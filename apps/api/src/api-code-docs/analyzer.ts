import { dirname, relative, resolve, sep } from "node:path"
import ts from "typescript"
import type { OpenApiDocument, OperationObject } from "../openapi-doc-quality.js"
import {
  operationSlug,
  type ApiCodeAnalysis,
  type ApiCodeAnalysisResult,
  type BranchFactor,
  type CallCategory,
  type CallSite,
  type DataAccess,
  type DataAccessKind,
  type FlowStep,
  type FlowStepKind,
  type FunctionReference,
  type MessageSpec,
  type RelatedTest,
  type SourceLocation
} from "./model.js"

type FunctionWithBody =
  | ts.FunctionDeclaration
  | ts.MethodDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration

type RouteNode = {
  method: string
  path: string
  slug: string
  routeCall: ts.CallExpression
  handler: FunctionWithBody
  routeLocation: SourceLocation
  handlerLocation: SourceLocation
  handlerName: string
}

type FunctionNode = {
  node: FunctionWithBody
  name: string
  depth: number
}

type TestNode = {
  name: string
  callback: FunctionWithBody
  location: SourceLocation
}

type AnalysisContext = {
  checker: ts.TypeChecker
  repoRoot: string
  sourceRoot: string
}

const HTTP_ROUTE_METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head", "all"])
const TEST_CALL_NAMES = new Set(["test", "it"])

export function createApiProgram(tsconfigPath: string): ts.Program {
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile)
  if (configFile.error) throw new Error(formatDiagnostics([configFile.error]))
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, dirname(tsconfigPath))
  if (parsed.errors.length > 0) throw new Error(formatDiagnostics(parsed.errors))
  return ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options })
}

export function analyzeApiCode(options: {
  api: OpenApiDocument
  repoRoot: string
  sourceRoot: string
  tsconfigPath: string
}): ApiCodeAnalysisResult {
  const repoRoot = resolve(options.repoRoot)
  const sourceRoot = resolve(options.sourceRoot)
  const program = createApiProgram(resolve(options.tsconfigPath))
  const checker = program.getTypeChecker()
  const context: AnalysisContext = { checker, repoRoot, sourceRoot }
  const sourceFiles = program.getSourceFiles().filter((sourceFile) => isProductionSource(sourceFile, sourceRoot))
  const testSourceFiles = program.getSourceFiles().filter((sourceFile) => isTestSource(sourceFile, sourceRoot))
  const discoveredRoutes = discoverRoutes(sourceFiles, context)
  const routeByKey = new Map(discoveredRoutes.map((route) => [operationKey(route.method, route.path), route]))

  for (const [path, pathItem] of Object.entries(options.api.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isHttpMethod(method)) continue
      const key = operationKey(method, path)
      if (!routeByKey.has(key)) {
        throw new Error(`OpenAPI operation ${method.toUpperCase()} ${path} に対応する route handler を TypeScript source から解決できません`)
      }
      void operation
    }
  }

  const tests = collectTests(testSourceFiles, context)
  const operations = discoveredRoutes
    .map((route) => analyzeRoute(route, options.api, tests, context))
    .sort((left, right) => left.path.localeCompare(right.path) || left.method.localeCompare(right.method))

  return {
    api: options.api,
    operations,
    sourceRoot: repoPath(sourceRoot, repoRoot),
    testFiles: testSourceFiles.map((sourceFile) => repoPath(sourceFile.fileName, repoRoot)).sort()
  }
}

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine
  })
}

function isProductionSource(sourceFile: ts.SourceFile, sourceRoot: string): boolean {
  const fileName = resolve(sourceFile.fileName)
  return isWithin(fileName, sourceRoot)
    && !sourceFile.isDeclarationFile
    && !fileName.endsWith(".test.ts")
    && !fileName.includes(`${sep}dist${sep}`)
}

function isTestSource(sourceFile: ts.SourceFile, sourceRoot: string): boolean {
  const fileName = resolve(sourceFile.fileName)
  return isWithin(fileName, sourceRoot) && fileName.endsWith(".test.ts")
}

function isWithin(fileName: string, root: string): boolean {
  const value = relative(root, fileName)
  return value === "" || (!value.startsWith("..") && !value.includes(`..${sep}`))
}

function repoPath(fileName: string, repoRoot: string): string {
  return relative(repoRoot, resolve(fileName)).split(sep).join("/")
}

function sourceLocation(node: ts.Node, repoRoot: string, symbol?: string): SourceLocation {
  const sourceFile = node.getSourceFile()
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
  return { path: repoPath(sourceFile.fileName, repoRoot), line: position.line + 1, ...(symbol ? { symbol } : {}) }
}

function operationKey(method: string, path: string): string {
  return `${method.toLowerCase()} ${path}`
}

function isHttpMethod(value: string): boolean {
  return ["get", "post", "put", "patch", "delete", "options", "head", "trace"].includes(value.toLowerCase())
}

function discoverRoutes(sourceFiles: ts.SourceFile[], context: AnalysisContext): RouteNode[] {
  const routes: RouteNode[] = []
  const seen = new Set<string>()
  for (const sourceFile of sourceFiles) {
    walk(sourceFile, (node) => {
      if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return
      if (!ts.isIdentifier(node.expression.expression) || node.expression.expression.text !== "app") return
      const registrationMethod = node.expression.name.text
      let method: string | undefined
      let path: string | undefined
      let handlerExpression: ts.Expression | undefined
      if (registrationMethod === "openapi") {
        const config = node.arguments[0] ? resolveObjectLiteral(node.arguments[0], context.checker) : undefined
        if (!config) return
        method = objectStringProperty(config, "method", context.checker)?.toLowerCase()
        path = objectStringProperty(config, "path", context.checker)
        handlerExpression = node.arguments[1]
      } else if (HTTP_ROUTE_METHODS.has(registrationMethod)) {
        method = registrationMethod
        path = node.arguments[0] ? literalString(resolveExpression(node.arguments[0], context.checker)) : undefined
        handlerExpression = node.arguments[1]
      } else {
        return
      }
      if (!method || !path || !handlerExpression) return
      const handler = resolveFunction(handlerExpression, context.checker)
      if (!handler) {
        throw new Error(`${sourceLocation(node, context.repoRoot).path}:${sourceLocation(node, context.repoRoot).line} ${method.toUpperCase()} ${path} の handler を解決できません`)
      }
      const key = operationKey(method, path)
      if (seen.has(key)) throw new Error(`重複 route を検出しました: ${method.toUpperCase()} ${path}`)
      seen.add(key)
      const handlerName = `${method.toUpperCase()} ${path} handler`
      routes.push({
        method,
        path,
        slug: operationSlug(method, path),
        routeCall: node,
        handler,
        routeLocation: sourceLocation(node, context.repoRoot, `${method.toUpperCase()} ${path}`),
        handlerLocation: sourceLocation(handler, context.repoRoot, handlerName),
        handlerName
      })
    })
  }
  return routes
}

function resolveExpression(expression: ts.Expression, checker: ts.TypeChecker, visited = new Set<ts.Node>()): ts.Expression {
  if (visited.has(expression)) return expression
  visited.add(expression)
  if (ts.isParenthesizedExpression(expression)
    || ts.isAsExpression(expression)
    || ts.isTypeAssertionExpression(expression)
    || ts.isNonNullExpression(expression)
    || ts.isSatisfiesExpression(expression)) {
    return resolveExpression(expression.expression, checker, visited)
  }
  if (ts.isIdentifier(expression)) {
    const symbol = resolvedSymbol(checker.getSymbolAtLocation(expression), checker)
    for (const declaration of symbol?.declarations ?? []) {
      if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
        return resolveExpression(declaration.initializer, checker, visited)
      }
    }
  }
  return expression
}

function resolveObjectLiteral(expression: ts.Expression, checker: ts.TypeChecker): ts.ObjectLiteralExpression | undefined {
  const resolved = resolveExpression(expression, checker)
  if (ts.isObjectLiteralExpression(resolved)) return resolved
  if (ts.isCallExpression(resolved) && resolved.arguments[0]) {
    const name = callName(resolved.expression)
    if (["looseRoute", "createRoute", "withAuthorizationMetadata"].includes(name)) {
      return resolveObjectLiteral(resolved.arguments[0], checker)
    }
  }
  return undefined
}

function objectStringProperty(object: ts.ObjectLiteralExpression, name: string, checker: ts.TypeChecker): string | undefined {
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property) || propertyName(property.name) !== name) continue
    return literalString(resolveExpression(property.initializer, checker))
  }
  return undefined
}

function objectPropertyExpression(object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  for (const property of object.properties) {
    if (ts.isPropertyAssignment(property) && propertyName(property.name) === name) return property.initializer
  }
  return undefined
}

function propertyName(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text
  return name.getText()
}

function literalString(expression: ts.Expression): string | undefined {
  if (ts.isStringLiteralLike(expression)) return expression.text
  return undefined
}

function resolvedSymbol(symbol: ts.Symbol | undefined, checker: ts.TypeChecker): ts.Symbol | undefined {
  if (!symbol) return undefined
  return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
}

function resolveFunction(expression: ts.Expression, checker: ts.TypeChecker): FunctionWithBody | undefined {
  const resolved = resolveExpression(expression, checker)
  if (isFunctionWithBody(resolved)) return resolved
  const target = ts.isPropertyAccessExpression(resolved) ? resolved.name : resolved
  const symbol = resolvedSymbol(checker.getSymbolAtLocation(target), checker)
  return functionFromDeclarations(symbol?.declarations ?? [], checker)
}

function functionFromDeclarations(declarations: readonly ts.Declaration[], checker: ts.TypeChecker): FunctionWithBody | undefined {
  for (const declaration of declarations) {
    if (isFunctionWithBody(declaration)) return declaration
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      const resolved = resolveExpression(declaration.initializer, checker)
      if (isFunctionWithBody(resolved)) return resolved
    }
  }
  return undefined
}

function isFunctionWithBody(node: ts.Node): node is FunctionWithBody {
  return (ts.isFunctionDeclaration(node)
    || ts.isMethodDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)
    || ts.isGetAccessorDeclaration(node)
    || ts.isSetAccessorDeclaration(node)) && Boolean(node.body)
}

function analyzeRoute(route: RouteNode, api: OpenApiDocument, tests: TestNode[], context: AnalysisContext): ApiCodeAnalysis {
  const operation = openApiOperation(api, route.method, route.path)
  const functionNodes: FunctionNode[] = []
  const calls: CallSite[] = []
  const messages: MessageSpec[] = []
  const visited = new Map<string, FunctionNode>()
  visitFunction({ node: route.handler, name: route.handlerName, depth: 0 }, functionNodes, calls, messages, visited, context)

  const functions = functionNodes.map<FunctionReference>(({ node, name, depth }) => ({
    name,
    summary: describeFunction(name),
    location: sourceLocation(node, context.repoRoot, name),
    depth
  }))
  const branches = functionNodes.flatMap(({ node, name, depth }) => collectBranches(node, name, depth, context))
  const flow = collectHandlerFlow(route.handler, context)
  const dataAccess = collectDataAccess(calls)
  const contractMessages = operation ? messagesFromContract(operation) : []
  const relatedTests = matchTests(route, calls, tests)
  const warnings: string[] = []
  if (!operation) warnings.push("この route は runtime OpenAPI contract に登録されていないため、IF は実装コードから分かる範囲だけを記載しています。")
  if (relatedTests.length === 0) warnings.push("route path または到達関数へ直接対応する test case を静的に特定できませんでした。")
  if (dataAccess.length === 0) warnings.push("handler から到達する store / external boundary call は検出されませんでした。")

  return {
    method: route.method,
    path: route.path,
    slug: route.slug,
    routeLocation: route.routeLocation,
    handlerLocation: route.handlerLocation,
    handlerName: route.handlerName,
    hasOpenApiContract: Boolean(operation),
    summary: operation?.summary ?? `${route.method.toUpperCase()} ${route.path} を処理する`,
    description: operation?.description ?? "実装コードから検出した route。runtime OpenAPI には登録されていません。",
    ...(operation ? { operation } : {}),
    functions,
    calls: uniqueBy(calls, (call) => `${call.location.path}:${call.location.line}:${call.expression}:${call.caller}`),
    flow,
    branches: uniqueBy(branches, (branch) => `${branch.location.path}:${branch.location.line}:${branch.kind}:${branch.condition}`),
    messages: uniqueBy([...contractMessages, ...messages], (message) => `${message.kind}:${message.status ?? ""}:${message.text}:${message.location?.path ?? ""}:${message.location?.line ?? ""}`),
    dataAccess,
    tests: relatedTests,
    warnings
  }
}

function openApiOperation(api: OpenApiDocument, method: string, path: string): OperationObject | undefined {
  if (!isHttpMethod(method)) return undefined
  return api.paths?.[path]?.[method]
}

function visitFunction(
  current: FunctionNode,
  functions: FunctionNode[],
  calls: CallSite[],
  messages: MessageSpec[],
  visited: Map<string, FunctionNode>,
  context: AnalysisContext
): void {
  const key = `${current.node.getSourceFile().fileName}:${current.node.pos}`
  const previous = visited.get(key)
  if (previous && previous.depth <= current.depth) return
  if (previous) {
    previous.depth = current.depth
    previous.name = current.name
  } else {
    visited.set(key, current)
    functions.push(current)
  }
  const body = current.node.body
  if (!body) return
  walkPostOrder(body, (node) => {
    if (ts.isCallExpression(node)) {
      const call = callSite(node, current, context)
      calls.push(call)
      const declaration = resolveCallDeclaration(node, context.checker)
      if (declaration && isProductionSource(declaration.getSourceFile(), context.sourceRoot)) {
        const name = declarationName(declaration)
        visitFunction({ node: declaration, name, depth: current.depth + 1 }, functions, calls, messages, visited, context)
      }
      messages.push(...messagesFromCall(node, current.name, context))
    }
    if (ts.isThrowStatement(node)) messages.push(...messagesFromThrow(node, current.name, context))
  })
}

function resolveCallDeclaration(call: ts.CallExpression, checker: ts.TypeChecker): FunctionWithBody | undefined {
  const signatureDeclaration = checker.getResolvedSignature(call)?.declaration
  if (signatureDeclaration && isFunctionWithBody(signatureDeclaration)) return signatureDeclaration
  const target = ts.isPropertyAccessExpression(call.expression) ? call.expression.name : call.expression
  const symbol = resolvedSymbol(checker.getSymbolAtLocation(target), checker)
  return functionFromDeclarations(symbol?.declarations ?? [], checker)
}

function declarationName(node: FunctionWithBody): string {
  if (ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
    const method = node.name ? propertyName(node.name) : "anonymous"
    const parent = node.parent
    if (ts.isClassDeclaration(parent) && parent.name) return `${parent.name.text}.${method}`
    return method
  }
  if (ts.isFunctionDeclaration(node) && node.name) return node.name.text
  if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
    return node.parent.name.text
  }
  return "anonymous function"
}

function callSite(call: ts.CallExpression, current: FunctionNode, context: AnalysisContext): CallSite {
  const callee = call.expression.getText(call.getSourceFile())
  const args = call.arguments.map((argument) => compactExpression(argument.getText(call.getSourceFile())))
  const category = categorizeCall(callee, args)
  const declaration = resolveCallDeclaration(call, context.checker)
  return {
    caller: current.name,
    callee,
    expression: compactExpression(call.getText(call.getSourceFile())),
    arguments: args,
    category,
    description: describeCall(callee, args, category),
    location: sourceLocation(call, context.repoRoot, current.name),
    ...(declaration && isProductionSource(declaration.getSourceFile(), context.sourceRoot)
      ? { declaration: sourceLocation(declaration, context.repoRoot, declarationName(declaration)) }
      : {}),
    depth: current.depth
  }
}

function categorizeCall(callee: string, args: string[]): CallCategory {
  const lower = callee.toLowerCase()
  if (lower === "c.get" && args[0]?.includes("user")) return "authorization"
  if (/permission|authoriz|authmiddleware|getpermissionsforgroups/.test(lower)) return "authorization"
  if (/valid(json|param|request)|safeparse|\.parse$|c\.req\.(param|query|header)/.test(lower)) return "validation"
  if (/c\.json$|c\.body$|c\.text$|writes?se$|stream/.test(lower)) return "response"
  if (/store|repository|ledger|objectstore|vectorstore/.test(lower)) return "data"
  if (/bedrock|textmodel|provider|codebuild|stepfunctions|sfn|userdirectory|client\./.test(lower)) return "external"
  if (/^service\.|^this\.|memoragservice/.test(lower)) return "service"
  return "utility"
}

function compactExpression(value: string, maxLength = 220): string {
  const compact = value.replace(/\s+/g, " ").trim()
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 1)}…`
}

function callName(expression: ts.Expression): string {
  if (ts.isIdentifier(expression)) return expression.text
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text
  return expression.getText()
}

function describeCall(callee: string, args: string[], category: CallCategory): string {
  const member = callee.split(".").at(-1) ?? callee
  if (callee === "c.get" && args[0]?.includes("user")) return "認証済み利用者を request context から取得する。"
  if (/requirePermission$/i.test(callee)) return `${permissionLabel(args[1] ?? args[0])} permission を必須条件として確認する。`
  if (/hasPermission$/i.test(callee)) return `${permissionLabel(args[1])} permission の保有有無を判定する。`
  if (/validJson$/i.test(callee)) return "schema 検証済みの JSON request body を取得する。"
  if (/validParam$/i.test(callee) || /c\.req\.param$/i.test(callee)) return "schema 検証済みの path parameter を取得する。"
  if (/c\.req\.header$/i.test(callee)) return `${args[0] ?? "指定"} header を取得する。`
  if (/c\.json$/i.test(callee)) return `${args[1] ? `HTTP ${args[1]} で` : ""} JSON response を返す。`
  if (/writes?se$/i.test(callee)) return "SSE event を client へ送信する。"
  const words = humanizeIdentifier(member)
  if (category === "data") return `${humanizeTarget(callee)} に対して ${words} を実行する。`
  if (category === "external") return `${humanizeTarget(callee)} へ ${words} を実行する。`
  if (category === "service") return `service の ${words} 処理を呼び出す。`
  if (category === "authorization") return `${words} により認証・認可条件を確認する。`
  if (category === "validation") return `${words} により入力を検証する。`
  return `${words} を実行する。`
}

function permissionLabel(value: string | undefined): string {
  return !value || value === "permission" ? "指定された" : value
}

function humanizeTarget(callee: string): string {
  const parts = callee.split(".")
  const receiver = parts.slice(0, -1).join(".") || callee
  return `\`${receiver}\``
}

function humanizeIdentifier(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
}

function describeFunction(name: string): string {
  if (name.endsWith(" handler")) return `${name.replace(/ handler$/, "")} の request を受け、検証・認可・service 呼び出し・HTTP 応答を調整する。`
  const member = name.split(".").at(-1) ?? name
  return `${humanizeIdentifier(member)} の実装処理を担当する。`
}

function collectHandlerFlow(handler: FunctionWithBody, context: AnalysisContext): FlowStep[] {
  const steps: FlowStep[] = []
  let order = 0
  const add = (node: ts.Node, depth: number, kind: FlowStepKind, description: string, evidence: string) => {
    steps.push({ order: ++order, depth, kind, description, evidence: compactExpression(evidence), location: sourceLocation(node, context.repoRoot) })
  }
  const visitStatement = (statement: ts.Statement, depth: number): void => {
    if (ts.isBlock(statement)) {
      statement.statements.forEach((item) => visitStatement(item, depth))
      return
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const initializer = declaration.initializer
        if (initializer && ts.isCallExpression(unwrapAwait(initializer))) {
          const call = unwrapAwait(initializer) as ts.CallExpression
          const category = categorizeCall(call.expression.getText(), call.arguments.map((arg) => compactExpression(arg.getText())))
          add(statement, depth, flowKindForCategory(category), describeCall(call.expression.getText(), call.arguments.map((arg) => compactExpression(arg.getText())), category), declaration.getText())
        } else {
          add(statement, depth, "state", `${compactExpression(declaration.name.getText())} を計算して後続処理へ保持する。`, declaration.getText())
        }
      }
      return
    }
    if (ts.isIfStatement(statement)) {
      add(statement.expression, depth, "branch", `分岐: ${describeCondition(statement.expression)}。`, statement.expression.getText())
      visitNestedStatement(statement.thenStatement, depth + 1, visitStatement)
      if (statement.elseStatement) {
        add(statement.elseStatement, depth, "branch", "上記条件が成立しない場合の処理へ進む。", "else")
        visitNestedStatement(statement.elseStatement, depth + 1, visitStatement)
      }
      return
    }
    if (ts.isTryStatement(statement)) {
      add(statement, depth, "state", "例外を監視しながら主要処理を実行する。", "try")
      visitNestedStatement(statement.tryBlock, depth + 1, visitStatement)
      if (statement.catchClause) {
        add(statement.catchClause, depth, "exception", `例外を捕捉し、種類と内容に応じて HTTP 応答へ変換する。`, statement.catchClause.getText())
        visitNestedStatement(statement.catchClause.block, depth + 1, visitStatement)
      }
      if (statement.finallyBlock) visitNestedStatement(statement.finallyBlock, depth + 1, visitStatement)
      return
    }
    if (ts.isReturnStatement(statement)) {
      const expression = statement.expression ? unwrapAwait(statement.expression) : undefined
      if (expression && ts.isCallExpression(expression)) {
        const category = categorizeCall(expression.expression.getText(), expression.arguments.map((arg) => compactExpression(arg.getText())))
        add(statement, depth, category === "response" || /c\.json$/.test(expression.expression.getText()) ? "response" : flowKindForCategory(category), describeReturnCall(expression, category), statement.getText())
      } else {
        add(statement, depth, "response", "現在の処理結果を呼び出し元へ返す。", statement.getText())
      }
      return
    }
    if (ts.isThrowStatement(statement)) {
      add(statement, depth, "exception", describeThrow(statement.expression), statement.getText())
      return
    }
    if (ts.isForStatement(statement) || ts.isForOfStatement(statement) || ts.isForInStatement(statement) || ts.isWhileStatement(statement) || ts.isDoStatement(statement)) {
      const expression = loopExpression(statement)
      add(statement, depth, "loop", `反復: ${expression ? describeCondition(expression) : "対象要素を順に処理する"}。`, expression?.getText() ?? statement.getText())
      visitNestedStatement(statement.statement, depth + 1, visitStatement)
      return
    }
    if (ts.isSwitchStatement(statement)) {
      add(statement.expression, depth, "branch", `${compactExpression(statement.expression.getText())} の値ごとに処理を分岐する。`, statement.expression.getText())
      for (const clause of statement.caseBlock.clauses) clause.statements.forEach((item) => visitStatement(item, depth + 1))
      return
    }
    if (ts.isExpressionStatement(statement)) {
      const expression = unwrapAwait(statement.expression)
      if (ts.isCallExpression(expression)) {
        const args = expression.arguments.map((arg) => compactExpression(arg.getText()))
        const category = categorizeCall(expression.expression.getText(), args)
        add(statement, depth, flowKindForCategory(category), describeCall(expression.expression.getText(), args, category), statement.getText())
      } else {
        add(statement, depth, "state", "処理状態を更新する。", statement.getText())
      }
    }
  }
  const body = handler.body
  if (body && ts.isBlock(body)) body.statements.forEach((statement) => visitStatement(statement, 0))
  else if (body) add(body, 0, "response", "式の評価結果を応答として返す。", body.getText())
  return steps
}

function visitNestedStatement(statement: ts.Statement, depth: number, visit: (statement: ts.Statement, depth: number) => void): void {
  if (ts.isBlock(statement)) statement.statements.forEach((item) => visit(item, depth))
  else visit(statement, depth)
}

function flowKindForCategory(category: CallCategory): FlowStepKind {
  if (category === "authorization") return "authorization"
  if (category === "validation") return "validation"
  if (category === "response") return "response"
  return "call"
}

function unwrapAwait(expression: ts.Expression): ts.Expression {
  return ts.isAwaitExpression(expression) ? expression.expression : expression
}

function describeReturnCall(call: ts.CallExpression, category: CallCategory): string {
  if (/c\.json$/.test(call.expression.getText())) {
    const status = call.arguments[1]?.getText() ?? "規定 status"
    const first = call.arguments[0]
    if (first && ts.isAwaitExpression(first) && ts.isCallExpression(first.expression)) {
      return `${describeCall(first.expression.expression.getText(), first.expression.arguments.map((arg) => compactExpression(arg.getText())), categorizeCall(first.expression.expression.getText(), []))} その結果を HTTP ${status} の JSON response として返す。`
    }
    return `処理結果を HTTP ${status} の JSON response として返す。`
  }
  return `${describeCall(call.expression.getText(), call.arguments.map((arg) => compactExpression(arg.getText())), category)} その結果を呼び出し元へ返す。`
}

function describeThrow(expression: ts.Expression): string {
  if (ts.isNewExpression(expression)) {
    const name = expression.expression.getText()
    const status = expression.arguments?.[0]?.getText()
    return `${name}${status ? ` (${status})` : ""} を送出して通常処理を中断する。`
  }
  return `${compactExpression(expression.getText())} を例外として送出する。`
}

function loopExpression(statement: ts.IterationStatement): ts.Expression | undefined {
  if (ts.isWhileStatement(statement) || ts.isDoStatement(statement)) return statement.expression
  if (ts.isForStatement(statement)) return statement.condition
  if (ts.isForOfStatement(statement) || ts.isForInStatement(statement)) return statement.expression
  return undefined
}

function collectBranches(node: FunctionWithBody, functionName: string, depth: number, context: AnalysisContext): BranchFactor[] {
  const branches: BranchFactor[] = []
  if (!node.body) return branches
  walk(node.body, (child) => {
    if (ts.isIfStatement(child)) {
      branches.push({ kind: "if", functionName, depth, condition: compactExpression(child.expression.getText()), description: describeCondition(child.expression), location: sourceLocation(child.expression, context.repoRoot, functionName) })
    } else if (ts.isConditionalExpression(child)) {
      branches.push({ kind: "conditional", functionName, depth, condition: compactExpression(child.condition.getText()), description: describeCondition(child.condition), location: sourceLocation(child.condition, context.repoRoot, functionName) })
    } else if (ts.isCatchClause(child)) {
      branches.push({ kind: "catch", functionName, depth, condition: child.variableDeclaration?.name.getText() ?? "error", description: "例外が発生した場合に catch 処理へ移る", location: sourceLocation(child, context.repoRoot, functionName) })
    } else if (ts.isSwitchStatement(child)) {
      branches.push({ kind: "switch", functionName, depth, condition: compactExpression(child.expression.getText()), description: `${humanizeIdentifier(child.expression.getText())} の値ごとに処理を選択する`, location: sourceLocation(child.expression, context.repoRoot, functionName) })
    } else if (ts.isForStatement(child) || ts.isForOfStatement(child) || ts.isForInStatement(child) || ts.isWhileStatement(child) || ts.isDoStatement(child)) {
      const expression = loopExpression(child)
      branches.push({ kind: "loop", functionName, depth, condition: compactExpression(expression?.getText() ?? child.getText()), description: expression ? describeCondition(expression) : "対象要素を順に処理する", location: sourceLocation(child, context.repoRoot, functionName) })
    }
  })
  return branches
}

function describeCondition(expression: ts.Expression, negated = false): string {
  if (ts.isParenthesizedExpression(expression)) return describeCondition(expression.expression, negated)
  if (ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.ExclamationToken) {
    return describeCondition(expression.operand, !negated)
  }
  if (ts.isBinaryExpression(expression)) {
    const operator = expression.operatorToken.kind
    if (operator === ts.SyntaxKind.AmpersandAmpersandToken || operator === ts.SyntaxKind.BarBarToken) {
      const conjunction = operator === ts.SyntaxKind.AmpersandAmpersandToken ? "かつ" : "または"
      const value = `${describeCondition(expression.left)}、${conjunction} ${describeCondition(expression.right)}`
      return negated ? `「${value}」ではない` : value
    }
    const left = compactExpression(expression.left.getText())
    const right = compactExpression(expression.right.getText())
    const operatorText = conditionOperator(operator)
    const value = `\`${left}\` が \`${right}\` ${operatorText}`
    return negated ? `${value}ではない` : value
  }
  if (ts.isCallExpression(expression)) {
    const callee = expression.expression.getText()
    const args = expression.arguments.map((argument) => compactExpression(argument.getText()))
    let value: string
    if (/hasPermission$/.test(callee)) value = `利用者が ${permissionLabel(args[1])} permission を持つ`
    else if (/requirePermission$/.test(callee)) value = `${permissionLabel(args[1])} permission の確認に成功する`
    else if (/\.includes$/.test(callee)) value = `\`${callee.replace(/\.includes$/, "")}\` が ${args[0] ?? "指定値"} を含む`
    else value = `${humanizeIdentifier(callee.split(".").at(-1) ?? callee)} の判定結果が真である`
    return negated ? value.replace(/である$/, "ではない").replace(/持つ$/, "持たない").replace(/含む$/, "含まない") : value
  }
  const text = compactExpression(expression.getText())
  if (ts.isIdentifier(expression) || ts.isPropertyAccessExpression(expression)) {
    return negated ? `\`${text}\` が存在しない、または偽である` : `\`${text}\` が存在し、真である`
  }
  return negated ? `条件式 \`${text}\` が成立しない` : `条件式 \`${text}\` が成立する`
}

function conditionOperator(kind: ts.SyntaxKind): string {
  const values = new Map<ts.SyntaxKind, string>([
    [ts.SyntaxKind.EqualsEqualsEqualsToken, "と等しい"],
    [ts.SyntaxKind.EqualsEqualsToken, "と等しい"],
    [ts.SyntaxKind.ExclamationEqualsEqualsToken, "と異なる"],
    [ts.SyntaxKind.ExclamationEqualsToken, "と異なる"],
    [ts.SyntaxKind.GreaterThanToken, "より大きい"],
    [ts.SyntaxKind.GreaterThanEqualsToken, "以上である"],
    [ts.SyntaxKind.LessThanToken, "より小さい"],
    [ts.SyntaxKind.LessThanEqualsToken, "以下である"],
    [ts.SyntaxKind.InKeyword, "に含まれる"],
    [ts.SyntaxKind.InstanceOfKeyword, "の instance である"]
  ])
  return values.get(kind) ?? "の条件を満たす"
}

function messagesFromContract(operation: OperationObject): MessageSpec[] {
  const messages: MessageSpec[] = []
  for (const [status, response] of Object.entries(operation.responses ?? {})) {
    if (!response || typeof response !== "object" || !("description" in response)) continue
    const description = response.description
    if (typeof description !== "string" || !description.trim()) continue
    messages.push({ kind: "contract", text: description.trim(), status, trigger: `OpenAPI で宣言された HTTP ${status} response` })
  }
  return messages
}

function messagesFromCall(call: ts.CallExpression, functionName: string, context: AnalysisContext): MessageSpec[] {
  const callee = call.expression.getText()
  const location = sourceLocation(call, context.repoRoot, functionName)
  const trigger = enclosingTrigger(call)
  if (/c\.json$/.test(callee)) {
    const text = call.arguments[0] ? objectMessage(call.arguments[0]) : undefined
    if (!text) return []
    return [{ kind: "http-response", text, status: call.arguments[1]?.getText() ?? "default", trigger, location }]
  }
  if (/writes?se$/i.test(callee)) {
    const event = call.arguments[0] ? objectLiteralValue(call.arguments[0], "event") : undefined
    const message = call.arguments[0] ? findNestedMessage(call.arguments[0]) : undefined
    if (!event && !message) return []
    return [{ kind: "event", text: message ?? `SSE event: ${event}`, status: event, trigger, location }]
  }
  if (/\.(warn|warning|error|log)$/.test(callee) || /^log[A-Z]/.test(callName(call.expression))) {
    const text = call.arguments.map(literalText).find((value): value is string => Boolean(value))
    if (!text) return []
    return [{ kind: "log", text, trigger, location }]
  }
  if (ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === "json") return []
  return []
}

function messagesFromThrow(statement: ts.ThrowStatement, functionName: string, context: AnalysisContext): MessageSpec[] {
  const expression = statement.expression
  if (!expression || !ts.isNewExpression(expression)) return []
  const name = expression.expression.getText()
  let text = expression.arguments?.map(literalText).find((value): value is string => Boolean(value))
  let status: string | undefined
  if (name === "HTTPException") {
    status = expression.arguments?.[0]?.getText()
    const options = expression.arguments?.[1]
    text = options ? objectLiteralValue(options, "message") ?? text : text
  }
  if (!text) return []
  return [{ kind: "exception", text, ...(status ? { status } : {}), trigger: enclosingTrigger(statement), location: sourceLocation(statement, context.repoRoot, functionName) }]
}

function objectMessage(expression: ts.Expression): string | undefined {
  return objectLiteralValue(expression, "error") ?? objectLiteralValue(expression, "message")
}

function objectLiteralValue(expression: ts.Expression, property: string): string | undefined {
  const value = unwrapAwait(expression)
  if (!ts.isObjectLiteralExpression(value)) return undefined
  const initializer = objectPropertyExpression(value, property)
  return initializer ? literalText(initializer) : undefined
}

function findNestedMessage(expression: ts.Expression): string | undefined {
  let result: string | undefined
  walk(expression, (node) => {
    if (result || !ts.isPropertyAssignment(node) || propertyName(node.name) !== "message") return
    result = literalText(node.initializer)
  })
  return result
}

function literalText(expression: ts.Expression): string | undefined {
  if (ts.isStringLiteralLike(expression)) return expression.text
  if (ts.isTemplateExpression(expression)) return compactExpression(expression.getText())
  return undefined
}

function enclosingTrigger(node: ts.Node): string {
  let current: ts.Node | undefined = node.parent
  while (current) {
    if (ts.isIfStatement(current)) return describeCondition(current.expression)
    if (ts.isCatchClause(current)) return "例外を捕捉した場合"
    if (isFunctionWithBody(current)) break
    current = current.parent
  }
  return "当該処理へ到達した場合"
}

function collectDataAccess(calls: CallSite[]): DataAccess[] {
  const rows = calls
    .filter((call) => call.category === "data" || call.category === "external")
    .map<DataAccess>((call) => {
      const parts = call.callee.split(".")
      const operation = parts.at(-1) ?? call.callee
      const target = parts.slice(0, -1).join(".") || call.callee
      return {
        kind: dataAccessKind(operation),
        boundary: call.category === "data" ? "store" : "external",
        target,
        operation,
        purpose: call.description,
        expression: call.expression,
        location: call.location,
        caller: call.caller
      }
    })
  return uniqueBy(rows, (row) => `${row.location.path}:${row.location.line}:${row.expression}:${row.caller}`)
}

function dataAccessKind(operation: string): DataAccessKind {
  const normalized = operation.toLowerCase()
  if (/^(get|read|load|list|find|query|scan|search|head|exists|fetch)/.test(normalized)) return "read"
  if (/^(create|put|save|append|add|insert|upload|index|start)/.test(normalized)) return "create"
  if (/^(delete|remove|clear)/.test(normalized)) return "delete"
  if (/^(update|set|mark|move|rename|share|suspend|resolve|answer|publish|cancel)/.test(normalized)) return "update"
  return "execute"
}

function collectTests(sourceFiles: ts.SourceFile[], context: AnalysisContext): TestNode[] {
  const tests: TestNode[] = []
  for (const sourceFile of sourceFiles) {
    walk(sourceFile, (node) => {
      if (!ts.isCallExpression(node) || !TEST_CALL_NAMES.has(callName(node.expression))) return
      const nameNode = node.arguments[0]
      const callbackNode = node.arguments[1]
      if (!nameNode || !callbackNode) return
      const name = literalText(nameNode)
      const callback = resolveFunction(callbackNode, context.checker)
      if (!name || !callback) return
      tests.push({ name, callback, location: sourceLocation(node, context.repoRoot, name) })
    })
  }
  return tests
}

function matchTests(route: RouteNode, calls: CallSite[], tests: TestNode[]): RelatedTest[] {
  const functionNames = calls
    .filter((call) => call.depth === 0 && ["service", "data", "external"].includes(call.category))
    .map((call) => call.callee.split(".").at(-1) ?? call.callee)
    .filter((name) => name.length >= 5 && !name.endsWith("handler"))
  const matches: RelatedTest[] = []
  for (const test of tests) {
    const requests = requestReferences(test.callback)
    const routeMatch = requests.some((request) => pathMatches(route.path, request.path)
      && (route.method === "all" || !request.method || request.method === route.method.toLowerCase()))
      || titleMatchesRoute(test.name, route)
    if (routeMatch) {
      matches.push({ name: test.name, relation: "route", location: test.location })
      continue
    }
    const text = test.callback.getText()
    if (functionNames.some((name) => new RegExp(`(?:\\.|\\b)${escapeRegExp(name)}\\s*\\(`).test(text))) {
      matches.push({ name: test.name, relation: "implementation", location: test.location })
    }
  }
  return uniqueBy(matches, (test) => `${test.location.path}:${test.location.line}:${test.name}:${test.relation}`)
    .sort((left, right) => left.location.path.localeCompare(right.location.path) || left.location.line - right.location.line)
}

function requestReferences(callback: FunctionWithBody): Array<{ path: string; method?: string }> {
  const references: Array<{ path: string; method?: string }> = []
  if (!callback.body) return references
  walk(callback.body, (node) => {
    if (!ts.isCallExpression(node)) return
    const name = callName(node.expression).toLowerCase()
    if (!name.includes("request") && name !== "fetch") return
    const path = node.arguments[0] ? literalText(node.arguments[0]) : undefined
    if (!path || !path.startsWith("/")) return
    const init = node.arguments[1]
    let method: string | undefined
    if (init && ts.isObjectLiteralExpression(init)) method = objectLiteralValue(init, "method")?.toLowerCase()
    if (!init) method = "get"
    references.push({ path: path.split("?")[0] ?? path, ...(method ? { method } : {}) })
  })
  return references
}

function titleMatchesRoute(title: string, route: RouteNode): boolean {
  const normalizedTitle = title.toLowerCase()
  if (!normalizedTitle.includes(route.method.toLowerCase()) && route.method !== "all") return false
  const staticPath = route.path.replace(/\{[^}]+\}/g, "").replace(/\*+/g, "")
  return staticPath.length > 1 && normalizedTitle.includes(staticPath.toLowerCase())
}

function pathMatches(pattern: string, value: string): boolean {
  const source = escapeRegExp(pattern)
    .replace(/\\\{[^}]+\\\}/g, "[^/?]+")
    .replace(/\\\*/g, ".*")
  return new RegExp(`^${source}/?$`).test(value)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function uniqueBy<T>(values: T[], key: (value: T) => string): T[] {
  const result: T[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const itemKey = key(value)
    if (seen.has(itemKey)) continue
    seen.add(itemKey)
    result.push(value)
  }
  return result
}

function walk(node: ts.Node, visitor: (node: ts.Node) => void): void {
  visitor(node)
  node.forEachChild((child) => walk(child, visitor))
}

function walkPostOrder(node: ts.Node, visitor: (node: ts.Node) => void): void {
  node.forEachChild((child) => walkPostOrder(child, visitor))
  visitor(node)
}
