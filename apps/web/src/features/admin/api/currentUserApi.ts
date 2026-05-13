import { get } from "../../../shared/api/http.js"
import type { CurrentUser } from "../../../shared/types/common.js"

export async function getMe(): Promise<CurrentUser> {
  const result = await get<{ user: CurrentUser }>("/me")
  return result.user
}
