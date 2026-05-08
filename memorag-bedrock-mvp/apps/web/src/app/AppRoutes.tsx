import type { ComponentProps } from "react"
import { AdminWorkspace } from "../features/admin/components/AdminWorkspace.js"
import { BenchmarkWorkspace } from "../features/benchmark/components/BenchmarkWorkspace.js"
import { ChatView } from "../features/chat/components/ChatView.js"
import { DocumentWorkspace } from "../features/documents/components/DocumentWorkspace.js"
import { HistoryWorkspace } from "../features/history/components/HistoryWorkspace.js"
import { AssigneeWorkspace } from "../features/questions/components/AssigneeWorkspace.js"
import { PersonalSettingsView } from "./components/PersonalSettingsView.js"
import type { AppView } from "./types.js"

export type AppRoutesProps = {
  activeView: AppView
  canAnswerQuestions: boolean
  canReadBenchmarkRuns: boolean
  canManageDocuments: boolean
  canSeeAdminSettings: boolean
  chatProps: ComponentProps<typeof ChatView>
  assigneeProps: ComponentProps<typeof AssigneeWorkspace>
  benchmarkProps: ComponentProps<typeof BenchmarkWorkspace>
  documentProps: ComponentProps<typeof DocumentWorkspace>
  adminProps: ComponentProps<typeof AdminWorkspace>
  historyProps: ComponentProps<typeof HistoryWorkspace>
  profileProps: ComponentProps<typeof PersonalSettingsView>
}

export function AppRoutes({
  activeView,
  canAnswerQuestions,
  canReadBenchmarkRuns,
  canManageDocuments,
  canSeeAdminSettings,
  chatProps,
  assigneeProps,
  benchmarkProps,
  documentProps,
  adminProps,
  historyProps,
  profileProps
}: AppRoutesProps) {
  if (activeView === "chat") return <ChatView {...chatProps} />
  if (activeView === "assignee" && canAnswerQuestions) return <AssigneeWorkspace {...assigneeProps} />
  if (activeView === "benchmark" && canReadBenchmarkRuns) return <BenchmarkWorkspace {...benchmarkProps} />
  if (activeView === "documents" && canManageDocuments) return <DocumentWorkspace {...documentProps} />
  if (activeView === "admin" && canSeeAdminSettings) return <AdminWorkspace {...adminProps} />
  if (activeView === "profile") return <PersonalSettingsView {...profileProps} />
  return <HistoryWorkspace {...historyProps} favoriteOnly={activeView === "favorites"} />
}
