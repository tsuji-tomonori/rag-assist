const followups = [
  "根拠を詳しく教えて",
  "関連する手順はある？",
  "担当者に確認したい"
]

export function FollowupSuggestions({
  disabled,
  onAdditionalQuestion
}: {
  disabled: boolean
  onAdditionalQuestion: (value: string) => void
}) {
  return (
    <div className="answer-followups" aria-label="追加質問の候補">
      {followups.map((followup) => (
        <button type="button" key={followup} disabled={disabled} onClick={() => onAdditionalQuestion(followup)}>
          {followup}
        </button>
      ))}
    </div>
  )
}
