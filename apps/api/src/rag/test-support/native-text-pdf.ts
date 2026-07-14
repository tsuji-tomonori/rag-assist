/** Build a small, standards-compliant native-text PDF without test-only parser seams. */
export function buildNativeTextPdf(pageLines: ReadonlyArray<ReadonlyArray<string>>): Buffer {
  if (pageLines.length === 0) throw new Error("At least one PDF page is required")
  const objects = new Map<number, string>()
  const pageObjectIds = pageLines.map((_, index) => 4 + index * 2)
  const contentObjectIds = pageLines.map((_, index) => 5 + index * 2)
  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>")
  objects.set(2, `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageLines.length} >>`)
  objects.set(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
  for (const [index, lines] of pageLines.entries()) {
    const pageObjectId = pageObjectIds[index]!
    const contentObjectId = contentObjectIds[index]!
    objects.set(
      pageObjectId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    )
    const escapedLines = lines.map((line) => line.replace(/([\\()])/g, "\\$1"))
    const commands = escapedLines.length === 0
      ? ""
      : [
          "BT",
          "/F1 12 Tf",
          "72 720 Td",
          ...escapedLines.flatMap((line, lineIndex) => [
            ...(lineIndex === 0 ? [] : ["0 -24 Td"]),
            `(${line}) Tj`
          ]),
          "ET"
        ].join("\n")
    objects.set(contentObjectId, `<< /Length ${Buffer.byteLength(commands, "latin1")} >>\nstream\n${commands}\nendstream`)
  }

  const maximumObjectId = Math.max(...objects.keys())
  let pdf = "%PDF-1.4\n% native text test fixture\n"
  const offsets: number[] = Array.from({ length: maximumObjectId + 1 }, () => 0)
  for (let objectId = 1; objectId <= maximumObjectId; objectId += 1) {
    offsets[objectId] = Buffer.byteLength(pdf, "latin1")
    pdf += `${objectId} 0 obj\n${objects.get(objectId)}\nendobj\n`
  }
  const xrefOffset = Buffer.byteLength(pdf, "latin1")
  pdf += `xref\n0 ${maximumObjectId + 1}\n0000000000 65535 f \n`
  for (let objectId = 1; objectId <= maximumObjectId; objectId += 1) {
    pdf += `${String(offsets[objectId]).padStart(10, "0")} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${maximumObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  // pdf-parse's legacy pdfjs build reads the entire backing ArrayBuffer. Keep
  // this fixture unpooled so unrelated slab bytes cannot be interpreted as PDF.
  const result = Buffer.allocUnsafeSlow(Buffer.byteLength(pdf, "latin1"))
  result.write(pdf, "latin1")
  return result
}
