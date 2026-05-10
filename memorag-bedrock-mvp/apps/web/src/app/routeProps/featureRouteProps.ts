import type { ComponentProps } from "react"
import type { AdminWorkspace } from "../../features/admin/components/AdminWorkspace.js"
import type { BenchmarkWorkspace } from "../../features/benchmark/components/BenchmarkWorkspace.js"
import type { DocumentWorkspace } from "../../features/documents/components/DocumentWorkspace.js"
import type { HistoryWorkspace } from "../../features/history/components/HistoryWorkspace.js"
import type { AssigneeWorkspace } from "../../features/questions/components/AssigneeWorkspace.js"
import type { PersonalSettingsView } from "../components/PersonalSettingsView.js"

export type AssigneeRouteProps = ComponentProps<typeof AssigneeWorkspace>
export type BenchmarkRouteProps = ComponentProps<typeof BenchmarkWorkspace>
export type DocumentRouteProps = ComponentProps<typeof DocumentWorkspace>
export type AdminRouteProps = ComponentProps<typeof AdminWorkspace>
export type HistoryRouteProps = ComponentProps<typeof HistoryWorkspace>
export type ProfileRouteProps = ComponentProps<typeof PersonalSettingsView>

export function buildAssigneeRouteProps(props: AssigneeRouteProps): AssigneeRouteProps {
  return props
}

export function buildBenchmarkRouteProps(props: BenchmarkRouteProps): BenchmarkRouteProps {
  return props
}

export function buildDocumentRouteProps(props: DocumentRouteProps): DocumentRouteProps {
  return props
}

export function buildAdminRouteProps(props: AdminRouteProps): AdminRouteProps {
  return props
}

export function buildHistoryRouteProps(props: HistoryRouteProps): HistoryRouteProps {
  return props
}

export function buildProfileRouteProps(props: ProfileRouteProps): ProfileRouteProps {
  return props
}
