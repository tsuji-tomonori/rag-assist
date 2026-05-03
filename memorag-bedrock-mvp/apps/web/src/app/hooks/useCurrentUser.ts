import { useEffect, useState } from "react"
import { getMe, type CurrentUser } from "../../api.js"
import type { AuthSession } from "../../authClient.js"

export function useCurrentUser(authSession: AuthSession | null) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [currentUserError, setCurrentUserError] = useState<string | null>(null)

  useEffect(() => {
    if (!authSession) {
      setCurrentUser(null)
      return
    }
    let active = true
    setCurrentUser(null)
    setCurrentUserError(null)
    getMe()
      .then((user) => {
        if (active) setCurrentUser(user)
      })
      .catch((err) => {
        console.warn("Failed to load current user", err)
        if (active) {
          setCurrentUser(null)
          setCurrentUserError(err instanceof Error ? err.message : String(err))
        }
      })
    return () => {
      active = false
    }
  }, [authSession])

  return { currentUser, currentUserError, setCurrentUser }
}
