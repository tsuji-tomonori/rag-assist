# Issue #359 Phase B2 session-local evidence RAG integration 作業レポート

## 受けた指示

- Phase B1 PR #380 final head `62470791` を起点に専用worktree/branchでPhase B2を実装する。
- authoritative scope normalization、current reauthorization、retrieve/answer/trace、bounded security、旧single-scope互換を受け入れ条件へ固定する。
- B1 API securityを弱めず、task/report、日本語draft PR、受け入れ条件コメント、セルフレビュー、final-head CIまで完了する。
- #338 metadata更新はB2/CのPR linkが揃うまで延期し、merge/deploy/releaseを行わない。

## 要件整理

- temporary scopeのauthorityはclient requestではなく、認証actorのtenant+user partitionから読み出すB1 `sessionDocumentContext` とcurrent manifestに置く。
- active referenceだけを通常scopeへ合成し、terminal/expired/cross-owner/cross-tenant/cross-session/client-only scopeを除外する。
- 旧`temporaryScopeId`を維持しつつ、最大20件の`temporaryScopeIds`へ正規化する。上限超過を黙って切り捨てない。
- retrieval時とanswer/citation確定前にcurrent authorizationを再評価し、途中失効時は根拠を除外して不足なら回答不能にする。
- previous citation anchorはcurrent authorization済みの実在source document/chunkだけを使い、assistant本文とclient citationをauthorityにしない。
- user-safe traceはaccepted/denied countとbounded reason codeだけを記録し、tenant/user/session IDや権限外資源の存在を列挙しない。

## 検討・判断

- 既存orchestratorにはrerank後、answer生成後、citation検証後の`reauthorize_evidence`があるため、これを撤去せずtemporary owner/tenant/scope/TTLと最新B1 contextの確認を追加した。
- sync chatは開始前、async chatはadmission時とworker protected-read後にscopeを正規化する。answer-time reauthorizationでもB1 contextを再読するため、run途中でremoved/revokedになったreferenceを拒否できる。
- `/search`は`conversationId`を追加し、指定がない場合はtemporary scopeを採用しない。benchmark searchからはこのfieldを除外してdataset overrideを増やさない。
- `temporaryScopeIds`のpublic schemaはmaxItems=20で拒否する。内部防御でも超過分をdenied countへ含め、`scope_limit_exceeded`をsafe traceへ残す。
- API route/middlewareの認証境界は変更せず、B1のtenant+user partition、not-found非列挙、terminal非復活を保持した。

## 実施作業

- session-local evidence scope normalizerとfocused testsを追加した。
- chat/search/run admission、worker再読、multi-scope lexical/semantic/memory retrieval、cleanup matchingを更新した。
- current evidence reauthorizerへtemporary manifestと最新session contextのcurrent checkを追加した。
- authoritative citation anchor生成とclient citation除去を追加した。
- traceからsession/citation identifier列挙を除去し、bounded normalization summaryを追加した。
- API/contract schemas、ChatRun保存項目、OpenAPI、source-backed API docs、FR-067、RAG data/API design、requirements coverageを同期した。

## 検証結果

- focused scope normalization: 3/3 success
- focused current evidence reauthorization: 2/2 success
- temporary attachment boundary/integration: 3/3 success
- contract schema: 9/9 success
- requirements coverage: success
- graph/trace focused tests: success
- `npm run typecheck -w @memorag-mvp/api`: success
- `task docs:check`: success
- `task verify`: success（lint、全workspace typecheck、全workspace build）
- `npm test -w @memorag-mvp/api`: 810/810 success
- sandbox内での最初のfull API suiteは、server/`tsx`が`/tmp`へIPC socketを作る箇所で`EPERM`となった。実装期待値の2件を修正後、ユーザー確認付きsandbox外再実行で全810件成功した。環境失敗と成功証跡を混同していない。
- GitHub Actions final-head CI: PR作成後に追記する。

## 成果物

- `apps/api/src/rag/_shared/security/session-local-evidence-scope.ts`
- `apps/api/src/rag/_shared/security/current-evidence-reauthorizer.ts`
- `apps/api/src/rag/memorag-service.ts`
- retrieval/orchestration/trace/schema/contract/tests一式
- FR-067、RAG data/API design、OpenAPI/source-backed docs、requirements coverage
- Phase B2 taskと本レポート

## 指示へのfit評価

- authoritative context優先、client-only拒否、current reauthorization、multi-scope、旧single互換、source-only anchor、abstention、bounded traceを実装・direct test・full API suiteで確認した。
- B1 API securityは維持し、cross-owner/unknown conversationはtemporary scopeを取得できない。
- Web UIは変更しておらず、Phase Cの範囲を先取りしていない。
- #338 metadata更新、merge、deploy、releaseは実施していない。

## 未対応・制約・リスク

- GitHub Actions final-head CI、PR受け入れ条件コメント、セルフレビュー、task done移動はdraft PR作成後に実施する。
- `npm install --ignore-scripts`はlockfileを変更しなかったが、auditは既存依存に8件（low 2、moderate 1、high 5）を報告した。本タスクでは依存更新を行っていない。
- source-backed docsは`memorag-service.ts`のsource lineとcall graphを正規生成したため広範なgenerated差分を含む。`task docs:check`で588文書のfreshnessを確認済み。

## 2026-07-18 current mainへの収束

- PR #380でmainへ導入済みの`ConversationHistoryItem` schema v3を正本とし、B2単独コミット`9a215ac`をcurrent mainへ再適用した。
- 競合は5ファイルで、実ソースは`apps/api/src/rag/memorag-service.ts`のimport 1箇所だけだった。mainの`LEGACY_DEBUG_TRACE_TARGET_TYPE_DEFAULT`とB2の`Citation`型を双方保持した。
- 残る4競合はsource-backed generated docsだったため、旧生成物を選択せずcurrent source解消後に正規generatorで再生成した。
- 収束処理内でcontract/API typecheck、contract test、scope normalization、current evidence reauthorization、temporary attachment boundary、schema test、正本文書構造・hidden Unicodeを確認した。
- 収束PRは#444。旧PR #387は#444統合後にsupersededとしてcloseする。
