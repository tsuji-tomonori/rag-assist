# RAG component layout

This directory separates RAG implementation by runtime first and pipeline stage second.

- `offline/`: document-side processing that can run before a user query, including ingestion, extraction, chunking, embedding, index versioning, and offline prompt assets.
- `online/`: request-time processing for retrieval, rerank, context packing, answerability, generation, citation, and verification.
- `_shared/`: policies, storage helpers, and utilities shared across offline and online runtimes.
- `orchestration/`: chat-oriented RAG orchestration.

The existing RAG implementation has been moved into this layout for the primary production path:

- extraction: `offline/pre-retrieval/extraction/text-extractor.ts`
- chunking: `offline/pre-retrieval/chunking/chunker.service.ts`
- ingestion run: `offline/pre-retrieval/ingestion/ingest-run.service.ts`
- embedding cache: `offline/pre-retrieval/embedding/embedding-cache.ts`
- manifest chunk loading: `_shared/storage/manifest-chunks.ts`
- quality policy: `_shared/policies/quality-policy.ts`
- answer policy: `_shared/policies/answer-policy.ts`
- JSON utilities: `_shared/json.ts`
- pipeline versions: `offline/pre-retrieval/indexing/index-version-store.ts`
- hybrid retrieval: `online/retrieval/hybrid/hybrid-retriever.ts`
- context packing: `online/post-retrieval/context-packing/context-packer.ts`
- prompt building: `online/generation/prompt/grounded-prompt-builder.ts`
- memory card prompt: `offline/generation/prompt-assets/memory-card-prompt.ts`
- chat RAG orchestration: `orchestration/chat-rag-orchestrator.ts`
- request-time retrieval and post-retrieval/generation nodes under `online/**`

The old flat files remain only as compatibility re-export shims. New production code should import the runtime or pipeline module directly from this layout.
