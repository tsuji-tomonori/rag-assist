# ドキュメント構成方針（MemoRAG MVP）

## 目的

`memorag-bedrock-mvp/docs` を、skills の SWEBOK-lite フォーマットに準拠した構成へ段階移行する。

## 推奨ディレクトリ構成

```text
memorag-bedrock-mvp/docs/
  1_要求_REQ/
    11_製品要求_PRODUCT/
      REQ_PRODUCT_001.md
      01_機能要求_FUNCTIONAL/
        REQ_FUNCTIONAL_001.md
      11_非機能要求_NON_FUNCTIONAL/
        REQ_NON_FUNCTIONAL_001.md
        01_技術制約_TECHNICAL_CONSTRAINT/
          REQ_TECHNICAL_CONSTRAINT_001.md
        11_サービス品質制約_SERVICE_QUALITY/
          REQ_SERVICE_QUALITY_001.md
    21_受入基準_ACCEPTANCE/
      REQ_ACCEPTANCE_001.md
  2_アーキテクチャ_ARC/
    01_コンテキスト_CONTEXT/
      ARC_CONTEXT_001.md
    11_ビュー_VIEW/
      ARC_VIEW_001.md
    21_重要決定_ADR/
      ARC_ADR_001.md
  3_設計_DES/
    01_高レベル設計_HLD/
      DES_HLD_001.md
    11_詳細設計_DLD/
      DES_DLD_001.md
    41_API_API/
      DES_API_001.md
  4_運用_OPS/
    11_リリース_RELEASE/
      OPS_RELEASE_001.md
    21_監視_MONITORING/
      OPS_MONITORING_001.md
```

## 要件の原子性ルール

- 1 行 1 要件（1 文で 1 検証可能条件）
- 要件 ID を付与（例: `FR-001`, `NFR-001`, `AC-001`）
- AND / OR の複合条件は分割する
- 実装手段と要求レベルは分離する

## 移行方針

- 現在の `REQUIREMENTS.md` / `ARCHITECTURE.md` は暫定的に維持
- 新規追加・更新時は上記ディレクトリへ分割して記述
- 既存ファイルは更新機会に合わせて段階移管する

## 運用ルール（今後）

- ドキュメント更新時は必ず対象カテゴリ（REQ/ARC/DES/OPS）を選ぶ
- ドキュメント内冒頭メタ情報（ファイル、種別、作成日、状態）を維持する
- 変更時に原子性チェック（複文分解）を実施する
