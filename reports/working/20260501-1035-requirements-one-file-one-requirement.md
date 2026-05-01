# 作業完了レポート

保存先: `reports/working/20260501-1035-requirements-one-file-one-requirement.md`

## 1. 受けた指示

- 主な依頼: 要件を 1要件1ファイルへ修正し、各要件ファイルに受け入れ条件を明記する。
- 追加依頼: この書き方を強制するルールを skills に記載し、AGENTS 側でも明示する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 要件を 1要件1ファイル化 | 高 | 対応 |
| R2 | 各要件ファイルに受け入れ条件を同居 | 高 | 対応 |
| R3 | skills に強制ルールを追加 | 高 | 対応 |
| R4 | AGENTS にも方針を追記 | 高 | 対応 |

## 3. 検討・判断したこと

- 既存 `REQUIREMENTS.md` は運用インデックスに切り替え、詳細要求は分割ファイルを正とする方針を採用した。
- FR/NFR の既存ID体系を維持しつつ、対応する受け入れ条件を各ファイルへ埋め込む構成にした。
- skills では全体ルール（docs-swebok）と個別ルール（functional/nonfunctional/acceptance）の両面に追記し、運用強制力を高めた。

## 4. 実施した作業

- `memorag-bedrock-mvp/docs/1_要求_REQ/...` 配下に FR/NFR の分割ファイルを新規作成。
- 各分割ファイルへ「要件」と「受け入れ条件（この要件専用）」を明記。
- `memorag-bedrock-mvp/docs/REQUIREMENTS.md` をインデックス用途に再構成。
- `AGENTS.md` に 1要件1ファイル + 要件内受け入れ条件の必須ルールを追記。
- 関連 skills (`docs-swebok-template-writer`, `docs-functional-requirement-writer`, `docs-nonfunctional-requirement-writer`, `docs-acceptance-criteria-writer`) に強制ルールを追記。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/docs/REQUIREMENTS.md` | Markdown | 要件運用ルールと分割ファイル一覧 | R1, R2 |
| `memorag-bedrock-mvp/docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/REQ_FUNCTIONAL_001.md` - `REQ_FUNCTIONAL_013.md` | Markdown | FRごとの個別要件 + 受け入れ条件 | R1, R2 |
| `memorag-bedrock-mvp/docs/1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/REQ_NON_FUNCTIONAL_001.md` - `REQ_NON_FUNCTIONAL_009.md` | Markdown | NFRごとの個別要件 + 受け入れ条件 | R1, R2 |
| `skills/*/SKILL.md` (4ファイル) | Markdown | 1要件1ファイル運用の強制ルール追記 | R3 |
| `AGENTS.md` | Markdown | docs更新ポリシーへの明示追加 | R4 |

## 6. 指示へのfit評価

総合fit: 5.0 / 5.0（約100%）

- 指示網羅性: 主要依頼を全て実施。
- 制約遵守: 既存ID体系とdocs方針を維持しながら移行。
- 成果物品質: 要件ごとに受け入れ条件を同一ファイル化。
- 検収容易性: インデックス化により参照しやすくした。

## 7. 未対応・制約・リスク

- 未対応: なし。
- 制約: 既存ACの粒度は元文書依存のため、一部は将来の詳細化余地あり。
- リスク: 要件追加時に同ルールを守らない更新が入ると再び集約化する可能性があるため、skills/AGENTS の運用徹底が必要。
