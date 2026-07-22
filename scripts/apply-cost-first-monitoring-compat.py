from pathlib import Path

path = Path("apps/api/src/rag/quality-control/production-rag-monitor.ts")
text = path.read_text()
old = '''  const required = input.required ?? process.env.RAG_MONITORING_REQUIRED === "1"
  if (!required) return
  const operation = input.operation ?? "chat"'''
new = '''  const configuredMonitoringRequired = process.env.RAG_MONITORING_REQUIRED
  const required = input.required ?? configuredMonitoringRequired === "1"
  const explicitlyDisabled = input.required === false
    || (input.required === undefined && configuredMonitoringRequired === "0")
  if (explicitlyDisabled) return
  const operation = input.operation ?? "chat"'''
if text.count(old) != 1:
    raise SystemExit("monitoring interlock patch did not match exactly once")
path.write_text(text.replace(old, new))
