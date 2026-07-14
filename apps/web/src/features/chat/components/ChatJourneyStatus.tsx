import { StatusBadge } from "../../../shared/ui/StatusBadge.js"
import { chatJourneyPresentation } from "../utils/chatJourney.js"
import type { ChatResponse } from "../types-api.js"

export function ChatJourneyStatus({ result }: { result: ChatResponse }) {
  const journey = chatJourneyPresentation(result)
  return (
    <div className="chat-journey-status" role="group" aria-label="回答状態">
      <header>
        <StatusBadge presentation={journey.presentation} />
        <span>{result.citations.length > 0 ? `参照元 ${result.citations.length} 件` : "参照元 0 件"}</span>
      </header>
      <p><strong>次の操作:</strong> {journey.nextAction}</p>
    </div>
  )
}
