import type { UiStateTarget } from "../shared/ui/ResourceState.js"

export type AppResourceKey = "history" | "favorites" | "assignee" | "documents" | "benchmark" | "admin" | "debug"
export type AppUiStateTargetKey = "chat" | AppResourceKey

export const appUiStateTargets: Record<AppUiStateTargetKey, UiStateTarget> = {
  chat: { id: "chat", label: "チャット", regionId: "chat-resource-region", source: "チャット API" },
  history: { id: "history", label: "会話履歴", regionId: "history-resource-region", source: "会話履歴 API" },
  favorites: { id: "favorites", label: "お気に入り", regionId: "favorites-resource-region", source: "お気に入り API" },
  assignee: { id: "assignee", label: "担当者対応", regionId: "assignee-resource-region", source: "問い合わせ API" },
  documents: { id: "documents", label: "文書ワークスペース", regionId: "documents-resource-region", source: "文書 API" },
  benchmark: { id: "benchmark", label: "性能テスト", regionId: "benchmark-resource-region", source: "性能テスト API" },
  admin: { id: "admin", label: "管理者設定", regionId: "admin-resource-region", source: "管理 API" },
  debug: { id: "debug", label: "デバッグ実行履歴", regionId: "debug-resource-region", source: "デバッグ API" }
}

export const appResourceStateTargets: Record<AppResourceKey, UiStateTarget> = {
  history: appUiStateTargets.history,
  favorites: appUiStateTargets.favorites,
  assignee: appUiStateTargets.assignee,
  documents: appUiStateTargets.documents,
  benchmark: appUiStateTargets.benchmark,
  admin: appUiStateTargets.admin,
  debug: appUiStateTargets.debug
}

export const accountUiStateTarget: UiStateTarget = {
  id: "account",
  label: "アカウント情報",
  regionId: "app-route-region",
  source: "アカウント API"
}
