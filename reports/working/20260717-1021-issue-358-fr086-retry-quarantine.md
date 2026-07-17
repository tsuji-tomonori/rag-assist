# Issue #358 FR-086 bounded retry / quarantine 作業レポート

## 受けた指示

Issue #358のFR-086について、未収束security mutation audit intentのbounded retry、quarantine、poison-intent batch isolationを実装・検証し、日本語draft PR lifecycleまで進める。merge / deploy / releaseは行わない。

## 要件整理と判断

現行production reconcilerはresolver selection、authoritative state、audit completionのいずれかが失敗するとtenant batch全体を停止し、intentへ試行証跡を残さなかった。別storeや別prefixを増やすとIAMとatomic boundaryが広がるため、既存schema-v1 intentへoptional reconciliation evidenceと`quarantined` statusを追加し、同じobject version CASで更新する。

自動再試行上限はversioned constantの3回とする。保存する理由は`resolver_selection_failed`、`authoritative_resolution_failed`、`audit_completion_failed`の固定codeだけで、raw exception、message、stack、機微なARN等を永続化しない。quarantineはcompleted/successではなく未解決の運用対象であり、通常pending列挙から除外する。

## 実施作業と成果物

- intentへattempt count、max attempts、safe last failure code、last attempted/quarantined timestampを追加した。
- `recordReconciliationFailure`を既存object CASで実装し、duplicate workerでも上限3・単一quarantine stateへ収束させた。
- resolver未登録、authoritative resolution failure、audit completion failureをintent単位でcatchし、別intentの処理を同一runで継続する。
- completed-state repair hook failureもbatchを停止せず`repairDeferred`としてworker resultへ公開する。
- quarantine済みintentを通常`listPending`から除外し、`listAll`では運用証跡として読み取れる状態を維持した。
- cross-tenant lookup、corrupt/stale evidenceをfail closedにした。
- poisonと正常intentの同一batch、8 duplicate workers、transient completion failure、repair deferredを自動テストで固定した。
- FR-086正本文書、requirements coverage、static security policy、source-backed API docs 97 APIs / 582 documentsを同期した。
- 新規store/prefix/actionは不要で、既存workerのintent List/Get/Put CAS IAM内に収まるためinfra snapshot/inventory変更は不要と判断した。

## 検証

- selected outbox / production worker / access-control / requirements coverage: 4 files成功。
- API full coverage: 828 / 828成功、statement/line 90.48%、branch 80.31%、function 93.05%。
- 最後に追加したtransient audit completion testを含むselected 2 files: 成功。
- API typecheck・build、root lint: 成功。
- `task docs:check`: 成功。OpenAPI、source-backed API docs、canonical docs、web/infra inventory、hidden Unicodeを確認した。
- product runtime source audit: dataset-specific branch 0件、artifact mismatch 0件。
- `npm ci`: 成功。既存8 vulnerabilitiesを報告。
- `git diff --check`: 成功。

失敗と修復:

- 初回typecheckは新worktreeのdependencies未展開によりworkspace contractを解決できず、同時に新しいworker resultを返すtest mock 1件の不足を検出した。`npm ci`後にmockを更新し、typecheckを成功させた。
- access-control selected test初回はpackage testと同じsafe guard profile環境を付けず、起動前fail-closedになった。同じtest profileを明示して再実行し4 files成功を確認した。
- sandbox内のAPI full coverageは既知の`tsx` IPC listen `EPERM`によりHTTP 5 filesだけ失敗し、107/112 files成功だった。権限委譲後に同一full commandを再実行し828 / 828成功を確認した。
- source-backed API docs初回checkはoutboxの行追加で4 API・17生成物がstaleだった。正規generatorで97 APIs / 582 documentsを再生成し、check成功を確認した。

## 指示への fit 評価

未収束intentをsuccessへ誤変換せず、有限回だけ自動再試行し、上限後はdurable quarantineとして可視化する。poison intentのraw errorを保存せず、同一tenantの正常intentを同じrunで収束できる。新しい認可・storage境界は追加していない。

## 未対応・制約・リスク

- quarantine解除、手動再投入、管理API/運用UI、alarm/metricは後続。現時点の可観測性はdurable intentとworker resultである。
- folder/document share・move・delete、principal transfer、application role authoritative resolverは後続。
- 実AWS S3/EventBridge/Lambda duplicate deliveryは未検証。local CAS fault testsとfinal-head CIを証跡にする。
- stacked baseはPR #394 branch。Draft PR、AC/self-review、final-head CIのURLはlifecycle commitで追記する。
- Issue #358全体は未完了として維持する。
- merge / deploy / releaseは実施しない。
