# ドキュメント操作安全性改善

## 状態

done

## 背景

直近レビューで、確認ダイアログが高リスク操作向けとして未完成であり、操作結果ログが実際の成功/失敗を正しく表せない可能性が指摘された。PR #273 で共有設定フォームの誤解除防止は先行対応済みのため、次の改善として操作実行時の状態表示と失敗時の記録精度を上げる。

## 目的

文書削除、再インデックス、共有更新などの操作で、ユーザーが処理中状態・失敗状態・二重実行防止を明確に把握できるようにする。

## タスク種別

修正

## 軽量なぜなぜ分析

### 問題文

現行の確認ダイアログと文書操作ログでは、非同期操作中の busy 状態や失敗結果が十分に表現されず、高リスク操作でユーザーが処理状態を誤認する可能性がある。

### 確認済み事実

- `ConfirmDialog` は最低限の `role="dialog"` / `aria-modal` を持つが、focus trap、Escape close、return focus、confirm 実行中の disable が不足している。
- `DocumentWorkspace` は confirm action を閉じてから async handler を呼ぶため、dialog 内で処理中・失敗を表示できない。
- `useDocuments` の操作関数は多くの失敗を hook 内で catch して `setError` し、呼び出し側が成功/失敗を判別しにくい。
- `recordSessionOperation` は呼び出し後に成功に近い文言を積む可能性がある。

### 推定原因

- UI コンポーネントが synchronous confirm 前提で設計され、非同期操作の lifecycle を dialog に残す契約がない。
- hook の操作関数が「UI 全体の error state 更新」と「操作結果の返却」を分離していない。

### 根本原因

- 高リスク操作に必要な非同期状態・結果状態を、dialog/hook/caller の共通契約として扱っていない。

### 対策方針

- `ConfirmDialog` に async confirm、busy 表示、二重実行防止、Escape/focus 制御を追加する。
- document 操作 hook が成功/失敗を呼び出し側へ返せる契約を追加する。
- `DocumentWorkspace` の最近の操作ログを、実結果に基づく成功/失敗記録にする。

## スコープ

- 対象: 文書管理 UI の確認ダイアログ、文書操作 hook、最近の操作ログ、関連テスト。
- 対象外: backend API の監査ログ、AWS 実環境操作、実ブラウザ visual regression。

## 実装計画

1. `ConfirmDialog` と利用箇所を確認し、既存 API との互換を保ちながら非同期状態を追加する。
2. `useDocuments` の document 操作関数が結果を返すようにする。
3. `DocumentWorkspace` の confirm action と session operation 記録を結果ベースへ変更する。
4. keyboard / busy / failure のテストを追加または更新する。
5. 変更範囲に見合う検証を実行する。

## ドキュメントメンテナンス計画

- durable docs は、UI 内部の安全性改善で API や運用手順を変更しない限り更新不要と判断する。
- 作業内容と未実施検証は `reports/working/` に記録する。

## 受け入れ条件

- 確認ダイアログで confirm 実行中に confirm/cancel/close の二重操作が抑止される。
- 確認ダイアログが Escape close、初期 focus、focus trap、return focus を扱う。
- 文書操作の最近の操作ログが成功と失敗を区別して記録する。
- 失敗時にユーザーが失敗を認識できる error 表示または operation log が残る。
- 既存の文書共有安全化 UI の挙動を壊さない。
- 関連 unit/component tests と TypeScript check が pass する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- DocumentWorkspace`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- useDocuments`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`
- `git diff --check`

## PR レビュー観点

- risky action の二重実行が防げているか。
- async failure が成功ログとして残らないか。
- keyboard-only 操作で dialog から focus が漏れないか。
- 既存 UI 文言と a11y metadata が破綻していないか。

## リスク

- `ConfirmDialog` は共有コンポーネントのため、他画面の利用箇所にも影響し得る。
- hook 戻り値の変更により、既存テストの期待値調整が必要になる可能性がある。
