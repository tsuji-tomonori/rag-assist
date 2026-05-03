export function defaultQuestionTitle(sourceQuestion: string): string {
  const compact = sourceQuestion.replace(/\s+/g, " ").trim()
  return compact ? `${compact.slice(0, 42)}について確認したい` : "資料外の内容について確認したい"
}

export function defaultQuestionBody(sourceQuestion: string): string {
  const compact = sourceQuestion.trim()
  return compact
    ? `${compact}\n\n資料を確認しましたが、該当する情報が見つかりませんでした。ご教示いただけますでしょうか。`
    : "資料を確認しましたが、該当する情報が見つかりませんでした。ご教示いただけますでしょうか。"
}
