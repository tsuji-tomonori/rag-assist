import assert from "node:assert/strict"
import { test } from "node:test"
import {
  extractDrawingValues,
  normalizeDiameter,
  normalizeDimension,
  normalizeExpectedDrawingValue,
  normalizeLength,
  normalizeRange,
  normalizeScale,
  normalizedDrawingValuesMatch
} from "./drawing-normalization.js"

test("normalizes drawing scale variants", () => {
  assert.equal(normalizeScale("縮尺 S=1/100")?.canonical, "scale:1/100")
  assert.equal(normalizeScale("A1:1/200")?.canonical, "scale:1/200")
  assert.equal(normalizeScale("１：５０")?.canonical, "scale:1/50")
})

test("normalizes dimensions to millimeters", () => {
  assert.equal(normalizeDimension("10000mm")?.canonical, "dimension:mm:10000")
  assert.equal(normalizeDimension("10.0 m")?.canonical, "dimension:mm:10000")
  assert.equal(normalizeDimension("12.5cm")?.canonical, "dimension:mm:125")
})

test("normalizes pipe diameters with notation class", () => {
  assert.equal(normalizeDiameter("VPφ75")?.canonical, "diameter:phi:75")
  assert.equal(normalizeDiameter("D=75")?.canonical, "diameter:d:75")
  assert.equal(normalizeDiameter("75A")?.canonical, "diameter:a:75")
})

test("normalizes drawing lengths to meters", () => {
  assert.equal(normalizeLength("L=12.5m")?.canonical, "length:m:12.5")
  assert.equal(normalizeLength("延長 12500mm")?.canonical, "length:m:12.5")
})

test("normalizes range operators to millimeters", () => {
  assert.equal(normalizeRange("1000mm以上")?.canonical, "range:>=:mm:1000")
  assert.equal(normalizeRange("1.2m以下")?.canonical, "range:<=:mm:1200")
  assert.equal(normalizeRange("75未満")?.canonical, "range:<:mm:75")
  assert.equal(normalizeRange(">= 10cm")?.canonical, "range:>=:mm:100")
})

test("extracts multiple drawing values and compares expected values", () => {
  const values = extractDrawingValues("縮尺1/100、VPφ75、L=12.5m")
  assert.deepEqual(values.map((value) => value.canonical), ["scale:1/100", "length:m:12.5", "diameter:phi:75"])
  assert.equal(normalizeExpectedDrawingValue({ kind: "diameter", raw: "φ75" }), "diameter:phi:75")
  assert.equal(normalizedDrawingValuesMatch(["S=1/100", "L=12.5m"], "縮尺は1:100、延長は12500mmです。"), true)
  assert.equal(normalizedDrawingValuesMatch(["L=12.5m"], "延長は10mです。"), false)
})
