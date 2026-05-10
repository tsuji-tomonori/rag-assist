import type { AppUser } from "./auth.js"

export type AppEnv = {
  Variables: {
    user: AppUser
  }
}
