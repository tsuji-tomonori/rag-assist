export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "api/search-test.routes",
  runtime: "shared",
  stage: "api",
  area: "api",
  status: "planned"
} satisfies RagComponentDescriptor
