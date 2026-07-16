import assert from "node:assert/strict"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import * as cdk from "aws-cdk-lib"
import { Match, Template } from "aws-cdk-lib/assertions"
import { APPLICATION_ROLES } from "@memorag-mvp/contract/access-control"
import { MemoRagMvpStack } from "../lib/memorag-mvp-stack"

function synthesize(context?: Record<string, string>) {
  const app = new cdk.App({
    context
  })
  const stack = new MemoRagMvpStack(app, "MemoRagMvpStackTest", {
    env: { account: "111111111111", region: "ap-northeast-1" },
    includeFrontendDeployment: false
  })
  return Template.fromStack(stack)
}

function getBenchmarkProject(template: Template) {
  const projects = Object.values(template.toJSON().Resources ?? {})
    .filter((resource: any) => resource.Type === "AWS::CodeBuild::Project")
  assert.equal(projects.length, 1)
  return projects[0] as any
}

function resourcePathById(resources: Record<string, any>, logicalId: string): string {
  const resource = resources[logicalId]
  assert.ok(resource, `API Gateway resource missing: ${logicalId}`)
  if (resource.Type !== "AWS::ApiGateway::Resource") return "/"
  const parentId = resource.Properties.ParentId?.Ref
  const parentPath = typeof parentId === "string" ? resourcePathById(resources, parentId) : ""
  return `${parentPath}/${resource.Properties.PathPart}`.replace(/\/+/g, "/")
}

function methodTargets(template: Template): Record<string, string> {
  const resources = template.toJSON().Resources ?? {}
  const targets: Record<string, string> = {}
  for (const resource of Object.values(resources) as any[]) {
    if (resource.Type !== "AWS::ApiGateway::Method") continue
    const method = resource.Properties.HttpMethod
    const resourceId = resource.Properties.ResourceId?.Ref
    const pathName = typeof resourceId === "string" ? resourcePathById(resources, resourceId) : "/"
    targets[`${method} ${pathName}`] = JSON.stringify(resource.Properties.Integration?.Uri ?? "")
  }
  return targets
}

function getResourceByLogicalIdPrefix(template: Template, logicalIdPrefix: string) {
  const resources = template.toJSON().Resources ?? {}
  const matchingEntries = Object.entries(resources)
    .filter(([logicalId, resource]) => (
      logicalId.startsWith(logicalIdPrefix) &&
      (resource as any).Type === "AWS::Lambda::Function"
    ))
  assert.equal(matchingEntries.length, 1)
  const matchingEntry = matchingEntries[0]
  assert.ok(matchingEntry)
  return matchingEntry[1] as any
}

test("implements the designed serverless resources", () => {
  const template = synthesize()

  template.resourceCountIs("AWS::S3::Bucket", 5)
  template.resourceCountIs("AWS::Cognito::UserPool", 1)
  template.resourceCountIs("AWS::Cognito::UserPoolClient", 1)
  template.resourceCountIs("AWS::Cognito::UserPoolGroup", APPLICATION_ROLES.length)
  template.hasResourceProperties("AWS::Cognito::UserPool", {
    AdminCreateUserConfig: { AllowAdminCreateUserOnly: true }
  })
  template.resourceCountIs("AWS::SecretsManager::Secret", 1)
  template.resourceCountIs("AWS::KMS::Key", 1)
  template.hasResourceProperties("AWS::KMS::Key", {
    EnableKeyRotation: true
  })
  template.resourceCountIs("AWS::ApiGateway::Authorizer", 1)
  template.resourceCountIs("AWS::ApiGateway::RequestValidator", 1)
  template.hasResourceProperties("AWS::ApiGateway::RequestValidator", {
    Name: "basic-request-validator",
    ValidateRequestBody: true,
    ValidateRequestParameters: true
  })
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
    Timeout: 60,
    MemorySize: 1024,
    Environment: Match.objectLike({
      Variables: Match.objectLike({ BENCHMARK_BUCKET_NAME: Match.anyValue() })
    })
  })
  template.hasResourceProperties("AWS::Lambda::Function", {
    Handler: "index.handler",
    Runtime: "nodejs22.x",
    Timeout: 60,
    MemorySize: 3008,
    Environment: Match.objectLike({
      Variables: Match.objectLike({ BENCHMARK_BUCKET_NAME: Match.anyValue() })
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
    Integration: Match.objectLike({
      TimeoutInMillis: 60000
    })
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
    GlobalSecondaryIndexes: Match.arrayWith([
      Match.objectLike({ IndexName: "RequesterUpdatedAtIndex" }),
      Match.objectLike({ IndexName: "AssigneeUserUpdatedAtIndex" }),
      Match.objectLike({ IndexName: "AssigneeGroupUpdatedAtIndex" }),
      Match.objectLike({ IndexName: "StatusUpdatedAtIndex" })
    ]),
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
    KeySchema: [
      { AttributeName: "ownerUserId", KeyType: "HASH" },
      { AttributeName: "targetKey", KeyType: "RANGE" }
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
  template.hasResourceProperties("AWS::DynamoDB::Table", {
    KeySchema: [{ AttributeName: "groupId", KeyType: "HASH" }],
    BillingMode: "PAY_PER_REQUEST",
    GlobalSecondaryIndexes: Match.arrayWith([
      Match.objectLike({
        IndexName: "AdminCanonicalPathIndex",
        KeySchema: [
          { AttributeName: "adminPathPk", KeyType: "HASH" },
          { AttributeName: "normalizedCanonicalPath", KeyType: "RANGE" }
        ],
        Projection: { ProjectionType: "ALL" }
      })
    ]),
    PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true }
  })
  for (const groupName of APPLICATION_ROLES) {
    template.hasResourceProperties("AWS::Cognito::UserPoolGroup", {
      GroupName: groupName,
      UserPoolId: Match.anyValue()
    })
  }
  template.hasResourceProperties("AWS::Lambda::Function", {
    Environment: Match.objectLike({
      Variables: Match.objectLike({
        QUESTION_TABLE_NAME: Match.anyValue(),
        DEFAULT_SUPPORT_ASSIGNEE_GROUP_ID: "ANSWER_EDITOR",
        CONVERSATION_HISTORY_TABLE_NAME: Match.anyValue(),
        FAVORITES_TABLE_NAME: Match.anyValue(),
        BENCHMARK_RUNS_TABLE_NAME: Match.anyValue(),
        CHAT_RUNS_TABLE_NAME: Match.anyValue(),
        CHAT_RUN_EVENTS_TABLE_NAME: Match.anyValue(),
        BENCHMARK_BUCKET_NAME: Match.anyValue(),
        BENCHMARK_STATE_MACHINE_ARN: Match.anyValue(),
        BENCHMARK_TARGET_API_BASE_URL: Match.anyValue(),
        CHAT_RUN_STATE_MACHINE_ARN: Match.anyValue(),
        USE_LOCAL_BENCHMARK_RUN_STORE: "false",
        USE_LOCAL_CHAT_RUN_STORE: "false",
        AUTH_ENABLED: "true",
        AUTH_TENANT_ID: Match.anyValue(),
        BENCHMARK_EVALUATION_ENABLED: "true",
        BENCHMARK_EVALUATION_TENANT_ID: Match.anyValue(),
        CORS_ALLOWED_ORIGINS: "*",
        COGNITO_USER_POOL_ID: Match.anyValue(),
        COGNITO_APP_CLIENT_ID: Match.anyValue(),
        DEBUG_DOWNLOAD_BUCKET_NAME: Match.anyValue(),
        DEBUG_DOWNLOAD_EXPIRES_IN_SECONDS: "900",
        RAG_MONITORING_REQUIRED: "1",
        RAG_SAFETY_STATE_TTL_SECONDS: "600",
        RAG_GUARD_PROFILE_JSON: JSON.stringify({
          id: "standard-safe-rag",
          version: "standard-safe-rag-v1",
          guards: {
            authentication: true,
            authorization: true,
            classification_usage: true,
            prompt_injection: true,
            tool_policy: true,
            grounding: true,
            citation: true,
            output_secret: true,
            trace_redaction: true
          }
        }),
        PDF_OCR_FALLBACK_ENABLED: "true",
        PDF_OCR_FALLBACK_TIMEOUT_MS: "45000"
      })
    })
  })
  template.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1)
  template.hasResourceProperties("AWS::Events::Rule", {
    ScheduleExpression: "rate(5 minutes)",
    State: "ENABLED"
  })
  template.hasResourceProperties("AWS::Lambda::Function", {
    Timeout: 300,
    MemorySize: 512,
    Environment: Match.objectLike({ Variables: Match.objectLike({
      RAG_MONITORING_REQUIRED: "1",
      RAG_ALERT_TOPIC_ARN: Match.anyValue()
    }) })
  })
  template.resourceCountIs("AWS::SNS::Topic", 1)
  template.resourceCountIs("AWS::CloudWatch::Alarm", 4)
  const qualityMonitorPolicy = Object.entries(template.toJSON().Resources ?? {}).find(([logicalId, resource]) => (
    logicalId.startsWith("RagQualityMonitorFunctionServiceRoleDefaultPolicy")
    && (resource as any).Type === "AWS::IAM::Policy"
  ))?.[1]
  assert.ok(qualityMonitorPolicy)
  assert.match(JSON.stringify((qualityMonitorPolicy as any).Properties.PolicyDocument), /sns:Publish/)
  template.hasResourceProperties("AWS::CloudWatch::Alarm", {
    Namespace: "MemoRAG/QualityControl",
    MetricName: "CriticalAlertCount",
    Threshold: 1,
    AlarmActions: Match.anyValue()
  })
  template.hasResourceProperties("AWS::CloudFormation::CustomResource", {
    vectorBucketName: Match.anyValue(),
    indexNames: ["memory-index", "evidence-index"],
    dimension: 1024,
    distanceMetric: "cosine"
  })
  template.hasResourceProperties("AWS::CodeBuild::Project", {
    EncryptionKey: { "Fn::GetAtt": [Match.stringLikeRegexp("BenchmarkProjectKey"), "Arn"] },
    Environment: Match.objectLike({
      ComputeType: "BUILD_GENERAL1_SMALL",
      Image: "aws/codebuild/standard:7.0",
      EnvironmentVariables: Match.arrayWith([
        Match.objectLike({ Name: "COGNITO_USER_POOL_ID" }),
        Match.objectLike({ Name: "COGNITO_APP_CLIENT_ID" }),
        Match.objectLike({ Name: "BENCHMARK_AUTH_SECRET_ID" }),
        Match.objectLike({ Name: "BENCHMARK_RUNNER_GROUP", Value: "BENCHMARK_RUNNER" }),
        Match.objectLike({ Name: "BENCHMARK_RUNS_TABLE_NAME" }),
        Match.objectLike({ Name: "BENCHMARK_CODEBUILD_LOG_GROUP_NAME" }),
        Match.objectLike({ Name: "BENCHMARK_AUTHORIZATION_FUNCTION_NAME" })
      ])
    }),
    TimeoutInMinutes: 180
  })
  const benchmarkProject = getBenchmarkProject(template)
  assert.match(benchmarkProject.Properties.Source.BuildSpec, /codeBuildLogGroupName/)
  assert.match(benchmarkProject.Properties.Source.BuildSpec, /codeBuildLogStreamName/)
  template.hasResourceProperties("AWS::IAM::ManagedPolicy", {
    PolicyDocument: Match.objectLike({
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: "logs:GetLogEvents",
          Resource: Match.anyValue()
        }),
        Match.objectLike({
          Action: "codebuild:BatchGetBuilds",
          Resource: { "Fn::GetAtt": [Match.stringLikeRegexp("BenchmarkProject"), "Arn"] }
        })
      ])
    })
  })
  const managedPolicies = Object.values(template.toJSON().Resources ?? {})
    .filter((resource: any) => resource.Type === "AWS::IAM::ManagedPolicy") as any[]
  const getLogEventsStatement = managedPolicies
    .flatMap((policy) => policy.Properties?.PolicyDocument?.Statement ?? [])
    .find((statement) => statement.Action === "logs:GetLogEvents")
  assert.ok(getLogEventsStatement)
  const getLogEventsResource = JSON.stringify(getLogEventsStatement.Resource)
  assert.match(getLogEventsResource, /log-stream:\*/)
  assert.doesNotMatch(getLogEventsResource, /\*.*log-stream:\*/)
  template.hasResourceProperties("AWS::IAM::ManagedPolicy", {
    PolicyDocument: Match.objectLike({
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: Match.arrayWith([
            "cognito-idp:ListUsers",
            "cognito-idp:AdminGetUser",
            "cognito-idp:AdminListGroupsForUser",
            "cognito-idp:AdminAddUserToGroup",
            "cognito-idp:AdminRemoveUserFromGroup",
            "cognito-idp:AdminDisableUser",
            "cognito-idp:AdminEnableUser",
            "cognito-idp:AdminUpdateUserAttributes",
            "cognito-idp:AdminUserGlobalSignOut",
            "cognito-idp:AdminDeleteUser"
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
  template.hasResourceProperties("AWS::IAM::ManagedPolicy", {
    PolicyDocument: Match.objectLike({
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: Match.arrayWith([
            "textract:DetectDocumentText",
            "textract:StartDocumentTextDetection",
            "textract:GetDocumentTextDetection"
          ]),
          Resource: "*"
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
  assert.equal(stateMachines.length, 3)
  const chatRunStateMachine = stateMachines.find((stateMachine: any) => JSON.stringify(stateMachine.Properties.DefinitionString).includes("ChatRunWorkerTask"))
  assert.ok(chatRunStateMachine)
  const chatRunDefinition = JSON.stringify((chatRunStateMachine as any).Properties.DefinitionString)
  assert.match(chatRunDefinition, /ChatRunMarkFailedTask/)
  assert.match(chatRunDefinition, /States\.ALL/)
  const benchmarkStateMachine = stateMachines.find((stateMachine: any) => JSON.stringify(stateMachine.Properties.DefinitionString).includes("BenchmarkStartCodeBuild"))
  assert.ok(benchmarkStateMachine)
  const benchmarkDefinition = JSON.stringify((benchmarkStateMachine as any).Properties.DefinitionString)
  assert.match(benchmarkDefinition, /TimeoutSeconds\\":32400/)
  assert.match(benchmarkDefinition, /BenchmarkAuthorizeStart/)
  assert.match(benchmarkDefinition, /BenchmarkAuthorizeCommit/)
  assert.match(benchmarkDefinition, /ConditionExpression\\":\\"#status = :queued/)
  assert.match(benchmarkDefinition, /ConditionExpression\\":\\"#status = :running/)
  assert.match(benchmarkDefinition, /if_not_exists\(#error, :error\)/)
  const documentIngestRunStateMachine = stateMachines.find((stateMachine: any) => JSON.stringify(stateMachine.Properties.DefinitionString).includes("DocumentIngestRunWorkerTask"))
  assert.ok(documentIngestRunStateMachine)
  const documentIngestRunDefinition = JSON.stringify((documentIngestRunStateMachine as any).Properties.DefinitionString)
  assert.match(documentIngestRunDefinition, /DocumentIngestRunMarkFailedTask/)
  assert.match(documentIngestRunDefinition, /States\.ALL/)
  for (const stateMachine of stateMachines) {
    assert.equal((stateMachine as any).Properties.TracingConfiguration, undefined)
  }
})

test("deploys a scheduled least-privilege revocation reconciliation worker", () => {
  const template = synthesize()
  const worker = getResourceByLogicalIdPrefix(template, "RevocationCleanupFunction")
  assert.equal(worker.Properties.Timeout, 300)
  assert.equal(worker.Properties.MemorySize, 1024)

  template.hasResourceProperties("AWS::Events::Rule", {
    ScheduleExpression: "rate(1 minute)",
    State: "ENABLED",
    Targets: Match.arrayWith([Match.objectLike({ Input: "{\"limitPerTenant\":100}" })])
  })
  const resources = template.toJSON().Resources ?? {}
  const policyResources = Object.entries(resources)
    .filter(([logicalId, resource]) => logicalId.startsWith("RevocationCleanupFunctionServiceRoleDefaultPolicy") && (resource as any).Type === "AWS::IAM::Policy")
    .map(([, resource]) => resource as any)
  const policies = policyResources
    .map((resource) => JSON.stringify(resource.Properties.PolicyDocument))
    .join("\n")
  assert.match(policies, /s3:ListBucket/)
  assert.match(policies, /s3:DeleteObject/)
  assert.match(policies, /s3vectors:GetVectors/)
  assert.match(policies, /s3vectors:DeleteVectors/)
  assert.match(policies, /dynamodb:Query/)
  assert.match(policies, /dynamodb:UpdateItem/)
  assert.doesNotMatch(policies, /dynamodb:Scan/)
  assert.match(policies, /cognito-idp:AdminUserGlobalSignOut/)
  assert.match(policies, /security\/revocation-cleanup-tenants/)
  assert.match(policies, /security\/revocation-cleanup-tenant-registry-state/)
  assert.doesNotMatch(policies, /bedrock:InvokeModel/)
  assert.doesNotMatch(policies, /s3vectors:PutVectors/)
  const putStatements = policyResources.flatMap((resource) => resource.Properties.PolicyDocument.Statement)
    .filter((statement: any) => [statement.Action].flat().includes("s3:PutObject"))
  assert.ok(putStatements.length > 0)
  for (const statement of putStatements) {
    const serialized = JSON.stringify(statement.Resource)
    assert.match(serialized, /security\/revocation-cleanup/)
    assert.doesNotMatch(serialized, /BenchmarkBucket/)
  }
  const deleteStatements = policyResources.flatMap((resource) => resource.Properties.PolicyDocument.Statement)
    .filter((statement: any) => [statement.Action].flat().includes("s3:DeleteObject"))
  for (const statement of deleteStatements) {
    const serialized = JSON.stringify(statement.Resource)
    assert.doesNotMatch(serialized, /security\/revocation-cleanup(?:\/|-(?:repairs|tenants|tenant-registry-state))/)
  }
})

test("production monitoring requires an explicit quality and safety owner notification target", () => {
  assert.throws(
    () => synthesize({ deploymentEnvironment: "prod" }),
    /ragAlertTopicArn or ragAlertEmail/
  )
  const template = synthesize({ deploymentEnvironment: "prod", ragAlertEmail: "rag-on-call@example.com" })
  template.hasResourceProperties("AWS::SNS::Subscription", {
    Protocol: "email",
    Endpoint: "rag-on-call@example.com"
  })
  template.hasResourceProperties("AWS::SNS::TopicPolicy", {
    PolicyDocument: Match.objectLike({
      Statement: Match.arrayWith([Match.objectLike({
        Action: "sns:Publish",
        Effect: "Deny",
        Principal: { AWS: "*" },
        Condition: { Bool: { "aws:SecureTransport": "false" } }
      })])
    })
  })
})

test("stackProvidesDefaultSupportAssigneeGroupIdToApiFunctions", () => {
  const template = synthesize()
  for (const logicalIdPrefix of [
    "ApiFunction",
    "HeavyApiFunction",
    "ChatRunWorkerFunction",
    "DocumentIngestRunWorkerFunction"
  ]) {
    const fn = getResourceByLogicalIdPrefix(template, logicalIdPrefix)
    assert.equal(fn.Properties.Environment.Variables.DEFAULT_SUPPORT_ASSIGNEE_GROUP_ID, "ANSWER_EDITOR")
  }
})

test("routes heavy synchronous API paths to the heavyweight API Lambda", () => {
  const template = synthesize()
  const targets = methodTargets(template)
  const heavyRoutes = [
    "POST /chat",
    "POST /search",
    "POST /benchmark/query",
    "POST /benchmark/search",
    "POST /documents",
    "POST /documents/uploads/{uploadId}/content",
    "POST /documents/uploads/{uploadId}/ingest",
    "POST /documents/{documentId}/reindex",
    "POST /documents/{documentId}/reindex/stage",
    "POST /documents/reindex-migrations/{migrationId}/cutover",
    "POST /documents/reindex-migrations/{migrationId}/rollback"
  ]

  for (const route of heavyRoutes) {
    assert.match(targets[route] ?? "", /HeavyApiFunction/)
  }
  assert.match(targets["ANY /{proxy+}"] ?? "", /ApiFunction/)
  assert.doesNotMatch(targets["ANY /{proxy+}"] ?? "", /HeavyApiFunction/)
  assert.match(targets["POST /chat-runs"] ?? "", /ApiFunction/)
  assert.doesNotMatch(targets["POST /chat-runs"] ?? "", /HeavyApiFunction/)
  assert.match(targets["GET /chat-runs/{runId}/events"] ?? "", /ChatRunEventsStreamFunction/)
  assert.match(targets["GET /documents"] ?? "", /ApiFunction/)
  assert.match(targets["POST /documents/uploads"] ?? "", /ApiFunction/)
  assert.match(targets["DELETE /documents/{documentId}"] ?? "", /ApiFunction/)
  assert.match(targets["GET /documents/reindex-migrations"] ?? "", /ApiFunction/)
})

test("applies mandatory ownership and cost allocation tags", () => {
  const template = synthesize().toJSON()
  const taggableResourceTypes = new Set([
    "AWS::CloudFront::Distribution",
    "AWS::CodeBuild::Project",
    "AWS::Cognito::UserPool",
    "AWS::DynamoDB::Table",
    "AWS::IAM::Role",
    "AWS::KMS::Key",
    "AWS::Lambda::Function",
    "AWS::Logs::LogGroup",
    "AWS::S3::Bucket",
    "AWS::SecretsManager::Secret",
    "AWS::StepFunctions::StateMachine"
  ])
  const expectedTags = {
    Project: "memorag-bedrock-mvp",
    Application: "MemoRAG",
    Environment: "dev",
    ManagedBy: "aws-cdk",
    Repository: "tsuji-tomonori/rag-assist",
    CostCenter: "memorag-mvp"
  }

  let checkedResources = 0
  for (const [logicalId, resource] of Object.entries(template.Resources ?? {})) {
    if (logicalId.startsWith("CustomS3AutoDeleteObjectsCustomResourceProvider")) continue
    if (!taggableResourceTypes.has((resource as any).Type)) continue
    assertResourceTags(logicalId, resource, expectedTags)
    checkedResources += 1
  }

  assert.ok(checkedResources > 20, "The stack should tag the main application resources.")
})

test("allows deployment environment and cost center tag overrides", () => {
  const template = synthesize({ deploymentEnvironment: "staging", costCenter: "rag-platform" }).toJSON()
  const firstBucket = Object.entries(template.Resources ?? {})
    .find(([, resource]) => (resource as any).Type === "AWS::S3::Bucket")

  assert.ok(firstBucket)
  assertResourceTags(firstBucket[0], firstBucket[1], {
    Environment: "staging",
    CostCenter: "rag-platform"
  })
})

test("uses default benchmark source when CDK context is omitted", () => {
  const project = getBenchmarkProject(synthesize())

  assert.equal(project.Properties.Source.Location, "https://github.com/tsuji-tomonori/rag-assist.git")
  assert.equal(project.Properties.SourceVersion, "main")
})

test("keeps bootstrap IAM resources aligned with the tag strategy", () => {
  const bootstrapTemplate = readFileSync(path.join(__dirname, "../bootstrap/github-actions-oidc-role.yaml"), "utf-8")

  for (const tagKey of ["Project", "Application", "Environment", "ManagedBy", "Repository", "CostCenter"]) {
    assert.ok(
      bootstrapTemplate.includes(`Key: ${tagKey}`),
      `bootstrap template should include ${tagKey} tag`
    )
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
    assert.equal(method.RequestValidatorId, undefined)
  }

  const protectedMethods = methods.filter((method: any) => method.HttpMethod !== "OPTIONS")
  assert.ok(protectedMethods.length > 0)
  for (const method of protectedMethods) {
    assert.equal(method.AuthorizationType, "COGNITO_USER_POOLS")
    assert.ok(method.AuthorizerId)
    assert.ok(method.RequestValidatorId)
  }
})

test("keeps benchmark CodeBuild runner generic and fails when auth token resolution fails", () => {
  const template = synthesize().toJSON()
  const codeBuildProjects = Object.values(template.Resources ?? {})
    .filter((resource: any) => resource.Type === "AWS::CodeBuild::Project")

  assert.equal(codeBuildProjects.length, 1)
  const buildSpec = JSON.parse((codeBuildProjects[0] as any).Properties.Source.BuildSpec)

  assert.equal(buildSpec.env.shell, "bash")
  for (const phase of ["install", "pre_build", "build", "post_build"]) {
    assert.equal(buildSpec.phases[phase].commands[0], "set -euo pipefail")
  }
  const buildMetadataUpdate = buildSpec.phases.install.commands.find((command: string) => command.includes("aws dynamodb update-item"))
  assert.ok(buildMetadataUpdate?.includes("$STORAGE_RUN_ID"))
  assert.equal(buildMetadataUpdate?.includes('"$RUN_ID"'), false)
  assert.ok(buildMetadataUpdate?.includes("#status = :running"))
  assert.ok(buildSpec.phases.install.commands.includes("node infra/scripts/authorize-benchmark-boundary.mjs durable_commit build-metadata"))
  assert.ok(buildSpec.phases.pre_build.commands.includes("API_AUTH_TOKEN=\"$(node infra/scripts/resolve-benchmark-auth-token.mjs)\""))
  assert.ok(buildSpec.phases.pre_build.commands.includes("export API_AUTH_TOKEN"))
  assert.ok(buildSpec.phases.pre_build.commands.includes("export BENCHMARK_SUITE_ID=\"$SUITE_ID\""))
  assert.ok(buildSpec.phases.pre_build.commands.includes("npm run codebuild:prepare -w @memorag-mvp/benchmark"))
  const preBuildCommands = buildSpec.phases.pre_build.commands as string[]
  const protectedReadPayload = preBuildCommands.findIndex((command) => command.includes('boundary: "protected_read"'))
  const protectedReadInvoke = preBuildCommands.findIndex((command) => command.includes("aws lambda invoke") && command.includes("benchmark-authorize-protected-read"))
  const protectedReadGuard = preBuildCommands.findIndex((command, index) => index > protectedReadInvoke && command.includes("AUTHORIZATION_FUNCTION_ERROR") && command.includes("exit 1"))
  const protectedReadResponseCheck = preBuildCommands.findIndex((command) => command.includes("benchmark-authorize-protected-read-response.json") && command.includes("value.authorized !== true"))
  const firstProtectedRead = preBuildCommands.findIndex((command) => command.includes("RAG_WORKLOAD_EVIDENCE_S3_KEY") && command.includes("aws s3 cp"))
  const prepareExternalPayload = preBuildCommands.findIndex((command) => command.includes('boundary: "external_side_effect"') && command.includes("benchmark-authorize-prepare"))
  const prepareExternalInvoke = preBuildCommands.findIndex((command) => command.includes("aws lambda invoke") && command.includes("benchmark-authorize-prepare-external-side-effect"))
  const prepareExternalGuard = preBuildCommands.findIndex((command, index) => index > prepareExternalInvoke && command.includes("AUTHORIZATION_FUNCTION_ERROR") && command.includes("exit 1"))
  const prepareExternalResponseCheck = preBuildCommands.findIndex((command) => command.includes("benchmark-authorize-prepare-external-side-effect-response.json") && command.includes("value.authorized !== true"))
  const prepareCommand = preBuildCommands.indexOf("npm run codebuild:prepare -w @memorag-mvp/benchmark")
  assert.ok(protectedReadPayload >= 0)
  assert.ok(protectedReadPayload < protectedReadInvoke)
  assert.ok(protectedReadInvoke < protectedReadGuard)
  assert.ok(protectedReadGuard < protectedReadResponseCheck)
  assert.ok(protectedReadResponseCheck < firstProtectedRead)
  assert.ok(preBuildCommands.filter((command) => command.includes("authorize-benchmark-boundary.mjs protected_read")).length >= 3)
  for (const label of ["workload-evidence", "price-catalog"]) {
    const guardedRead = preBuildCommands.find((command) => command.includes(`protected_read ${label}`))
    assert.ok(guardedRead?.includes("aws s3 cp"), `${label} authorization must be in the same fail-closed shell command as its read`)
  }
  assert.ok(firstProtectedRead < prepareExternalPayload)
  assert.ok(prepareExternalPayload < prepareExternalInvoke)
  assert.ok(prepareExternalInvoke < prepareExternalGuard)
  assert.ok(prepareExternalGuard < prepareExternalResponseCheck)
  assert.ok(prepareExternalResponseCheck < prepareCommand)

  const buildCommands = buildSpec.phases.build.commands as string[]
  const runExternalPayload = buildCommands.findIndex((command) => command.includes('boundary: "external_side_effect"') && command.includes("benchmark-authorize-run"))
  const runExternalInvoke = buildCommands.findIndex((command) => command.includes("aws lambda invoke") && command.includes("benchmark-authorize-run-external-side-effect"))
  const runExternalGuard = buildCommands.findIndex((command, index) => index > runExternalInvoke && command.includes("AUTHORIZATION_FUNCTION_ERROR") && command.includes("exit 1"))
  const runExternalResponseCheck = buildCommands.findIndex((command) => command.includes("benchmark-authorize-run-external-side-effect-response.json") && command.includes("value.authorized !== true"))
  const runnerCommand = buildCommands.indexOf("npm run codebuild:run -w @memorag-mvp/benchmark")
  assert.ok(runExternalPayload >= 0)
  assert.ok(runExternalPayload < runExternalInvoke)
  assert.ok(runExternalInvoke < runExternalGuard)
  assert.ok(runExternalGuard < runExternalResponseCheck)
  assert.ok(runExternalResponseCheck < runnerCommand)
  assert.ok(buildSpec.phases.post_build.commands.includes("if [ ! -f \"$OUTPUT\" ]; then printf '' > \"$OUTPUT\"; fi"))
  assert.ok(buildSpec.phases.post_build.commands.includes("if [ ! -f \"$SUMMARY\" ]; then printf '{\"total\":0,\"succeeded\":0,\"failedHttp\":0,\"metrics\":{\"errorRate\":1}}\\n' > \"$SUMMARY\"; fi"))
  assert.ok(buildSpec.phases.post_build.commands.includes("export RELEASE_AUDIT=./benchmark/.release-audit.json"))
  assert.ok(buildSpec.phases.post_build.commands.includes("npm run release:audit -w @memorag-mvp/benchmark -- --summary \"$SUMMARY\" --source-root apps/api/src --source-root apps/web/src --output \"$RELEASE_AUDIT\" --report-only"))
  assert.ok(buildSpec.phases.post_build.commands.includes("aws s3 cp \"$RELEASE_AUDIT\" \"$OUTPUT_S3_PREFIX/release-audit.json\""))
  assert.ok(buildSpec.phases.post_build.commands.includes("node infra/scripts/update-benchmark-run-metrics.mjs"))
  const durableCommitPayload = buildSpec.phases.post_build.commands.findIndex((command: string) => command.includes('boundary: "durable_commit"') && command.includes("benchmark-authorize-artifact"))
  const durableCommitInvoke = buildSpec.phases.post_build.commands.findIndex((command: string) => command.includes("aws lambda invoke") && command.includes("benchmark-authorize-artifact-durable-commit"))
  const durableCommitGuard = buildSpec.phases.post_build.commands.findIndex((command: string) => command.includes("AUTHORIZATION_FUNCTION_ERROR") && command.includes("exit 1"))
  const durableCommitResponseCheck = buildSpec.phases.post_build.commands.findIndex((command: string) => command.includes("benchmark-authorize-artifact-durable-commit-response.json") && command.includes("value.authorized !== true"))
  const artifactUploadIndexes = ["results.jsonl", "summary.json", "report.md", "release-audit.json"].map((fileName) => (
    buildSpec.phases.post_build.commands.findIndex((command: string) => command.includes("aws s3 cp") && command.includes(fileName))
  ))
  assert.ok(durableCommitPayload >= 0)
  assert.ok(durableCommitPayload < durableCommitInvoke)
  assert.ok(durableCommitInvoke < durableCommitGuard)
  assert.ok(durableCommitGuard < durableCommitResponseCheck)
  assert.ok(artifactUploadIndexes.every((index) => durableCommitResponseCheck < index))
  for (const [label, uploadIndex] of ["results-artifact", "summary-artifact", "report-artifact", "release-audit-artifact"].map((label, index) => [label, artifactUploadIndexes[index]!] as const)) {
    const authorizationIndex = buildSpec.phases.post_build.commands.indexOf(`node infra/scripts/authorize-benchmark-boundary.mjs durable_commit ${label}`)
    assert.equal(authorizationIndex + 1, uploadIndex)
  }
  const metricsUpdateIndex = buildSpec.phases.post_build.commands.indexOf("node infra/scripts/update-benchmark-run-metrics.mjs")
  assert.equal(
    buildSpec.phases.post_build.commands.indexOf("node infra/scripts/authorize-benchmark-boundary.mjs durable_commit metrics-update") + 1,
    metricsUpdateIndex
  )
  assert.ok(buildSpec.phases.post_build.commands.indexOf("npm run release:audit -w @memorag-mvp/benchmark -- --summary \"$SUMMARY\" --source-root apps/api/src --source-root apps/web/src --output \"$RELEASE_AUDIT\" --report-only") < buildSpec.phases.post_build.commands.indexOf("node infra/scripts/update-benchmark-run-metrics.mjs"))
  assert.ok(buildSpec.phases.build.commands.includes("npm run codebuild:run -w @memorag-mvp/benchmark"))
  assert.doesNotMatch(JSON.stringify(buildSpec), /standard-agent-v1|allganize-rag-evaluation-ja-v1|mtrag-v1|chatrag-bench-v1|mlit-pdf-figure-table-rag-seed-v1/)
  assert.equal(
    buildSpec.phases.pre_build.commands.includes("export API_AUTH_TOKEN=\"$(node infra/scripts/resolve-benchmark-auth-token.mjs)\""),
    false
  )

  const resources = template.Resources ?? {}
  const projectPolicy = Object.entries(resources).find(([logicalId, resource]) => (
    logicalId.startsWith("BenchmarkProjectRoleDefaultPolicy") && (resource as any).Type === "AWS::IAM::Policy"
  ))?.[1]
  assert.ok(projectPolicy)
  assert.match(JSON.stringify((projectPolicy as any).Properties.PolicyDocument), /lambda:InvokeFunction/)
  assert.match(JSON.stringify((projectPolicy as any).Properties.PolicyDocument), /BenchmarkRunAuthorizationFunction/)

  const authorizationPolicy = Object.entries(resources).find(([logicalId, resource]) => (
    logicalId.startsWith("BenchmarkRunAuthorizationFunctionServiceRoleDefaultPolicy") && (resource as any).Type === "AWS::IAM::Policy"
  ))?.[1]
  assert.ok(authorizationPolicy)
  const authorizationPolicyJson = JSON.stringify((authorizationPolicy as any).Properties.PolicyDocument)
  assert.match(authorizationPolicyJson, /security\/revocation-cleanup/)
  assert.match(authorizationPolicyJson, /runs\/\*/)
  assert.match(authorizationPolicyJson, /s3:DeleteObject/)
})

test("deploys the tenant-scoped security audit reconciliation worker with bounded audit and membership read authority", () => {
  const template = synthesize()
  const worker = getResourceByLogicalIdPrefix(template, "SecurityAuditReconciliationFunction")
  assert.equal(worker.Properties.Timeout, 60)
  assert.equal(worker.Properties.MemorySize, 512)
  assert.deepEqual(worker.Properties.Environment.Variables.AUTH_TENANT_ID, { Ref: "AWS::AccountId" })

  const resources = template.toJSON().Resources ?? {}
  const schedule = Object.entries(resources).find(([logicalId, resource]) => (
    logicalId.startsWith("SecurityAuditReconciliationSchedule") && (resource as any).Type === "AWS::Events::Rule"
  ))?.[1] as any
  assert.ok(schedule)
  assert.equal(schedule.Properties.ScheduleExpression, "rate(1 minute)")
  assert.equal(schedule.Properties.State, "ENABLED")
  assert.match(JSON.stringify(schedule.Properties.Targets), /tenantId.*AWS::AccountId.*limit.*100/)

  const policies = Object.entries(resources)
    .filter(([logicalId, resource]) => logicalId.startsWith("SecurityAuditReconciliationFunctionServiceRoleDefaultPolicy") && (resource as any).Type === "AWS::IAM::Policy")
    .map(([, resource]) => JSON.stringify((resource as any).Properties.PolicyDocument))
    .join("\n")
  assert.match(policies, /s3:ListBucket/)
  assert.match(policies, /s3:GetObject/)
  assert.match(policies, /s3:PutObject/)
  assert.match(policies, /security-audit\/intents/)
  assert.match(policies, /source-governance/)
  assert.match(policies, /dynamodb:GetItem/)
  assert.match(policies, /dynamodb:Query/)
  assert.match(policies, /DocumentGroupsTable/)
  assert.match(policies, /index\/\*/)
  assert.doesNotMatch(policies, /s3:DeleteObject/)
  assert.doesNotMatch(policies, /bedrock:InvokeModel/)
  assert.doesNotMatch(policies, /dynamodb:(?:BatchGetItem|Scan|PutItem|UpdateItem|DeleteItem|TransactWriteItems)/)
})

test("passes only explicitly configured versioned workload and price evidence into benchmark CodeBuild", () => {
  const template = synthesize({
    ragWorkloadEvidenceS3Key: "quality/workload-v3.json",
    ragPriceCatalogS3Key: "quality/price-v6.json",
    ragRuntimeProfileVersion: "runtime-v9",
    ragWorkloadProfileVersion: "workload-v3",
    ragPriceCatalogVersion: "price-v6",
    ragIndexVersion: "index-v7",
    ragPromptVersion: "prompt-v5",
    ragPipelineVersion: "pipeline-v8",
    ragParserVersion: "parser-v4",
    ragChunkerVersion: "chunker-v2"
  })
  const variables = getBenchmarkProject(template).Properties.Environment.EnvironmentVariables
  const environment = Object.fromEntries(variables.map((item: any) => [item.Name, item.Value]))

  assert.equal(environment.RAG_WORKLOAD_EVIDENCE_S3_KEY, "quality/workload-v3.json")
  assert.equal(environment.RAG_PRICE_CATALOG_S3_KEY, "quality/price-v6.json")
  assert.equal(environment.RAG_RUNTIME_PROFILE_VERSION, "runtime-v9")
  assert.equal(environment.RAG_WORKLOAD_PROFILE_VERSION, "workload-v3")
  assert.equal(environment.RAG_PRICE_CATALOG_VERSION, "price-v6")
  assert.equal(environment.RAG_INDEX_VERSION, "index-v7")
  assert.equal(environment.RAG_PROMPT_VERSION, "prompt-v5")
  assert.equal(environment.RAG_PIPELINE_VERSION, "pipeline-v8")
  assert.equal(environment.RAG_PARSER_VERSION, "parser-v4")
  assert.equal(environment.RAG_CHUNKER_VERSION, "chunker-v2")
})

test("deploys conversation benchmark corpus to the benchmark bucket", () => {
  const template = synthesize()

  template.hasResourceProperties("Custom::CDKBucketDeployment", {
    DestinationBucketKeyPrefix: "corpus/conversation"
  })
})

test("keeps document ingest worker within Lambda deployment limits", () => {
  const template = synthesize()
  const workerFunction = getResourceByLogicalIdPrefix(template, "DocumentIngestRunWorkerFunction")

  assert.equal(workerFunction.Properties.MemorySize, 3008)
  assert.equal(workerFunction.Properties.Timeout, 900)
})

test("provisions tenant query indexes and uses the physical benchmark run key in every durable update", () => {
  const resources = synthesize().toJSON().Resources ?? {}
  for (const logicalIdPrefix of ["BenchmarkRunsTable", "ChatRunsTable", "DocumentIngestRunsTable", "DocumentGroupsTable"]) {
    const matches = Object.entries(resources).filter(([logicalId, resource]) => (
      logicalId.startsWith(logicalIdPrefix) && (resource as any).Type === "AWS::DynamoDB::Table"
    ))
    assert.equal(matches.length, 1, `${logicalIdPrefix} must synthesize exactly once`)
    const table = matches[0]?.[1] as any
    const tenantIndex = table.Properties.GlobalSecondaryIndexes?.find((index: any) => index.IndexName === "TenantItemIndex")
    assert.ok(tenantIndex, `${logicalIdPrefix} must expose TenantItemIndex`)
    assert.deepEqual(tenantIndex.KeySchema, [
      { AttributeName: "tenantPartitionId", KeyType: "HASH" },
      { AttributeName: "tenantItemId", KeyType: "RANGE" }
    ])
    assert.deepEqual(tenantIndex.Projection, { ProjectionType: "ALL" })
  }

  const stateMachines = Object.entries(resources).filter(([logicalId, resource]) => (
    logicalId.startsWith("BenchmarkStateMachine") && (resource as any).Type === "AWS::StepFunctions::StateMachine"
  ))
  assert.equal(stateMachines.length, 1)
  const definition = collectStringFragments((stateMachines[0]?.[1] as any).Properties.DefinitionString)
  const physicalKey = '"Key":{"runId":{"S.$":"$.storageRunId"}}'
  assert.equal(definition.split(physicalKey).length - 1, 3)
  assert.equal(definition.includes('"Key":{"runId":{"S.$":"$.runId"}}'), false)
  assert.match(definition, /"Name":"STORAGE_RUN_ID","Value\.\$":"\$\.storageRunId"/)
  assert.match(definition, /"Name":"TENANT_ID","Value\.\$":"\$\.tenantId"/)
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

function collectStringFragments(value: unknown): string {
  if (typeof value === "string") return value
  if (Array.isArray(value)) return value.map(collectStringFragments).join("")
  if (!value || typeof value !== "object") return ""
  return Object.values(value).map(collectStringFragments).join("")
}

function assertResourceTags(logicalId: string, resource: unknown, expectedTags: Record<string, string>) {
  const properties = (resource as any).Properties ?? {}
  const tags = (properties.Tags ?? properties.UserPoolTags ?? []) as unknown
  const tagMap = new Map<string, unknown>()

  if (Array.isArray(tags)) {
    for (const tag of tags) {
      tagMap.set(String((tag as any).Key), (tag as any).Value)
    }
  } else if (tags && typeof tags === "object") {
    for (const [key, value] of Object.entries(tags)) {
      tagMap.set(key, value)
    }
  }

  for (const [key, expectedValue] of Object.entries(expectedTags)) {
    assert.equal(tagMap.get(key), expectedValue, `${logicalId} should have ${key}=${expectedValue}`)
  }
}
