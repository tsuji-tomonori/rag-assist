#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import * as ts from "typescript"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const webSrcDir = path.join(repoRoot, "apps/web/src")
const outputDir = path.join(repoRoot, "docs/generated")
const outputFiles = {
  screens: path.join(outputDir, "web-screens.md"),
  features: path.join(outputDir, "web-features.md"),
  components: path.join(outputDir, "web-components.md"),
  json: path.join(outputDir, "web-ui-inventory.json")
}
const args = new Set(process.argv.slice(2))
const checkOnly = args.has("--check")

const viewLabels = {
  chat: "チャット",
  assignee: "担当者対応",
  history: "履歴",
  favorites: "お気に入り",
  benchmark: "性能テスト",
  admin: "管理者設定",
  documents: "ドキュメント",
  profile: "個人設定"
}

const featureLabels = {
  admin: "管理",
  app: "アプリケーション枠",
  auth: "認証",
  benchmark: "性能テスト",
  chat: "チャット",
  debug: "デバッグ",
  documents: "ドキュメント",
  history: "履歴",
  questions: "担当者対応",
  shared: "共通"
}

const viewFeatures = {
  admin: "admin",
  assignee: "questions",
  benchmark: "benchmark",
  chat: "chat",
  documents: "documents",
  favorites: "history",
  history: "history",
  profile: "app"
}

const intrinsicUiElements = new Set(["button", "a", "form", "input", "select", "textarea", "label", "option"])
const handlerAttribute = /^on[A-Z]/

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return walkFiles(fullPath)
    if (!entry.isFile()) return []
    if (!fullPath.endsWith(".tsx") && !fullPath.endsWith(".ts")) return []
    if (/\.(test|spec)\.(tsx|ts)$/.test(fullPath)) return []
    if (fullPath.includes(`${path.sep}test${path.sep}`)) return []
    return [fullPath]
  })
}

function toRepoPath(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/")
}

function readSourceFile(filePath) {
  return ts.createSourceFile(filePath, fs.readFileSync(filePath, "utf8"), ts.ScriptTarget.Latest, true, filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}

function nodeText(node) {
  return node.getText().replace(/\s+/g, " ").trim()
}

function truncate(value, length = 120) {
  if (value.length <= length) return value
  return `${value.slice(0, length - 1)}…`
}

function getJsxTagName(tagName) {
  if (ts.isIdentifier(tagName)) return tagName.text
  if (ts.isPropertyAccessExpression(tagName)) return nodeText(tagName)
  return nodeText(tagName)
}

function getAttribute(attrs, name) {
  const attr = attrs.properties.find((item) => ts.isJsxAttribute(item) && item.name.text === name)
  if (!attr || !ts.isJsxAttribute(attr) || !attr.initializer) return null
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text
  if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
    const expression = attr.initializer.expression
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text
    return nodeText(expression)
  }
  return null
}

function getAttributes(attrs) {
  return attrs.properties
    .filter(ts.isJsxAttribute)
    .map((attr) => {
      const initializer = attr.initializer
      let value = "true"
      if (initializer && ts.isStringLiteral(initializer)) value = initializer.text
      if (initializer && ts.isJsxExpression(initializer) && initializer.expression) value = truncate(nodeText(initializer.expression), 90)
      return { name: String(attr.name.text), value }
    })
}

function extractTextFromChildren(children) {
  const values = []
  for (const child of children) {
    if (ts.isJsxText(child)) {
      const text = child.getText().replace(/\s+/g, " ").trim()
      if (text) values.push(text)
    }
    if (ts.isJsxExpression(child) && child.expression) {
      if (ts.isStringLiteral(child.expression) || ts.isNoSubstitutionTemplateLiteral(child.expression)) values.push(child.expression.text)
    }
    if (ts.isJsxElement(child)) {
      values.push(...extractTextFromChildren(child.children))
    }
  }
  return values
}

function getElementLabel(node) {
  const attrs = ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes
  const attrLabel = getAttribute(attrs, "aria-label") ?? getAttribute(attrs, "title") ?? getAttribute(attrs, "placeholder") ?? getAttribute(attrs, "value")
  if (attrLabel) return truncate(attrLabel, 80)
  if (ts.isJsxElement(node)) {
    const text = extractTextFromChildren(node.children).join(" / ")
    if (text) return truncate(text, 80)
  }
  return "未推定"
}

function findNearestFunctionName(node) {
  let current = node
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) return current.name.text
    if (ts.isMethodDeclaration(current) && current.name) return nodeText(current.name)
    current = current.parent
  }
  return "未推定"
}

function getFeature(filePath) {
  const repoPath = toRepoPath(filePath)
  const parts = repoPath.split("/")
  const featureIndex = parts.indexOf("features")
  if (featureIndex >= 0 && parts[featureIndex + 1]) return parts[featureIndex + 1]
  if (parts.includes("shared")) return "shared"
  if (parts.includes("app")) return "app"
  return "app"
}

function isExported(node) {
  return Boolean(ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
}

function collectDeclaredExports(sourceFile) {
  const exports = []
  sourceFile.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name && isExported(node)) exports.push(node.name.text)
    if (ts.isVariableStatement(node) && isExported(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) exports.push(declaration.name.text)
      }
    }
  })
  return exports
}

function collectJsxUsages(sourceFile) {
  const usages = new Set()
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) usages.add(getJsxTagName(node.tagName))
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return [...usages].sort()
}

function collectAppViews(sourceFile) {
  const views = []
  function visit(node) {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === "AppView" && ts.isUnionTypeNode(node.type)) {
      for (const type of node.type.types) {
        if (ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal)) views.push(type.literal.text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return views
}

function getStringLiteralFromExpression(expression) {
  if (!expression) return null
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text
  return null
}

function findViewLiteral(expression) {
  if (!expression) return null
  if (ts.isBinaryExpression(expression)) {
    const left = expression.left
    const right = expression.right
    if (nodeText(left) === "activeView") return getStringLiteralFromExpression(right)
    if (nodeText(right) === "activeView") return getStringLiteralFromExpression(left)
    return findViewLiteral(left) ?? findViewLiteral(right)
  }
  if (ts.isParenthesizedExpression(expression)) return findViewLiteral(expression.expression)
  return null
}

function collectIdentifiers(expression) {
  const ids = new Set()
  if (!expression) return ids
  function visit(node) {
    if (ts.isIdentifier(node) && node.text !== "activeView") ids.add(node.text)
    ts.forEachChild(node, visit)
  }
  visit(expression)
  return ids
}

function findReturnedJsxName(statement) {
  if (ts.isReturnStatement(statement) && statement.expression) {
    const expression = statement.expression
    if (ts.isJsxElement(expression)) return getJsxTagName(expression.openingElement.tagName)
    if (ts.isJsxSelfClosingElement(expression)) return getJsxTagName(expression.tagName)
  }
  if (ts.isBlock(statement)) {
    for (const child of statement.statements) {
      const result = findReturnedJsxName(child)
      if (result) return result
    }
  }
  return null
}

function collectScreenRoutes(sourceFile, appViews, navLabels) {
  const routeMap = new Map()
  function visit(node) {
    if (ts.isIfStatement(node)) {
      const view = findViewLiteral(node.expression)
      const component = findReturnedJsxName(node.thenStatement)
      if (view && component) {
        const permissions = [...collectIdentifiers(node.expression)].filter((id) => id.startsWith("can")).sort()
        routeMap.set(view, { view, component, permissions, certainty: "confirmed" })
      }
    }
    if (ts.isReturnStatement(node) && node.expression) {
      const expression = node.expression
      const tagName = ts.isJsxElement(expression)
        ? getJsxTagName(expression.openingElement.tagName)
        : ts.isJsxSelfClosingElement(expression)
          ? getJsxTagName(expression.tagName)
          : null
      if (tagName === "HistoryWorkspace") {
        for (const view of ["history", "favorites"]) {
          routeMap.set(view, { view, component: "HistoryWorkspace", permissions: [], certainty: "inferred" })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return appViews.map((view) => ({
    view,
    label: navLabels.get(view) ?? viewLabels[view] ?? view,
    routePath: "/",
    routeKind: "client-state",
    screenComponent: routeMap.get(view)?.component ?? "未推定",
    permissions: routeMap.get(view)?.permissions ?? [],
    certainty: routeMap.get(view)?.certainty ?? "unknown"
  }))
}

function collectNavLabels(sourceFile) {
  const labels = new Map()
  function visit(node) {
    if (ts.isJsxElement(node) && getJsxTagName(node.openingElement.tagName) === "button") {
      const onClick = getAttribute(node.openingElement.attributes, "onClick")
      const match = onClick?.match(/onChangeView\("([^"]+)"\)/)
      if (match?.[1]) labels.set(match[1], getElementLabel(node))
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return labels
}

function collectInteractions(sourceFile, filePath) {
  const interactions = []
  function visit(node) {
    const jsxNode = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null
    if (!jsxNode) {
      ts.forEachChild(node, visit)
      return
    }
    const tagName = getJsxTagName(jsxNode.tagName)
    const attrs = getAttributes(jsxNode.attributes)
    const handlers = attrs.filter((attr) => handlerAttribute.test(attr.name))
    const isIntrinsic = intrinsicUiElements.has(tagName)
    const isCustomAction = /^[A-Z]/.test(tagName) && (handlers.length > 0 || /(Button|Link|Form|Composer|Nav|Panel)$/.test(tagName))
    if (isIntrinsic || isCustomAction) {
      const line = sourceFile.getLineAndCharacterOfPosition(jsxNode.getStart()).line + 1
      interactions.push({
        id: `${toRepoPath(filePath)}:${line}:${tagName}`,
        file: toRepoPath(filePath),
        line,
        feature: getFeature(filePath),
        component: findNearestFunctionName(node),
        element: tagName,
        label: getElementLabel(node),
        handlers,
        attributes: attrs.filter((attr) => ["type", "href", "name", "role", "aria-label", "title", "placeholder", "disabled"].includes(attr.name)),
        certainty: getElementLabel(node) === "未推定" ? "unknown" : "confirmed"
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return interactions
}

function buildInventory() {
  const files = walkFiles(webSrcDir).sort()
  const sourceFiles = new Map(files.map((filePath) => [filePath, readSourceFile(filePath)]))
  const appTypesFile = sourceFiles.get(path.join(webSrcDir, "app/types.ts"))
  const appRoutesFile = sourceFiles.get(path.join(webSrcDir, "app/AppRoutes.tsx"))
  const railNavFile = sourceFiles.get(path.join(webSrcDir, "app/components/RailNav.tsx"))
  const appViews = appTypesFile ? collectAppViews(appTypesFile) : []
  const navLabels = railNavFile ? collectNavLabels(railNavFile) : new Map()
  const screens = appRoutesFile ? collectScreenRoutes(appRoutesFile, appViews, navLabels) : []
  const components = []
  const interactions = []

  for (const [filePath, sourceFile] of sourceFiles) {
    const exports = collectDeclaredExports(sourceFile)
    const jsxUsages = collectJsxUsages(sourceFile)
    if (filePath.endsWith(".tsx") && (exports.length > 0 || jsxUsages.length > 0)) {
      components.push({
        file: toRepoPath(filePath),
        feature: getFeature(filePath),
        exports,
        jsxUsages,
        certainty: exports.length > 0 ? "confirmed" : "inferred"
      })
    }
    interactions.push(...collectInteractions(sourceFile, filePath))
  }

  const features = [...new Set([...components.map((item) => item.feature), ...interactions.map((item) => item.feature)])]
    .sort()
    .map((feature) => ({
      feature,
      label: featureLabels[feature] ?? feature,
      screens: screens.filter((screen) => viewFeatures[screen.view] === feature).map((screen) => screen.view),
      componentCount: components.filter((item) => item.feature === feature).length,
      interactionCount: interactions.filter((item) => item.feature === feature).length
    }))

  return {
    generatedBy: "tools/web-inventory/generate-web-inventory.mjs",
    sourceRoot: "apps/web/src",
    note: "静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。",
    screens,
    features,
    components: components.sort((a, b) => a.file.localeCompare(b.file)),
    interactions: interactions.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
  }
}

function markdownTable(headers, rows) {
  const escape = (value) => String(value).replaceAll("|", "\\|").replace(/\n/g, "<br>")
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escape).join(" | ")} |`)
  ].join("\n")
}

function renderScreens(inventory) {
  return `# Web 画面一覧

> 自動生成: \`${inventory.generatedBy}\`
>
> ${inventory.note}

## 画面

${markdownTable(
  ["表示名", "view", "route", "画面コンポーネント", "権限条件", "確度"],
  inventory.screens.map((screen) => [
    screen.label,
    screen.view,
    `${screen.routePath} (${screen.routeKind})`,
    screen.screenComponent,
    screen.permissions.length > 0 ? screen.permissions.join(", ") : "-",
    screen.certainty
  ])
)}
`
}

function renderFeatures(inventory) {
  return `# Web 機能一覧

> 自動生成: \`${inventory.generatedBy}\`
>
> ${inventory.note}

## 機能サマリ

${markdownTable(
  ["機能", "feature", "関連画面", "コンポーネント数", "UI 操作要素数"],
  inventory.features.map((feature) => [
    feature.label,
    feature.feature,
    feature.screens.length > 0 ? feature.screens.join(", ") : "-",
    feature.componentCount,
    feature.interactionCount
  ])
)}

## UI 操作要素

${markdownTable(
  ["機能", "コンポーネント", "要素", "ラベル", "ハンドラ", "場所", "確度"],
  inventory.interactions.map((item) => [
    featureLabels[item.feature] ?? item.feature,
    item.component,
    item.element,
    item.label,
    item.handlers.length > 0 ? item.handlers.map((handler) => `${handler.name}=${handler.value}`).join("<br>") : "-",
    `${item.file}:${item.line}`,
    item.certainty
  ])
)}
`
}

function renderComponents(inventory) {
  return `# Web コンポーネント一覧

> 自動生成: \`${inventory.generatedBy}\`
>
> ${inventory.note}

${markdownTable(
  ["機能", "ファイル", "export", "使用 JSX 要素", "確度"],
  inventory.components.map((component) => [
    featureLabels[component.feature] ?? component.feature,
    component.file,
    component.exports.length > 0 ? component.exports.join(", ") : "-",
    component.jsxUsages.length > 0 ? component.jsxUsages.join(", ") : "-",
    component.certainty
  ])
)}
`
}

function renderOutputs(inventory) {
  return {
    [outputFiles.screens]: renderScreens(inventory),
    [outputFiles.features]: renderFeatures(inventory),
    [outputFiles.components]: renderComponents(inventory),
    [outputFiles.json]: `${JSON.stringify(inventory, null, 2)}\n`
  }
}

function main() {
  const outputs = renderOutputs(buildInventory())
  if (checkOnly) {
    const staleFiles = []
    for (const [filePath, content] of Object.entries(outputs)) {
      if (!fs.existsSync(filePath) || fs.readFileSync(filePath, "utf8") !== content) staleFiles.push(path.relative(repoRoot, filePath))
    }
    if (staleFiles.length > 0) {
      console.error(`Web UI インベントリが最新ではありません: ${staleFiles.join(", ")}`)
      console.error("更新するには `npm run docs:web-inventory` を実行してください。")
      process.exitCode = 1
      return
    }
    console.log("Web UI インベントリは最新です。")
    return
  }

  fs.mkdirSync(outputDir, { recursive: true })
  for (const [filePath, content] of Object.entries(outputs)) {
    fs.writeFileSync(filePath, content)
    console.log(`generated ${path.relative(repoRoot, filePath)}`)
  }
}

main()
