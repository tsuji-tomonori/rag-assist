import assert from "node:assert/strict"
import test from "node:test"
import { InvalidPageCursorError, decodePageCursor, encodePageCursor, pageByStableCursor } from "./keyset-pagination.js"

type Item = { id: string; updatedAt: string }

const items: Item[] = [
  { id: "c", updatedAt: "2026-05-03T00:00:00.000Z" },
  { id: "b", updatedAt: "2026-05-02T00:00:00.000Z" },
  { id: "a", updatedAt: "2026-05-02T00:00:00.000Z" },
  { id: "z", updatedAt: "2026-05-01T00:00:00.000Z" }
]

function page(cursor?: string) {
  return pageByStableCursor({
    items,
    limit: 2,
    cursor,
    sort: "updatedDesc",
    cursorValues: (item) => [item.updatedAt, item.id],
    isAfter: (item, [updatedAt, id]) => item.updatedAt < updatedAt! || item.updatedAt === updatedAt && item.id < id!
  })
}

test("stable cursor keeps duplicate sort values without skipping or duplicating records", () => {
  const first = page()
  assert.deepEqual(first.items.map((item) => item.id), ["c", "b"])
  assert.equal(first.total, 4)
  assert.equal(first.truncated, true)
  assert.ok(first.nextCursor)

  const second = page(first.nextCursor)
  assert.deepEqual(second.items.map((item) => item.id), ["a", "z"])
  assert.equal(second.truncated, false)
  assert.equal(second.nextCursor, undefined)
})

test("cursor is opaque, sort-bound, and rejects malformed or stale values", () => {
  const cursor = encodePageCursor("termAsc", ["pto", "alias-1"])
  assert.deepEqual(decodePageCursor(cursor, "termAsc").values, ["pto", "alias-1"])
  assert.throws(() => decodePageCursor(cursor, "updatedDesc"), InvalidPageCursorError)
  assert.throws(() => decodePageCursor("not-a-cursor", "termAsc"), InvalidPageCursorError)
})
