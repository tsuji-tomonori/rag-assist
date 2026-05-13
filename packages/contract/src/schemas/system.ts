import { z } from "zod"

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  timestamp: z.string()
})

export type HealthResponse = z.output<typeof HealthResponseSchema>
