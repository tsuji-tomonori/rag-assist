# 管理 Usage / Cost PR を最新 main と CI に収束する

- 状態: do
- 優先度: P0
- 種別: integration / verification / PR lifecycle
- 起票日: 2026-07-15
- 対象: PR #357

## 作業前チェックリスト

- [x] 既存 task、作業レポート、PR 差分、過去 CI を確認する。
- [ ] 最新 `origin/main` を取り込み、stacked branch の差分を `main` 向けへ収束する。
- [ ] 競合、生成物、認可境界、Usage / Cost の真正性を再確認する。
- [ ] 変更範囲に見合う検証を実行し、失敗があれば修復して再実行する。
- [ ] PR 本文、受け入れ条件コメント、セルフレビューを最新 head に同期する。

## Done 条件

- [ ] PR #357 の base が `main` で、最新 `origin/main` を含む。
- [ ] tenant-scoped usage、versioned pricing、export 専用認可、unknown / missing / completeness 表示を維持する。
- [ ] docs / generated inventory と実装が同期し、選択した lint、typecheck、test、build、docs check が成功する。
- [ ] live AWS / billing acceptance の未実施を達成扱いにせず、release blocker として明記する。
- [ ] 作業レポート、task lifecycle、commit / push、日本語 PR コメント、最新 CI、draft 解除、merge 可否確認を完了する。

## 受け入れ条件

- [ ] 既存の Usage / Cost 受け入れ条件が最新 `main` 上でも自動 test で維持される。
- [ ] PR #356 までに導入された admin access / audit 境界を弱めない。
- [ ] generated Web / API / infra docs が freshness check を通過する。
- [ ] blocking 指摘および未解決の必須 CI failure がない。
