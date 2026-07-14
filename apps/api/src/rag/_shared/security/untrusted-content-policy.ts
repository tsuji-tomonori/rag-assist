import { createHash } from "node:crypto"

export const UNTRUSTED_CONTENT_POLICY_VERSION = "untrusted-content-v1"

export type UntrustedContentSource =
  | "document_body"
  | "metadata"
  | "file_name"
  | "conversation_history"
  | "user_input"
  | "tool_output"

export type UntrustedContentFinding = {
  policyVersion: typeof UNTRUSTED_CONTENT_POLICY_VERSION
  source: UntrustedContentSource
  ruleId: string
  action: "quarantine"
  contentHash: string
}

type DetectionRule = {
  id: string
  pattern: RegExp
}

const detectionRules: readonly DetectionRule[] = [
  {
    id: "instruction_override",
    pattern: /(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+)?(?:(?:previous|prior)(?:\s+(?:system|developer|security))?|system|developer|security)\s+(?:instructions?|messages?|rules?|polic(?:y|ies))|(?:これまで|以前|上位|system|システム|開発者).{0,24}(?:指示|命令|規則|ポリシー).{0,12}(?:無視|忘れ|上書き|回避)/iu
  },
  {
    id: "system_prompt_exfiltration",
    pattern: /(?:reveal|print|show|repeat|expose|leak|return).{0,40}(?:system|developer)\s*(?:prompt|message|instructions?)|(?:system|developer)\s*(?:prompt|message|instructions?).{0,40}(?:reveal|print|show|repeat|expose|leak|return)|(?:システム|開発者).{0,12}(?:プロンプト|指示).{0,20}(?:表示|開示|出力|漏洩)/iu
  },
  {
    id: "secret_exfiltration",
    pattern: /(?:reveal|print|show|send|upload|exfiltrat\w*).{0,48}(?:api[ _-]?key|access[ _-]?token|secret|credential|password)|(?:api[ _-]?key|access[ _-]?token|secret|credential|password).{0,48}(?:reveal|print|show|send|upload|exfiltrat\w*)|(?:秘密|認証情報|パスワード|APIキー|トークン).{0,20}(?:表示|送信|出力|開示)/iu
  },
  {
    id: "tool_execution_directive",
    pattern: /(?:execute|run|invoke|call)\s+(?:the\s+)?(?:shell|terminal|bash|powershell|curl|tool|function)|(?:shell|terminal|bash|powershell|curl|ツール|関数).{0,16}(?:実行|呼び出)/iu
  },
  {
    id: "prompt_delimiter_breakout",
    pattern: /<\/?(?:system|developer|assistant|tool|context|computedFacts)\b|\[(?:system|developer|assistant|tool)\]/iu
  },
  {
    id: "role_message_impersonation",
    pattern: /(?:^|\n)\s*(?:system|developer|assistant|tool)\s*:\s*\S/iu
  }
] as const

export function inspectUntrustedContent(value: string, source: UntrustedContentSource): UntrustedContentFinding[] {
  const normalized = value.normalize("NFKC")
  if (!normalized.trim()) return []
  const contentHash = createHash("sha256").update(normalized).digest("hex")
  return detectionRules
    .filter((rule) => rule.pattern.test(normalized))
    .map((rule) => ({
      policyVersion: UNTRUSTED_CONTENT_POLICY_VERSION,
      source,
      ruleId: rule.id,
      action: "quarantine",
      contentHash
    }))
}

export function inspectPromptEvidence(input: { text: string; fileName?: string }): UntrustedContentFinding[] {
  return [
    ...inspectUntrustedContent(input.text, "document_body"),
    ...inspectUntrustedContent(input.fileName ?? "", "file_name")
  ]
}

export function guardUntrustedPromptText(value: string, source: UntrustedContentSource): {
  text: string
  findings: UntrustedContentFinding[]
} {
  const findings = inspectUntrustedContent(value, source)
  if (findings.length === 0) return { text: value, findings }
  return {
    text: `[quarantined untrusted content: ${[...new Set(findings.map((finding) => finding.ruleId))].join(",")}]`,
    findings
  }
}
