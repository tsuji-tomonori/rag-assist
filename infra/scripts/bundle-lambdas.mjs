import { mkdir, rm } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"

const infraDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repoRoot = path.resolve(infraDir, "..")
const outDir = path.join(infraDir, "lambda-dist")

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

await Promise.all([
  bundle({
    entry: path.join(repoRoot, "apps/api/src/index.ts"),
    outfile: path.join(outDir, "api/index.js")
  }),
  bundle({
    entry: path.join(repoRoot, "apps/api/src/chat-run-worker.ts"),
    outfile: path.join(outDir, "chat-run-worker/index.js")
  }),
  bundle({
    entry: path.join(repoRoot, "apps/api/src/chat-run-mark-failed.ts"),
    outfile: path.join(outDir, "chat-run-mark-failed/index.js")
  }),
  bundle({
    entry: path.join(repoRoot, "apps/api/src/chat-run-events-stream.ts"),
    outfile: path.join(outDir, "chat-run-events-stream/index.js")
  }),
  bundle({
    entry: path.join(repoRoot, "apps/api/src/document-ingest-run-worker.ts"),
    outfile: path.join(outDir, "document-ingest-run-worker/index.js")
  }),
  bundle({
    entry: path.join(repoRoot, "apps/api/src/document-ingest-run-mark-failed.ts"),
    outfile: path.join(outDir, "document-ingest-run-mark-failed/index.js")
  }),
  bundle({
    entry: path.join(repoRoot, "apps/api/src/benchmark-run-authorization-worker.ts"),
    outfile: path.join(outDir, "benchmark-run-authorization-worker/index.js")
  }),
  bundle({
    entry: path.join(repoRoot, "apps/api/src/rag-quality-monitor-worker.ts"),
    outfile: path.join(outDir, "rag-quality-monitor-worker/index.js")
  }),
  bundle({
    entry: path.join(repoRoot, "apps/api/src/security-mutation-audit-reconciliation-worker.ts"),
    outfile: path.join(outDir, "security-mutation-audit-reconciliation-worker/index.js")
  }),
  bundle({
    entry: path.join(repoRoot, "apps/api/src/revocation-cleanup-worker.ts"),
    outfile: path.join(outDir, "revocation-cleanup-worker/index.js")
  }),
  bundle({
    entry: path.join(repoRoot, "apps/api/src/websocket-authorizer.ts"),
    outfile: path.join(outDir, "websocket-authorizer/index.js")
  }),
  bundle({
    entry: path.join(repoRoot, "apps/api/src/websocket-connection-handler.ts"),
    outfile: path.join(outDir, "websocket-connection-handler/index.js")
  }),
  bundle({
    entry: path.join(infraDir, "functions/s3-vectors-custom-resource.ts"),
    outfile: path.join(outDir, "s3-vectors-provider/index.js")
  }),
  bundle({
    entry: path.join(infraDir, "functions/cognito-post-confirmation.ts"),
    outfile: path.join(outDir, "cognito-post-confirmation/index.js")
  })
])

function bundle({ entry, outfile }) {
  return build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    sourcemap: false,
    minify: true,
    logLevel: "info"
  })
}
