import type { AppAuthSession, AppUser } from "./auth.js"

export type AppEnv = {
  Variables: {
    authSession: AppAuthSession
    user: AppUser
  }
}
