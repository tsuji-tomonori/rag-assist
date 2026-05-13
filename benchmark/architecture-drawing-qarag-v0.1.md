# 建築図面 QARAG ベンチマーク v0.1

この Markdown は、`.workspace/architecture_drawing_qarag_benchmark_v0_1.xlsx` を Excel 管理からリポジトリ内レビュー可能な文書へ移すための説明・レビュー用である。性能テストで runner が読む正本は [`architecture-drawing-qarag-v0.1.json`](architecture-drawing-qarag-v0.1.json) とし、この Markdown を機械的に parse しない。

## 位置づけ

- 対象: 建築・AEC 図面に対する社内 QARAG の検索、視覚理解、根拠提示、回答不能抑制の評価。
- seed QA 件数: 82 件。
- 主な入力: 国土交通省標準図、自治体公開図面、既存ベンチマーク調査メモ。
- 管理方針: 性能テスト用の seed QA / source 正本は JSON で管理し、Markdown では評価観点・運用方針を差分レビューする。
- 注意: 外部リンクと最新性はこの変換時点で再調査していない。令和4年改定版への差し替えが必要な seed は `notes` に残す。

## Summary シート相当

| 項目 | 値 | 補足1 | 補足2 | 補足3 |
| --- | --- | --- | --- | --- |
| 社内QARAG 建築図面QAベンチマーク v0.1 |  |  |  |  |
| 作成日 | 2026-05-08 |  |  |  |
| 目的 | 公的機関の公開図面・標準図を使い、建築系図面に対するRAG回答の検索・視覚理解・根拠提示・回答抑制を評価する。 |  |  |  |
| 結論 | 既存のAEC図面理解ベンチマークは存在するが、日本語・国交省/自治体公開図面・社内QARAG用途にそのまま適用できるものは限定的。 |  | Sources | 13 |
| Seed QA件数 | 82 |  | Seed rows | 82 |
| Primary sources | 国交省標準詳細図/公共建築設備工事標準図、徳島県・宇治市の公開入札図面 |  |  |  |
| 推奨する本番拡張 | まず100〜200問に拡張し、建築士/設備設計者レビューでgold answerを確定。各QAに根拠bboxまたは画像cropを付与する。 |  |  |  |
| 評価時の出力条件 | 回答、根拠文書名、ページ/図面番号、根拠引用、回答不能時の理由を必須化する。 |  |  |  |
| 評価観点 | 推奨比率 | 主なメトリクス | 備考 |  |
| Titleblock/OCR | 15% | Exact match normalized | 工事名、図面名、図面番号、縮尺 |  |
| 凡例/略号 | 15% | Exact mapping, list F1 | 建築・電気・機械設備記号 |  |
| 寸法/単位 | 20% | Numeric exact with unit | mm/m/径/厚さ/縮尺 |  |
| 室名/部材抽出 | 10% | Exact/list F1 | 同名室・括弧番号・階を区別 |  |
| カウント/存在確認 | 10% | Exact count, MAPE | EV、扉、窓、器具、配管部材 |  |
| 空間/比較推論 | 10% | Boolean with evidence, judge | 上下左右、隣接、階間比較 |  |
| 参照遷移/横断 | 8% | Recall@k, set exact | 断面番号、詳細図参照、複数シート |  |
| 優先順位/仕様整合 | 7% | Required terms, expert judge | 標準図 vs 案件図面 |  |
| 回答不能抑制 | 5% | Abstain accuracy | 記載なし・範囲外を推測しない |  |

## 既存ベンチマーク比較

| benchmark | domain | modality | size_or_scope | useful_takeaway_for_internal_QARAG | gap_for_this_use_case | url |
| --- | --- | --- | --- | --- | --- | --- |
| AECV-Bench | Architectural/engineering drawings | floorplan images + drawing-grounded QA | 120 floor plans for object counting; 192 QA pairs | OCR・カウント・空間推論・比較推論のカテゴリ設計を流用できる | 日本語・MLIT標準図・自治体図面ではない | https://arxiv.org/abs/2601.04819 |
| AEC-Bench | Construction coordination workflows | multimodal project documents, agentic tasks | 196 instances across 9 task families | RAGエージェントの図面横断・プロジェクト横断評価の設計参考 | 公開公的日本語図面向けではない | https://arxiv.org/abs/2603.29199 |
| AECBench | AEC knowledge benchmark | mostly text/knowledge + some task formats | 約4,800 samples across 23 task types | 建築・施工・設備ドメイン知識の段階評価の参考 | 図面VQA/RAGというより知識評価寄り、日本語ではない | https://github.com/ArchiAI-LAB/AECBench |
| JDocQA | Japanese document QA | PDF pages with text+visual elements | 5,504 PDFs; 11,600 QA; includes unanswerable and multi-page | 日本語QA、根拠ページ・bbox・unanswerable設計が参考 | 建築図面特化ではない | https://arxiv.org/abs/2403.19454 |
| FloorplanQA | Symbolic floorplan spatial reasoning | JSON/XML structured layouts | 2,000 layouts; 16,000 questions | 距離、視認性、配置可否、経路など空間推論カテゴリが参考 | 画像図面・OCR・日本語RAGではない | https://arxiv.org/pdf/2507.07644 |
| DesignQA | Engineering documentation | requirements text + CAD images + engineering drawings | rule comprehension/compliance/extraction | 仕様書×図面のクロスモーダル評価設計が参考 | Formula SAE由来で建築公的図面ではない | https://arxiv.org/abs/2404.07917 |
| DocVQA / ChartQA / InfographicVQA | Document/chart/infographic VQA | document images/charts/infographics | large public datasets | OCR・レイアウト・数値推論の一般評価形式が参考 | 建築図面の記号体系・尺度・断面参照には不足 | https://www.docvqa.org/ |

## 公的図面・参照ソース

| source_id | source_name | type | publisher | year/version | primary_use | url | notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S01 | 建築工事標準詳細図（令和4年改定）概要・表示記号及び略号 | MLIT standard detail / PDF | 国土交通省 官庁営繕部 | 令和4年改定 | 目的・適用範囲・優先関係・建築記号/略号 | https://www.mlit.go.jp/common/001157902.pdf | 最新の詳細図(1)-(6)は技術基準ページから参照。 |
| S02 | 建築工事標準詳細図 平成28年版：床仕上げ（1-01, 1-02） | MLIT standard detail / PDF | 国土交通省 官庁営繕部 | 平成28年版 | 床仕上げ、畳、フローリング、石材寸法等の図面読み取り | https://www.mlit.go.jp/gobuild/content/001477861.pdf | 公開PDFを用いたパイロット。実運用では令和4年改定版で再採番・再確認する。 |
| S03 | 建築工事標準詳細図 平成28年版：断熱・階段（7-01, 7-11） | MLIT standard detail / PDF | 国土交通省 官庁営繕部 | 平成28年版 | 断熱材打込み、階段の平面・断面・寸法注記 | https://www.mlit.go.jp/gobuild/content/001477864.pdf | 公開PDFを用いたパイロット。実運用では令和4年改定版で再確認する。 |
| S04 | 公共建築設備工事標準図（機械設備工事編）令和7年版 | MLIT equipment standard / PDF | 国土交通省 官庁営繕部 | 令和7年版 | 配管図示記号、管種記号、機械設備図面の凡例 | https://www.mlit.go.jp/gobuild/content/001888832.pdf | 令和7年5月12日最終改定。 |
| S05 | 公共建築設備工事標準図（電気設備工事編）令和7年版 | MLIT equipment standard / PDF | 国土交通省 官庁営繕部 | 令和7年版 | 電気標準図の一般仕様、寸法範囲、材質記号 | https://www.mlit.go.jp/gobuild/content/001879276.pdf | 令和7年3月21日。 |
| S06 | 徳島県立国府支援学校校舎棟新築工事のうち建築工事 図面（1/20） | public procurement drawing / PDF | 徳島県 県土整備部営繕課 | 公開入札図面 | 1階・2階平面図、図面番号、縮尺、室名・寸法の抽出 | https://e-ppi.pref.tokushima.lg.jp/file/anken/360000/26392/28/%E5%BE%B3%E5%B3%B6%E7%9C%8C%E7%AB%8B%E5%9B%BD%E5%BA%9C%E6%94%AF%E6%8F%B4%E5%AD%A6%E6%A0%A1%E6%A0%A1%E8%88%8E%E6%A3%9F%E6%96%B0%E7%AF%89%E5%B7%A5%E4%BA%8B%E3%81%AE%E3%81%86%E3%81%A1%E5%BB%BA%E7%AF%89%E5%B7%A5%E4%BA%8B%E3%80%80%E5%9B%B3%E9%9D%A2%EF%BC%88%EF%BC%91%EF%BC%8F%EF%BC%92%EF%BC%90%EF%BC%89.pdf | 公共施設の実施設計図面。URLは長いためRAG側ではsource_id管理推奨。 |
| S07 | 北小倉小学校関連 給配水管移設工事 図面 | public procurement drawing / PDF | 宇治市 建設部 | 令和8年度 | 配管平面図・配管詳細図・横断面図・凡例 | https://nyusatsu.city.uji.kyoto.jp/apfile/2026/12065701-09zumen.pdf | 水道・給配水管の配管図面。 |
| S08 | 笠取小学校体育館空調設置ほか改修工事 図面 | public procurement drawing / PDF | 宇治市 | 令和8年度 | 仮設計画図、足場、凡例、注記の読み取り | https://nyusatsu.city.uji.kyoto.jp/apfile/2026/12058901-09zumen.pdf | 体育館改修の建築図面。 |
| B01 | AECV-Bench | existing benchmark / arXiv | AEC Foundry等 | 2026 | AEC図面理解ベンチマークの設計参考 | https://arxiv.org/abs/2601.04819 | 120床平面図の物体カウント、192 QA。日本語/MLITではない。 |
| B02 | AEC-Bench | existing benchmark / arXiv + GitHub | Nomic AI等 | 2026 | エージェント型AEC RAG評価の設計参考 | https://arxiv.org/abs/2603.29199 | 196インスタンス、9タスクファミリー、図面横断/プロジェクト横断を含む。 |
| B03 | JDocQA | existing benchmark / paper | LREC-COLING 2024 | 2024 | 日本語Document QAの形式・unanswerable設計参考 | https://arxiv.org/abs/2403.19454 | 日本語PDF文書QA。建築図面特化ではない。 |
| B04 | FloorplanQA | existing benchmark / arXiv | KAUST等 | 2026 | 空間推論タスク設計の参考 | https://arxiv.org/pdf/2507.07644 | JSON/XML構造化平面図に対する空間推論。画像図面ではない。 |
| B05 | DesignQA | existing benchmark / arXiv | MIT等 | 2024 | 仕様・要求文書×CAD/図面QAの参考 | https://arxiv.org/abs/2404.07917 | Formula SAE由来の技術文書・CAD・図面。建築公的図面ではない。 |

## 評価ルーブリック

| category | what_it_tests | recommended_metric | pass_condition | typical_failure_modes | target_share_full_benchmark |
| --- | --- | --- | --- | --- | --- |
| titleblock/OCR | 図面名、図面番号、縮尺、工事名、ページ/シート識別 | exact_match_normalized | 全角半角・空白・記号を正規化して一致 | OCR誤り、シート違い、A1/A3縮尺の混同 | 15% |
| legend/abbreviation | 建築・設備の記号、凡例、略号の展開 | exact_mapping / list_F1 | 記号→意味の対応が正しい | 似た略号の混同、凡例ではなく一般知識で回答 | 15% |
| dimension extraction | 寸法線・括弧寸法・厚さ・径・長さ・縮尺の読み取り | numeric_exact_with_unit / tolerance | mm/m/径/厚さの単位を正規化し、原則完全一致。OCR困難箇所は±1mm等の許容を明示 | 桁落ち、カンマ落ち、縮尺換算の誤用 | 20% |
| room label extraction | 室名、階、設備・部材ラベルの抽出 | exact_or_alias / list_F1 | 対象階・ラベル・括弧番号が正しい | 近傍ラベルの取り違え、同名室の集約ミス | 10% |
| symbol/counting | EV、扉、窓、器具、配管部材などの有無・数 | exact_count / MAPE | 定義に基づく数が一致。複数候補は根拠付き | ドア/開口/記号の未検出、重複カウント | 10% |
| spatial/comparative | 上下左右、隣接、系統、階間比較、条件比較 | boolean_with_evidence / semantic_judge | 結論と根拠シートが整合 | 視覚的位置関係の反転、比較対象の取り違え | 10% |
| cross-section navigation | 平面図から断面図、No.、詳細参照への遷移 | set_exact / retrieval_recall@k | 正しい参照番号とページを取得 | 検索が本文だけに偏り参照記号を落とす | 8% |
| precedence/compliance | 標準図・仕様書・案件図面の優先順位、特記事項の扱い | required_terms / expert_judge | 優先規則と回答範囲を明示 | 標準図を案件図面より優先、無根拠な適合判定 | 7% |
| abstention | 図面にない情報、範囲外の質問への回答抑制 | abstain_accuracy / unsupported_rate | 記載なし・根拠なしを明示し、推測しない | もっともらしい捏造、費用や法適合を断定 | 5% |

## 入力規則リスト

| task_category | difficulty | modality_scope | scoring_rule |
| --- | --- | --- | --- |
| abstention | easy | drawing image+OCR | abstain_correct |
| comparative | medium | drawing image+dimension | boolean_with_evidence |
| cross-section navigation | hard | drawing text+OCR | exact_mapping |
| detail extraction |  | drawing text+dimension | exact_normalized |
| dimension extraction |  | drawing text+legend | exact_or_alias |
| dimension rule |  | text+layout | exact_or_required_terms |
| legend/abbreviation |  | visual symbol+OCR | numeric_exact |
| material extraction |  |  | numeric_exact_m |
| metadata/policy |  |  | numeric_exact_mm |
| open-ended grounded |  |  | numeric_exact_with_label |
| precedence/compliance |  |  | numeric_pair_exact |
| room label extraction |  |  | required_terms |
| safety note extraction |  |  | semantic_exact_with_required_terms |
| symbol/counting |  |  | set_exact |
| titleblock/OCR |  |  |  |

## Seed QA

各 QA は Excel の `Benchmark_v0.1` 行を `id` 単位で展開した。`source_id` の URL と出典情報は「公的図面・参照ソース」を参照する。

### OV-001 / metadata/policy / purpose

- source_id: `S01`
- document_name: 建築工事標準詳細図（令和4年改定）概要・表示記号及び略号
- page_or_sheet: P1
- evidence_anchor: lines 12-15
- modality_scope: text+layout
- retrieval_setting: single-page
- question_ja: 建築工事標準詳細図の目的は何か。
- expected_answer_ja: 設計で使用頻度の高い詳細を標準化し、設計の質の確保、能率向上、寸法統一を図り、積算・施工等の業務簡素化を図ること。
- acceptable_aliases_or_normalization: 要旨一致。設計品質/能率/寸法統一/積算施工簡素化のうち主要要素を含む。
- scoring_rule: `semantic_exact_with_required_terms`
- difficulty: `easy`

### OV-002 / metadata/policy / scope

- source_id: `S01`
- document_name: 建築工事標準詳細図（令和4年改定）概要・表示記号及び略号
- page_or_sheet: P1
- evidence_anchor: lines 16-18
- modality_scope: text+layout
- retrieval_setting: single-page
- question_ja: 建築工事標準詳細図の適用範囲は何か。
- expected_answer_ja: 官公庁施設の建設等に関する法律第2条第2項に規定する庁舎及びその附帯施設の建築設計。
- acceptable_aliases_or_normalization: 庁舎等/官庁施設の庁舎及び附帯施設を可。
- scoring_rule: `exact_or_required_terms`
- difficulty: `easy`

### OV-003 / precedence/compliance / document precedence

- source_id: `S01`
- document_name: 建築工事標準詳細図（令和4年改定）概要・表示記号及び略号
- page_or_sheet: P1
- evidence_anchor: lines 35-39
- modality_scope: text+layout
- retrieval_setting: single-page
- question_ja: 標準詳細図と設計図書中の図面が相違する場合、どちらを優先するか。
- expected_answer_ja: 図面を優先する。
- acceptable_aliases_or_normalization: プロジェクトの図面/設計図書の図面が優先。
- scoring_rule: `exact_or_alias`
- difficulty: `easy`
- notes: QARAGで標準図と案件図面が衝突したときの重要テスト。

### OV-004 / legend/abbreviation / abbreviation expansion

- source_id: `S01`
- document_name: 建築工事標準詳細図（令和4年改定）概要・表示記号及び略号
- page_or_sheet: P3
- evidence_anchor: lines 47-48 / screenshot
- modality_scope: visual symbol+OCR
- retrieval_setting: single-page
- question_ja: 建築工事標準詳細図の略号「BM」は何を表すか。
- expected_answer_ja: ベンチマーク。
- acceptable_aliases_or_normalization: Benchmarkも可。
- scoring_rule: `exact_or_alias`
- difficulty: `easy`

### OV-005 / legend/abbreviation / abbreviation expansion

- source_id: `S01`
- document_name: 建築工事標準詳細図（令和4年改定）概要・表示記号及び略号
- page_or_sheet: P3
- evidence_anchor: lines 47-48 / screenshot
- modality_scope: visual symbol+OCR
- retrieval_setting: single-page
- question_ja: 建築工事標準詳細図の略号「GL」は何を表すか。
- expected_answer_ja: 基準地盤面。
- acceptable_aliases_or_normalization: ground levelは参考語として可だが日本語回答を推奨。
- scoring_rule: `exact_or_alias`
- difficulty: `easy`

### OV-006 / legend/abbreviation / abbreviation expansion

- source_id: `S01`
- document_name: 建築工事標準詳細図（令和4年改定）概要・表示記号及び略号
- page_or_sheet: P3
- evidence_anchor: lines 47-48 / screenshot
- modality_scope: visual symbol+OCR
- retrieval_setting: single-page
- question_ja: 建築工事標準詳細図の略号「FL」は何を表すか。
- expected_answer_ja: 基準床面。
- acceptable_aliases_or_normalization: floor levelは参考語として可だが日本語回答を推奨。
- scoring_rule: `exact_or_alias`
- difficulty: `easy`

### OV-007 / legend/abbreviation / material abbreviation

- source_id: `S01`
- document_name: 建築工事標準詳細図（令和4年改定）概要・表示記号及び略号
- page_or_sheet: P3
- evidence_anchor: lines 45-48 / screenshot
- modality_scope: visual symbol+OCR
- retrieval_setting: single-page
- question_ja: 「ALC」は何を表すか。
- expected_answer_ja: 軽量気泡コンクリートパネル。
- acceptable_aliases_or_normalization: ALCパネル/軽量気泡コンクリートパネル。
- scoring_rule: `exact_or_alias`
- difficulty: `easy`

### OV-008 / legend/abbreviation / finish abbreviation

- source_id: `S01`
- document_name: 建築工事標準詳細図（令和4年改定）概要・表示記号及び略号
- page_or_sheet: P3
- evidence_anchor: lines 45-46 / screenshot
- modality_scope: visual symbol+OCR
- retrieval_setting: single-page
- question_ja: 仕上げ略号「SOP」は何を表すか。
- expected_answer_ja: 合成樹脂調合ペイント塗り。
- acceptable_aliases_or_normalization: 合成樹脂調合ペイント。
- scoring_rule: `exact_or_alias`
- difficulty: `easy`

### OV-009 / legend/abbreviation / finish abbreviation

- source_id: `S01`
- document_name: 建築工事標準詳細図（令和4年改定）概要・表示記号及び略号
- page_or_sheet: P3
- evidence_anchor: lines 45-46 / screenshot
- modality_scope: visual symbol+OCR
- retrieval_setting: single-page
- question_ja: 仕上げ略号「CL」は何を表すか。
- expected_answer_ja: クリヤラッカー塗り。
- acceptable_aliases_or_normalization: クリアラッカー塗りも可。
- scoring_rule: `exact_or_alias`
- difficulty: `easy`

### ME-001 / legend/abbreviation / mechanical symbol rule

- source_id: `S04`
- document_name: 公共建築設備工事標準図（機械設備工事編）令和7年版
- page_or_sheet: P1
- evidence_anchor: lines 16-18
- modality_scope: text+layout
- retrieval_setting: single-page
- question_ja: 令和7年版の公共建築設備工事標準図（機械設備工事編）で、図示記号はどのような位置づけか。
- expected_answer_ja: 図示記号は標準的な記号を示したもので、記載がない記号が示す内容は特記による。
- acceptable_aliases_or_normalization: 標準記号/記載がない記号は特記による、の2点必須。
- scoring_rule: `required_terms`
- difficulty: `medium`

### ME-002 / legend/abbreviation / pipe notation

- source_id: `S04`
- document_name: 公共建築設備工事標準図（機械設備工事編）令和7年版
- page_or_sheet: P2
- evidence_anchor: lines 39-52
- modality_scope: text+layout
- retrieval_setting: single-page
- question_ja: 管の太さ又は種類を同時に示す場合、どの順序で記入するか。
- expected_answer_ja: 管の太さを表す文字の次に、管の種類を表す記号を記入する。
- acceptable_aliases_or_normalization: 太さ→管種記号の順。
- scoring_rule: `required_terms`
- difficulty: `medium`

### ME-003 / legend/abbreviation / pipe material code

- source_id: `S04`
- document_name: 公共建築設備工事標準図（機械設備工事編）令和7年版
- page_or_sheet: P2
- evidence_anchor: lines 60-75
- modality_scope: text+layout
- retrieval_setting: single-page
- question_ja: 機械設備標準図の管種記号「CU」は何を表すか。
- expected_answer_ja: 銅管。
- acceptable_aliases_or_normalization: 銅管/どうかん。
- scoring_rule: `exact_or_alias`
- difficulty: `easy`

### ME-004 / legend/abbreviation / pipe material code

- source_id: `S04`
- document_name: 公共建築設備工事標準図（機械設備工事編）令和7年版
- page_or_sheet: P2
- evidence_anchor: lines 60-75
- modality_scope: text+layout
- retrieval_setting: single-page
- question_ja: 機械設備標準図の管種記号「PE」は何を表すか。
- expected_answer_ja: ポリエチレン管。
- acceptable_aliases_or_normalization: polyethylene pipeも可。
- scoring_rule: `exact_or_alias`
- difficulty: `easy`

### ME-005 / legend/abbreviation / fitting symbol

- source_id: `S04`
- document_name: 公共建築設備工事標準図（機械設備工事編）令和7年版
- page_or_sheet: P3
- evidence_anchor: lines 117-124
- modality_scope: text+layout
- retrieval_setting: single-page
- question_ja: 機械設備標準図で「FJ」は何の記号か。
- expected_answer_ja: たわみ継手、可とう継手等。
- acceptable_aliases_or_normalization: フレキシブルジョイント/可とう継手を含む回答可。
- scoring_rule: `exact_or_alias`
- difficulty: `medium`

### EL-001 / dimension rule / range interpretation

- source_id: `S05`
- document_name: 公共建築設備工事標準図（電気設備工事編）令和7年版
- page_or_sheet: P1
- evidence_anchor: lines 19-24
- modality_scope: text+layout
- retrieval_setting: single-page
- question_ja: 電気設備標準図で寸法が「以上」と示されている場合、どの値を満たせばよいか。
- expected_answer_ja: その値以上であればよい。
- acceptable_aliases_or_normalization: 以上=同値を含み上回る値。
- scoring_rule: `exact_or_alias`
- difficulty: `easy`

### EL-002 / dimension rule / range interpretation

- source_id: `S05`
- document_name: 公共建築設備工事標準図（電気設備工事編）令和7年版
- page_or_sheet: P1
- evidence_anchor: lines 19-24
- modality_scope: text+layout
- retrieval_setting: single-page
- question_ja: 電気設備標準図で寸法が「以下」と示されている場合、どの値を満たせばよいか。
- expected_answer_ja: その値以下であればよい。
- acceptable_aliases_or_normalization: 以下=同値を含み下回る値。
- scoring_rule: `exact_or_alias`
- difficulty: `easy`

### EL-003 / dimension rule / material thickness

- source_id: `S05`
- document_name: 公共建築設備工事標準図（電気設備工事編）令和7年版
- page_or_sheet: P1
- evidence_anchor: line 25
- modality_scope: text+layout
- retrieval_setting: single-page
- question_ja: 電気設備標準図に示す材厚は、どの時点の厚さとして扱うか。
- expected_answer_ja: 加工前の標準厚さとし、図及び表の値以上とする。
- acceptable_aliases_or_normalization: 加工前/標準厚さ/値以上の3点。
- scoring_rule: `required_terms`
- difficulty: `medium`

### EL-004 / legend/abbreviation / material code

- source_id: `S05`
- document_name: 公共建築設備工事標準図（電気設備工事編）令和7年版
- page_or_sheet: P2
- evidence_anchor: lines 74-85
- modality_scope: text+layout
- retrieval_setting: single-page
- question_ja: 材質記号「PVC」は何を表すか。
- expected_answer_ja: 硬質塩化ビニル樹脂。
- acceptable_aliases_or_normalization: 硬質PVC/硬質塩ビも可。
- scoring_rule: `exact_or_alias`
- difficulty: `easy`

### F1-001 / titleblock/OCR / sheet number

- source_id: `S02`
- document_name: 建築工事標準詳細図 平成28年版：床仕上げ（1-01, 1-02）
- page_or_sheet: P1 / sheet 1-01
- evidence_anchor: screenshot page 1
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: この図面の図面番号は何か。
- expected_answer_ja: 1-01。
- acceptable_aliases_or_normalization: 全角/半角ハイフンを正規化。
- scoring_rule: `exact_normalized`
- difficulty: `easy`

### F1-002 / titleblock/OCR / drawing title

- source_id: `S02`
- document_name: 建築工事標準詳細図 平成28年版：床仕上げ（1-01, 1-02）
- page_or_sheet: P1 / sheet 1-01
- evidence_anchor: screenshot page 1
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: 図面番号1-01の図面名称は何か。
- expected_answer_ja: 床：仕上げ。
- acceptable_aliases_or_normalization: 床 仕上げ/床仕上げも可。
- scoring_rule: `exact_or_alias`
- difficulty: `easy`

### F1-003 / titleblock/OCR / scale extraction

- source_id: `S02`
- document_name: 建築工事標準詳細図 平成28年版：床仕上げ（1-01, 1-02）
- page_or_sheet: P1 / sheet 1-01
- evidence_anchor: screenshot page 1
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: 図面番号1-01の縮尺は何か。
- expected_answer_ja: 1/5。
- acceptable_aliases_or_normalization: S=1/5も可。
- scoring_rule: `exact_normalized`
- difficulty: `easy`

### F1-004 / detail extraction / detail label

- source_id: `S02`
- document_name: 建築工事標準詳細図 平成28年版：床仕上げ（1-01, 1-02）
- page_or_sheet: P1 / sheet 1-01
- evidence_anchor: screenshot page 1 top-left
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: 1-01の「-1」はどの床仕上げを示すか。
- expected_answer_ja: モルタル、モルタルの上塗り床等。
- acceptable_aliases_or_normalization: モルタル床/モルタル上塗り床等を含む。
- scoring_rule: `required_terms`
- difficulty: `easy`

### F1-005 / detail extraction / detail label

- source_id: `S02`
- document_name: 建築工事標準詳細図 平成28年版：床仕上げ（1-01, 1-02）
- page_or_sheet: P1 / sheet 1-01
- evidence_anchor: screenshot page 1 top row
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: 1-01の「-3」は何を示すか。
- expected_answer_ja: 床コンクリート直均し仕上げ、床コンクリート直均し仕上げの上塗り床等。
- acceptable_aliases_or_normalization: 床コンクリート直均し仕上げを必須。
- scoring_rule: `required_terms`
- difficulty: `easy`

### F1-006 / dimension extraction / dimension

- source_id: `S02`
- document_name: 建築工事標準詳細図 平成28年版：床仕上げ（1-01, 1-02）
- page_or_sheet: P1 / sheet 1-01
- evidence_anchor: screenshot page 1 top-left
- modality_scope: drawing image+dimension
- retrieval_setting: single-page
- question_ja: 1-01の「-1」モルタル仕上げで、図中に示される厚さ寸法はいくつか。
- expected_answer_ja: 30 mm。
- acceptable_aliases_or_normalization: 30/30mm/30㎜。単位mmに正規化。
- scoring_rule: `numeric_exact_mm`
- difficulty: `medium`

### F1-007 / dimension extraction / standard tile size

- source_id: `S02`
- document_name: 建築工事標準詳細図 平成28年版：床仕上げ（1-01, 1-02）
- page_or_sheet: P1 / sheet 1-01
- evidence_anchor: screenshot page 1 center
- modality_scope: drawing image+dimension
- retrieval_setting: single-page
- question_ja: 1-01の誘導用床材・注意喚起用床材で、図中に示される標準的な寸法は何か。
- expected_answer_ja: 300×300×30程度。
- acceptable_aliases_or_normalization: 300x300x30、300×300×30mm程度。
- scoring_rule: `exact_normalized`
- difficulty: `medium`

### F1-008 / dimension extraction / stone size

- source_id: `S02`
- document_name: 建築工事標準詳細図 平成28年版：床仕上げ（1-01, 1-02）
- page_or_sheet: P1 / sheet 1-01
- evidence_anchor: screenshot page 1 bottom-left
- modality_scope: drawing image+dimension
- retrieval_setting: single-page
- question_ja: 石厚50以下の場合、石の標準寸法はいくつか。
- expected_answer_ja: 600×600。
- acceptable_aliases_or_normalization: 600x600、600×600mm。
- scoring_rule: `numeric_pair_exact`
- difficulty: `medium`

### F1-009 / dimension extraction / stone size

- source_id: `S02`
- document_name: 建築工事標準詳細図 平成28年版：床仕上げ（1-01, 1-02）
- page_or_sheet: P1 / sheet 1-01
- evidence_anchor: screenshot page 1 bottom-center
- modality_scope: drawing image+dimension
- retrieval_setting: single-page
- question_ja: 石厚50を超える場合、石の標準寸法はいくつか。
- expected_answer_ja: 900×450。
- acceptable_aliases_or_normalization: 900x450、900×450mm。
- scoring_rule: `numeric_pair_exact`
- difficulty: `medium`

### F1-010 / open-ended grounded / special note extraction

- source_id: `S02`
- document_name: 建築工事標準詳細図 平成28年版：床仕上げ（1-01, 1-02）
- page_or_sheet: P1 / sheet 1-01
- evidence_anchor: screenshot page 1 bottom notes
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: 1-01の特記事項で、7の誘導用床材・注意喚起用床材について特記すべき項目は何か。
- expected_answer_ja: 材質、厚さ。
- acceptable_aliases_or_normalization: 材質および厚さ。
- scoring_rule: `exact_or_required_terms`
- difficulty: `medium`

### F2-001 / titleblock/OCR / sheet number

- source_id: `S02`
- document_name: 建築工事標準詳細図 平成28年版：床仕上げ（1-01, 1-02）
- page_or_sheet: P2 / sheet 1-02
- evidence_anchor: screenshot page 2
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: この図面の図面番号は何か。
- expected_answer_ja: 1-02。
- acceptable_aliases_or_normalization: 全角/半角ハイフンを正規化。
- scoring_rule: `exact_normalized`
- difficulty: `easy`

### F2-002 / detail extraction / detail group

- source_id: `S02`
- document_name: 建築工事標準詳細図 平成28年版：床仕上げ（1-01, 1-02）
- page_or_sheet: P2 / sheet 1-02
- evidence_anchor: screenshot page 2
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: 1-02の「-1〜-3」は何の詳細か。
- expected_answer_ja: 畳敷き。
- acceptable_aliases_or_normalization: 畳/畳敷。
- scoring_rule: `exact_or_alias`
- difficulty: `easy`

### F2-003 / dimension extraction / material thickness

- source_id: `S02`
- document_name: 建築工事標準詳細図 平成28年版：床仕上げ（1-01, 1-02）
- page_or_sheet: P2 / sheet 1-02
- evidence_anchor: screenshot page 2 top-right
- modality_scope: drawing image+dimension
- retrieval_setting: single-page
- question_ja: 1-02の「-3」畳敷きで、ポリスチレンフォーム床下地材の厚さはいくつか。
- expected_answer_ja: t=40。
- acceptable_aliases_or_normalization: 40mm/厚さ40。
- scoring_rule: `numeric_exact_mm`
- difficulty: `medium`

### F2-004 / dimension extraction / spacing

- source_id: `S02`
- document_name: 建築工事標準詳細図 平成28年版：床仕上げ（1-01, 1-02）
- page_or_sheet: P2 / sheet 1-02
- evidence_anchor: screenshot page 2 middle
- modality_scope: drawing image+dimension
- retrieval_setting: single-page
- question_ja: 1-02のフローリングボード・複合フローリングの根太間隔はどのように示されているか。
- expected_answer_ja: 根太 @300。
- acceptable_aliases_or_normalization: @300/300mm間隔。
- scoring_rule: `numeric_exact_mm`
- difficulty: `medium`

### F2-005 / titleblock/OCR / drawing title

- source_id: `S02`
- document_name: 建築工事標準詳細図 平成28年版：床仕上げ（1-01, 1-02）
- page_or_sheet: P2 / sheet 1-02
- evidence_anchor: screenshot page 2 bottom-right
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: 1-02の図面名称は何か。
- expected_answer_ja: 床：仕上げ。
- acceptable_aliases_or_normalization: 床仕上げも可。
- scoring_rule: `exact_or_alias`
- difficulty: `easy`

### F2-006 / titleblock/OCR / scale extraction

- source_id: `S02`
- document_name: 建築工事標準詳細図 平成28年版：床仕上げ（1-01, 1-02）
- page_or_sheet: P2 / sheet 1-02
- evidence_anchor: screenshot page 2 bottom-right
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: 1-02の縮尺は何か。
- expected_answer_ja: 1/5。
- acceptable_aliases_or_normalization: S=1/5も可。
- scoring_rule: `exact_normalized`
- difficulty: `easy`

### I7-001 / titleblock/OCR / sheet number

- source_id: `S03`
- document_name: 建築工事標準詳細図 平成28年版：断熱・階段（7-01, 7-11）
- page_or_sheet: P1 / sheet 7-01
- evidence_anchor: screenshot page 1
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: この図面の図面番号は何か。
- expected_answer_ja: 7-01。
- acceptable_aliases_or_normalization: 全角/半角ハイフンを正規化。
- scoring_rule: `exact_normalized`
- difficulty: `easy`

### I7-002 / titleblock/OCR / drawing title

- source_id: `S03`
- document_name: 建築工事標準詳細図 平成28年版：断熱・階段（7-01, 7-11）
- page_or_sheet: P1 / sheet 7-01
- evidence_anchor: screenshot page 1 bottom-right
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: 図面番号7-01の図面名称は何か。
- expected_answer_ja: 断熱：断熱材打込み。
- acceptable_aliases_or_normalization: 断熱材打込みを含む。
- scoring_rule: `required_terms`
- difficulty: `easy`

### I7-003 / titleblock/OCR / scale extraction

- source_id: `S03`
- document_name: 建築工事標準詳細図 平成28年版：断熱・階段（7-01, 7-11）
- page_or_sheet: P1 / sheet 7-01
- evidence_anchor: screenshot page 1 bottom-right
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: 7-01の縮尺は何か。
- expected_answer_ja: 1/20、1/50。
- acceptable_aliases_or_normalization: 1/20 and 1/50。順不同可。
- scoring_rule: `set_exact`
- difficulty: `easy`

### I7-004 / comparative / case distinction

- source_id: `S03`
- document_name: 建築工事標準詳細図 平成28年版：断熱・階段（7-01, 7-11）
- page_or_sheet: P1 / sheet 7-01
- evidence_anchor: screenshot page 1
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: 7-01で比較されている地域条件は何か。
- expected_answer_ja: 寒地の場合、標準地及び暖地の場合。
- acceptable_aliases_or_normalization: 寒地/標準地/暖地の3語を含む。
- scoring_rule: `required_terms`
- difficulty: `medium`

### I7-005 / dimension extraction / dimension

- source_id: `S03`
- document_name: 建築工事標準詳細図 平成28年版：断熱・階段（7-01, 7-11）
- page_or_sheet: P1 / sheet 7-01
- evidence_anchor: screenshot page 1 left section
- modality_scope: drawing image+dimension
- retrieval_setting: single-page
- question_ja: 7-01の寒地の場合の外周地盤側の断面で、縦方向に示される寸法はいくつか。
- expected_answer_ja: (400) mm。
- acceptable_aliases_or_normalization: 400/400mm。括弧は任意。
- scoring_rule: `numeric_exact_mm`
- difficulty: `hard`
- notes: 小さい寸法注記の読み取り。

### I7-006 / material extraction / material thickness

- source_id: `S03`
- document_name: 建築工事標準詳細図 平成28年版：断熱・階段（7-01, 7-11）
- page_or_sheet: P1 / sheet 7-01
- evidence_anchor: screenshot page 1 left slab detail
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: 7-01の土間コンクリートの場合で、ポリエチレンフィルムの厚さはどう示されているか。
- expected_answer_ja: t 0.15。
- acceptable_aliases_or_normalization: t=0.15/0.15mm相当。
- scoring_rule: `numeric_exact_with_label`
- difficulty: `hard`

### I7-007 / detail extraction / case label

- source_id: `S03`
- document_name: 建築工事標準詳細図 平成28年版：断熱・階段（7-01, 7-11）
- page_or_sheet: P1 / sheet 7-01
- evidence_anchor: screenshot page 1 right
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: 7-01で、右側の断面図に併記されている屋根条件は何か。
- expected_answer_ja: 屋根が断熱防水の場合。
- acceptable_aliases_or_normalization: 断熱防水の屋根/屋根が断熱防水。
- scoring_rule: `exact_or_alias`
- difficulty: `medium`

### S7-001 / titleblock/OCR / sheet number

- source_id: `S03`
- document_name: 建築工事標準詳細図 平成28年版：断熱・階段（7-01, 7-11）
- page_or_sheet: P2 / sheet 7-11
- evidence_anchor: screenshot page 2
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: 階段図面の図面番号は何か。
- expected_answer_ja: 7-11。
- acceptable_aliases_or_normalization: 全角/半角ハイフンを正規化。
- scoring_rule: `exact_normalized`
- difficulty: `easy`

### S7-002 / titleblock/OCR / drawing title

- source_id: `S03`
- document_name: 建築工事標準詳細図 平成28年版：断熱・階段（7-01, 7-11）
- page_or_sheet: P2 / sheet 7-11
- evidence_anchor: screenshot page 2 bottom-right
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: 図面番号7-11の図面名称は何か。
- expected_answer_ja: 階段：階段 平面、断面。
- acceptable_aliases_or_normalization: 階段/平面/断面を含む。
- scoring_rule: `required_terms`
- difficulty: `easy`

### S7-003 / titleblock/OCR / scale extraction

- source_id: `S03`
- document_name: 建築工事標準詳細図 平成28年版：断熱・階段（7-01, 7-11）
- page_or_sheet: P2 / sheet 7-11
- evidence_anchor: screenshot page 2 bottom-right
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: 7-11の縮尺は何か。
- expected_answer_ja: 1/50。
- acceptable_aliases_or_normalization: S=1/50も可。
- scoring_rule: `exact_normalized`
- difficulty: `easy`

### S7-004 / comparative / case distinction

- source_id: `S03`
- document_name: 建築工事標準詳細図 平成28年版：断熱・階段（7-01, 7-11）
- page_or_sheet: P2 / sheet 7-11
- evidence_anchor: screenshot page 2 top
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: 7-11で示されている2つの階段ケースは何か。
- expected_answer_ja: 階段（手すり子のある場合）と、階段（手すり腰壁の場合）。
- acceptable_aliases_or_normalization: 手すり子/手すり腰壁の2語を含む。
- scoring_rule: `required_terms`
- difficulty: `medium`

### S7-005 / dimension extraction / minimum width

- source_id: `S03`
- document_name: 建築工事標準詳細図 平成28年版：断熱・階段（7-01, 7-11）
- page_or_sheet: P2 / sheet 7-11
- evidence_anchor: screenshot page 2 plan/section
- modality_scope: drawing image+dimension
- retrieval_setting: single-page
- question_ja: 7-11の平面図・断面図で、W1の最小値はどう示されているか。
- expected_answer_ja: W1≧1,400。
- acceptable_aliases_or_normalization: W1 >= 1400、W1は1400mm以上。
- scoring_rule: `numeric_exact_with_label`
- difficulty: `medium`

### S7-006 / dimension extraction / minimum width

- source_id: `S03`
- document_name: 建築工事標準詳細図 平成28年版：断熱・階段（7-01, 7-11）
- page_or_sheet: P2 / sheet 7-11
- evidence_anchor: screenshot page 2 plan/section
- modality_scope: drawing image+dimension
- retrieval_setting: single-page
- question_ja: 7-11の平面図・断面図で、W2の最小値はどう示されているか。
- expected_answer_ja: W2≧1,400。
- acceptable_aliases_or_normalization: W2 >= 1400、W2は1400mm以上。
- scoring_rule: `numeric_exact_with_label`
- difficulty: `medium`

### S7-007 / open-ended grounded / special note extraction

- source_id: `S03`
- document_name: 建築工事標準詳細図 平成28年版：断熱・階段（7-01, 7-11）
- page_or_sheet: P2 / sheet 7-11
- evidence_anchor: screenshot page 2 bottom notes
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: 7-11の特記事項で、T、R、W1、W2、Hのほかに特記対象として挙げられるものを答えよ。
- expected_answer_ja: 下段手すりの有無及びその高さ、点字表示位置、蹴高。
- acceptable_aliases_or_normalization: 下段手すり/点字表示位置/蹴高を含む。
- scoring_rule: `required_terms`
- difficulty: `hard`

### TJ-001 / titleblock/OCR / project name

- source_id: `S06`
- document_name: 徳島県立国府支援学校校舎棟新築工事のうち建築工事 図面（1/20）
- page_or_sheet: P27-28 / A-026 A-027
- evidence_anchor: lines 10065-10074, 10337-10347
- modality_scope: drawing text+OCR
- retrieval_setting: multi-page
- question_ja: 徳島県の平面図に記載された工事名は何か。
- expected_answer_ja: 徳島県立国府支援学校校舎棟新築工事のうち建築工事。
- acceptable_aliases_or_normalization: 完全一致。
- scoring_rule: `exact_normalized`
- difficulty: `easy`

### TJ-002 / titleblock/OCR / sheet metadata

- source_id: `S06`
- document_name: 徳島県立国府支援学校校舎棟新築工事のうち建築工事 図面（1/20）
- page_or_sheet: P27 / A-026
- evidence_anchor: lines 10065-10074
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: 1階平面図の図面番号と縮尺は何か。
- expected_answer_ja: 図面番号はA-026、縮尺はA1:1/150。
- acceptable_aliases_or_normalization: A-026と1/150を含む。
- scoring_rule: `required_terms`
- difficulty: `easy`

### TJ-003 / titleblock/OCR / sheet metadata

- source_id: `S06`
- document_name: 徳島県立国府支援学校校舎棟新築工事のうち建築工事 図面（1/20）
- page_or_sheet: P28 / A-027
- evidence_anchor: lines 10337-10347
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: 2階平面図の図面番号と縮尺は何か。
- expected_answer_ja: 図面番号はA-027、縮尺はA1:1/150。
- acceptable_aliases_or_normalization: A-027と1/150を含む。
- scoring_rule: `required_terms`
- difficulty: `easy`

### TJ-004 / room label extraction / floor/room relation

- source_id: `S06`
- document_name: 徳島県立国府支援学校校舎棟新築工事のうち建築工事 図面（1/20）
- page_or_sheet: P27 / A-026
- evidence_anchor: lines 10075-10081
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: 保健室(1)が記載されているのは何階平面図か。
- expected_answer_ja: 1階平面図。
- acceptable_aliases_or_normalization: 1階/一階。
- scoring_rule: `exact_or_alias`
- difficulty: `easy`

### TJ-005 / room label extraction / floor/room relation

- source_id: `S06`
- document_name: 徳島県立国府支援学校校舎棟新築工事のうち建築工事 図面（1/20）
- page_or_sheet: P28 / A-027
- evidence_anchor: lines 10348-10360
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: 職員室と職員WWC(1)が記載されているのは何階平面図か。
- expected_answer_ja: 2階平面図。
- acceptable_aliases_or_normalization: 2階/二階。
- scoring_rule: `exact_or_alias`
- difficulty: `easy`

### TJ-006 / symbol/counting / element presence

- source_id: `S06`
- document_name: 徳島県立国府支援学校校舎棟新築工事のうち建築工事 図面（1/20）
- page_or_sheet: P28 / A-027
- evidence_anchor: lines 10348-10353
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: 2階平面図にはEV(2)の表記があるか。
- expected_answer_ja: ある。EV(2)が記載されている。
- acceptable_aliases_or_normalization: はい/あり。
- scoring_rule: `boolean_with_evidence`
- difficulty: `easy`

### TJ-007 / dimension extraction / overall dimension

- source_id: `S06`
- document_name: 徳島県立国府支援学校校舎棟新築工事のうち建築工事 図面（1/20）
- page_or_sheet: P27 / A-026
- evidence_anchor: lines 10054-10063
- modality_scope: drawing text+dimension
- retrieval_setting: single-page
- question_ja: 1階平面図で示される全体寸法64,740は、どの図面から抽出されるか。
- expected_answer_ja: 1階平面図（A-026）から抽出される。
- acceptable_aliases_or_normalization: A-026/1階平面図を含む。
- scoring_rule: `required_terms`
- difficulty: `medium`

### TJ-008 / dimension extraction / overall dimension

- source_id: `S06`
- document_name: 徳島県立国府支援学校校舎棟新築工事のうち建築工事 図面（1/20）
- page_or_sheet: P28 / A-027
- evidence_anchor: lines 10322-10329
- modality_scope: drawing text+dimension
- retrieval_setting: single-page
- question_ja: 2階平面図で示される全体寸法はいくつか。
- expected_answer_ja: 66,000。
- acceptable_aliases_or_normalization: 66000/66,000mm。
- scoring_rule: `numeric_exact_mm`
- difficulty: `medium`

### UJ-001 / titleblock/OCR / project name

- source_id: `S07`
- document_name: 北小倉小学校関連 給配水管移設工事 図面
- page_or_sheet: P0-P1
- evidence_anchor: lines 190-199, 318-323
- modality_scope: drawing text+OCR
- retrieval_setting: multi-page
- question_ja: 宇治市の配管図面に記載された工事名は何か。
- expected_answer_ja: 北小倉小学校関連 給配水管移設工事。
- acceptable_aliases_or_normalization: 北小倉小学校関連/給配水管移設工事を含む。
- scoring_rule: `required_terms`
- difficulty: `easy`

### UJ-002 / titleblock/OCR / drawing type+scale

- source_id: `S07`
- document_name: 北小倉小学校関連 給配水管移設工事 図面
- page_or_sheet: P0 / sheet 1 of 3
- evidence_anchor: lines 116-126, 190-199
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: 1枚目の図面種類と縮尺は何か。
- expected_answer_ja: 配管平面図、縮尺1/250。
- acceptable_aliases_or_normalization: 配管平面図と1/250を含む。
- scoring_rule: `required_terms`
- difficulty: `easy`

### UJ-003 / titleblock/OCR / drawing type+scale

- source_id: `S07`
- document_name: 北小倉小学校関連 給配水管移設工事 図面
- page_or_sheet: P1 / sheet 2 of 3
- evidence_anchor: lines 208-216, 318-323
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: 2枚目の図面種類と縮尺は何か。
- expected_answer_ja: 配管詳細図、縮尺1/100。
- acceptable_aliases_or_normalization: 配管詳細図と1/100を含む。
- scoring_rule: `required_terms`
- difficulty: `easy`

### UJ-004 / legend/abbreviation / legend code

- source_id: `S07`
- document_name: 北小倉小学校関連 給配水管移設工事 図面
- page_or_sheet: P0-P1
- evidence_anchor: lines 149-152, 278-279
- modality_scope: drawing text+legend
- retrieval_setting: single-page
- question_ja: 凡例の施工タイプで、type1は何を意味するか。
- expected_answer_ja: 外つなぎ。
- acceptable_aliases_or_normalization: 外つなぎ。
- scoring_rule: `exact_or_alias`
- difficulty: `easy`

### UJ-005 / legend/abbreviation / legend code

- source_id: `S07`
- document_name: 北小倉小学校関連 給配水管移設工事 図面
- page_or_sheet: P0-P1
- evidence_anchor: lines 149-152, 278-279
- modality_scope: drawing text+legend
- retrieval_setting: single-page
- question_ja: 凡例の施工タイプで、type2は何を意味するか。
- expected_answer_ja: 1次側改良（メーターまで）。
- acceptable_aliases_or_normalization: 一次側改良/メーターまで。
- scoring_rule: `required_terms`
- difficulty: `easy`

### UJ-006 / legend/abbreviation / legend code

- source_id: `S07`
- document_name: 北小倉小学校関連 給配水管移設工事 図面
- page_or_sheet: P0-P1
- evidence_anchor: lines 149-152
- modality_scope: drawing text+legend
- retrieval_setting: single-page
- question_ja: 凡例の施工タイプで、type3は何を意味するか。
- expected_answer_ja: 1,2次側改良。
- acceptable_aliases_or_normalization: 一次側・二次側改良。
- scoring_rule: `exact_or_alias`
- difficulty: `easy`

### UJ-007 / legend/abbreviation / legend code

- source_id: `S07`
- document_name: 北小倉小学校関連 給配水管移設工事 図面
- page_or_sheet: P0-P1
- evidence_anchor: lines 149-152
- modality_scope: drawing text+legend
- retrieval_setting: single-page
- question_ja: 凡例の施工タイプで、type4は何を意味するか。
- expected_answer_ja: 外つなぎ、2次側改良。
- acceptable_aliases_or_normalization: 外つなぎと二次側改良を含む。
- scoring_rule: `required_terms`
- difficulty: `easy`

### UJ-008 / legend/abbreviation / existing utility symbol

- source_id: `S07`
- document_name: 北小倉小学校関連 給配水管移設工事 図面
- page_or_sheet: P0
- evidence_anchor: lines 153-155
- modality_scope: drawing text+legend
- retrieval_setting: single-page
- question_ja: 凡例の既設地下埋設物で、WとSはそれぞれ何を示すか。
- expected_answer_ja: Wは上水道管、Sは下水道管。
- acceptable_aliases_or_normalization: 上水道管=W、下水道管=S。
- scoring_rule: `exact_mapping`
- difficulty: `easy`

### UJ-009 / material extraction / pipe component

- source_id: `S07`
- document_name: 北小倉小学校関連 給配水管移設工事 図面
- page_or_sheet: P1 / 配管詳細図
- evidence_anchor: lines 217-227
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: 配管詳細図で「DIP-GX 直管 φ75×4000」は何本示されているか。
- expected_answer_ja: 23本。
- acceptable_aliases_or_normalization: ×23/23。
- scoring_rule: `numeric_exact`
- difficulty: `medium`

### UJ-010 / material extraction / pipe component

- source_id: `S07`
- document_name: 北小倉小学校関連 給配水管移設工事 図面
- page_or_sheet: P1 / 配管詳細図
- evidence_anchor: lines 217-218
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: 不断水割丁字管(VK型)の口径表記とBOX有無はどう記載されているか。
- expected_answer_ja: φ200×φ75(VB)、BOXなし。
- acceptable_aliases_or_normalization: φ200×φ75とBOXなしを含む。
- scoring_rule: `required_terms`
- difficulty: `medium`

### UJ-011 / dimension extraction / removal length

- source_id: `S07`
- document_name: 北小倉小学校関連 給配水管移設工事 図面
- page_or_sheet: P1 / 配管詳細図
- evidence_anchor: line 289
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: 既設VLP管φ50撤去の延長は何mか。
- expected_answer_ja: L=4.0m。
- acceptable_aliases_or_normalization: 4.0m/4m。
- scoring_rule: `numeric_exact_m`
- difficulty: `medium`

### UJ-012 / material extraction / component size

- source_id: `S07`
- document_name: 北小倉小学校関連 給配水管移設工事 図面
- page_or_sheet: P1 / 配管詳細図
- evidence_anchor: line 306
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: サドル分水栓(DIP用)のサイズは何か。
- expected_answer_ja: φ75×φ50。
- acceptable_aliases_or_normalization: 75×50。
- scoring_rule: `numeric_pair_exact`
- difficulty: `medium`

### UJ-013 / cross-section navigation / section labels

- source_id: `S07`
- document_name: 北小倉小学校関連 給配水管移設工事 図面
- page_or_sheet: P1 / 横断面図
- evidence_anchor: lines 324-333
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: 横断面図にはどのNo.の断面が示されているか。
- expected_answer_ja: No.1、No.3、No.5、No.7。
- acceptable_aliases_or_normalization: 1,3,5,7の集合。
- scoring_rule: `set_exact`
- difficulty: `medium`

### UJ-014 / titleblock/OCR / scale extraction

- source_id: `S07`
- document_name: 北小倉小学校関連 給配水管移設工事 図面
- page_or_sheet: P1 / 横断面図
- evidence_anchor: line 332
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: 横断面図の縮尺は何か。
- expected_answer_ja: 1/100。
- acceptable_aliases_or_normalization: S=1/100も可。
- scoring_rule: `exact_normalized`
- difficulty: `easy`

### UK-001 / titleblock/OCR / project name

- source_id: `S08`
- document_name: 笠取小学校体育館空調設置ほか改修工事 図面
- page_or_sheet: P44-P45 / A-34
- evidence_anchor: lines 9833-9843
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: 笠取小学校の図面に記載された工事名は何か。
- expected_answer_ja: 笠取小学校体育館空調設置ほか改修工事。
- acceptable_aliases_or_normalization: 笠取小学校体育館空調設置ほか改修工事。
- scoring_rule: `exact_normalized`
- difficulty: `easy`

### UK-002 / titleblock/OCR / drawing title

- source_id: `S08`
- document_name: 笠取小学校体育館空調設置ほか改修工事 図面
- page_or_sheet: P44 / A-34
- evidence_anchor: lines 9839-9843
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: A-34の図名は何か。
- expected_answer_ja: 仮設計画 2階平面図（外部・内部）（参考図）。
- acceptable_aliases_or_normalization: 仮設計画/2階平面図/外部・内部/参考図を含む。
- scoring_rule: `required_terms`
- difficulty: `easy`

### UK-003 / titleblock/OCR / sheet number

- source_id: `S08`
- document_name: 笠取小学校体育館空調設置ほか改修工事 図面
- page_or_sheet: P44 / A-34
- evidence_anchor: line 9843
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: 仮設計画2階平面図（外部・内部）の図面番号は何か。
- expected_answer_ja: A-34。
- acceptable_aliases_or_normalization: Ａ－３４等を正規化。
- scoring_rule: `exact_normalized`
- difficulty: `easy`

### UK-004 / safety note extraction / temporary work note

- source_id: `S08`
- document_name: 笠取小学校体育館空調設置ほか改修工事 図面
- page_or_sheet: P44 / A-34
- evidence_anchor: lines 9835-9838
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: 外部足場について、凡例ではどのように記載されているか。
- expected_answer_ja: 枠組足場W1200、外部足場、養生シート張り共（防炎Ⅰ類）を示す。
- acceptable_aliases_or_normalization: W1200/外部足場/養生シート/防炎I類を含む。
- scoring_rule: `required_terms`
- difficulty: `medium`

### UK-005 / safety note extraction / temporary work note

- source_id: `S08`
- document_name: 笠取小学校体育館空調設置ほか改修工事 図面
- page_or_sheet: P44 / A-34
- evidence_anchor: lines 9839-9842
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: 内部仕上足場はどの足場として示されているか。
- expected_answer_ja: 枠組棚足場。
- acceptable_aliases_or_normalization: 枠組棚足場。
- scoring_rule: `exact_or_alias`
- difficulty: `easy`

### UK-006 / safety note extraction / safety requirement

- source_id: `S08`
- document_name: 笠取小学校体育館空調設置ほか改修工事 図面
- page_or_sheet: P44 / A-34
- evidence_anchor: lines 9835-9836
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: 昇降階段の最下部にはどのような措置が必要と記載されているか。
- expected_answer_ja: 開閉式のフェンスバリケード等を設置し、施錠可能な仕様とする。
- acceptable_aliases_or_normalization: 開閉式フェンスバリケード/施錠可能の2点。
- scoring_rule: `required_terms`
- difficulty: `medium`

### UK-007 / safety note extraction / fall prevention

- source_id: `S08`
- document_name: 笠取小学校体育館空調設置ほか改修工事 図面
- page_or_sheet: P44 / A-34
- evidence_anchor: line 9837
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: 転落防止措置として何が記載されているか。
- expected_answer_ja: 手すり設置。
- acceptable_aliases_or_normalization: 手すり/手摺設置。
- scoring_rule: `exact_or_alias`
- difficulty: `easy`

### UK-008 / titleblock/OCR / scale extraction

- source_id: `S08`
- document_name: 笠取小学校体育館空調設置ほか改修工事 図面
- page_or_sheet: P45 / A-34
- evidence_anchor: line 9864
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: A-34の縮尺は何か。
- expected_answer_ja: 1/100。
- acceptable_aliases_or_normalization: S=1/100も可。
- scoring_rule: `exact_normalized`
- difficulty: `easy`

### NEG-001 / abstention / unanswerable

- source_id: `S02`
- document_name: 建築工事標準詳細図 平成28年版：床仕上げ（1-01, 1-02）
- page_or_sheet: P1 / sheet 1-01
- evidence_anchor: screenshot page 1
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: 図面1-01から工事期間を答えよ。
- expected_answer_ja: 図面1-01には工事期間の記載がないため回答できない。
- acceptable_aliases_or_normalization: 記載なし/不明/回答不能。
- scoring_rule: `abstain_correct`
- difficulty: `medium`
- notes: ハルシネーション抑制用。

### NEG-002 / abstention / unanswerable

- source_id: `S03`
- document_name: 建築工事標準詳細図 平成28年版：断熱・階段（7-01, 7-11）
- page_or_sheet: P2 / sheet 7-11
- evidence_anchor: screenshot page 2
- modality_scope: drawing image+OCR
- retrieval_setting: single-page
- question_ja: 図面7-11から建物全体の延床面積を答えよ。
- expected_answer_ja: 図面7-11は階段の平面・断面詳細であり、建物全体の延床面積は記載されていないため回答できない。
- acceptable_aliases_or_normalization: 記載なし/この図面からは不明。
- scoring_rule: `abstain_correct`
- difficulty: `medium`
- notes: ハルシネーション抑制用。

### NEG-003 / abstention / scope limitation

- source_id: `S07`
- document_name: 北小倉小学校関連 給配水管移設工事 図面
- page_or_sheet: P1 / 配管詳細図
- evidence_anchor: lines 217-227
- modality_scope: drawing text+OCR
- retrieval_setting: single-page
- question_ja: 配管詳細図だけを根拠に、施工費の総額を答えよ。
- expected_answer_ja: 配管詳細図には施工費総額が記載されていないため回答できない。
- acceptable_aliases_or_normalization: 費用記載なし/内訳書が必要。
- scoring_rule: `abstain_correct`
- difficulty: `medium`
- notes: コスト推定の過剰回答を抑制。

### CRS-001 / precedence/compliance / cross-source precedence

- source_id: `S01`
- document_name: 建築工事標準詳細図（令和4年改定）概要・表示記号及び略号
- page_or_sheet: P1
- evidence_anchor: lines 35-39
- modality_scope: text+layout
- retrieval_setting: multi-source
- question_ja: 案件図面の寸法と標準詳細図の括弧内寸法が異なる場合、QARAGはどちらを優先して回答すべきか。
- expected_answer_ja: 案件図面に特記・寸法がある場合は図面を優先する。標準詳細図は図面を補完する位置づけ。
- acceptable_aliases_or_normalization: 図面優先/標準詳細図は補完の2点。
- scoring_rule: `required_terms`
- difficulty: `hard`
- notes: 社内RAGで重要な優先規則。
