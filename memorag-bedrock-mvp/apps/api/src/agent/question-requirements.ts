export type QuestionRequirement =
  | {
      type: "list_count"
      count: number
      label: string
    }
  | {
      type: "slot"
      slot:
        | "amount"
        | "date"
        | "count"
        | "procedure"
        | "person"
        | "condition"
        | "classification"
        | "place"
        | "organization"
        | "section"
        | "item"
        | "term"
        | "reason"
        | "yes_no"
      label: string
    }

export type AnswerRequirementIssue = {
  requirement: QuestionRequirement
  reason: string
}

export const MONEY_AMOUNT_RE = /(?:\d[\d,]*(?:\.\d+)?|[一二三四五六七八九十百千万億兆]+)\s*(?:円|万円|千円)(?!滑|満|卓|環)/u

export function asksForMoney(value: string): boolean {
  const normalized = value.normalize("NFKC")
  return MONEY_AMOUNT_RE.test(normalized) || /金額|費用|料金|価格|単価|上限|下限|いくら/u.test(normalized)
}

export function detectQuestionRequirements(question: string): QuestionRequirement[] {
  const normalized = question.normalize("NFKC")
  const requirements: QuestionRequirement[] = []
  const listCount = extractRequestedListCount(normalized)
  if (listCount !== undefined) {
    requirements.push({ type: "list_count", count: listCount, label: `${listCount}項目` })
  }
  if (asksForMoney(normalized) || hasComparableQuantitySignal(normalized)) {
    requirements.push({ type: "slot", slot: "amount", label: "数量・金額" })
  }
  if (/期限|期日|締切|締め切り|開始日|終了日|何営業日/u.test(normalized)) {
    requirements.push({ type: "slot", slot: "date", label: "期限" })
  } else if (/いつ|何年|何月|何日|時期|起点|開始|発足|設置/u.test(normalized)) {
    requirements.push({ type: "slot", slot: "date", label: "日付・時期" })
  }
  if (/頻度|何回|何度|ごと|毎月|毎年/u.test(normalized)) {
    requirements.push({ type: "slot", slot: "count", label: "回数・頻度" })
  }
  if (/方法|手順|やり方|フロー|提出/u.test(normalized) || (/申請/u.test(normalized) && !/申請期限|申請期日|申請締切/u.test(normalized))) {
    requirements.push({ type: "slot", slot: "procedure", label: "手順" })
  }
  if (/誰|担当|承認者|責任者|部署|報告先|依頼先/u.test(normalized)) {
    requirements.push({ type: "slot", slot: "person", label: "担当者・組織" })
  }
  if (/条件|対象|例外|適用範囲/u.test(normalized)) {
    requirements.push({ type: "slot", slot: "condition", label: "条件" })
  }
  if (/分類|種類|区分/u.test(normalized)) {
    requirements.push({ type: "slot", slot: "classification", label: "分類" })
  }
  if (/どこ|場所|所在地|設置先|置かれた|どこに/u.test(normalized)) {
    requirements.push({ type: "slot", slot: "place", label: "場所" })
  }
  if (/組織|機関|部署|課|局|何という|名称/u.test(normalized)) {
    requirements.push({ type: "slot", slot: "organization", label: "組織名・名称" })
  }
  if (/節|章|目次|どの節|どの項目|section/i.test(normalized)) {
    requirements.push({ type: "slot", slot: "section", label: "節番号・節名" })
  }
  if (/項目|含まれる|挙げ|列挙|一覧|洗い出/u.test(normalized)) {
    requirements.push({ type: "slot", slot: "item", label: "項目名" })
  }
  if (/(?:^|[^A-Za-z0-9])(?:DPC[/／]?PDPS|SDDS|EBPM|AI)(?:$|[^A-Za-z0-9])/i.test(normalized)) {
    requirements.push({ type: "slot", slot: "term", label: "正規化語句" })
  }
  if (/理由|なぜ|趣旨|合うか|適合|該当/u.test(normalized)) {
    requirements.push({ type: "slot", slot: "reason", label: "理由・根拠句" })
  }
  if (/合うか|該当|正しいですか|合っていますか|できますか|できませんか|(?:^|[、。!！?？\s])(はい|いいえ)(?:[、。!！?？\s]|$)/u.test(normalized)) {
    requirements.push({ type: "slot", slot: "yes_no", label: "可否" })
  }
  return dedupeRequirements(requirements).slice(0, 8)
}

function hasComparableQuantitySignal(question: string): boolean {
  return /[¥$€£]\s*\p{Number}/u.test(question) || /\p{Number}\s*%/u.test(question)
}

export function formatQuestionRequirementsForPrompt(question: string): string {
  const requirements = detectQuestionRequirements(question)
  if (requirements.length === 0) return ""
  return [
    "- 質問要求スロットを省略しない。検出された要求:",
    ...requirements.map((requirement) => `  - ${formatRequirement(requirement)}`),
    "- 検出された項目数、日付・場所・組織名、節番号・項目名、可否と理由は、<context>に根拠がある限り回答文へ明示する。",
    "- 要求スロットを根拠から埋められない場合だけ isAnswerable=false にする。"
  ].join("\n")
}

export function validateAnswerRequirements(question: string, answer: string): AnswerRequirementIssue[] {
  const requirements = detectQuestionRequirements(question)
  if (requirements.length === 0) return []
  const normalizedAnswer = answer.normalize("NFKC")
  const issues: AnswerRequirementIssue[] = []
  for (const requirement of requirements) {
    if (requirement.type === "list_count") {
      const count = countAnswerItems(normalizedAnswer)
      if (count < requirement.count) issues.push({ requirement, reason: `質問は${requirement.count}項目を要求していますが、回答は${count}項目相当です。` })
      continue
    }
    if (requirement.slot === "date" && !/(?:明治|大正|昭和|平成|令和)?\s*\d+\s*年|\d{4}年|\d{4}[-/]\d{1,2}|\d+\s*(?:営業日|日|か月|ヶ月|月)|翌月|当月|月末|月初/u.test(normalizedAnswer)) {
      issues.push({ requirement, reason: "日付・時期が回答に含まれていません。" })
    }
    if (requirement.slot === "place" && !/官|院|省|庁|局|部|課|所|センター|室|地域|都|道|府|県|市|区|町|村/u.test(normalizedAnswer)) {
      issues.push({ requirement, reason: "場所を示す語が回答に含まれていません。" })
    }
    if (requirement.slot === "organization" && !/官|院|省|庁|局|部|課|所|センター|室|組織|機関/u.test(normalizedAnswer)) {
      issues.push({ requirement, reason: "組織名・名称を示す語が回答に含まれていません。" })
    }
    if (requirement.slot === "section" && !/(?:[IVXⅠⅡⅢⅣⅤ]+|[0-9]+)\s*[-－ー]\s*[0-9]+(?:\s*[-－ー]\s*[0-9]+)?|第\s*\d+\s*(?:章|節|項)/u.test(normalizedAnswer)) {
      issues.push({ requirement, reason: "節番号または章節を示す表記が回答に含まれていません。" })
    }
    if (requirement.slot === "item" && countAnswerItems(normalizedAnswer) === 0) {
      issues.push({ requirement, reason: "項目名の列挙が回答に含まれていません。" })
    }
    if (requirement.slot === "term" && !/(?:^|[^A-Za-z0-9])(?:DPC|PDPS|SDDS|EBPM|AI)(?:$|[^A-Za-z0-9])/u.test(normalizedAnswer)) {
      issues.push({ requirement, reason: "質問中の正規化語句が回答に含まれていません。" })
    }
    if (requirement.slot === "reason" && !/ため|から|理由|根拠|趣旨|基づ/u.test(normalizedAnswer)) {
      issues.push({ requirement, reason: "理由または根拠句が回答に含まれていません。" })
    }
    if (requirement.slot === "yes_no" && !/はい|いいえ|該当|合致|適合|できます|できません|です|ではありません/u.test(normalizedAnswer)) {
      issues.push({ requirement, reason: "可否を示す回答が含まれていません。" })
    }
  }
  return issues
}

function extractRequestedListCount(question: string): number | undefined {
  const digit = question.match(/([0-9]+)\s*(?:項目|つ|点|個|件)/u)
  if (digit?.[1]) return Number(digit[1])
  const kanji = question.match(/([一二三四五六七八九十])\s*(?:項目|つ|点|個|件)/u)
  return kanji?.[1] ? kanjiNumber(kanji[1]) : undefined
}

function kanjiNumber(value: string): number | undefined {
  const map = new Map([
    ["一", 1],
    ["二", 2],
    ["三", 3],
    ["四", 4],
    ["五", 5],
    ["六", 6],
    ["七", 7],
    ["八", 8],
    ["九", 9],
    ["十", 10]
  ])
  return map.get(value)
}

function countAnswerItems(answer: string): number {
  const numbered = answer.match(/(?:^|[\n、。])\s*(?:[0-9]+[.)．、]|[①②③④⑤⑥⑦⑧⑨⑩]|[-*・])\s*/gu)
  if (numbered && numbered.length > 0) return numbered.length
  const semicolonItems = answer.split(/[、，,;；\n]|(?:\s+and\s+)/iu).map((item) => item.trim()).filter((item) => item.length >= 3)
  return semicolonItems.length >= 2 ? semicolonItems.length : 0
}

function formatRequirement(requirement: QuestionRequirement): string {
  if (requirement.type === "list_count") return `${requirement.count}項目の列挙`
  return requirement.label
}

function dedupeRequirements(requirements: QuestionRequirement[]): QuestionRequirement[] {
  const seen = new Set<string>()
  return requirements.filter((requirement) => {
    const key = requirement.type === "list_count" ? `list:${requirement.count}` : `slot:${requirement.slot}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
