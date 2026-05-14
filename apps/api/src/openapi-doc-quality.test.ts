import assert from "node:assert/strict"
import test from "node:test"
import { collectRestOrpcRoutes, validateRestOrpcContractDrift } from "./openapi-contract-drift.js"
import {
  contentRows,
  enrichOpenApiDocument,
  isHttpMethod,
  parameterRows,
  parametersByGroup,
  responseRows,
  schemaRows,
  validateOpenApiDocument,
  type OpenApiDocument
} from "./openapi-doc-quality.js"
import { renderMarkdownArtifacts } from "./generate-openapi-docs.js"

const authorization = {
  mode: "permission",
  allowedRoles: ["CHAT_USER"],
  deniedRoles: ["ANSWER_EDITOR"],
  conditionalDeniedRoles: ["BENCHMARK_RUNNER"],
  errors: [
    {
      status: 403,
      when: "権限がない場合",
      body: { message: "権限がありません" }
    }
  ],
  notes: ["内部 policy は返しません。"]
}

test("OpenAPI enrichment fills descriptions, lifecycle, authorization headers, and schema metadata", () => {
  const api: OpenApiDocument = {
    openapi: "3.1.0",
    info: { title: "API", version: "1.0.0", description: "説明" },
    components: {
      schemas: {
        Item: {
          type: "object",
          properties: {
            id: { type: "string", minLength: 1 },
            tags: {
              type: "array",
              minItems: 1,
              maxItems: 3,
              items: {
                type: "object",
                properties: {
                  label: { type: "string", enum: ["a", "b"] }
                }
              }
            },
            union: { oneOf: [{ type: "string" }, { type: "number", minimum: 1, maximum: 9 }] },
            nullableValue: { type: ["string", "null"], nullable: true, maxLength: 20 }
          },
          required: ["id", "tags"]
        }
      }
    },
    paths: {
      "/chat": {
        post: {
          parameters: [
            { name: "Authorization", in: "header", schema: { type: "string" } },
            { name: "runId", in: "path", required: true, schema: { type: "string" } },
            { name: "query", in: "query", schema: { type: "string" } },
            { name: "session", in: "cookie", schema: { type: "string" } },
            { name: "custom", in: "form" as "query", schema: { format: "uuid", type: "string" } }
          ],
          requestBody: {
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Item" } }
            }
          },
          responses: {
            "200": {
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/Item" } },
                "text/plain": { schema: { type: "string", description: "text の値。" } }
              }
            },
            "204": {}
          },
          "x-memorag-authorization": authorization
        }
      },
      "/health": {
        trace: { responses: { "200": {} } },
        get: { responses: { "200": {} } }
      }
    }
  }

  const enriched = enrichOpenApiDocument(api)
  const chat = enriched.paths?.["/chat"]?.post
  assert.equal(chat?.summary, "同期チャット回答を生成する")
  assert.equal(chat?.["x-memorag-lifecycle"]?.stage, "compatibility")
  assert.equal(parametersByGroup(chat ?? {}, "header")[0]?.name, "Authorization")
  assert.equal(parametersByGroup(chat ?? {}, "path")[0]?.description?.includes("URL path"), true)
  assert.equal(parametersByGroup(chat ?? {}, "query")[0]?.description?.includes("クエリ文字列"), true)
  assert.equal(parametersByGroup(chat ?? {}, "cookie")[0]?.description?.includes("Cookie"), true)
  assert.equal(parameterRows(parametersByGroup(chat ?? {}, "query"))[0]?.constraints, "-")
  assert.equal(contentRows(enriched, chat?.requestBody?.content)[0]?.rows.some((row) => row.name === "tags[].label"), true)
  assert.equal(responseRows(enriched, chat?.responses).some((row) => row.status === "204" && row.mediaType === "-"), true)
  assert.equal(schemaRows(enriched, { anyOf: [{ type: "string" }, { type: "number" }] }, "value")[0]?.name, "value")
  assert.equal(isHttpMethod("trace"), true)
  assert.equal(isHttpMethod("madeup"), false)

  const markdown = renderMarkdownArtifacts(enriched).find((artifact) => artifact.relativePath === "openapi/post-chat.md")?.content ?? ""
  assert.match(markdown, /## Authorization/)
  assert.match(markdown, /## Lifecycle/)
  assert.match(markdown, /認証・認可エラー/)
  assert.match(markdown, /Media type: `application\/json`/)
})

test("OpenAPI quality validation reports lifecycle, authorization, parameter, and schema errors", () => {
  const api: OpenApiDocument = {
    openapi: "3.1.0",
    info: { title: "API", version: "1.0.0", description: "説明" },
    components: {
      schemas: {
        MissingDescriptions: {
          type: "object",
          properties: {
            child: {
              type: "object",
              properties: {
                value: { type: "string" }
              }
            }
          }
        }
      }
    },
    paths: {
      "/unknown": {
        post: {
          summary: "plain",
          description: "plain",
          deprecated: true,
          parameters: [{ name: "plain", in: "query", description: "plain", schema: { type: "string" } }],
          requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/MissingDescriptions" } } } },
          responses: { "200": { description: "plain", content: { "application/json": { schema: { type: "object", properties: { value: { type: "string" } } } } } } }
        }
      },
      "/chat": {
        post: {
          summary: "同期",
          description: "同期",
          responses: { "200": { description: "成功" } },
          "x-memorag-lifecycle": { stage: "deprecated" },
          "x-memorag-authorization": { mode: "permission" }
        }
      }
    }
  }

  const errors = validateOpenApiDocument(api)
  assert.ok(errors.some((error) => error.includes("POST /unknown: operationDocs")))
  assert.ok(errors.some((error) => error.includes("POST /unknown: deprecated operation")))
  assert.ok(errors.some((error) => error.includes("summary に日本語説明")))
  assert.ok(errors.some((error) => error.includes("parameter plain")))
  assert.ok(errors.some((error) => error.includes("object schema に日本語 description")))
  assert.ok(errors.some((error) => error.includes("compatibility/deprecated API に replacement")))
  assert.ok(errors.some((error) => error.includes("x-memorag-authorization.allowedRoles")))
  assert.ok(errors.some((error) => error.includes("protected API に 401 response")))
  assert.ok(errors.some((error) => error.includes("permission protected API に 403 response")))
})

test("REST/oRPC drift validation reports missing operations and schema presence mismatches", () => {
  const contract = {
    chat: {
      "~orpc": {
        route: { method: "POST", path: "/chat" },
        inputSchema: {},
        outputSchema: {}
      }
    },
    health: {
      "~orpc": {
        route: { method: "GET", path: "/health" },
        outputSchema: {}
      }
    },
    ignored: {
      nested: {
        "~orpc": {
          route: { method: "TRACE", path: "/ignored" }
        }
      }
    }
  }
  const routes = collectRestOrpcRoutes(contract)
  assert.deepEqual(routes.map((route) => route.procedure), ["chat", "health", "ignored.nested"])

  const errors = validateRestOrpcContractDrift({
    paths: {
      "/chat": {
        post: {
          responses: {}
        }
      },
      "/health": {
        get: {
          responses: {}
        }
      }
    }
  } as OpenApiDocument)
  assert.ok(errors.some((error) => error.includes("requestBody")))
  assert.ok(errors.some((error) => error.includes("200 response")))
})
