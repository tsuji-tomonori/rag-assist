import { Icon } from "../../../../shared/components/Icon.js"
import type { Message } from "../../types.js"

export function CitationList({ citations }: { citations: NonNullable<Message["result"]>["citations"] }) {
  if (citations.length === 0) return null

  return (
    <div className="answer-sources">
      <strong>参照元</strong>
      <ul>
        {citations.slice(0, 3).map((citation, index) => (
          <li key={`${citation.documentId}-${citation.chunkId ?? index}`}>
            <a href={`#source-${index}`}>
              <Icon name="document" />
              <span>{citation.fileName}</span>
            </a>
            <span>{`score ${citation.score}`}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
