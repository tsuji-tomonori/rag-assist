import { act, fireEvent, render, screen } from "@testing-library/react"
import { StrictMode } from "react"
import { describe, expect, it, vi } from "vitest"
import type { Message } from "../types.js"
import { AssistantAnswer } from "./AssistantAnswer.js"
import { UserPromptBubble } from "./UserPromptBubble.js"

type CopyScenario = {
  copiedName: string
  idleName: string
  renderComponent: () => ReturnType<typeof render>
  renderStrictComponent: () => ReturnType<typeof render>
}

const assistantMessage: Message = {
  role: "assistant",
  text: "ソフトウェア要求は製品要求とプロジェクト要求に分類されます。",
  createdAt: "2026-05-04T00:00:00.000Z",
  result: {
    answer: "ソフトウェア要求は製品要求とプロジェクト要求に分類されます。",
    citations: [],
    isAnswerable: true,
    retrieved: []
  }
}

const copyScenarios: CopyScenario[] = [
  {
    idleName: "プロンプトをコピー",
    copiedName: "プロンプトをコピー済み",
    renderComponent: () => render(<UserPromptBubble text="分類を教えて" />),
    renderStrictComponent: () =>
      render(
        <StrictMode>
          <UserPromptBubble text="分類を教えて" />
        </StrictMode>
      )
  },
  {
    idleName: "回答をコピー",
    copiedName: "回答をコピー済み",
    renderComponent: () =>
      render(
        <AssistantAnswer
          message={assistantMessage}
          loading={false}
          onCreateQuestion={async () => undefined}
          onResolveQuestion={async () => undefined}
          onAdditionalQuestion={() => undefined}
          onSubmitClarificationOption={async () => undefined}
        />
      ),
    renderStrictComponent: () =>
      render(
        <StrictMode>
          <AssistantAnswer
            message={assistantMessage}
            loading={false}
            onCreateQuestion={async () => undefined}
            onResolveQuestion={async () => undefined}
            onAdditionalQuestion={() => undefined}
            onSubmitClarificationOption={async () => undefined}
          />
        </StrictMode>
      )
  }
]

async function clickAndFlush(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element)
    await Promise.resolve()
  })
}

describe("chat copy feedback", () => {
  it.each(copyScenarios)("$copiedName keeps the latest copied feedback window after repeated copies", async ({ copiedName, idleName, renderComponent }) => {
    vi.useFakeTimers()
    try {
      vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
      renderComponent()

      await clickAndFlush(screen.getByRole("button", { name: idleName }))
      expect(screen.getByRole("button", { name: copiedName }).querySelector(".icon-check")).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      await clickAndFlush(screen.getByRole("button", { name: copiedName }))

      act(() => {
        vi.advanceTimersByTime(1799)
      })
      expect(screen.getByRole("button", { name: copiedName }).querySelector(".icon-check")).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(screen.getByRole("button", { name: idleName }).querySelector(".icon-copy")).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })

  it.each(copyScenarios)("$copiedName shows copied feedback under StrictMode", async ({ copiedName, idleName, renderStrictComponent }) => {
    try {
      vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
      renderStrictComponent()

      await clickAndFlush(screen.getByRole("button", { name: idleName }))

      expect(screen.getByRole("button", { name: copiedName }).querySelector(".icon-check")).toBeInTheDocument()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it.each(copyScenarios)("$idleName does not schedule feedback after unmount while clipboard is pending", async ({ idleName, renderComponent }) => {
    vi.useFakeTimers()
    try {
      let resolveClipboard: () => void = () => undefined
      vi.stubGlobal("navigator", {
        clipboard: {
          writeText: vi.fn(
            () =>
              new Promise<void>((resolve) => {
                resolveClipboard = resolve
              })
          )
        }
      })
      const { unmount } = renderComponent()

      fireEvent.click(screen.getByRole("button", { name: idleName }))
      unmount()

      await act(async () => {
        resolveClipboard()
        await Promise.resolve()
      })

      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })
})
