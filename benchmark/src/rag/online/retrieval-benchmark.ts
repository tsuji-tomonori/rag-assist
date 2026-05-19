export type RagBenchmarkDescriptor = {
  id: string
  status: "planned"
}

export const ragBenchmarkDescriptor = {
  id: "online/retrieval-benchmark",
  status: "planned"
} satisfies RagBenchmarkDescriptor
