import type { SeededDocument } from "./corpus.js"

export type DatasetFileReferenceRow = {
  id?: string
  question?: string
  expectedFiles?: string[]
  expectedFileNames?: string[]
  followUp?: {
    expectedFiles?: string[]
    expectedFileNames?: string[]
  }
  expectedFactSlots?: Array<{
    expectedFiles?: string[]
  }>
}

export type SkippedDatasetRow = {
  id?: string
  question: string
  fileNames: string[]
  reason: "required_corpus_skipped"
}

export function skippedCorpusFileNameSet(corpusSeed: SeededDocument[]): Set<string> {
  return new Set(corpusSeed
    .filter((seed) => seed.status === "skipped_unextractable")
    .map((seed) => seed.fileName))
}

export function skippedExpectedFileNames(row: DatasetFileReferenceRow, skippedFileNames: Set<string>): string[] {
  if (skippedFileNames.size === 0) return []
  return uniqueStrings([
    ...(row.expectedFiles ?? []),
    ...(row.expectedFileNames ?? []),
    ...(row.followUp?.expectedFiles ?? []),
    ...(row.followUp?.expectedFileNames ?? []),
    ...(row.expectedFactSlots ?? []).flatMap((slot) => slot.expectedFiles ?? [])
  ]).filter((fileName) => skippedFileNames.has(fileName))
}

export function createSkippedDatasetRow(row: DatasetFileReferenceRow, fileNames: string[]): SkippedDatasetRow {
  return {
    id: row.id,
    question: row.question ?? "",
    fileNames,
    reason: "required_corpus_skipped"
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()).map((value) => value.trim()))]
}
