# FR-052 3層認可モデル

- 種別: `REQ_FUNCTIONAL`
- 状態: Superseded（2026-07-11、`CHG-003`）
- 仕様参照: `docs/spec/2026-chapter-spec.md` 16-20 章
- FR-052: 操作可否を Account status、Feature permission、Resource permission の 3 層で判定し、フォルダ・文書・RAG・benchmark・admin 操作に一貫して適用できること。

## 要求

操作可否を Account status、Feature permission、Resource permission の 3 層で判定し、フォルダ・文書・RAG・benchmark・admin 操作に一貫して適用できること。

> この planning 要求は account、feature、resource、tenant、存在秘匿を一つに含むため、新規実装の正規要求としては使用しない。置換先は `FR-056`–`FR-060`。互換 trace のため ID を保持する。

## 受け入れ条件

- [ ] inactive account は feature / resource permission に関係なく操作できない。
- [ ] 操作ごとに必要な feature permission が定義されている。
- [ ] 対象 resource には `none` / `readOnly` / `full` の実効権限が適用される。
- [ ] 権限不足時のエラーは権限外文書の存在を示唆しない。

## 受け入れ条件 disposition

| Legacy criterion | 置換先 | 扱い |
| --- | --- | --- |
| inactive account の全操作拒否 | `FR-057`, `FR-058` | current account/session/worker lifecycle へ分割 |
| operation ごとの feature permission | `FR-057`, `FR-076`, `FR-079` | canonical role catalog と resource type × operation matrix へ分割 |
| resource `none/readOnly/full` | `FR-057`, `FR-061`, `FR-063`, `FR-077` | folder/document composition と administrative principal invariant へ分割 |
| existence を示唆しない拒否 | `FR-057`, `FR-060`, `FR-064`, `FR-088` | tenant/resource deny と response/trace minimization へ分割 |

未完了チェックはこのファイルで close せず、置換先の AC と検証結果で判定する。

## 備考

2026-07-11 の `CHG-003` で原子的な要求へ置換した。未完了チェックを実装済みとは扱わない。
