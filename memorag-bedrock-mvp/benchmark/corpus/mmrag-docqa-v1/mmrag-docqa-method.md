# MMRAG-DocQA Benchmark Brief

MMRAG-DocQA is treated in this suite as a Document Question-Answering benchmark target focused on hierarchical index behavior and multi-granularity retrieval behavior.

The benchmark checks whether the agent can retrieve and cite evidence that distinguishes a hierarchical index from flat retrieval. The expected retrieval evidence should include both section-level context and chunk-level context.

The intended production benchmark must be replaced with the actual paper corpus, multimodal assets, and ground-truth answers before results are used as evidence of method quality. The current sample corpus is a UI and runner smoke fixture for the suite named `mmrag-docqa-v1`.

## Evaluation Targets

- Target task: Document Question-Answering.
- Indexing focus: hierarchical index.
- Retrieval focus: multi-granularity retrieval.
- Coarse retrieval granularity: section-level context.
- Fine retrieval granularity: chunk-level context.
- Required production inputs: paper corpus, multimodal assets, ground-truth answers, and expected citations.
