# RAG component layout

This directory separates RAG implementation by runtime first and pipeline stage second.

- `offline/`: document-side processing that can run before a user query, including ingestion, preprocessing, extraction, parsing, normalization, chunking, metadata/ACL snapshots, embedding, index assets, corpus compression, quality gates, prompt assets, and synthetic data generation.
- `online/`: request-time processing for query scope, rewrite, expansion, decomposition, retrieval, rerank, evidence filtering, context packing, answerability, generation, citation, verification, repair, and refusal.
- `_shared/`: types, policies, guards, tracing, and errors shared across offline and online runtimes.
- `orchestration/`: pipeline runners and chat-oriented orchestration.
- `api/`: route modules for RAG, ingestion, and search testing.

The existing flat files in `apps/api/src/rag/` remain in place for the current implementation. New code should prefer this layout when adding or moving RAG responsibilities. Placeholder modules in this tree intentionally expose only descriptors until their production behavior is implemented and wired.
