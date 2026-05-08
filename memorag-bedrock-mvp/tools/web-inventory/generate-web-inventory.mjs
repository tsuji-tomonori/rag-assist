#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import * as ts from "typescript"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const webSrcDir = path.join(repoRoot, "apps/web/src")
const outputDir = path.join(repoRoot, "docs/generated")
const featureOutputDir = path.join(outputDir, "web-features")
const outputFiles = {
  overview: path.join(outputDir, "web-overview.md"),
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

const featureDescriptions = {
  admin: "管理者向けのユーザー、ロール、利用状況、コスト、alias review / publish を扱う領域です。",
  app: "ログイン後の共通フレーム、ナビゲーション、トップバー、個人設定を扱う領域です。",
  auth: "ログイン、サインアップ、確認コード、新規パスワード設定などの認証画面を扱う領域です。",
  benchmark: "ベンチマーク suite の選択、run 起動、履歴、成果物ダウンロードを扱う領域です。",
  chat: "RAG 質問、回答表示、引用、追加確認、担当者エスカレーション、チャット入力を扱う領域です。",
  debug: "RAG 実行 trace、検索根拠、support verification、step detail を調査する領域です。",
  documents: "ドキュメント upload、document group、共有、blue-green reindex 操作を扱う領域です。",
  history: "会話履歴、検索、並び替え、お気に入り、履歴削除を扱う領域です。",
  questions: "担当者が問い合わせを確認し、回答作成、下書き保存、回答送信を行う領域です。",
  shared: "複数領域で再利用される表示部品です。単独の画面ではなく、他の画面から使われます。"
}

const viewDescriptions = {
  admin: "管理者設定。文書管理、担当者対応、debug / benchmark、ユーザー管理、alias 管理などの入口になります。",
  assignee: "担当者対応。問い合わせ一覧から質問を選び、回答本文や参考資料を作成します。",
  benchmark: "性能テスト。benchmark suite を選択し、run 起動、キャンセル、結果 download を行います。",
  chat: "チャット。利用者が質問し、RAG 回答、引用、確認質問、担当者への問い合わせ導線を確認します。",
  documents: "ドキュメント。ファイル upload、フォルダ作成、共有、reindex 切替を行います。",
  favorites: "お気に入り。会話履歴のうち favorite のものに絞って確認します。",
  history: "履歴。過去の会話を検索、並び替え、再表示、削除します。",
  profile: "個人設定。送信ショートカットやサインアウトなど個人単位の設定を扱います。"
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

function featureFileName(feature) {
  return `${feature}.md`
}

function featureLink(feature) {
  return `web-features/${featureFileName(feature)}`
}

function componentName(component) {
  return component.exports[0] ?? path.basename(component.file)
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))]
}

function summarizeLabels(items, limit = 8) {
  const labels = uniq(items.map((item) => item.label).filter((label) => {
    if (!label || label === "未推定") return false
    return !/[{}?$`]|=>|\?\?|\.[a-zA-Z]/.test(label)
  }))
  if (labels.length === 0) return "-"
  const visible = labels.slice(0, limit)
  const suffix = labels.length > limit ? ` ほか ${labels.length - limit} 件` : ""
  return `${visible.join("、")}${suffix}`
}

function roleFromComponent(component) {
  const file = component.file
  if (file.includes("/components/")) return "画面または画面内 UI コンポーネント"
  if (file.endsWith("main.tsx")) return "React mount entry"
  if (file.includes("/app/")) return "アプリケーション共通制御"
  return "UI 構成要素"
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

function renderHeader(title, inventory) {
  return `# ${title}

> 自動生成: \`${inventory.generatedBy}\`
>
> ${inventory.note}
>
> 読み方: \`confirmed\` はコードから直接確認できた情報、\`inferred\` は fallback や構造から推定した情報、\`unknown\` は静的解析だけでは断定できない情報です。
`
}

function renderOverview(inventory) {
  return `${renderHeader("Web UI インベントリ概要", inventory)}

## この資料で分かること

- Web UI にどの画面があるか。
- 各画面がどの画面コンポーネントに対応するか。
- 機能領域ごとに、どのコンポーネントと UI 操作要素があるか。
- ボタン、リンク、フォーム、入力欄、主要 handler がどのファイルにあるか。

## 全体サマリ

${markdownTable(
  ["項目", "件数", "参照先"],
  [
    ["画面", inventory.screens.length, "[web-screens.md](web-screens.md)"],
    ["機能領域", inventory.features.length, "[web-features.md](web-features.md)"],
    ["コンポーネント", inventory.components.length, "[web-components.md](web-components.md)"],
    ["UI 操作要素", inventory.interactions.length, "[web-features.md](web-features.md)"]
  ]
)}

## 初めて見る人向けの導線

1. [画面一覧](web-screens.md) で、ユーザーが見る画面と権限条件を把握する。
2. [機能一覧](web-features.md) で、機能領域と関連画面の対応を見る。
3. 気になる機能の詳細ファイルを開き、ボタン、フォーム、handler、実装ファイルを確認する。
4. [コンポーネント一覧](web-components.md) で、画面を構成する部品と JSX 使用要素を確認する。

## 生成されるファイル

${markdownTable(
  ["ファイル", "用途"],
  [
    ["[web-overview.md](web-overview.md)", "初見向けの入口と全体サマリ"],
    ["[web-screens.md](web-screens.md)", "画面、view、画面コンポーネント、権限条件、主要操作"],
    ["[web-features.md](web-features.md)", "機能別詳細ファイルへの索引"],
    ["[web-features/*.md](web-features/)", "機能ごとの画面、コンポーネント、UI 操作要素"],
    ["[web-components.md](web-components.md)", "コンポーネント、export、役割、関連画面"],
    ["web-ui-inventory.json", "CI や将来の可視化に使える機械可読データ"]
  ]
)}
`
}

function renderScreens(inventory) {
  return `${renderHeader("Web 画面一覧", inventory)}

## 画面サマリ

${markdownTable(
  ["表示名", "view", "route", "機能", "画面コンポーネント", "権限条件", "主要操作", "確度"],
  inventory.screens.map((screen) => [
    screen.label,
    screen.view,
    `${screen.routePath} (${screen.routeKind})`,
    `[${featureLabels[viewFeatures[screen.view]] ?? viewFeatures[screen.view]}](${featureLink(viewFeatures[screen.view])})`,
    screen.screenComponent,
    screen.permissions.length > 0 ? screen.permissions.join(", ") : "-",
    summarizeLabels(inventory.interactions.filter((item) => item.feature === viewFeatures[screen.view]), 6),
    screen.certainty
  ])
)}

## 画面ごとの説明

${inventory.screens.map((screen) => {
  const interactions = inventory.interactions.filter((item) => item.feature === viewFeatures[screen.view])
  return `### ${screen.label}

- view: \`${screen.view}\`
- 機能領域: [${featureLabels[viewFeatures[screen.view]] ?? viewFeatures[screen.view]}](${featureLink(viewFeatures[screen.view])})
- 画面コンポーネント: \`${screen.screenComponent}\`
- route: \`${screen.routePath}\` (${screen.routeKind})
- 権限条件: ${screen.permissions.length > 0 ? screen.permissions.map((permission) => `\`${permission}\``).join(", ") : "なし"}
- 画面の意味: ${viewDescriptions[screen.view] ?? "静的解析では説明未定義。"}
- 主要操作: ${summarizeLabels(interactions, 10)}
`
}).join("\n")}
`
}

function renderFeatures(inventory) {
  return `${renderHeader("Web 機能一覧", inventory)}

## 機能別ファイル

${markdownTable(
  ["機能", "feature", "概要", "関連画面", "コンポーネント数", "UI 操作要素数", "詳細"],
  inventory.features.map((feature) => [
    feature.label,
    feature.feature,
    featureDescriptions[feature.feature] ?? "-",
    feature.screens.length > 0 ? feature.screens.join(", ") : "-",
    feature.componentCount,
    feature.interactionCount,
    `[${featureFileName(feature.feature)}](${featureLink(feature.feature)})`
  ])
)}
`
}

function renderFeatureDetail(inventory, feature) {
  const screens = inventory.screens.filter((screen) => viewFeatures[screen.view] === feature.feature)
  const components = inventory.components.filter((component) => component.feature === feature.feature)
  const interactions = inventory.interactions.filter((item) => item.feature === feature.feature)
  const buttons = interactions.filter((item) => item.element === "button" || item.element === "a")
  const forms = interactions.filter((item) => item.element === "form")
  const fields = interactions.filter((item) => ["input", "select", "textarea"].includes(item.element))

  return `${renderHeader(`Web 機能詳細: ${feature.label}`, inventory)}

## 概要

${featureDescriptions[feature.feature] ?? "静的解析では説明未定義です。"}

## 関連画面

${screens.length > 0 ? markdownTable(
  ["表示名", "view", "画面コンポーネント", "権限条件", "説明"],
  screens.map((screen) => [
    screen.label,
    screen.view,
    screen.screenComponent,
    screen.permissions.length > 0 ? screen.permissions.join(", ") : "-",
    viewDescriptions[screen.view] ?? "-"
  ])
) : "関連画面は静的解析では見つかりませんでした。"}

## コンポーネント

${markdownTable(
  ["コンポーネント", "役割", "ファイル", "export", "使用 JSX 要素"],
  components.map((component) => [
    componentName(component),
    roleFromComponent(component),
    component.file,
    component.exports.length > 0 ? component.exports.join(", ") : "-",
    component.jsxUsages.length > 0 ? component.jsxUsages.join(", ") : "-"
  ])
)}

## 主なボタン・リンク

${buttons.length > 0 ? markdownTable(
  ["コンポーネント", "要素", "ラベル", "ハンドラ", "場所", "確度"],
  buttons.map((item) => [
    item.component,
    item.element,
    item.label,
    item.handlers.length > 0 ? item.handlers.map((handler) => `${handler.name}=${handler.value}`).join("<br>") : "-",
    `${item.file}:${item.line}`,
    item.certainty
  ])
) : "ボタン・リンクは静的解析では見つかりませんでした。"}

## フォーム

${forms.length > 0 ? markdownTable(
  ["コンポーネント", "ラベル", "送信ハンドラ", "場所", "確度"],
  forms.map((item) => [
    item.component,
    item.label,
    item.handlers.length > 0 ? item.handlers.map((handler) => `${handler.name}=${handler.value}`).join("<br>") : "-",
    `${item.file}:${item.line}`,
    item.certainty
  ])
) : "フォームは静的解析では見つかりませんでした。"}

## 入力項目

${fields.length > 0 ? markdownTable(
  ["コンポーネント", "要素", "ラベル", "ハンドラ", "場所", "確度"],
  fields.map((item) => [
    item.component,
    item.element,
    item.label,
    item.handlers.length > 0 ? item.handlers.map((handler) => `${handler.name}=${handler.value}`).join("<br>") : "-",
    `${item.file}:${item.line}`,
    item.certainty
  ])
) : "入力項目は静的解析では見つかりませんでした。"}

## UI 操作要素の全量

${markdownTable(
  ["コンポーネント", "要素", "ラベル", "ハンドラ", "場所", "確度"],
  interactions.map((item) => [
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
  return `${renderHeader("Web コンポーネント一覧", inventory)}

## コンポーネントサマリ

${markdownTable(
  ["機能", "関連画面", "コンポーネント", "役割", "ファイル", "export", "使用 JSX 要素", "確度"],
  inventory.components.map((component) => [
    `[${featureLabels[component.feature] ?? component.feature}](${featureLink(component.feature)})`,
    inventory.screens.filter((screen) => viewFeatures[screen.view] === component.feature).map((screen) => screen.label).join(", ") || "-",
    componentName(component),
    roleFromComponent(component),
    component.file,
    component.exports.length > 0 ? component.exports.join(", ") : "-",
    component.jsxUsages.length > 0 ? component.jsxUsages.join(", ") : "-",
    component.certainty
  ])
)}
`
}

function renderOutputs(inventory) {
  const outputs = {
    [outputFiles.overview]: renderOverview(inventory),
    [outputFiles.screens]: renderScreens(inventory),
    [outputFiles.features]: renderFeatures(inventory),
    [outputFiles.components]: renderComponents(inventory),
    [outputFiles.json]: `${JSON.stringify(inventory, null, 2)}\n`
  }
  for (const feature of inventory.features) {
    outputs[path.join(featureOutputDir, featureFileName(feature.feature))] = renderFeatureDetail(inventory, feature)
  }
  return Object.fromEntries(Object.entries(outputs).map(([filePath, content]) => [
    filePath,
    `${content.trimEnd()}\n`
  ]))
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
  fs.mkdirSync(featureOutputDir, { recursive: true })
  for (const [filePath, content] of Object.entries(outputs)) {
    fs.writeFileSync(filePath, content)
    console.log(`generated ${path.relative(repoRoot, filePath)}`)
  }
}

main()
