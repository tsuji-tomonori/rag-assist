import assert from "node:assert/strict"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"

test("serializes Cognito auth parameters as JSON so password punctuation is preserved", async () => {
  const password = "H1(JvI<}@E|Pp:k/&kgxl6(bN&hF:/?g"
  const scriptPath = path.resolve(__dirname, "../scripts/resolve-benchmark-auth-token.mjs")
  const importModule = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>
  const script = await importModule(pathToFileURL(scriptPath).href) as {
    cognitoAuthParameters(input: { username: string; password: string }): string
  }

  const serialized = script.cognitoAuthParameters({
    username: "benchmark-runner@memorag.local",
    password
  })

  assert.deepEqual(JSON.parse(serialized), {
    USERNAME: "benchmark-runner@memorag.local",
    PASSWORD: password
  })
  assert.equal(serialized.includes("USERNAME=benchmark-runner@memorag.local,PASSWORD="), false)
})
