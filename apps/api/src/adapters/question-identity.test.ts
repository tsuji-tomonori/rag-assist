import assert from "node:assert/strict"
import test from "node:test"
import { questionIdForCreate } from "./question-identity.js"

test("questionIdentity_isStablePerRequesterAndMessage", () => {
  const first = questionIdForCreate({ title: "A", question: "A", requesterUserId: "user-1", messageId: "message-1" })
  const repeated = questionIdForCreate({ title: "changed", question: "changed", requesterUserId: "user-1", messageId: "message-1" })
  const otherRequester = questionIdForCreate({ title: "A", question: "A", requesterUserId: "user-2", messageId: "message-1" })
  const otherMessage = questionIdForCreate({ title: "A", question: "A", requesterUserId: "user-1", messageId: "message-2" })

  assert.equal(first, repeated)
  assert.notEqual(first, otherRequester)
  assert.notEqual(first, otherMessage)
})
