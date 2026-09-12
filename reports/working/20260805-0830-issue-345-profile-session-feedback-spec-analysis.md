# Issue #345 profile session feedback specification analysis

## Input inventory

| Source | Date / ref | Type | Reliability |
| --- | --- | --- | --- |
| Issue #345 | 2026-08-05確認 | canonical work scope | confirmed |
| `main@0771521c` | 2026-08-05確認 | current source baseline | confirmed |
| Draft PR #462 `5bfb6faa` | 2026-08-05確認 | cumulative implementation/evidence | confirmed |
| `PersonalSettingsView.tsx` / `useChatSession.ts` | PR head | implementation | confirmed |
| `REQ_SERVICE_QUALITY_016.md` / `DES_UI_UX_001.md` | PR head | canonical requirement/design | confirmed |
| `tasks/todo/20260713-2301-user-preferences.md` | PR head | pending persistence work | confirmed |
| representative screen reader / actual 400% / real device | 未実施 | manual evidence | open_question |

## Report facts

- FACT-001 confirmed: 送信キーは`useChatSession`のReact stateで、API/storeへ保存されない。
- FACT-002 confirmed: 個人設定は設定scopeと変更結果のstatusを表示しない。
- FACT-003 confirmed: 永続設定は`FR-051`関連todoで未実装である。
- FACT-004 confirmed: profileのkeyboard / Chromium AX tree自動証跡は既にrequired gateへ入っている。
- FACT-005 confirmed: `profile / AC-SQ016-007`のN/A / mutation feedback / persistence分類はowner未確定である。

## Candidate task

- TASK-001: session-onlyである現在の境界を説明し、送信キー変更結果をpolite statusで通知する。

## Acceptance criteria

### AC-PROFILE-SESSION-001: session scopeをfieldへ関連付ける

- Type: normal_path / data_persistence boundary
- Confidence: confirmed
- Source: FACT-001, FACT-002, FACT-003
- Given: 認証済み利用者が個人設定を開いている。
- When: 送信キーfieldを確認する。
- Then: 現在のサインイン中だけ有効で、再読み込みまたは再サインイン時に既定値へ戻る説明がvisibleかつprogrammatically関連付いている。

### AC-PROFILE-SESSION-002: 値変更を通知する

- Type: state_change / screen_reader
- Confidence: confirmed
- Source: FACT-002
- Given: 個人設定の送信キーfieldへ到達している。
- When: `Enterで送信`から`Ctrl+Enterで送信`へ変更する。
- Then: 選択値とsession-only scopeを示すvisible polite statusが表示される。

### AC-PROFILE-SESSION-003: 同一session内で値を維持する

- Type: navigation / session state
- Confidence: confirmed
- Source: FACT-001
- Given: 送信キーを`Ctrl+Enterで送信`へ変更した。
- When: チャットへ戻り、同じsessionで個人設定を再度開く。
- Then: combobox valueは`Ctrl+Enterで送信`のままである。

### AC-PROFILE-SESSION-004: 未実装を完了扱いにしない

- Type: traceability / false completion prevention
- Confidence: confirmed
- Source: FACT-003, FACT-005
- Given: session feedback自動証跡が成功した。
- When: quality matrixとtask statusを更新する。
- Then: profileの`AC-SQ016-007`、manual screen reader、actual zoom、real-device、永続化/remote state/owner判断はblockedのままである。

### AC-PROFILE-SESSION-005: reloadで既定値へ戻る

- Type: data_persistence boundary
- Confidence: confirmed
- Source: FACT-001
- Given: 同一session中に送信キーを`Ctrl+Enterで送信`へ変更した。
- When: page reloadを実行する。
- Then: combobox valueは既定の`Enterで送信`へ戻り、説明と実挙動が一致する。

## E2E and non-UI scenarios

### E2E-UI-STATE-001 profile session feedback

- Acceptance Criteria: AC-PROFILE-SESSION-001〜004
- Target screen: 個人設定
- Actor: 認証済み一般利用者
- Priority: high
- Confidence: confirmed

#### 画面操作

1. 個人設定を開く。
2. 送信キーの説明と現在値を確認する。
3. `Ctrl+Enterで送信`を選択する。
4. 変更statusを確認する。
5. チャットへ戻り、個人設定を再度開く。
6. page reloadを実行する。

#### 期待値

- field descriptionはsession scopeとreset境界を示す。
- statusは選択値とsession scopeをpoliteに通知する。
- 同一session内の再表示では選択値を維持する。
- page reload後は既定値へ戻る。
- 永続保存済み、保存成功、remote retry可能とは表示しない。

#### 非UI検証

- API/store write requestを新設しない。
- quality matrixのprofile `AC-SQ016-007`はblockedのままにする。

## Operation and expectation groups

| Operation | Expectation | Confidence |
| --- | --- | --- |
| fieldを読む | scope説明がlabelled fieldへ関連付く | confirmed |
| 値を変更する | visible polite statusで結果を知る | confirmed |
| 画面を往復する | 同一React session内で値を維持する | confirmed |
| reload / re-sign-in | 既定値へ戻ると説明し、reloadはrequired E2Eで検証する | confirmed / re-sign-in unverified |
| 永続化する | 本task対象外、`FR-051` owner判断待ち | open_question |

## Traceability gap

| Requirement / AC | Design | Implementation | Test | Status |
| --- | --- | --- | --- | --- |
| `SQ-016 / AC-SQ016-003` | profile semantics | native select + planned status | unit + required E2E | current passを維持、evidence拡張 |
| `SQ-016 / AC-SQ016-007` | profile state classification | session-only feedback only | required E2E subset | blocked |
| `FR-051` | 未確定 | API/storeなし | 既存todo | planning / blocked |

## Open questions

- OQ-PROFILE-001: 永続設定のowner、API/store、authorization、save error/retry契約は何か。
- OQ-PROFILE-002: profileの`AC-SQ016-007`をN/Aとするか、`FR-051`完了後のmutation/resource state evidenceへ結ぶか。
- OQ-UI-002: manual evidence owner / cadence / approved matrix。
