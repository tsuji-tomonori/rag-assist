# RAG component layout

This directory separates RAG implementation by runtime first and pipeline stage second.

- `offline/`: document-side processing that can run before a user query, including ingestion, preprocessing, extraction, parsing, normalization, chunking, metadata/ACL snapshots, embedding, index assets, corpus compression, quality gates, prompt assets, and synthetic data generation.
- `online/`: request-time processing for query scope, rewrite, expansion, decomposition, retrieval, rerank, evidence filtering, context packing, answerability, generation, citation, verification, repair, and refusal.
- `_shared/`: types, policies, guards, tracing, and errors shared across offline and online runtimes.
- `orchestration/`: pipeline runners and chat-oriented orchestration.
- `api/`: route modules for RAG, ingestion, and search testing.

The existing RAG implementation has been moved into this layout for the primary production path:

- extraction: `offline/pre-retrieval/extraction/text-extractor.ts`
- chunking: `offline/pre-retrieval/chunking/chunker.service.ts`
- embedding cache: `offline/pre-retrieval/embedding/embedding-cache.ts`
- manifest chunk loading: `_shared/storage/manifest-chunks.ts`
- quality policy: `_shared/policies/quality-policy.ts`
- pipeline versions: `offline/pre-retrieval/indexing/index-version-store.ts`
- hybrid retrieval: `online/retrieval/hybrid/hybrid-retriever.ts`
- chat RAG orchestration: `orchestration/chat-rag-orchestrator.ts`
- request-time retrieval and post-retrieval/generation nodes under `online/**`

The old flat files remain only as compatibility re-export shims. New production code should import the runtime or pipeline module directly from this layout.
