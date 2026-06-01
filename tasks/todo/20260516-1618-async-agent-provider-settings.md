# 非同期エージェント provider credential / tenant settings 管理を追加する

保存先: `tasks/todo/20260516-1618-async-agent-provider-settings.md`

## 状態

- todo

## タスク種別

- 機能追加

## 背景

Claude Code / Codex / OpenCode provider は command env が設定された場合だけ available になる。provider credentials、Secrets rotation、tenant/user-level provider settings、管理 UI は未実装である。

## 目的

provider の有効化・無効化・credential 参照・rotation 状態を管理し、未設定時は正直に `not_configured` を返す運用可能な provider settings を追加する。

## 対象範囲

- async agent provider registry/config
- Secrets Manager / local config boundary
- admin provider settings API/UI
- audit log
- docs / operations

## 実行計画

1. tenant-level / user-level / admin-managed service credential の初期方針を決める。
2. credential 値そのものを返さない settings schema を定義する。
3. provider enable/disable、command path、credential ref、rotation metadata を管理する。
4. provider unavailable / not configured の UI を架空値なしで表示する。
5. credential 更新と provider 有効化を audit log に残す。

## 受け入れ条件

- credential secret value が API response、debug trace、artifact、UI に出ない。
- provider 設定がない場合は mock 実行や mock artifact を作らず `not_configured` になる。
- provider 設定変更は管理権限と audit log で保護される。
- tenant/user/service credential の採用範囲と未対応範囲が docs/PR に記録される。
- local 開発時の設定手順と本番 secret 運用手順が分離されている。

## 検証計画

- `npm run test -w @memorag-mvp/api -- src/rag/memorag-service.test.ts`
- `npm run test -w @memorag-mvp/api -- src/security/access-control-policy.test.ts`
- `npm run test -w @memorag-mvp/web`
- `git diff --check`

## PRレビュー観点

- secret value を保存・表示・ログ出力していないか。
- 未設定 provider を本番 UI で利用可能に見せていないか。
- provider 設定が他 tenant/user に漏れないか。

## 関連

- `docs/spec/gap-phase-g.md`
- `tasks/done/20260515-0032-g2-async-agent-claude-code.md`
