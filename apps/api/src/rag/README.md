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
- source admission: `offline/pre-retrieval/admission/source-admission.ts`
- source governance approval: `offline/pre-retrieval/admission/source-governance-approval-service.ts`
- embedding cache: `offline/pre-retrieval/embedding/embedding-cache.ts`
- manifest chunk loading: `_shared/storage/manifest-chunks.ts`
- quality policy: `_shared/policies/quality-policy.ts`
- derived-record envelope and reconciliation: `_shared/security/derived-record-security.ts`
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

## Ingest publication invariants

Production ingest accepts tenant, owner, authorization, classification, usage, quality, lifecycle, provenance, and inspection state only through the server-internal admission context. Request metadata with those protected keys is removed and recorded in the admission audit record. Missing, malformed, failed, or unknown authority is fail-closed: the source manifest is retained as `staging`, but no memory or evidence vector is published.

Regular group uploads intentionally start `unreviewed`. A reviewer with current `rag:source:approve` and full resource permission must submit an expected-version approval containing explicit classification, usage, quality, and inspection profiles. The service persists an audit intent and CAS-protected governance transition before re-ingesting into the fenced staging namespace; only a validated `approved` candidate can commit the active publication pointer.

Every publishable document, chunk, memory card, and vector carries a hashed security envelope with the document version, tenant, versioned policy references, and a stable source locator. Vector writes occur only after the manifest projection, record counts, identities, and envelope hashes reconcile.

Extraction over the configured character ceiling is recorded as `partial` with an explicit `extraction_content_truncated` error and cannot be published. Production chunking uses the persisted `structure_aware` policy snapshot, deterministic content-and-locator IDs, explicit character/token budgets, and violation-driven quarantine. Legacy fixture behavior is available only when tests inject `localTestIngestAdmissionContext`; `createDependencies()` never enables it.
