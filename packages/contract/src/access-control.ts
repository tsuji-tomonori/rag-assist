export const ROLE_CATALOG_VERSION = "memorag-access-role-catalog-v2" as const

export const COGNITO_SESSION_INVALID_AT_ATTRIBUTE_NAME = "session_invalid_at" as const
export const COGNITO_SESSION_INVALID_AT_USER_ATTRIBUTE = `custom:${COGNITO_SESSION_INVALID_AT_ATTRIBUTE_NAME}` as const

export const APPLICATION_ROLES = [
  "CHAT_USER",
  "ANSWER_EDITOR",
  "RAG_GROUP_MANAGER",
  "BENCHMARK_OPERATOR",
  "BENCHMARK_RUNNER",
  "ASYNC_AGENT_USER",
  "SKILL_PROFILE_ADMIN",
  "ASYNC_AGENT_ADMIN",
  "USER_ADMIN",
  "ACCESS_ADMIN",
  "COST_AUDITOR",
  "SYSTEM_ADMIN"
] as const

export type ApplicationRole = (typeof APPLICATION_ROLES)[number]

export const DEFAULT_APPLICATION_ROLE: ApplicationRole = "CHAT_USER"

export const APPLICATION_ROLE_DISPLAY_CATALOG = {
  CHAT_USER: {
    displayName: "チャット利用者",
    description: "チャット、本人の履歴・利用状況、許可された文書検索を利用します。"
  },
  ANSWER_EDITOR: {
    displayName: "問い合わせ回答担当",
    description: "割り当てられた問い合わせの回答を編集・公開します。"
  },
  RAG_GROUP_MANAGER: {
    displayName: "RAG グループ管理者",
    description: "許可された文書・フォルダ・リソースグループと用語展開を管理します。"
  },
  BENCHMARK_OPERATOR: {
    displayName: "性能評価オペレーター",
    description: "性能評価の定義を参照し、許可された評価を実行します。"
  },
  BENCHMARK_RUNNER: {
    displayName: "性能評価実行者",
    description: "評価専用 corpus と query を使って性能評価を実行します。"
  },
  ASYNC_AGENT_USER: {
    displayName: "非同期エージェント利用者",
    description: "本人の非同期エージェント実行、成果物、preset を管理します。"
  },
  SKILL_PROFILE_ADMIN: {
    displayName: "スキル・プロファイル管理者",
    description: "共有スキルとエージェントプロファイルを管理します。"
  },
  ASYNC_AGENT_ADMIN: {
    displayName: "非同期エージェント管理者",
    description: "管理対象の非同期エージェント実行と実行設定を管理します。"
  },
  USER_ADMIN: {
    displayName: "ユーザー管理者",
    description: "管理対象ユーザーの作成、状態変更、利用状況確認を行います。"
  },
  ACCESS_ADMIN: {
    displayName: "アクセス管理者",
    description: "アプリケーションロールの割り当てと認可ポリシーの確認を行います。"
  },
  COST_AUDITOR: {
    displayName: "コスト監査担当",
    description: "提供可能な全体コスト情報を監査します。"
  },
  SYSTEM_ADMIN: {
    displayName: "システム管理者",
    description: "システム全体の管理と復旧に必要な権限を持つ system preset です。"
  }
} as const satisfies Record<ApplicationRole, { displayName: string; description: string }>

/** FR-076 enabled cells. resourceGroup.move/share are intentionally absent. */
export const RESOURCE_OPERATION_FEATURE_PERMISSIONS = [
  "document.create",
  "document.read",
  "document.update",
  "document.delete",
  "document.move",
  "document.share",
  "document.useInSearch",
  "folder.create",
  "folder.read",
  "folder.update",
  "folder.delete",
  "folder.move",
  "folder.share",
  "folder.useInSearch",
  "resourceGroup.create",
  "resourceGroup.read",
  "resourceGroup.update",
  "resourceGroup.delete",
  "resourceGroup.useInSearch"
] as const

export type ResourceOperationFeaturePermission = (typeof RESOURCE_OPERATION_FEATURE_PERMISSIONS)[number]

const resourceReadSearchFeaturePermissions = [
  "document.read",
  "document.useInSearch",
  "folder.read",
  "folder.useInSearch",
  "resourceGroup.read",
  "resourceGroup.useInSearch"
] as const satisfies readonly ResourceOperationFeaturePermission[]

export const ROLE_PERMISSION_CATALOG = {
  CHAT_USER: [
    "chat:create",
    "chat:read:own",
    "chat:read:shared",
    "chat:share:own",
    "chat:delete:own",
    "usage:read:own",
    "cost:read:own",
    "rag:doc:read",
    ...resourceReadSearchFeaturePermissions
  ],
  ANSWER_EDITOR: ["answer:edit", "answer:publish"],
  RAG_GROUP_MANAGER: [
    "rag:group:create",
    "rag:group:assign_manager",
    "rag:doc:read",
    "rag:doc:share",
    "rag:doc:move",
    "rag:doc:write:group",
    "rag:source:approve",
    "rag:doc:delete:group",
    "rag:index:rebuild:group",
    "rag:alias:read",
    "rag:alias:write:group",
    "rag:alias:review:group",
    "rag:alias:disable:group",
    "rag:alias:publish:group",
    "benchmark:read",
    "benchmark:run",
    ...RESOURCE_OPERATION_FEATURE_PERMISSIONS
  ],
  BENCHMARK_OPERATOR: ["benchmark:read", "benchmark:run"],
  BENCHMARK_RUNNER: [
    "benchmark:query",
    "benchmark:seed_corpus",
    "document.create",
    "document.read",
    "document.delete",
    "document.useInSearch"
  ],
  ASYNC_AGENT_USER: [
    "agent:cancel",
    "agent:read:self",
    "agent:trace:read:self",
    "agent:artifact:download",
    "skill:read",
    "agent_profile:read",
    "agent_preset:read:self",
    "agent_preset:create:self",
    "agent_preset:update:self",
    "agent_preset:delete:self"
  ],
  SKILL_PROFILE_ADMIN: [
    "skill:read",
    "skill:create",
    "skill:update",
    "skill:delete",
    "skill:share",
    "skill:generate_with_ai",
    "agent_profile:read",
    "agent_profile:create",
    "agent_profile:update",
    "agent_profile:delete",
    "agent_profile:share",
    "agent_profile:generate_with_ai"
  ],
  ASYNC_AGENT_ADMIN: [
    "agent:cancel",
    "agent:read:self",
    "agent:read:managed",
    "agent:trace:read:self",
    "agent:trace:read:sanitized",
    "agent:artifact:download",
    "agent:settings:manage",
    "skill:read",
    "agent_profile:read",
    "agent_preset:read:self"
  ],
  USER_ADMIN: [
    "user:create",
    "user:read",
    "user:suspend",
    "user:unsuspend",
    "user:delete",
    "usage:read:all_users",
    "usage:export"
  ],
  ACCESS_ADMIN: ["access:role:create", "access:role:update", "access:role:assign", "access:policy:read", "access:audit:export"],
  COST_AUDITOR: ["cost:read:all", "cost:export"],
  SYSTEM_ADMIN: [
    "chat:create",
    "chat:read:own",
    "chat:read:shared",
    "chat:share:own",
    "chat:delete:own",
    "chat:admin:read_all",
    "answer:edit",
    "answer:publish",
    "support:ticket:read:all",
    "rag:group:create",
    "rag:group:assign_manager",
    "rag:doc:read",
    "rag:doc:share",
    "rag:doc:move",
    "rag:doc:write:group",
    "rag:source:approve",
    "rag:doc:delete:group",
    "rag:index:rebuild:group",
    "rag:alias:read",
    "rag:alias:write:group",
    "rag:alias:review:group",
    "rag:alias:disable:group",
    "rag:alias:publish:group",
    "benchmark:read",
    "benchmark:query",
    "benchmark:run",
    "benchmark:seed_corpus",
    "benchmark:cancel",
    "benchmark:download",
    "debug:trace:read:self",
    "debug:trace:read:sanitized",
    "debug:trace:read:internal",
    "debug:trace:export",
    "debug:ingest:read",
    "debug:chunk:read",
    "debug:replay",
    "debug:settings:update",
    "debug:answer_generation:read",
    "debug:answer_generation:export",
    "agent:cancel",
    "agent:read:self",
    "agent:read:managed",
    "agent:trace:read:self",
    "agent:trace:read:sanitized",
    "agent:trace:read:internal",
    "agent:artifact:download",
    "agent:settings:manage",
    "skill:read",
    "skill:create",
    "skill:update",
    "skill:delete",
    "skill:share",
    "skill:generate_with_ai",
    "agent_profile:read",
    "agent_profile:create",
    "agent_profile:update",
    "agent_profile:delete",
    "agent_profile:share",
    "agent_profile:generate_with_ai",
    "agent_preset:read:self",
    "agent_preset:create:self",
    "agent_preset:update:self",
    "agent_preset:delete:self",
    "usage:read:own",
    "usage:read:all_users",
    "usage:export",
    "cost:read:own",
    "cost:read:all",
    "cost:export",
    "user:create",
    "user:read",
    "user:suspend",
    "user:unsuspend",
    "user:delete",
    "access:role:create",
    "access:role:update",
    "access:role:assign",
    "access:policy:read",
    "access:audit:export",
    ...RESOURCE_OPERATION_FEATURE_PERMISSIONS
  ]
} as const satisfies Record<ApplicationRole, readonly string[]>

export const UNASSIGNED_APPLICATION_PERMISSIONS = [
  "agent:run",
  "agent:artifact:writeback",
  "agent:provider:manage"
] as const

export type ApplicationPermission =
  | (typeof ROLE_PERMISSION_CATALOG)[ApplicationRole][number]
  | (typeof UNASSIGNED_APPLICATION_PERMISSIONS)[number]

const applicationRoleSet = new Set<string>(APPLICATION_ROLES)

export function isApplicationRole(value: string): value is ApplicationRole {
  return applicationRoleSet.has(value)
}
