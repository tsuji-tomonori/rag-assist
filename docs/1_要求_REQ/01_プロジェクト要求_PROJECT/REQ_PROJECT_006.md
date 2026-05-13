# security access-control review と RAG 品質境界

- ファイル: `docs/1_要求_REQ/01_プロジェクト要求_PROJECT/REQ_PROJECT_006.md`
- 種別: `REQ_PROJECT`
- 要求ID: `PRJ-006`
- 作成日: 2026-05-07
- 最終更新日: 2026-05-07
- 状態: Draft

## 背景

MemoRAG MVP は RAG 根拠性、認可境界、benchmark、debug trace を継続的に扱うため、変更時に security と RAG 品質の境界を弱めない確認が必要である。

## 目的

- PRJ-006: MemoRAG MVP の security、認可、RAG 品質、benchmark に影響する変更は、認可境界と根拠性を弱めていないことを確認しなければならない。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `PRJ-006` |
| 説明 | security access-control review、PR セルフレビューの RAG / 認可観点、benchmark 固有値ハードコード禁止を定める要求。 |
| 根拠 | RAG の根拠性または認可境界が弱まると、信頼性と安全性に直接影響するため。 |
| 源泉 | `AGENTS.md`、`skills/security-access-control-reviewer/SKILL.md`、`skills/pr-review-self-review/SKILL.md`。 |
| 種類 | プロジェクト要求、品質保証制約、セキュリティ制約。 |
| 依存関係 | `PRJ-001`, `PRJ-005`, `PRJ-007` |
| 衝突 | 変更が security / RAG / benchmark に非該当の場合は、非該当理由を記録する。 |
| 受け入れ基準 | 本文の「受け入れ条件」を正とする。 |
| 優先度 | High |
| 安定性 | Stable。RAG workflow、認可方式、benchmark 方針変更時に見直す。 |
| 旧制約ID | `PRJ-001-C-011`, `PRJ-001-C-013`, `PRJ-001-C-014` |

## 制約

- PRJ-006-C-001: API route、middleware、認証、認可、RBAC、所有者境界、benchmark、debug trace、機微データ返却範囲に影響する変更は、security access-control review を実施しなければならない。
- PRJ-006-C-002: PR セルフレビューでは、docs と実装の同期、変更範囲に見合うテスト、RAG の根拠性、認可境界を確認しなければならない。
- PRJ-006-C-003: RAG 品質修正では、benchmark 期待語句、QA sample 固有値、dataset 固有分岐、根拠選択を迂回する domain word list を実装へ入れてはならない。

## 受け入れ条件

- PRJ-006-AC-001: security / 認可 / RAG / benchmark に影響する変更では、該当観点の確認結果が task、report、PR 本文、または PR コメントに記録されていること。
- PRJ-006-AC-002: 非該当の場合は、非該当理由が記録されていること。
- PRJ-006-AC-003: RAG 品質修正の PR 差分に、benchmark 期待語句、QA sample 固有値、dataset 固有分岐、根拠選択を迂回する domain word list が含まれていないこと。
- PRJ-006-AC-004: blocking の security または RAG 品質指摘が残る場合、完了扱いされていないこと。

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | Pass | RAG 根拠性と認可境界は MVP の信頼性に直結するため必要である。 |
| 十分性 | Pass | security review、PR セルフレビュー観点、benchmark 固有値禁止を含む。 |
| 理解容易性 | Pass | 対象変更と非該当時の扱いを分けている。 |
| 一貫性 | Pass | security access-control review と PR self review のルールに合う。 |
| 検証可能性 | Pass | 差分、task、report、PR コメントで確認できる。 |

## 変更履歴

| 日付 | 変更者 | 内容 |
|---|---|---|
| 2026-05-07 | Codex | `PRJ-001` から security / RAG 品質関連要求を分割。 |
