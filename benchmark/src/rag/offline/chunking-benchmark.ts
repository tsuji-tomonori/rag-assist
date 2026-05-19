export type RagBenchmarkDescriptor = {
  id: string
  status: "planned"
}

export const ragBenchmarkDescriptor = {
  id: "offline/chunking-benchmark",
  status: "planned"
} satisfies RagBenchmarkDescriptor
