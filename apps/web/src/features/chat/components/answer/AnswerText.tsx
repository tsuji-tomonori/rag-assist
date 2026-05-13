export function AnswerText({ text }: { text: string }) {
  return (
    <p className="answer-text">
      {text || "質問すると、社内ドキュメントに基づく回答と実行トレースが表示されます。"}
    </p>
  )
}
