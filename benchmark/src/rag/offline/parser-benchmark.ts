export type RagBenchmarkDescriptor = {
  id: string
  status: "planned"
}

export const ragBenchmarkDescriptor = {
  id: "offline/parser-benchmark",
  status: "planned"
} satisfies RagBenchmarkDescriptor
