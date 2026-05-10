import type { ClarificationOption } from "../../types-api.js"

export function ClarificationOptions({
  options,
  originalQuestion,
  disabled,
  onSubmitClarificationOption,
  onStartClarificationFreeform
}: {
  options: ClarificationOption[]
  originalQuestion: string
  disabled: boolean
  onSubmitClarificationOption: (option: ClarificationOption, originalQuestion: string) => Promise<void>
  onStartClarificationFreeform: (originalQuestion: string, seedText: string) => void
}) {
  return (
    <div className="clarification-options" aria-label="確認質問の選択肢">
      {options.map((option) => (
        <button
          type="button"
          key={option.id}
          disabled={disabled}
          onClick={() => void onSubmitClarificationOption(option, originalQuestion)}
          title={option.reason ?? "この候補で質問する"}
        >
          {option.label}
        </button>
      ))}
      <button
        type="button"
        className="clarification-freeform"
        disabled={disabled}
        onClick={() => onStartClarificationFreeform(originalQuestion, "例: 経費精算の申請期限は？")}
      >
        自分で入力
      </button>
    </div>
  )
}
