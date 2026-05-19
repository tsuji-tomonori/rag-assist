export type RagBenchmarkDescriptor = {
  id: string
  status: "planned"
}

export const ragBenchmarkDescriptor = {
  id: "online/e2e-rag-benchmark",
  status: "planned"
} satisfies RagBenchmarkDescriptor
