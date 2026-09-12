# Issue #345 チャット cross-browser state 証跡分析

## 結論

- 今回の最小改善は、チャットの `initial / processing / SSE timeout / retry / recovery / error / permission` を Firefox／WebKit の PR 必須 E2E に追加することとする。
- 追跡は `chat → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-005` とする。
- production source は変更せず、Playwright route fixture と正本・生成文書の同期だけを対象にする。

## 確認した事実

- `main@8e542b31` は PR #462 の統合 branch の祖先で、開始時点の final head は `8242412a`、main に対して behind 0／ahead 152 である。
- 前回の final head 後に integration branch の追加 commit はない。
- PR #462 の Firefox／WebKit 必須 gate は9画面の semantic contract、履歴／文書／担当者対応／お気に入りの state contractを持つ。
- チャットは Chromium required `E2E-UI-STATE-001` で処理中、SSE timeout、`Last-Event-ID` retry、回答回復、500、権限不足を検証するが、Firefox／WebKit に同じ状態境界はない。
- Draft PR #461 は production UI components を変更するため、今回 production source を変更すると競合と責務重複が増える。
- チャットは主要 user journey であり、既存の deterministic fixture を移植できるため、実装変更を伴わない独立した小さい slice である。

## 受け入れ境界

- 初期案内を表示し、送信後の processing／reconnecting 中は chat を busy、送信を disabled とする。
- SSE timeout 後の自動再接続は `Last-Event-ID: 3` を保持し、final event 後だけ回答を表示して busy を解除し、入力を再有効化する。
- HTTP 500 は private detail を隠した対象付き error alert を表示する。
- `chat:create` 不足は permission alert と disabled 送信 control を表示し、Enter 操作でも start request を発行しない。
- artifact は browser project、状態系列、request count／retry header、test-only fixture 境界を保持する。

## 証跡の限界

- route fixture は production incident、実 API／SSE、実認可、RAG 回答品質の証跡ではない。
- Firefox／WebKit の Playwright 実走は代表 screen reader、native accessibility tree、実ブラウザ 200%／400% zoom、touch／実機を代替しない。
- #461 統合後の再検証、FR-051／OQ-UI-002 の owner 判断、API C1 85% は未完了のまま扱う。
