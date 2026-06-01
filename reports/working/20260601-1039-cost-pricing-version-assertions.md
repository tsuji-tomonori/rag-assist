# Cost pricing version assertions 作業完了レポート

- 日時: 2026-06-01 10:39 JST
- 対象タスク: `tasks/do/20260516-1625-full-spec-gap-implementation.md`

## 受けた指示

- `.workspace/plan-060101.txt` の章別仕様 gap 実装を継続する。
- 完了条件を満たすまで完了扱いせず、実施した検証だけを記録する。

## 要件整理

- plan は cost export / cost audit に `pricingVersion` と `dataCompleteness` を含める方針を示している。
- `CostAuditSummary.pricingVersion` の実装は追加済みだが、export payload と Web 表示がこの field を保持することの回帰テストが不足していた。

## 検討・判断

- 実装追加ではなく、監査 contract を固定する assertion を追加するのが今回の最小で有効な進捗と判断した。
- export payload と UI 表示の両方を押さえ、API 側と Web 側の境界で pricingVersion が落ちないことを確認した。

## 実施作業

- service test の cost summary export payload assertion に top-level `pricingVersion` を追加した。
- Web `AdminWorkspace` test に Cost panel の top-level pricing version 表示 assertion を追加した。

## 成果物

- `apps/api/src/rag/memorag-service.test.ts`
- `apps/web/src/features/admin/components/AdminWorkspace.test.tsx`
- `tasks/do/20260516-1625-full-spec-gap-implementation.md`

## 検証

- `./node_modules/.bin/tsx --test apps/api/src/rag/memorag-service.test.ts`: pass（48 件）
- `npm run test -w @memorag-mvp/web -- src/features/admin/components/AdminWorkspace.test.tsx`: pass（8 件）
- `git diff --check`: pass

## fit 評価

- cost summary の top-level `pricingVersion` が export payload と UI 表示で保持されることをテストで固定し、plan の export 監査要件への回帰耐性を上げた。
- 実 AWS/S3 での export file 生成と signed URL ダウンロードは未検証。

## 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- 実 AWS/S3 への admin export 保存と署名付き URL の実ダウンロードは未検証。
- 章別仕様差分全体の PR 作成、PR コメント、task done 移動は未実施。
