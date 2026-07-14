import type { SemanticPresentation } from "../../../shared/ui/displayMetadata.js"
import type { HumanQuestion } from "../types.js"

export type QuestionJourneyActor = "requester" | "assignee"

export type QuestionJourneyPresentation = Readonly<{
  presentation: SemanticPresentation
  nextAction: string
  assignmentLabel: string
}>

export function questionJourneyPresentation(
  question: HumanQuestion,
  actor: QuestionJourneyActor
): QuestionJourneyPresentation {
  const assignmentLabel = questionAssignmentLabel(question)
  if (question.status === "resolved") {
    return {
      presentation: { label: "解決済み", tone: "neutral", description: "問い合わせは解決済みです" },
      nextAction: "追加の確認が必要な場合は、新しい質問として送信してください。",
      assignmentLabel
    }
  }
  if (question.status === "answered") {
    return actor === "requester"
      ? {
          presentation: { label: "担当者回答あり", tone: "success", description: "担当者の回答を確認できます" },
          nextAction: "回答を確認し、解決した場合は「解決した」を選択してください。",
          assignmentLabel
        }
      : {
          presentation: { label: "依頼者確認待ち", tone: "warning", description: "担当者回答の送信が確定しています" },
          nextAction: "依頼者の確認を待ってください。",
          assignmentLabel
        }
  }
  if (question.status === "waiting_requester") {
    return actor === "requester"
      ? {
          presentation: { label: "追加確認待ち", tone: "warning", description: "担当者が依頼者の確認を待っています" },
          nextAction: "担当者からの確認内容を確認してください。",
          assignmentLabel
        }
      : {
          presentation: { label: "依頼者回答待ち", tone: "warning", description: "依頼者からの追加情報を待っています" },
          nextAction: "依頼者から追加情報が届くまで待ってください。",
          assignmentLabel
        }
  }
  if (question.status === "in_progress") {
    return actor === "requester"
      ? {
          presentation: { label: "担当者対応中", tone: "info", description: "担当者が回答を確認しています" },
          nextAction: "担当者から回答が届くまで待ってください。",
          assignmentLabel
        }
      : {
          presentation: { label: "回答作成中", tone: "info", description: "担当者対応中の問い合わせです" },
          nextAction: "根拠と公開範囲を確認して回答を送信してください。",
          assignmentLabel
        }
  }
  if (actor === "assignee") {
    return {
      presentation: { label: "未対応", tone: "info", description: "回答作成に着手していない問い合わせです" },
      nextAction: "問い合わせ内容とチャット回答を確認し、回答を作成してください。",
      assignmentLabel
    }
  }
  const assigned = Boolean(question.assigneeUserId || question.assigneeGroupId || configuredDepartment(question))
  return {
    presentation: assigned
      ? { label: "担当割当済み", tone: "info", description: "担当者または担当部署へ送信済みです" }
      : { label: "担当者確認待ち", tone: "warning", description: "担当先の確定を待っています" },
    nextAction: "担当者から回答が届くまで待ってください。",
    assignmentLabel
  }
}

export function summarizeQuestionJourney(
  questions: HumanQuestion[],
  actor: QuestionJourneyActor
): (QuestionJourneyPresentation & { question: HumanQuestion; ticketCount: number }) | undefined {
  if (questions.length === 0) return undefined
  const priority: Record<HumanQuestion["status"], number> = {
    answered: 0,
    waiting_requester: 1,
    in_progress: 2,
    open: 3,
    resolved: 4
  }
  const question = [...questions].sort((left, right) => {
    const stateDifference = priority[left.status] - priority[right.status]
    return stateDifference || right.updatedAt.localeCompare(left.updatedAt)
  })[0]
  if (!question) return undefined
  return { ...questionJourneyPresentation(question, actor), question, ticketCount: questions.length }
}

function questionAssignmentLabel(question: HumanQuestion): string {
  if (question.assigneeUserId) return "担当者に割当済み"
  if (question.assigneeGroupId) return "担当グループに割当済み"
  if (configuredDepartment(question)) return `${question.assigneeDepartment}を担当部署に指定`
  return "担当先は未設定"
}

function configuredDepartment(question: HumanQuestion): boolean {
  const department = question.assigneeDepartment.trim()
  return department.length > 0 && department !== "未設定"
}
