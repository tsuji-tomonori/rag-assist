export type RagBenchmarkDescriptor = {
  id: string
  status: "planned"
}

export const ragBenchmarkDescriptor = {
  id: "online/generation-benchmark",
  status: "planned"
} satisfies RagBenchmarkDescriptor
