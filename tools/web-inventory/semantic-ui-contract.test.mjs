import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../', import.meta.url)

async function read(path) {
  return readFile(new URL(path, root), 'utf8')
}

async function sourceFiles(path) {
  const directory = new URL(path, root)
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = `${path}/${entry.name}`
    if (entry.isDirectory()) return sourceFiles(entryPath)
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [entryPath] : []
  }))
  return files.flat()
}

function cssVariable(css, name) {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
  assert.ok(match, `--${name} is required`)
  return match[1]
}

function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
  const [red, green, blue] = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrastRatio(first, second) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second))
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second))
  return (lighter + 0.05) / (darker + 0.05)
}

test('NONUI-UI-SEMANTIC-001: semantic status tokens meet WCAG AA text contrast', async () => {
  const css = await read('apps/web/src/styles/globals.css')
  for (const tone of ['neutral', 'info', 'success', 'warning', 'danger']) {
    const foreground = cssVariable(css, `status-${tone}-foreground`)
    const background = cssVariable(css, `status-${tone}-background`)
    assert.ok(contrastRatio(foreground, background) >= 4.5, `${tone} status contrast must be at least 4.5:1`)
  }
})

test('status primitive exposes a non-color marker and representative views do not render raw status enums', async () => {
  const [badge, benchmark, agents, documents, aliases] = await Promise.all([
    read('apps/web/src/shared/ui/StatusBadge.tsx'),
    read('apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx'),
    read('apps/web/src/features/agents/components/AsyncAgentWorkspace.tsx'),
    read('apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx'),
    read('apps/web/src/features/admin/components/panels/AliasAdminPanel.tsx')
  ])

  assert.match(badge, /ui-status-badge-marker/)
  assert.match(badge, /aria-hidden="true"/)
  assert.doesNotMatch(benchmark, /run-status|>status<|\{run\.mode\}|\{run\.runner\}/)
  assert.doesNotMatch(agents, /run-status|providerAvailabilityLabel|>status</)
  assert.doesNotMatch(documents, /\{migration\.status\}/)
  assert.doesNotMatch(aliases, /\{item\.action\}|\{disableCandidate\.status\}/)
})

test('confirmation dialogs share native focus semantics and semantic Button intents', async () => {
  const [componentDialog, uiDialog, button] = await Promise.all([
    read('apps/web/src/shared/components/ConfirmDialog.tsx'),
    read('apps/web/src/shared/ui/ConfirmDialog.tsx'),
    read('apps/web/src/shared/ui/Button.tsx')
  ])

  for (const dialog of [componentDialog, uiDialog]) {
    assert.match(dialog, /role="dialog"/)
    assert.match(dialog, /aria-modal="true"/)
    assert.match(dialog, /aria-busy=\{busy\}/)
    assert.match(dialog, /onKeyDown=\{trapFocus\}/)
    assert.match(dialog, /<Button/)
    assert.doesNotMatch(dialog, /confirm-dialog-primary/)
  }
  assert.match(button, /"warning"/)
  assert.match(button, /"danger"/)
})

test('retired unused UI primitives remain absent while Badge stays in use', async () => {
  for (const retiredPath of [
    'apps/web/src/shared/ui/IconButton.tsx',
    'apps/web/src/shared/ui/Panel.tsx'
  ]) {
    await assert.rejects(read(retiredPath), { code: 'ENOENT' })
  }

  const paths = await sourceFiles('apps/web/src')
  const sources = await Promise.all(paths.map(async (path) => `${path}\n${await read(path)}`))
  const webSource = sources.join('\n')
  const uiIndex = await read('apps/web/src/shared/ui/index.ts')
  const statusBadge = await read('apps/web/src/shared/ui/StatusBadge.tsx')

  assert.doesNotMatch(uiIndex, /\b(?:IconButton|Panel)\b/)
  assert.doesNotMatch(webSource, /\b(?:IconButton|Panel)\b/)
  assert.doesNotMatch(webSource, /shared\/ui\/(?:IconButton|Panel)(?:\.[cm]?[jt]sx?)?/)
  assert.doesNotMatch(webSource, /["']\.\/(?:IconButton|Panel)\.js["']/)
  assert.match(uiIndex, /export\s*\{\s*Badge\s*\}\s*from\s*"\.\/Badge\.js"/)
  assert.match(statusBadge, /import\s*\{\s*Badge\s*\}\s*from\s*"\.\/Badge\.js"/)
  assert.match(statusBadge, /<Badge\b/)
})
