export type RagBenchmarkDescriptor = {
  id: string
  status: "planned"
}

export const ragBenchmarkDescriptor = {
  id: "fixtures/golden-dataset",
  status: "planned"
} satisfies RagBenchmarkDescriptor
