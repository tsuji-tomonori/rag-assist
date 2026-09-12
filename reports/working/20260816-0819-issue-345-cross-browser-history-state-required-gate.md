# Issue #345 cross-browser履歴状態required gate 作業レポート

保存先: `reports/working/20260816-0819-issue-345-cross-browser-history-state-required-gate.md`

## 1. 実施概要

- current main、前回以降の変更、open PR／Issue、task、正本・生成物を確認した。
- Draft PR #462の既存cross-browser gateを、履歴のloading／500／retry／confirmed empty／403へ限定して拡張した。
- production UI、API、認可、RAG回答contractは変更せず、task、E2E、正本、authored matrix、生成文書を同期した。
- 自動browser証跡をmanual screen reader、実browser zoom、touch／実機の合格へ読み替えず、PRとtaskはDraft／`do`を維持した。

## 2. 判断と競合確認

- current `main@8e542b31`と作業開始時の#462 `4eeef71e`はbehind 0であり、main再統合は不要だった。
- Chromium requiredでのみ検査していたresource状態のうち、false zero、private detail、retry、permissionをFirefox／WebKitでも検出する小さな増分を選定した。
- cross-browser required増分は履歴2 scenario×2 browserの4件だけで、合計14件から18件とした。
- open PR #461との今回の新規path overlapは正規generator出力`docs/generated/web-ui-inventory.json`だけである。authored sourceは重複せず、統合時は最終sourceからgeneratorを再実行する。
- #341〜#344の旧並行作業は統合済みで、正本は既存のauthoritative requirement／designを更新し、重複正本を作らなかった。

## 3. 実装・文書同期

- `E2E-UI-CROSS-BROWSER-STATE-001`を追加し、履歴のloading→500→retry→confirmed emptyとHTTP 403をbrowser別に検査した。
- loading／error／permission中は未確認件数を0件またはemptyとして表示せず、private detailを露出しないことを確認した。
- browser project、state sequence、evidence boundaryをJSON attachmentへ保存した。
- required script／workflow表示名、E2E READMEを同期した。
- `SQ-016`、`NFR-018`、`DES_UI_UX_001`、machine-readable trace／quality matrixを更新し、正規generatorでWeb生成文書を同期した。

## 4. 検証結果

| 検証 | 結果 | 補足 |
| --- | --- | --- |
| `npm ci` | pass | lockfile install 504 packages |
| repository lint | pass | warning 0 |
| Web typecheck | pass | `tsc --noEmit` |
| Web unit | pass | 62 files／447 tests |
| Web build | pass | 既存chunk-size advisoryのみ |
| cross-browser required discovery | pass | Firefox 9＋WebKit 9、合計18 tests／6 files |
| cross-browser local実走 | blocked | network-enabled webServer起動がsandbox境界で拒否されたため、GitHub Actionsを実走証跡とする |
| UI trace | pass | 13 tests |
| semantic UI | pass | 5 tests |
| manual evidence contract | pass | 7 tests。baselineはpass 0／blocked 3／not_run 1、release-ready false |
| generated freshness／canonical docs | pass | 正規generator後にfresh |
| OpenAPI／API code docs | pass | 98 APIs／588 documents |
| infra／hidden Unicode／Taskfile alias／diff | pass | 差分なし |
| `task docs:check` | unavailable | runnerに`task`がなく、Taskfileで解決される各checkを直接実行して成功 |
| 修正head Web UI Quality | pass | run `31915498568`。Chromium required成功、Firefox／WebKit 18／18、retry／flakyなし |
| cross-browser artifact | pass | `9254810495`、digest `sha256:eca86fd6c3e4f4924593f505dff3c11c6d6f8ce237ac5f0fbbe9ec7d7e4df4bb` |
| Chromium artifact | pass | `9254811423`、digest `sha256:8c94ed6888c4e7d06fe6265f85c3d43513d67e013dc03870e6f199b0a71db587` |
| 修正head semver | pass | run `31915498559` |
| 修正head MemoRAG CI | pass | run `31915498575`。API／Web coverage、build、synthを含む全job成功 |
| evidence-head Web UI Quality | pass | run `31915883140`。Chromium required成功、Firefox／WebKit 18／18、retry／flakyなし |
| evidence-head cross-browser artifact | pass | `9254898373`、digest `sha256:dae3f250cfd8113877ee2a5ee54eda4a4ea7164b973875c29551fb2376dc011b` |
| evidence-head Chromium artifact | pass | `9254901227`、digest `sha256:6984c210805f97d94fe7af027654dcbdf2ff603c87a9dba25d2f8d13285f51f1` |
| evidence-head MemoRAG CI | pass | run `31915883144` |
| evidence-head semver | pass | run `31915883139` |

## 5. CI検出と修復

- 実装head `26ed314d`のWeb UI QualityではChromium requiredが成功し、新規Firefox／WebKit state testだけが確定的に失敗した。
- 原因はReactが履歴resourceの処理完了時に`aria-busy={false}`を文字列`"false"`ではなく属性なしとして描画するのに、E2Eが文字列属性を期待していたことだった。
- 完了状態を`aria-busy`属性なしとして検証するよう修正した。loading、error、permission、retry、false-zero、private-detailの期待値は緩和していない。
- 同じ初回runで既存WebKit semantics testが1回timeout後に再試行成功した。修正headでは同scenarioを含むFirefox／WebKit 18／18がretry／flakyなしで成功し、今回の修正後に再現していないことを確認した。

## 6. 未完了・制約

- representative screen reader、browser UIを操作する実200%／400% zoom、text-only zoom、OS scaling、touch／実機、Firefox／WebKit native accessibility treeは未実施である。
- FR-051永続化／profile state contract、API C1 85%、OQ-UI-002 owner／cadenceは未解決である。
- local browser実走はsandbox境界でblockedであり、GitHub Actions成功を代替の自動実走証跡とするがmanual証跡にはしない。
- merge、deploy、release、force-push、破壊的変更は実施しない。

## 7. 次の具体的作業

1. final record commitのGitHub Actionsを確認する。
2. representative screen reader、実browser zoom、touch／実機を承認済み環境で実施する。
3. FR-051、API C1、OQ-UI-002のowner判断を進める。

## 8. fit評価

総合fit: 4.7 / 5.0（約94%）

理由: boundedなE2E、正本、生成物、local検証、evidence-head CI、PR／Issue記録を同期した。manual／owner依存項目を未完了として残しているため、Issue全体は完了扱いにしない。

## 9. GitHub記録

- [Draft PR #462](https://github.com/tsuji-tomonori/rag-assist/pull/462)
- [受け入れ確認](https://github.com/tsuji-tomonori/rag-assist/pull/462#issuecomment-5304836582)
- [セルフレビュー](https://github.com/tsuji-tomonori/rag-assist/pull/462#pullrequestreview-4944984602)
- [Issue #345進捗](https://github.com/tsuji-tomonori/rag-assist/issues/345#issuecomment-5304836743)
