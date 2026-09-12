import { pathToFileURL } from 'node:url'

// USD planning inputs. Reference examples use US East; these are NOT verified Tokyo quotes.
export const rates = Object.freeze({
  novaInputMillion: 0.06, novaOutputMillion: 0.24, embeddingMillion: 0.02,
  lambdaGbSecond: 0.0000166667, lambdaMillionRequests: 0.2, restMillionRequests: 3.5,
  s3GbMonth: 0.023, s3ThousandWrites: 0.005, s3ThousandReads: 0.0004,
  vectorGbMonth: 0.06, vectorUploadGb: 0.2, vectorMillionQueries: 2.5, vectorQueryTb: 0.004,
  dynamoMillionWrites: 0.625, dynamoMillionReads: 0.125, dynamoGbMonth: 0.25, dynamoPitrGbMonth: 0.2,
  logIngestionGb: 0.5, logStorageGb: 0.03, alarmMonth: 0.1, customMetricMonth: 0.3,
  cloudfrontGb: 0.085, cloudfrontTenThousandHttps: 0.01, cloudfrontMillionFunctions: 0.1,
  cognitoEssentialsMau: 0.015, stateThousandTransitions: 0.025, textractPage: 0.0015,
  codebuildMinute: 0.005, hostedZoneMonth: 0.5, webSocketMillionMessages: 1, webSocketMillionMinutes: 0.25
})
export const scenarios = Object.freeze([
  { name: 'idle', questions: 0, mau: 0, s3Gb: 10, dynamoGb: 1, vectors: 10000, pages: 0, ingestJobs: 0, logGb: 0, deliveryGb: 0, webRequests: 0, benchmarkMinutes: 0 },
  { name: 'small', questions: 1000, mau: 20, s3Gb: 10, dynamoGb: 1, vectors: 10000, pages: 100, ingestJobs: 10, logGb: 1, deliveryGb: 5, webRequests: 20000, benchmarkMinutes: 0 },
  { name: 'medium', questions: 10000, mau: 100, s3Gb: 100, dynamoGb: 10, vectors: 100000, pages: 1000, ingestJobs: 100, logGb: 10, deliveryGb: 50, webRequests: 200000, benchmarkMinutes: 0 }
])

export function estimate(workload, price = rates, usdJpy = 150) {
  for (const [key, value] of Object.entries(workload)) {
    if (key !== 'name' && (!Number.isFinite(value) || value < 0)) throw new Error(`Invalid workload: ${key}`)
  }
  for (const key of Object.keys(scenarios[0])) {
    if (key !== 'name' && (!Number.isFinite(workload[key]) || workload[key] < 0)) throw new Error(`Missing or invalid workload: ${key}`)
  }
  for (const key of Object.keys(rates)) {
    if (!Number.isFinite(price[key]) || price[key] < 0) throw new Error(`Missing or invalid rate: ${key}`)
  }
  if (workload.vectors > 100000) throw new Error('This estimate requires at most 100000 vectors; model additional query tiers explicitly')
  if (!Number.isFinite(usdJpy) || usdJpy <= 0) throw new Error('Invalid exchange assumption')
  const q = workload.questions
  const vectorGb = workload.vectors * 6.17 * 1024 / 2 ** 30
  const processedTb = Math.min(workload.vectors, 100000) * 5.17 * 1024 / 2 ** 40
  // All calls/retries per answer aggregated: 20k input + 3k output tokens, 45.6 GB-s.
  const llm = q * (20000 * price.novaInputMillion + 3000 * price.novaOutputMillion) / 1e6
  const ingestLlm = workload.pages * (2000 * price.novaInputMillion + 300 * price.novaOutputMillion) / 1e6
  const embedding = (q * 300 + workload.pages * 2000) * price.embeddingMillion / 1e6
  const lineItems = {
    model: llm + ingestLlm + embedding,
    compute: (q * 45.6 + workload.ingestJobs * 60 * 2.9375) * price.lambdaGbSecond + (q * 8 + workload.ingestJobs * 3) / 1e6 * price.lambdaMillionRequests,
    api: (q * 6 + workload.ingestJobs * 3) / 1e6 * price.restMillionRequests,
    storage: workload.s3Gb * price.s3GbMonth + workload.dynamoGb * (price.dynamoGbMonth + price.dynamoPitrGbMonth) + vectorGb * price.vectorGbMonth,
    storageRequests: q * (30 / 1000 * price.s3ThousandWrites + 100 / 1000 * price.s3ThousandReads + 400 / 1e6 * price.dynamoMillionWrites + 200 / 1e6 * price.dynamoMillionReads),
    vectors: q * 4 * (price.vectorMillionQueries / 1e6 + processedTb * price.vectorQueryTb) + vectorGb * (workload.pages > 0 ? 0.1 : 0) * price.vectorUploadGb,
    monitoring: 4 * price.alarmMonth + (q > 0 ? 10 : 0) * price.customMetricMonth + workload.logGb * (price.logIngestionGb + price.logStorageGb),
    delivery: workload.deliveryGb * price.cloudfrontGb + workload.webRequests / 10000 * price.cloudfrontTenThousandHttps + (workload.webRequests + q * 6) / 1e6 * price.cloudfrontMillionFunctions,
    identity: workload.mau * price.cognitoEssentialsMau,
    orchestration: (q * 8 + workload.ingestJobs * 8) / 1000 * price.stateThousandTransitions,
    ocr: workload.pages * price.textractPage,
    dns: price.hostedZoneMonth,
    benchmarkCompute: workload.benchmarkMinutes * price.codebuildMinute,
    websocket: q * 20 / 1e6 * price.webSocketMillionMessages + workload.mau * 22 * 480 / 1e6 * price.webSocketMillionMinutes
  }
  const referenceUsd = Object.values(lineItems).reduce((sum, n) => sum + n, 0)
  return { workload, lineItems, referenceUsd, planningReserveUsd: referenceUsd * 1.5, planningReserveJpy: referenceUsd * 1.5 * usdJpy, usdJpy, priceStatus: 'reference rates; Tokyo quote verification pending; 50% planning reserve is not a cap', freeTierDeducted: false }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify({ assumptions: { inputTokensPerAnswer: 20000, outputTokensPerAnswer: 3000, usdJpy: 150, taxIncluded: false, rateCheckedDate: '2026-09-05', notes: 'No production usage measured. No free-tier/credits deducted. Benchmark model calls, external agents, support, domain registration, WAF, replication and retention growth are additional.' }, estimates: scenarios.map((scenario) => estimate(scenario)) }, null, 2))
}
