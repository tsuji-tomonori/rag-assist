import assert from 'node:assert/strict'
import test from 'node:test'
import { estimate, rates, scenarios } from './estimate.mjs'

test('idle retains storage, PITR, alarms and DNS without model or request charges', () => {
  const { lineItems, referenceUsd, planningReserveUsd } = estimate(scenarios[0])
  assert.equal(lineItems.model, 0)
  assert.equal(lineItems.compute, 0)
  assert.equal(lineItems.storageRequests, 0)
  assert.ok(lineItems.storage > 0)
  assert.equal(lineItems.monitoring, 0.4)
  assert.equal(lineItems.dns, 0.5)
  assert.equal(planningReserveUsd, referenceUsd * 1.5)
})

test('aggregate model tokens scale per question and currency does not change USD totals', () => {
  const baseline = estimate(scenarios[0])
  const one = estimate({ ...scenarios[0], questions: 1 })
  const ten = estimate({ ...scenarios[0], questions: 10 }, rates, 200)
  assert.equal(ten.lineItems.model, 10 * one.lineItems.model)
  assert.equal(one.lineItems.model, (20000 * rates.novaInputMillion + 3000 * rates.novaOutputMillion + 300 * rates.embeddingMillion) / 1e6)
  assert.equal(estimate(scenarios[0], rates, 200).referenceUsd, baseline.referenceUsd)
  assert.equal(ten.planningReserveJpy, ten.planningReserveUsd * 200)
})

test('incomplete, invalid and out-of-range inputs cannot silently underquote', () => {
  assert.throws(() => estimate({}), /workload/)
  assert.throws(() => estimate({ ...scenarios[0], questions: -1 }), /workload/)
  assert.throws(() => estimate({ ...scenarios[0], vectors: 100001 }), /query tiers/)
  assert.throws(() => estimate(scenarios[0], {}), /rate/)
  assert.throws(() => estimate(scenarios[0], rates, 0), /exchange/)
})
