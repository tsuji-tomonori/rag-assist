import assert from "node:assert/strict"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import * as cdk from "aws-cdk-lib"
import { Match, Template } from "aws-cdk-lib/assertions"
import { MemoRagMvpStack } from "../lib/memorag-mvp-stack"

function synthesize() {
  const app = new cdk.App()
  const stack = new MemoRagMvpStack(app, "MemoRagMvpStackTest", {
    env: { account: "111111111111", region: "ap-northeast-1" },
    includeFrontendDeployment: false
  })
  return Template.fromStack(stack)
}

test("implements the designed serverless resources", () => {
  const template = synthesize()

  template.resourceCountIs("AWS::S3::Bucket", 5)
  template.resourceCountIs("AWS::Cognito::UserPool", 1)
  template.resourceCountIs("AWS::Cognito::UserPoolClient", 1)
  template.resourceCountIs("AWS::Cognito::UserPoolGroup", 8)
  template.hasResourceProperties("AWS::Cognito::UserPool", {
    AdminCreateUserConfig: { AllowAdminCreateUserOnly: false },
    AutoVerifiedAttributes: ["email"],
    LambdaConfig: Match.objectLike({ PostConfirmation: Match.anyValue() })
  })
  template.resourceCountIs("AWS::SecretsManager::Secret", 1)
  template.resourceCountIs("AWS::ApiGateway::Authorizer", 1)
  template.hasResourceProperties("AWS::S3::Bucket", {
    BucketEncryption: {
      ServerSideEncryptionConfiguration: [
        { ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } }
      ]
    },
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true
    }
  })

  template.hasResourceProperties("AWS::S3::Bucket", {
    LoggingConfiguration: Match.objectLike({ LogFilePrefix: "s3/debug-downloads/" }),
    LifecycleConfiguration: {
      Rules: Match.arrayWith([Match.objectLike({ ExpirationInDays: 7, Status: "Enabled" })])
    }
  })
  template.hasResourceProperties("AWS::S3::Bucket", {
    LoggingConfiguration: Match.objectLike({ LogFilePrefix: "s3/benchmark/" }),
    LifecycleConfiguration: {
      Rules: Match.arrayWith([
        Match.objectLike({ ExpirationInDays: 30, Prefix: "runs/", Status: "Enabled" }),
        Match.objectLike({ ExpirationInDays: 7, Prefix: "downloads/", Status: "Enabled" })
      ])
    }
  })
  template.hasResourceProperties("AWS::Lambda::Function", {
    Handler: "index.handler",
    Runtime: "nodejs22.x",
    Architectures: ["arm64"]
  })
  template.hasResourceProperties("AWS::Lambda::Function", {
    Handler: "index.handler",
    Runtime: "nodejs22.x",
    Environment: Match.objectLike({
      Variables: Match.objectLike({ DEFAULT_SIGNUP_GROUP_NAME: "CHAT_USER" })
    })
  })
  template.hasResourceProperties("AWS::ApiGateway::RestApi", {
    EndpointConfiguration: Match.objectLike({
      Types: ["REGIONAL"]
    })
  })
  template.hasResourceProperties("AWS::ApiGateway::Stage", {
    StageName: "prod",
    AccessLogSetting: Match.objectLike({
      DestinationArn: Match.anyValue()
    }),
    MethodSettings: Match.arrayWith([
      Match.objectLike({
        LoggingLevel: "INFO",
        MetricsEnabled: true
      })
    ])
  })
  template.hasResourceProperties("AWS::ApiGateway::Method", {
    HttpMethod: "GET",
    AuthorizationType: "COGNITO_USER_POOLS",
    Integration: Match.objectLike({
      ResponseTransferMode: "STREAM",
      TimeoutInMillis: 900000
    })
  })
  template.hasResourceProperties("AWS::ApiGateway::GatewayResponse", {
    ResponseType: "DEFAULT_4XX",
    ResponseParameters: Match.objectLike({
      "gatewayresponse.header.Access-Control-Allow-Origin": "'*'",
      "gatewayresponse.header.Access-Control-Allow-Headers": "'Content-Type, Authorization, Last-Event-ID'",
      "gatewayresponse.header.Access-Control-Allow-Methods": "'GET, POST, DELETE, OPTIONS'"
    })
  })
  template.hasResourceProperties("AWS::ApiGateway::GatewayResponse", {
    ResponseType: "DEFAULT_5XX",
    ResponseParameters: Match.objectLike({
      "gatewayresponse.header.Access-Control-Allow-Origin": "'*'"
    })
  })
  template.hasResourceProperties("AWS::CloudFront::Distribution", {
    DistributionConfig: Match.objectLike({
      DefaultRootObject: "index.html",
      Logging: Match.objectLike({ Prefix: "cloudfront/frontend/" }),
      DefaultCacheBehavior: Match.objectLike({
        ViewerProtocolPolicy: "redirect-to-https"
      })
    })
  })
  template.hasResourceProperties("AWS::DynamoDB::Table", {
    KeySchema: [{ AttributeName: "questionId", KeyType: "HASH" }],
    BillingMode: "PAY_PER_REQUEST",
    PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true }
  })
  template.hasResourceProperties("AWS::DynamoDB::Table", {
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" },
      { AttributeName: "id", KeyType: "RANGE" }
    ],
    BillingMode: "PAY_PER_REQUEST",
    PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true }
  })
  template.hasResourceProperties("AWS::DynamoDB::Table", {
    KeySchema: [{ AttributeName: "runId", KeyType: "HASH" }],
    BillingMode: "PAY_PER_REQUEST",
    PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true }
  })
  template.hasResourceProperties("AWS::DynamoDB::Table", {
    KeySchema: [
      { AttributeName: "runId", KeyType: "HASH" },
      { AttributeName: "seq", KeyType: "RANGE" }
    ],
    BillingMode: "PAY_PER_REQUEST",
    TimeToLiveSpecification: { AttributeName: "ttl", Enabled: true },
    PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true }
  })
  for (const groupName of [
    "CHAT_USER",
    "ANSWER_EDITOR",
    "RAG_GROUP_MANAGER",
    "BENCHMARK_RUNNER",
    "USER_ADMIN",
    "ACCESS_ADMIN",
    "COST_AUDITOR",
    "SYSTEM_ADMIN"
  ]) {
    template.hasResourceProperties("AWS::Cognito::UserPoolGroup", {
      GroupName: groupName,
      UserPoolId: Match.anyValue()
    })
  }
  template.hasResourceProperties("AWS::Lambda::Function", {
    Environment: Match.objectLike({
      Variables: Match.objectLike({
        QUESTION_TABLE_NAME: Match.anyValue(),
        CONVERSATION_HISTORY_TABLE_NAME: Match.anyValue(),
        BENCHMARK_RUNS_TABLE_NAME: Match.anyValue(),
        CHAT_RUNS_TABLE_NAME: Match.anyValue(),
        CHAT_RUN_EVENTS_TABLE_NAME: Match.anyValue(),
        BENCHMARK_BUCKET_NAME: Match.anyValue(),
        BENCHMARK_STATE_MACHINE_ARN: Match.anyValue(),
        BENCHMARK_TARGET_API_BASE_URL: Match.anyValue(),
        CHAT_RUN_STATE_MACHINE_ARN: Match.anyValue(),
        USE_LOCAL_QUESTION_STORE: "false",
        USE_LOCAL_CONVERSATION_HISTORY_STORE: "false",
        USE_LOCAL_BENCHMARK_RUN_STORE: "false",
        USE_LOCAL_CHAT_RUN_STORE: "false",
        AUTH_ENABLED: "true",
        COGNITO_USER_POOL_ID: Match.anyValue(),
        COGNITO_APP_CLIENT_ID: Match.anyValue(),
        DEBUG_DOWNLOAD_BUCKET_NAME: Match.anyValue(),
        DEBUG_DOWNLOAD_EXPIRES_IN_SECONDS: "900"
      })
    })
  })
  template.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1)
  template.hasResourceProperties("AWS::CloudFormation::CustomResource", {
    vectorBucketName: Match.anyValue(),
    indexNames: ["memory-index", "evidence-index"],
    dimension: 1024,
    distanceMetric: "cosine"
  })
  template.hasResourceProperties("AWS::CodeBuild::Project", {
    EncryptionKey: Match.anyValue(),
    Environment: Match.objectLike({
      ComputeType: "BUILD_GENERAL1_SMALL",
      Image: "aws/codebuild/standard:7.0",
      EnvironmentVariables: Match.arrayWith([
        Match.objectLike({ Name: "COGNITO_USER_POOL_ID" }),
        Match.objectLike({ Name: "COGNITO_APP_CLIENT_ID" }),
        Match.objectLike({ Name: "BENCHMARK_AUTH_SECRET_ID" }),
        Match.objectLike({ Name: "BENCHMARK_RUNNER_GROUP", Value: "BENCHMARK_RUNNER" })
      ])
    }),
    TimeoutInMinutes: 120
  })
  template.hasResourceProperties("AWS::IAM::Policy", {
    PolicyDocument: Match.objectLike({
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: Match.arrayWith([
            "cognito-idp:ListUsers",
            "cognito-idp:AdminListGroupsForUser"
          ]),
          Resource: Match.anyValue()
        })
      ])
    })
  })
  template.hasResourceProperties("AWS::IAM::Policy", {
    PolicyDocument: Match.objectLike({
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: Match.arrayWith([
            "cognito-idp:AdminGetUser",
            "cognito-idp:AdminCreateUser",
            "cognito-idp:AdminSetUserPassword",
            "cognito-idp:AdminAddUserToGroup"
          ]),
          Resource: Match.anyValue()
        })
      ])
    })
  })
  template.hasResourceProperties("AWS::StepFunctions::StateMachine", {
    DefinitionString: Match.anyValue(),
    LoggingConfiguration: Match.objectLike({
      Level: "ALL"
    })
  })
  const stateMachines = Object.values(template.toJSON().Resources ?? {})
    .filter((resource: any) => resource.Type === "AWS::StepFunctions::StateMachine")
  assert.equal(stateMachines.length, 2)
  const chatRunStateMachine = stateMachines.find((stateMachine: any) => JSON.stringify(stateMachine.Properties.DefinitionString).includes("ChatRunWorkerTask"))
  assert.ok(chatRunStateMachine)
  const chatRunDefinition = JSON.stringify((chatRunStateMachine as any).Properties.DefinitionString)
  assert.match(chatRunDefinition, /ChatRunMarkFailedTask/)
  assert.match(chatRunDefinition, /States\.ALL/)
  for (const stateMachine of stateMachines) {
    assert.equal((stateMachine as any).Properties.TracingConfiguration, undefined)
  }
})

test("does not create fixed-cost network or datastore resources", () => {
  const template = synthesize().toJSON()
  const fixedCostResourceTypes = new Set([
    "AWS::EC2::NatGateway",
    "AWS::EC2::VPC",
    "AWS::EC2::Subnet",
    "AWS::EC2::EIP",
    "AWS::ElasticLoadBalancingV2::LoadBalancer",
    "AWS::RDS::DBInstance",
    "AWS::RDS::DBCluster",
    "AWS::OpenSearchService::Domain",
    "AWS::Elasticsearch::Domain"
  ])

  const actualTypes = Object.values(template.Resources ?? {}).map((resource: any) => resource.Type)
  assert.deepEqual(
    actualTypes.filter((type) => fixedCostResourceTypes.has(type)).sort(),
    [],
    "The MVP stack must stay serverless and avoid NAT gateways, VPC networking, and managed database/search clusters."
  )
})

test("keeps CORS preflight routes unauthenticated", () => {
  const template = synthesize().toJSON()
  const methods = Object.values(template.Resources ?? {})
    .filter((resource: any) => resource.Type === "AWS::ApiGateway::Method")
    .map((resource: any) => resource.Properties)

  const preflightMethods = methods.filter((method: any) => method.HttpMethod === "OPTIONS")
  assert.ok(preflightMethods.length >= 2)
  for (const method of preflightMethods) {
    assert.equal(method.AuthorizationType, "NONE")
    assert.equal(method.AuthorizerId, undefined)
  }

  const protectedMethods = methods.filter((method: any) => method.HttpMethod !== "OPTIONS")
  assert.ok(protectedMethods.length > 0)
  for (const method of protectedMethods) {
    assert.equal(method.AuthorizationType, "COGNITO_USER_POOLS")
    assert.ok(method.AuthorizerId)
  }
})

test("fails the benchmark CodeBuild runner when auth token resolution fails", () => {
  const template = synthesize().toJSON()
  const codeBuildProjects = Object.values(template.Resources ?? {})
    .filter((resource: any) => resource.Type === "AWS::CodeBuild::Project")

  assert.equal(codeBuildProjects.length, 1)
  const buildSpec = JSON.parse((codeBuildProjects[0] as any).Properties.Source.BuildSpec)

  assert.equal(buildSpec.env.shell, "bash")
  for (const phase of ["install", "pre_build", "build", "post_build"]) {
    assert.equal(buildSpec.phases[phase].commands[0], "set -euo pipefail")
  }
  assert.ok(buildSpec.phases.pre_build.commands.includes("API_AUTH_TOKEN=\"$(node infra/scripts/resolve-benchmark-auth-token.mjs)\""))
  assert.ok(buildSpec.phases.pre_build.commands.includes("export API_AUTH_TOKEN"))
  assert.equal(
    buildSpec.phases.pre_build.commands.includes("export API_AUTH_TOKEN=\"$(node infra/scripts/resolve-benchmark-auth-token.mjs)\""),
    false
  )
})

test("matches the synthesized CloudFormation snapshot", () => {
  const actual = `${JSON.stringify(stabilizeTemplate(synthesize().toJSON()), null, 2)}\n`
  const snapshotPath = path.join(__dirname, "__snapshots__", "memorag-mvp-stack.snapshot.json")

  if (process.env.UPDATE_SNAPSHOTS === "1") {
    mkdirSync(path.dirname(snapshotPath), { recursive: true })
    writeFileSync(snapshotPath, actual)
  }

  assert.equal(actual, readFileSync(snapshotPath, "utf-8"))
  assert.equal(existsSync(snapshotPath), true)
})

function stabilizeTemplate(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stabilizeTemplate)
  if (!value || typeof value !== "object") return stabilizeScalar(value)

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "Metadata")
      .map(([key, nested]) => [key, stabilizeTemplate(nested)])
  )
}

function stabilizeScalar(value: unknown): unknown {
  if (typeof value !== "string") return value
  return value
    .replace(/asset\.[0-9a-f]{64}/g, "asset.<hash>")
    .replace(/[0-9a-f]{64}\.zip/g, "<asset-hash>.zip")
}
