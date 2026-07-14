# prompt injection と evidence/citation safety の実装

- 状態: todo
- タスク種別: RAG 安全性実装
- 作成日: 2026-07-13
- 関連要件・gap: `FR-071`, `FR-073`, `SQ-010`, `SQ-011`, `GAP-RD-014`, `GAP-RD-015`

## 背景

構造 escape はあるが、取得文書を untrusted data とする明示 rule、検出・隔離、attack corpus が不足する。citation の自動補完は未支持回答を支持済みのように見せ得る。

## 目的と範囲

retrieved content の instruction を信頼せず、検出・隔離・拒否・監査を行い、citation は実際に claim を支持する span だけへ限定する。

## 受け入れ条件

- [ ] source 内 instruction が system/developer policy や tool decision を上書きしない。
- [ ] suspicious content を検出・隔離し、必要時は安全に回答不能とする。
- [ ] citation 不足を自動補完で隠さず、unsupported claim を拒否または明示する。
- [ ] indirect injection、citation spoofing、mixed safe/unsafe evidence の attack corpus を追加する。

## 検証・文書

- prompt/guard/citation unit test と adversarial benchmark を実行する。
- RAG runtime design、該当要求、監視イベントを更新する。

## リスク

detector 誤検知による回答率低下を測定し、dataset 固有語句を product runtime に入れない。
