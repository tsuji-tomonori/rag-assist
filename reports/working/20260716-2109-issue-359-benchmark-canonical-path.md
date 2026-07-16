# Issue #359 benchmark 正本 path 一本化 作業完了レポート

- 作成日時: 2026-07-16 21:09 JST
- 対象 issue: #359 Phase 2
- branch: `codex/issue-359-benchmark-canonical-path`
- 起点: `origin/main` (`e12abb07`)

## 受けた指示

未接続の複数形 root に残る benchmark suite contract を全参照調査・分類し、workspace 正本 `benchmark/` へ履歴保持で統合する。README、active script、test、今回 task を同期し、旧 source root の不在と再導入防止 guard を既存 benchmark test 経路へ接続する。sample validator、init / run contract dry-run、secret hygiene、artifact path / redaction、benchmark full test / typecheck / build、root CI、docs check を検証する。

PR #366 が変更する `benchmark/release-audit.ts` と `benchmark/release-audit.test.ts` は変更せず、benchmark 固有の期待値・QA sample・dataset 分岐を product runtime へ移さない。

## 要件整理と RCA

正本 workspace は単数形 root だったが、suite contract 導入時に58ファイルが別 root に追加され、その validator test が workspace test script に接続されていなかった。二重 root の再導入を検知する完了条件もなかったため、未接続状態が CI で検出されなかった。

単純削除では schema、validator、negative tests、permission fixture、artifact / secret contract、sample suite を失うため、全58ファイルを `git mv` で `benchmark/{README.md,_shared,suites}` へ移管する判断とした。詳細な全参照調査と preserve / migrate / delete 表は今回 task md に記録した。

既存 `tasks/done/` と過去 `reports/working/` は当時の事実を保持する履歴であり、active path guard の走査対象外として変更していない。artifact output `artifacts/benchmarks/` と API test の S3 object key は repository source path ではない外部 contract として明示的に preserve した。

## 実施作業

- 58ファイルを `benchmark/README.md`、`benchmark/_shared/**`、`benchmark/suites/**` へ履歴保持で移管した。
- README、suite `init.sh`、validator、validator test の active filesystem path を正本へ更新した。
- `benchmark/package.json` に `test:suites` を追加し、通常の benchmark `npm test` から validator negative tests 5件を実行するよう接続した。
- `benchmark/canonical-path.test.ts` を追加し、旧 root directory と active repository の旧 filesystem path 再導入を検知するようにした。
- guard で artifact output と S3 object key の意味を区別し、S3 key が既知の2参照だけであることも確認した。
- sample suite の validator、init dry-run、run contract dry-runを実施した。

## 成果物

| 成果物 | 内容 |
| --- | --- |
| `benchmark/README.md` | 正本 workspace 内の suite contract、構成、実行導線 |
| `benchmark/_shared/**` | schema、config、fixture、evaluator、validator / contract scripts |
| `benchmark/suites/internal_qa/leave_policy_v1/**` | sample suite と synthetic fixture |
| `benchmark/canonical-path.test.ts` | 旧 root / active reference の再導入 guard |
| `benchmark/package.json` | validator test の通常 test 経路への接続 |
| `tasks/do/20260716-2057-issue-359-benchmark-canonical-path.md` | RCA、全参照、分類、受け入れ条件 |

## dry-run と安全性確認

- init artifact: `/tmp/rag-assist-issue-359-benchmark-path-init/init_result.json`
  - `status: validation_only`
  - API upload / ingest / index verification は environment-specific runner の責務であることを明示
- run artifact: `/tmp/rag-assist-issue-359-benchmark-path-run/run_summary.json`
  - `status: blocked`
  - Chat API 未配線を成功扱いせず、promotion gate も blocked として明示
- 両 artifact を secret、token、password、authorization、judge prompt、sample 文書名で走査し、該当0件だった。
- moved suite / shared 定義に secret 実値の assignment がないことを確認した。
- `artifacts/benchmarks/.gitignore` が生成 artifact を除外し `.gitignore` 自体を保持する contract を確認した。
- product runtime へ benchmark 固有期待語句、QA sample 固有値、dataset 固有分岐を追加していない。

## 検証結果

| 検証 | 結果 |
| --- | --- |
| `node benchmark/_shared/scripts/validate-suite.mjs --suite-dir benchmark/suites/internal_qa/leave_policy_v1` | pass、2 cases / 2 documents |
| `node --test benchmark/_shared/scripts/validate-suite.test.mjs` | pass、5 tests |
| init / run contract dry-run | pass、validation-only / blocked artifact を `/tmp` に生成 |
| `npm test -w @memorag-mvp/benchmark` | pass、103 workspace tests + 5 suite validator tests |
| `npm run typecheck -w @memorag-mvp/benchmark` | pass |
| `npm run build -w @memorag-mvp/benchmark` | pass |
| `npm run ci` | pass。contract、API 801、web 442、infra 38、benchmark 103+5、全 build を含む |
| `task docs:check` | pass。canonical docs、OpenAPI、API-code 97/582、Web trace / inventory、infra inventory、hidden Unicode |
| `npm run docs:hidden-unicode:check` | pass |
| `git diff --check` | pass |
| `benchmark/release-audit.ts` / `.test.ts` 差分 | なし |
| pre-commit | 対象62ファイルで pass。全ファイル初回は対象外の過去 report の既存 trailing whitespace を自動修正したため、その対象外変更を戻して scope を限定した |

途中、最初の canonical guard 実行では移管後に残った空の旧 directory を検出して失敗した。空 directory を除去して再実行し、guard を含む全 test が成功した。sandbox 内の `tsx` IPC が `EPERM` となった再実行は、影響範囲を明示して承認を得たうえで同一 benchmark test を実行し成功した。

## 指示への fit 評価

- 正本 path、test 導線、再導入 guard、active docs / scripts を一つの変更として収束した。
- 外部 contract である artifact path / S3 key は改名せず、source root と区別した。
- 未配線 runner を成功扱いせず blocked artifact として保持した。
- PR #366 の変更対象と product runtime を変更していない。
- README 以外の product docs は API・挙動・運用契約に変更がなく、generated docs も freshness check が成功したため更新不要と判断した。

## 未対応・制約・リスク

- `run-suite.sh` の実 API / Chat execution は既存どおり environment-specific runner の後続責務であり、本変更では実装していない。
- sample PDF は数百 byte の synthetic placeholder であり、実 ingest 品質の corpus ではない。
- PR #366 と同じ `benchmark/` workspace を触るため、ファイル直接重複はないが merge 順序による branch-level conflict の可能性は残る。`release-audit*` を未変更にすることで競合面を限定した。
- `npm ci` は成功したが、既存 dependency audit は8件（low 2、moderate 1、high 5）を報告した。本 path 移管の範囲外であり自動修正していない。

## PR lifecycle

- PR #370 `♻️ benchmark正本パスを一本化` を GitHub Apps で作成した。
- `semver:patch` label を付与した。
- 日本語の受け入れ条件確認を top-level comment に記録し、技術的な条件をすべて満たすと判定した。
- 日本語のセルフレビューを top-level comment に記録し、blocking 指摘なしと判定した。
- task を `tasks/done/` へ移動する完了更新を同じ branch に追加する。
- merge / deploy / release は実施していない。
