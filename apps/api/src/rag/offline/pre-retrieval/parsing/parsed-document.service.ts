export type RagComponentDescriptor = {
  id: string
  runtime: "offline" | "online" | "shared"
  stage: string
  area: string
  status: "planned"
}

export const ragComponentDescriptor = {
  id: "offline/pre-retrieval/parsing/parsed-document.service",
  runtime: "offline",
  stage: "pre-retrieval",
  area: "parsing",
  status: "planned"
} satisfies RagComponentDescriptor
