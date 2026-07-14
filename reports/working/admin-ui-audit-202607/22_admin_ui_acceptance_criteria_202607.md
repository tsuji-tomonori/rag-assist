# 管理画面 改善受け入れ条件（2026-07）

## 記述規則

- すべて後続実装用の候補であり、現行実装が充足済みという意味ではない。
- 1 行を 1 個の独立して判定可能な結果とする。複数行をまとめて一つの test にしてよいが、一部だけ成功した場合に全体を合格にしない。
- `Given` の actor、tenant、期間、状態を fixture で固定し、`When` の操作一回に対して `Then` を一つ検証する。
- 金額・件数は架空の production fallback を使わず、test fixture の quantity と versioned pricing から期待値を算出する。
- `Type` は `normal`、`error`、`permission`、`boundary`、`empty`、`loading`、`recovery`、`security`、`nfr` のいずれかを主分類とする。

## TASK-AUI-001: 実利用計測

Source: `FACT-AUI-011`–`018`, `FACT-AUI-077`–`081`; `GAP-AUI-001`, `GAP-AUI-003`, `GAP-AUI-030`

| AC | Type | Given | When | Then |
| --- | --- | --- | --- | --- |
| `AC-AUI-001` | normal | provider が token/quantity を返す chat run が成功する | run を確定する | 一意な usage event が永続化される |
| `AC-AUI-002` | boundary | 同じ idempotency key の usage event が保存済みである | 同じ処理を再試行する | 集計 quantity は増えない |
| `AC-AUI-003` | normal | tenant、actor user、feature、provider、model、run ID が確定している | usage event を保存する | event は各 attribution key を保持する |
| `AC-AUI-004` | error | provider response に請求 quantity がない | event を集計する | completeness は `missing` 相当となる |
| `AC-AUI-005` | empty | 選択期間に event がなく ingestion watermark が期間末を超えている | summary を取得する | 0 件は complete zero として返る |
| `AC-AUI-006` | loading | ingestion watermark が選択期間末に達していない | summary を取得する | 0 を確定値にせず incomplete/delayed が返る |
| `AC-AUI-007` | recovery | 遅延 event が watermark 後に到着する | 同じ期間を再集計する | summary に遅延 quantity が一度だけ反映される |
| `AC-AUI-008` | boundary | event が期間開始直前、開始時刻、終了直前、終了時刻に存在する | 半開区間 `[from,to)` で集計する | 開始時刻以上かつ終了時刻未満だけが含まれる |
| `AC-AUI-009` | permission | own-scope permission だけの user がいる | global usage summary を要求する | request は拒否される |
| `AC-AUI-010` | security | tenant A と tenant B に同じ userId の event がある | tenant A の管理者が集計する | tenant B の event は含まれない |
| `AC-AUI-011` | boundary | query 上限を超える event がある | cursor で全 page を取得・集計する | page 上限による無言の欠落がない |
| `AC-AUI-012` | recovery | aggregation projection を再構築する | 同じ source event を再生する | 再構築後の合計が再生前と一致する |

## TASK-AUI-002: 料金算出契約

Source: `FACT-AUI-019`–`023`, `FACT-AUI-026`; `GAP-AUI-002`, `GAP-AUI-004`

| AC | Type | Given | When | Then |
| --- | --- | --- | --- | --- |
| `AC-AUI-013` | normal | 同一期間の usage quantity と有効な price version がある | cost summary を計算する | cost の対象期間は usage の対象期間と一致する |
| `AC-AUI-014` | normal | provider/region/model/unit と時刻に一致する price がある | quantity を評価する | effective range に該当する version だけが適用される |
| `AC-AUI-015` | error | quantity に一致する price がない | cost summary を計算する | 0 円を返さず unpriced として返る |
| `AC-AUI-016` | normal | price と quantity がある | cost item を取得する | quantity、unit、unit price、price version、subtotal を追跡できる |
| `AC-AUI-017` | normal | provider metering と内部推定の item が混在する | summary を取得する | 各 item は actual/estimated の measurement source を保持する |
| `AC-AUI-018` | boundary | subtotal が `$0.00005` 未満の正値である | UI/API で表示する | 0 と誤認させない有効桁または「0 未満」表現になる |
| `AC-AUI-019` | boundary | benchmark quantity が run と case の双方で存在する | cost を計算する | price unit と quantity unit が一致しない item は拒否される |
| `AC-AUI-020` | error | usage completeness が missing である | total cost を計算する | total は完全な確定値として返らない |
| `AC-AUI-021` | normal |複数 currency の price が存在する |一つの summary を計算する | currency conversion rule がない異種 currency は合算されない |
| `AC-AUI-022` | boundary | 小数 quantity と単価がある | subtotal と total を計算する | 規定の decimal precision と rounding mode が一貫して適用される |
| `AC-AUI-023` | security | client が unit price を送る | server が cost を計算する | client 提示価格は計算根拠に使用されない |
| `AC-AUI-024` | nfr | 同じ event set、pricing version、period がある | calculation を再実行する | 同じ breakdown と total が再現される |

## TASK-AUI-003: 利用量・料金 UI

Source: `FACT-AUI-024`–`030`; `GAP-AUI-004`–`008`, `GAP-AUI-036`

| AC | Type | Given | When | Then |
| --- | --- | --- | --- | --- |
| `AC-AUI-025` | normal | usage/cost read permission がある | usage-cost section を開く | query period と as-of が画面に表示される |
| `AC-AUI-026` | normal | user/model/feature/group filter 候補がある | filter を組み合わせて適用する | API request と表示結果に同じ filter が反映される |
| `AC-AUI-027` | normal | conversation、message、token/vector/run の集計がある | usage table を表示する | API が提供する各主要 quantity を確認できる |
| `AC-AUI-028` | normal | user 別 subtotal と unit price がある | cost breakdown を開く | user、quantity、unit price、subtotal を確認できる |
| `AC-AUI-029` | boundary | page size を超える rows がある | next cursor を選ぶ | 並び順を保って次 page が表示される |
| `AC-AUI-030` | normal | current period と比較 period の complete summary がある | comparison を有効にする | 差額と変化率が比較期間ラベル付きで表示される |
| `AC-AUI-031` | error |比較 period が incomplete である | comparison を表示する | 変化率は確定値として表示されない |
| `AC-AUI-032` | normal | anomaly rule と該当 item がある | anomaly indicator を開く | rule/version と対象 breakdown へ到達できる |
| `AC-AUI-033` | empty | complete な選択範囲に row がない | table を表示する | 「利用なし」と期間/filter が表示される |
| `AC-AUI-034` | error | usage query が失敗する | panel を表示する | 0/empty ではなく error と再試行 control が表示される |
| `AC-AUI-035` | loading | usage query が未完了である | panel を表示する | 既定の 0 件を描画せず loading state を示す |
| `AC-AUI-036` | permission | cost read permission がない | usage-cost section を開く | cost の金額・breakdown は表示されない |
| `AC-AUI-037` | permission | read はあるが export permission がない | export control を表示する | export は無効または非表示で理由を判別できる |
| `AC-AUI-038` | normal | export permission と filter 済み query がある | export を実行する | export の期間/filter/sort は画面 query と一致する |
| `AC-AUI-039` | security | own-scope user が自分の cost を開く | user breakdown を取得する | 他 user の identifier と cost は返らない |
| `AC-AUI-040` | nfr | 件数上限規模の query がある | sort/filter/page を操作する | 合意した response SLO 内で操作結果が返る |

## TASK-AUI-004: ロールカタログ

Source: `FACT-AUI-035`–`039`, `FACT-AUI-052`; `GAP-AUI-009`, `GAP-AUI-011`, `GAP-AUI-012`, `GAP-AUI-033`

| AC | Type | Given | When | Then |
| --- | --- | --- | --- | --- |
| `AC-AUI-041` | normal | canonical role が登録されている | role list を開く | ID、表示名、説明、category、risk、system/custom が表示される |
| `AC-AUI-042` | normal | role に複数 permission category がある | role detail を開く | permission はcategory別に読める |
| `AC-AUI-043` | normal | high-risk permission を含む role がある | role list/detail を表示する | risk と強権限が視覚・テキストの両方で識別できる |
| `AC-AUI-044` | normal | role が複数 user に割り当てられている | role list を表示する | authoritative query の assigned user count が表示される |
| `AC-AUI-045` | normal | 複数 role がある | name/permission/category で検索する | 条件に一致する role だけが表示される |
| `AC-AUI-046` | normal | 2 個以上の role を選ぶ |比較 view を開く | permission 差分が role ごとに判別できる |
| `AC-AUI-047` | security | backend catalog と provisioned identity group を検査する | consistency check を実行する | 欠落・余剰 role が検出される |
| `AC-AUI-048` | error | request に未知 role ID がある | role mutation を送る | request は validation error になり既存 role set は変わらない |
| `AC-AUI-049` | error | user の stored role に未知 ID がある | user detail を表示する | 未知 role を黙って消さず不整合として表示する |
| `AC-AUI-050` | normal | application role と resource group がある | user/role UI を表示する | 両者は別 label・別 field・別説明で表示される |
| `AC-AUI-051` | permission | actor に role catalog read がない | role route を直接開く | catalog data は返らない |
| `AC-AUI-052` | permission | role create/update API が未提供である | role panel を開く |実行不能な編集 control は表示されない |

## TASK-AUI-005: 複数ロール変更

Source: `FACT-AUI-031`–`043`, `FACT-AUI-073`; `GAP-AUI-010`, `GAP-AUI-013`, `GAP-AUI-014`

| AC | Type | Given | When | Then |
| --- | --- | --- | --- | --- |
| `AC-AUI-053` | normal | 対象 user に role A/B がある | role C を grant する | 最終 role set は A/B/C になる |
| `AC-AUI-054` | normal | 対象 user に role A/B/C がある | role B だけを revoke する | 最終 role set は A/C になる |
| `AC-AUI-055` | normal | role editor を開く |保存前の review を表示する | before/after/grant/revoke が確認できる |
| `AC-AUI-056` | normal |有効な role delta がある |変更を確定する | operator 入力の非空 reason が command と audit に保存される |
| `AC-AUI-057` | permission | actor が自分自身である |自分の role set を変更する | server は mutation を拒否する |
| `AC-AUI-058` | permission | actor が SYSTEM_ADMIN ではない | SYSTEM_ADMIN を grant する | server は mutation を拒否する |
| `AC-AUI-059` | security | target が別 tenant に属する | role mutation を送る | target の存在を過剰開示せず拒否する |
| `AC-AUI-060` | security | target が inactive/deleted である | role mutation を送る | state policy により拒否される |
| `AC-AUI-061` | security | target が最後の有効な SYSTEM_ADMIN である | SYSTEM_ADMIN を revoke する | server は mutation を拒否する |
| `AC-AUI-062` | boundary | editor 表示後に target version が変わる |旧 version で保存する | conflict が返り role set は上書きされない |
| `AC-AUI-063` | error | identity provider 更新が失敗する | role command を実行する | ledger は成功状態へ進まない |
| `AC-AUI-064` | recovery | identity 更新後に後段保存が失敗する | command を終了する |補償または reconciliation-required 状態が記録される |
| `AC-AUI-065` | permission | UI が actor/target/role policy を取得済みである | editor を表示する |実行不能な選択肢は理由付きで事前抑止される |
| `AC-AUI-066` | normal | role command が成功する | target が再認証または token refresh する |新しい effective permission が反映される |
| `AC-AUI-067` | security | role command が denied/conflict/failed になる | audit を検索する |対応する result の event が存在する |
| `AC-AUI-068` | nfr |同一 idempotency key の command が再送される | mutation を処理する |同じ role delta は一度だけ適用される |

## TASK-AUI-006: account lifecycle

Source: `FACT-AUI-044`–`050`; `GAP-AUI-015`–`017`

| AC | Type | Given | When | Then |
| --- | --- | --- | --- | --- |
| `AC-AUI-069` | normal |一意な login identifier と初期 role が有効である | user を作成する | authoritative identity provider に user が作成される |
| `AC-AUI-070` | error | identity provider の create が失敗する | user 作成 command を実行する |管理台帳だけの active user は作られない |
| `AC-AUI-071` | normal | active user が存在する | suspend を理由付きで確定する | identity provider の sign-in が無効化される |
| `AC-AUI-072` | security | suspend が成功する |既存 session/token で保護 API を要求する | access は policy 上の失効上限内に拒否される |
| `AC-AUI-073` | normal | suspended user が存在する | restore を理由付きで確定する | identity provider と管理 read model が active に一致する |
| `AC-AUI-074` | security | deleted user が存在する |同じ actor claims で管理台帳を load する | user status は active に戻らない |
| `AC-AUI-075` | permission | actor に lifecycle permission がない | suspend/restore/delete を直接要求する | request は拒否され identity state は変わらない |
| `AC-AUI-076` | security | actor が自分自身である |自分を suspend/delete する | server policy により拒否される |
| `AC-AUI-077` | boundary |対象 user が最後の有効な管理者である | suspend/delete を要求する |管理者不在になる操作は拒否される |
| `AC-AUI-078` | normal | delete retention policy が承認済みである | user を削除する | identity/ledger/PII は承認された state machine に従う |
| `AC-AUI-079` | error | identity と ledger の state が不一致である | reconciliation を実行する |不一致は修復済みまたは要手動対応として可視化される |
| `AC-AUI-080` | recovery | lifecycle command が途中失敗する |同じ command を再試行する |二重 user・逆向き state transition を生成しない |
| `AC-AUI-081` | normal | suspend/delete の影響が表示される |確認 dialog を開く |文言は実際の sign-in/session/data retention 効果と一致する |

## TASK-AUI-007: ユーザー・group 管理

Source: `FACT-AUI-051`–`053`; `GAP-AUI-018`, `GAP-AUI-019`, `GAP-AUI-030`, `GAP-AUI-033`

| AC | Type | Given | When | Then |
| --- | --- | --- | --- | --- |
| `AC-AUI-082` | normal |複数 user が存在する | name/login identifier で検索する |一致する user が server-side query で返る |
| `AC-AUI-083` | normal |複数 status/role/group の user がいる | filter を適用する |指定した全条件に一致する user だけが返る |
| `AC-AUI-084` | boundary | page size を超える user がいる | cursor で次 page を取得する |重複・欠落なしに安定順で表示される |
| `AC-AUI-085` | normal |対象 user が存在する | detail を開く | status、application roles、resource groups、source、as-of が表示される |
| `AC-AUI-086` | permission | actor が user detail read を持たない | detail route を直接要求する |対象 user の属性は返らない |
| `AC-AUI-087` | security | actor が resource scope を持つ | effective permission/folder visibility を開く | actor が閲覧を許された範囲だけが表示される |
| `AC-AUI-088` | normal |一行で mutation を実行する | command が処理中になる |対象行だけが busy になる |
| `AC-AUI-089` | error |一行の mutation が失敗する | error が返る |対象行に理由と retry control が表示される |
| `AC-AUI-090` | recovery |一行の mutation を retry する |成功 response が返る |対象行だけが server state で更新される |
| `AC-AUI-091` | empty | filter に一致する user がいない | list を表示する | filter 解除導線を含む empty state が表示される |
| `AC-AUI-092` | permission | group 管理 permission がない | resource group controls を表示する | group mutation controls は利用できない |
| `AC-AUI-093` | error | directory source が stale または同期失敗である | user list/detail を表示する |古い値を current と断定せず source/as-of/error を示す |

## TASK-AUI-008: 共通 audit・export

Source: `FACT-AUI-054`–`058`; `GAP-AUI-007`, `GAP-AUI-026`–`028`

| AC | Type | Given | When | Then |
| --- | --- | --- | --- | --- |
| `AC-AUI-094` | normal |管理 command が成功する | audit を取得する | result=`success` 相当の event が一件存在する |
| `AC-AUI-095` | security |管理 command が denied/conflict/failed になる | audit を取得する |実際の result を示す event が一件存在する |
| `AC-AUI-096` | normal | audit event がある | detail を表示する | actor/tenant/action/target/before/after/reason/result/requestId/policyVersion/time を追跡できる |
| `AC-AUI-097` | security | secret/token/raw prompt/権限外 resource が command context にある | audit event を保存・表示する |禁止 field は保存または返却されない |
| `AC-AUI-098` | security |重要 mutation が成功する | commit を確定する | state change と必須 audit の一方だけが成功扱いにならない |
| `AC-AUI-099` | normal |期間、actor、target、action、result filter がある | audit を検索する |全 filter に一致する event だけが返る |
| `AC-AUI-100` | boundary | 100 件を超える audit event がある | cursor で全 page を取得する |無言の先頭100件固定切り捨てがない |
| `AC-AUI-101` | permission | audit read permission がない | audit route を直接要求する | event は返らない |
| `AC-AUI-102` | permission | audit read はあるが export permission がない | export を要求する | export は拒否される |
| `AC-AUI-103` | normal | export permission と filter 済み audit query がある | export を実行する |同じ query scope の event が export される |
| `AC-AUI-104` | security | tenant A/B の audit がある | tenant A actor が検索/export する | tenant B の event は含まれない |
| `AC-AUI-105` | nfr | retention 期限を超えた event がある | retention job と integrity check を実行する |承認済み保持・legal hold policy に従う結果が記録される |

## TASK-AUI-009: query state・契約・競合

Source: `FACT-AUI-004`–`008`, `FACT-AUI-053`, `FACT-AUI-058`, `FACT-AUI-063`–`066`; `GAP-AUI-019`–`023`, `GAP-AUI-028`

| AC | Type | Given | When | Then |
| --- | --- | --- | --- | --- |
| `AC-AUI-106` | error |初期 query が失敗する | panel を表示する |初期値の 0/empty ではなく error state が表示される |
| `AC-AUI-107` | empty | query が成功し rows が 0 件である | panel を表示する | success-empty が表示される |
| `AC-AUI-108` | permission | query が forbidden を返す | panel を表示する |権限不足 state が error/empty と区別される |
| `AC-AUI-109` | loading | query が進行中である | panel を表示する |対象 region に busy/loading 状態が通知される |
| `AC-AUI-110` | error | response が runtime schema に不適合である | client が decode する | unavailable/empty にせず contract error として扱う |
| `AC-AUI-111` | security | API error に内部詳細がある | client へ error を返す | allowlist 済み code/message/requestId だけが表示される |
| `AC-AUI-112` | normal |成功 response がある | panel を表示する | data source と as-of/version を確認できる |
| `AC-AUI-113` | boundary |表示後に freshness threshold を超える | panel を継続表示する | stale indicator が表示される |
| `AC-AUI-114` | recovery |一つの panel query が失敗する |その panel の retry を実行する |他 panel の成功 data を破棄せず再取得する |
| `AC-AUI-115` | boundary |同じ record を二 actor が編集する |後着 actor が旧 version で保存する | conflict が返り先着変更は上書きされない |
| `AC-AUI-116` | recovery | idempotent mutation response が通信中に失われる |同じ key で再送する | mutation と audit は重複しない |

## TASK-AUI-010: overview・URL・action

Source: `FACT-AUI-001`–`010`; `GAP-AUI-020`–`025`

| AC | Type | Given | When | Then |
| --- | --- | --- | --- | --- |
| `AC-AUI-117` | normal |管理 section を選択している | URL を共有・再読込する |同じ section と許可された query が復元される |
| `AC-AUI-118` | normal |複数 section を遷移済みである | browser back/forward を使う |履歴順に section が切り替わる |
| `AC-AUI-119` | permission | actor に section permission がない |その deep link を開く |内容を表示せず権限不足の安全な遷移になる |
| `AC-AUI-120` | normal | overview KPI に対象 data がある | KPI/action card を選ぶ |対応 section と filter へ遷移する |
| `AC-AUI-121` | error | KPI source query が失敗する | overview を表示する | KPI は 0 と表示されず error/unknown になる |
| `AC-AUI-122` | loading | KPI source query が未完了である | overview を表示する |仮の 0 を出さず loading になる |
| `AC-AUI-123` | normal | quality action が返る | overview を表示する |許可された actor に action、根拠、対象、遷移先が表示される |
| `AC-AUI-124` | security | actor に action target の permission がない | quality action を取得する |対象の存在・件数を漏らす card は返らない |
| `AC-AUI-125` | normal | KPI/action threshold が適用される | card detail を開く | threshold source/version/as-of を確認できる |

## TASK-AUI-011: alias governance

Source: `FACT-AUI-056`, `FACT-AUI-059`–`062`, `FACT-AUI-073`; `GAP-AUI-027`, `GAP-AUI-029`

| AC | Type | Given | When | Then |
| --- | --- | --- | --- | --- |
| `AC-AUI-126` | normal | review 中 alias がある | reject を実行する | operator が入力した非空 reason が保存される |
| `AC-AUI-127` | normal | published/reviewed alias がある | draft へ戻す |明示的な transition command が実行される |
| `AC-AUI-128` | normal | alias transition が成功する | client state を更新する | server response の state/version/time だけを採用する |
| `AC-AUI-129` | security | disabled alias がある | review/publish を要求する | server は不正 transition を拒否する |
| `AC-AUI-130` | boundary | alias 表示後に version が変わる |旧 version で更新する | conflict が返り後着更新は適用されない |
| `AC-AUI-131` | permission | actor に transition permission がない | alias action を直接要求する | state は変わらない |
| `AC-AUI-132` | normal | alias expansions/state を変更する | review preview を開く | before/after と検索影響が確認できる |
| `AC-AUI-133` | security | alias mutation が success/denied/conflict/failed になる | audit を検索する | result と reason を持つ event が存在する |
| `AC-AUI-134` | boundary |表示上限を超える alias/audit がある | search/filter/cursor を使う |無言の8件/200件切り捨てなく対象へ到達できる |

## TASK-AUI-012: responsive・a11y・用語・品質 gate

Source: `FACT-AUI-003`, `FACT-AUI-065`–`074`; `GAP-AUI-031`–`035`

| AC | Type | Given | When | Then |
| --- | --- | --- | --- | --- |
| `AC-AUI-135` | nfr | CSS viewport 320 px で管理画面を開く |主要 task を操作する |二方向 scroll を強制されず内容と操作へ到達できる |
| `AC-AUI-136` | nfr | desktop viewport で 400% zoom にする |主要 task を操作する | content/controls が重なり・欠落なしに reflow する |
| `AC-AUI-137` | nfr | keyboard だけを使う | section、filter、row action、dialog を操作する |全操作を実行・取消できる |
| `AC-AUI-138` | nfr | dialog を開閉する | focus を追跡する |開始 focus、focus trap、復帰先が予測可能である |
| `AC-AUI-139` | nfr |同名の複数 row action がある | screen reader で controls を列挙する | accessible name に action と対象が含まれる |
| `AC-AUI-140` | nfr | user/usage/role table を accessibility tree で読む | header と cell を移動する | table/list の関係と empty state が正しく伝わる |
| `AC-AUI-141` | nfr | loading/error/success mutation が起きる | screen reader で待つ |重複しない適切な live status/alert が通知される |
| `AC-AUI-142` | nfr | touch input で主要 control を使う | target size を測定する |原則44px以上、例外はWCAG 2.2 target-size 条件を満たす |
| `AC-AUI-143` | nfr | text、focus、state indicator を表示する | contrast を自動/手動測定する | WCAG 2.2 AA の該当 contrast を満たす |
| `AC-AUI-144` | normal |日本語 locale で管理画面を開く | section/role/group/state/error を読む |承認済み日本語用語で一貫して表示される |
| `AC-AUI-145` | nfr | major browser と承認済み screen reader matrix がある | release candidate を検証する |各必須組合せの結果と証跡が記録される |
| `AC-AUI-146` | nfr |管理 UI/API の変更を commit する | CI を実行する |契約・permission・responsive・a11y の選定済み回帰 test が通る |

## TASK-AUI-013: PR #339 再適合・移行

Source: `FACT-AUI-077`–`081`; `GAP-AUI-008`, `GAP-AUI-030`, `GAP-AUI-035`

| AC | Type | Given | When | Then |
| --- | --- | --- | --- | --- |
| `AC-AUI-147` | boundary | 1,000件を超える usage event がある | tenant+period query を完走する | Scan/limit による無言の集計欠落がない |
| `AC-AUI-148` | security |複数 tenant の event が同じ store にある | tenant A の summary を取得する | tenant B の event は read/aggregate されない |
| `AC-AUI-149` | normal | provider/region/model 固有 price がある | candidate pricing を適用する | source/effective version を持つ一致価格が選ばれる |
| `AC-AUI-150` | error | wildcard fallback しか一致しない | production cost を計算する |承認のない価格を確定価格として使わない |
| `AC-AUI-151` | recovery | legacy counter から event/projection へ移行する | migration を再実行する |二重計上せず同じ結果になる |
| `AC-AUI-152` | normal | legacy と new summary の dual-read 期間である |比較 job を実行する |差分、completeness、原因分類が記録される |
| `AC-AUI-153` | boundary |許容差を超える dual-read 差分がある | rollout gate を評価する | cutover は停止する |
| `AC-AUI-154` | nfr | live Bedrock/DynamoDB/S3 test tenant がある | canary run と export を実行する | provider usage、永続化、集計、signed export を end-to-end で追跡できる |
| `AC-AUI-155` | security | live canary/export artifact がある | log/audit/artifact を確認する | token、prompt、権限外 tenant data が露出しない |
| `AC-AUI-156` | recovery | new read path に障害がある | kill switch/rollback を実行する |データを破壊せず承認済み fallback state へ戻る |
| `AC-AUI-157` | normal | cutover 後の月次 summary がある | cloud billing と照合する |差異と推定範囲が FinOps 記録に残る |
| `AC-AUI-158` | nfr | rollout 完了条件を評価する | legacy path を停止する | migration、reconciliation、monitoring、runbook の証跡が揃っている |

## 適用上の注意

- `AC-AUI-020`, `031`, `150` の UI 表現は Product/FinOps が決めるが、「0 円」または「actual」と誤表示しない制約は変更しない。
- `AC-AUI-072` の失効上限、`AC-AUI-105` の保持期間、`AC-AUI-153` の許容差、`AC-AUI-145` の browser/AT matrix は open question の決定値を参照する。
- mutation の UI test だけでは server-side authorization を充足した扱いにしない。route/service/store/audit の非 UI test を必須とする。
- 本書の AC は後続 task ごとに実装対象を選ぶ。未対象 AC を成功扱いにせず、PR 本文に not-applicable または未実施理由を残す。
