# FR-052 3層認可モデル

- 種別: `REQ_FUNCTIONAL`
- 状態: planning
- 仕様参照: `docs/spec/2026-chapter-spec.md` 16-20 章
- FR-052: 操作可否を Account status、Feature permission、Resource permission の 3 層で判定し、フォルダ・文書・RAG・benchmark・admin 操作に一貫して適用できること。

## 要求

操作可否を Account status、Feature permission、Resource permission の 3 層で判定し、フォルダ・文書・RAG・benchmark・admin 操作に一貫して適用できること。

## 受け入れ条件

- [ ] inactive account は feature / resource permission に関係なく操作できない。
- [ ] 操作ごとに必要な feature permission が定義されている。
- [ ] 対象 resource には `none` / `readOnly` / `full` の実効権限が適用される。
- [ ] 権限不足時のエラーは権限外文書の存在を示唆しない。

## 備考

Phase B で詳細化する。
