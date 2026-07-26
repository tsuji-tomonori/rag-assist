import * as fs from "node:fs"
import * as path from "node:path"
import * as cdk from "aws-cdk-lib"
import { Duration, RemovalPolicy, Size, Stack, type StackProps } from "aws-cdk-lib"
import * as apigw from "aws-cdk-lib/aws-apigateway"
import * as cloudfront from "aws-cdk-lib/aws-cloudfront"
import * as codebuild from "aws-cdk-lib/aws-codebuild"
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch"
import * as cloudwatchActions from "aws-cdk-lib/aws-cloudwatch-actions"
import * as origins from "aws-cdk-lib/aws-cloudfront-origins"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import * as events from "aws-cdk-lib/aws-events"
import * as eventTargets from "aws-cdk-lib/aws-events-targets"
import * as iam from "aws-cdk-lib/aws-iam"
import * as kms from "aws-cdk-lib/aws-kms"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as logs from "aws-cdk-lib/aws-logs"
import * as cognito from "aws-cdk-lib/aws-cognito"
import * as s3 from "aws-cdk-lib/aws-s3"
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment"
import * as sns from "aws-cdk-lib/aws-sns"
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions"
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager"
import * as sfn from "aws-cdk-lib/aws-stepfunctions"
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks"
import * as cr from "aws-cdk-lib/custom-resources"
import { NagSuppressions } from "cdk-nag"
import type { Construct } from "constructs"
import { APPLICATION_ROLES, COGNITO_SESSION_INVALID_AT_ATTRIBUTE_NAME } from "@memorag-mvp/contract/access-control"
import type { ApiFunctionRuntimeEnv, ApiRuntimeEnv } from "@memorag-mvp/contract/infra"

export interface MemoRagMvpStackProps extends StackProps {
  readonly includeFrontendDeployment?: boolean
}

const defaultResourceTags = {
  Project: "memorag-bedrock-mvp",
  Application: "MemoRAG",
  ManagedBy: "aws-cdk",
  Repository: "tsuji-tomonori/rag-assist"
} as const

const defaultBenchmarkSource = {
  owner: "tsuji-tomonori",
  repo: "rag-assist",
  branch: "main"
} as const

const benchmarkCodeBuildTimeout = Duration.hours(3)
const benchmarkCodeBuildTaskTimeout = Duration.hours(4)
const benchmarkStateMachineTimeout = Duration.hours(9)

function failedBenchmarkArtifactIntegrityAttribute(failureReason: string): Record<string, unknown> {
  return {
    M: {
      schemaVersion: { N: "1" },
      status: { S: "failed" },
      availableCount: { N: "0" },
      failureCount: { N: "4" },
      artifacts: {
        L: ["results", "summary", "report", "release_audit"].map((kind) => ({
          M: {
            kind: { S: kind },
            status: { S: "generation_failed" },
            failureReason: { S: failureReason }
          }
        }))
      }
    }
  }
}

export class MemoRagMvpStack extends Stack {
  constructor(scope: Construct, id: string, props?: MemoRagMvpStackProps) {
    super(scope, id, props)

    const deploymentEnvironment = String(this.node.tryGetContext("deploymentEnvironment") ?? "dev")
    const costCenter = String(this.node.tryGetContext("costCenter") ?? "memorag-mvp")
    const commonResourceTags = {
      ...defaultResourceTags,
      Environment: deploymentEnvironment,
      CostCenter: costCenter
    }
    for (const [key, value] of Object.entries(commonResourceTags)) {
      cdk.Tags.of(this).add(key, value)
    }

    const embeddingDimensions = Number(this.node.tryGetContext("embeddingDimensions") ?? 1024)
    const defaultModelId = String(this.node.tryGetContext("defaultModelId") ?? "amazon.nova-lite-v1:0")
    const embeddingModelId = String(this.node.tryGetContext("embeddingModelId") ?? "amazon.titan-embed-text-v2:0")
    const suffix = this.node.addr.slice(0, 8).toLowerCase()
    const vectorBucketName = `memorag-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}-${suffix}`
    const memoryVectorIndexName = "memory-index"
    const evidenceVectorIndexName = "evidence-index"
    const benchmarkRunnerAuthSecretIdOverride = String(this.node.tryGetContext("benchmarkRunnerAuthSecretId") ?? "")
    const benchmarkRunnerUsername = String(this.node.tryGetContext("benchmarkRunnerUsername") ?? "benchmark-runner@memorag.local")
    const defaultSupportAssigneeGroupId = String(this.node.tryGetContext("defaultSupportAssigneeGroupId") ?? "ANSWER_EDITOR")
    const ragAlertTopicArn = String(this.node.tryGetContext("ragAlertTopicArn") ?? "")
    const ragAlertEmail = String(this.node.tryGetContext("ragAlertEmail") ?? "")
    const ragWorkloadEvidenceS3Key = String(this.node.tryGetContext("ragWorkloadEvidenceS3Key") ?? "").trim()
    const ragPriceCatalogS3Key = String(this.node.tryGetContext("ragPriceCatalogS3Key") ?? "").trim()
    const ragRuntimeProfileVersion = String(this.node.tryGetContext("ragRuntimeProfileVersion") ?? "").trim()
    const ragWorkloadProfileVersion = String(this.node.tryGetContext("ragWorkloadProfileVersion") ?? "").trim()
    const ragPriceCatalogVersion = String(this.node.tryGetContext("ragPriceCatalogVersion") ?? "").trim()
    const ragIndexVersion = String(this.node.tryGetContext("ragIndexVersion") ?? "").trim()
    const ragPromptVersion = String(this.node.tryGetContext("ragPromptVersion") ?? "").trim()
    const ragPipelineVersion = String(this.node.tryGetContext("ragPipelineVersion") ?? "").trim()
    const ragParserVersion = String(this.node.tryGetContext("ragParserVersion") ?? "").trim()
    const ragChunkerVersion = String(this.node.tryGetContext("ragChunkerVersion") ?? "").trim()
    if (deploymentEnvironment === "prod" && !ragAlertTopicArn && !ragAlertEmail) {
      throw new Error("Production deployment requires ragAlertTopicArn or ragAlertEmail for the RAG quality/safety owner")
    }

    const accessLogsBucket = new s3.Bucket(this, "AccessLogsBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [{ expiration: Duration.days(90) }]
    })

    const docsBucket = new s3.Bucket(this, "DocumentsBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: "s3/documents/",
      cors: [{
        allowedMethods: [s3.HttpMethods.PUT],
        allowedOrigins: ["*"],
        allowedHeaders: ["content-type"],
        exposedHeaders: ["ETag"],
        maxAge: 900
      }],
      lifecycleRules: [{ prefix: "uploads/", expiration: Duration.days(7) }],
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    })

    const debugDownloadBucket = new s3.Bucket(this, "DebugDownloadBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: "s3/debug-downloads/",
      lifecycleRules: [{ expiration: Duration.days(7) }],
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    })

    const benchmarkBucket = new s3.Bucket(this, "BenchmarkBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: "s3/benchmark/",
      lifecycleRules: [
        { prefix: "runs/", expiration: Duration.days(30) },
        { prefix: "downloads/", expiration: Duration.days(7) }
      ],
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    })

    const frontendBucket = new s3.Bucket(this, "FrontendBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: "s3/frontend/",
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    })

    const questionsTable = new dynamodb.Table(this, "HumanQuestionsTable", {
      partitionKey: { name: "questionId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY
    })
    for (const [indexName, partitionKey] of [
      ["RequesterUpdatedAtIndex", "requesterUserId"],
      ["AssigneeUserUpdatedAtIndex", "assigneeUserId"],
      ["AssigneeGroupUpdatedAtIndex", "assigneeGroupId"],
      ["StatusUpdatedAtIndex", "status"]
    ] as const) {
      questionsTable.addGlobalSecondaryIndex({
        indexName,
        partitionKey: { name: partitionKey, type: dynamodb.AttributeType.STRING },
        sortKey: { name: "updatedAt", type: dynamodb.AttributeType.STRING },
        projectionType: dynamodb.ProjectionType.ALL
      })
    }

    const conversationHistoryTable = new dynamodb.Table(this, "ConversationHistoryTable", {
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY
    })

    const favoritesTable = new dynamodb.Table(this, "FavoritesTable", {
      partitionKey: { name: "ownerUserId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "targetKey", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY
    })

    const benchmarkRunsTable = new dynamodb.Table(this, "BenchmarkRunsTable", {
      partitionKey: { name: "runId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY
    })
    addTenantItemIndex(benchmarkRunsTable)

    const chatRunsTable = new dynamodb.Table(this, "ChatRunsTable", {
      partitionKey: { name: "runId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY
    })
    addTenantItemIndex(chatRunsTable)

    const chatRunEventsTable = new dynamodb.Table(this, "ChatRunEventsTable", {
      partitionKey: { name: "runId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "seq", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY
    })

    const usageEventsTable = new dynamodb.Table(this, "UsageEventsTable", {
      partitionKey: { name: "tenantId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "idempotencyKey", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY
    })
    usageEventsTable.addGlobalSecondaryIndex({
      indexName: "tenantId-periodKey-index",
      partitionKey: { name: "tenantId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "periodKey", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    })

    const documentIngestRunsTable = new dynamodb.Table(this, "DocumentIngestRunsTable", {
      partitionKey: { name: "runId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY
    })
    addTenantItemIndex(documentIngestRunsTable)

    const activeRunAuthorizationIndexTable = new dynamodb.Table(this, "ActiveRunAuthorizationIndexTable", {
      partitionKey: { name: "tenantPartitionId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "runKey", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY
    })

    const documentIngestRunEventsTable = new dynamodb.Table(this, "DocumentIngestRunEventsTable", {
      partitionKey: { name: "runId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "seq", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY
    })

    const documentGroupsTable = new dynamodb.Table(this, "DocumentGroupsTable", {
      partitionKey: { name: "groupId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY
    })
    documentGroupsTable.addGlobalSecondaryIndex({
      indexName: "AdminCanonicalPathIndex",
      partitionKey: { name: "adminPathPk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "normalizedCanonicalPath", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    })
    addTenantItemIndex(documentGroupsTable)

    new s3deploy.BucketDeployment(this, "DeployBenchmarkDatasets", {
      sources: [
        s3deploy.Source.data("smoke-v1.jsonl", fs.readFileSync(path.join(__dirname, "../../benchmark/dataset.sample.jsonl"), "utf-8")),
        s3deploy.Source.data("standard-v1.jsonl", fs.readFileSync(path.join(__dirname, "../../benchmark/dataset.sample.jsonl"), "utf-8")),
        s3deploy.Source.data("clarification-smoke-v1.jsonl", fs.readFileSync(path.join(__dirname, "../../benchmark/dataset.clarification.sample.jsonl"), "utf-8"))
      ],
      destinationBucket: benchmarkBucket,
      destinationKeyPrefix: "datasets/agent"
    })
    new s3deploy.BucketDeployment(this, "DeploySearchBenchmarkDatasets", {
      sources: [
        s3deploy.Source.data("smoke-v1.jsonl", fs.readFileSync(path.join(__dirname, "../../benchmark/datasets/search.sample.jsonl"), "utf-8")),
        s3deploy.Source.data("standard-v1.jsonl", fs.readFileSync(path.join(__dirname, "../../benchmark/datasets/search.sample.jsonl"), "utf-8"))
      ],
      destinationBucket: benchmarkBucket,
      destinationKeyPrefix: "datasets/search"
    })
    new s3deploy.BucketDeployment(this, "DeployConversationBenchmarkDatasets", {
      sources: [
        s3deploy.Source.data("mtrag-v1.jsonl", fs.readFileSync(path.join(__dirname, "../../benchmark/datasets/conversation/mtrag-v1.jsonl"), "utf-8")),
        s3deploy.Source.data("chatrag-bench-v1.jsonl", fs.readFileSync(path.join(__dirname, "../../benchmark/datasets/conversation/chatrag-bench-v1.jsonl"), "utf-8"))
      ],
      destinationBucket: benchmarkBucket,
      destinationKeyPrefix: "datasets/conversation"
    })
    new s3deploy.BucketDeployment(this, "DeployConversationBenchmarkCorpus", {
      sources: [
        s3deploy.Source.data("mtrag-v1/mtrag_sample_policy.md", fs.readFileSync(path.join(__dirname, "../../benchmark/corpus/mtrag-v1/mtrag_sample_policy.md"), "utf-8")),
        s3deploy.Source.data("chatrag-bench-v1/chatrag_sample_it.md", fs.readFileSync(path.join(__dirname, "../../benchmark/corpus/chatrag-bench-v1/chatrag_sample_it.md"), "utf-8"))
      ],
      destinationBucket: benchmarkBucket,
      destinationKeyPrefix: "corpus/conversation"
    })

    const s3VectorsProviderLogGroup = new logs.LogGroup(this, "S3VectorsProviderLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const s3VectorsProviderFn = new lambda.Function(this, "S3VectorsProviderFn", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda-dist/s3-vectors-provider")),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: Duration.minutes(2),
      logGroup: s3VectorsProviderLogGroup
    })
    s3VectorsProviderFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3vectors:*"],
        resources: ["*"]
      })
    )

    const s3VectorsFrameworkLogGroup = new logs.LogGroup(this, "S3VectorsProviderFrameworkLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const s3VectorsProvider = new cr.Provider(this, "S3VectorsProvider", {
      onEventHandler: s3VectorsProviderFn,
      logGroup: s3VectorsFrameworkLogGroup
    })

    new cdk.CustomResource(this, "S3VectorsResources", {
      serviceToken: s3VectorsProvider.serviceToken,
      properties: {
        vectorBucketName,
        indexNames: [memoryVectorIndexName, evidenceVectorIndexName],
        dimension: embeddingDimensions,
        distanceMetric: "cosine"
      }
    })


    const userPool = new cognito.UserPool(this, "UserPool", {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: false, otp: true },
      passwordPolicy: { minLength: 12, requireLowercase: true, requireUppercase: true, requireDigits: true, requireSymbols: true },
      customAttributes: {
        [COGNITO_SESSION_INVALID_AT_ATTRIBUTE_NAME]: new cognito.NumberAttribute({ mutable: true, min: 0 })
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const userPoolResource = userPool.node.defaultChild as cognito.CfnUserPool
    userPoolResource.addPropertyOverride("UserPoolTags", commonResourceTags)

    const userPoolClient = userPool.addClient("WebClient", {
      authFlows: { userPassword: true, userSrp: true },
      generateSecret: false,
      preventUserExistenceErrors: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30)
    })

    userPool.addDomain("UserPoolDomain", {
      cognitoDomain: { domainPrefix: `memorag-${suffix}` }
    })

    for (const role of APPLICATION_ROLES) {
      new cognito.CfnUserPoolGroup(this, `${role.replaceAll("_", "")}Group`, {
        userPoolId: userPool.userPoolId,
        groupName: role,
        description: `MemoRAG role: ${role}`
      })
    }

    const benchmarkRunnerAuthSecret = benchmarkRunnerAuthSecretIdOverride
      ? (benchmarkRunnerAuthSecretIdOverride.startsWith("arn:")
          ? secretsmanager.Secret.fromSecretCompleteArn(this, "BenchmarkRunnerAuthSecret", benchmarkRunnerAuthSecretIdOverride)
          : secretsmanager.Secret.fromSecretNameV2(this, "BenchmarkRunnerAuthSecret", benchmarkRunnerAuthSecretIdOverride))
      : new secretsmanager.Secret(this, "BenchmarkRunnerAuthSecret", {
          description: "MemoRAG benchmark runner Cognito service user credentials",
          generateSecretString: {
            secretStringTemplate: JSON.stringify({ username: benchmarkRunnerUsername }),
            generateStringKey: "password",
            passwordLength: 32,
            excludeCharacters: ",`$\\\"' \n\r\t"
          }
        })
    if (!benchmarkRunnerAuthSecretIdOverride) {
      NagSuppressions.addResourceSuppressions(
        benchmarkRunnerAuthSecret,
        [
          {
            id: "AwsSolutions-SMG4",
            reason: "The generated benchmark runner service-user secret is repaired by the CodeBuild runner and is not tied to a managed database rotation target; automatic rotation is deferred for MVP cost and operational simplicity."
          }
        ],
        true
      )
    }
    const benchmarkRunnerAuthSecretId = benchmarkRunnerAuthSecretIdOverride || benchmarkRunnerAuthSecret.secretArn

    const apiLogGroup = new logs.LogGroup(this, "ApiFunctionLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const apiEnvironment = {
      NODE_ENV: "production",
      USE_LOCAL_VECTOR_STORE: "false",
      MOCK_BEDROCK: "false",
      DOCS_BUCKET_NAME: docsBucket.bucketName,
      QUESTION_TABLE_NAME: questionsTable.tableName,
      DEFAULT_SUPPORT_ASSIGNEE_GROUP_ID: defaultSupportAssigneeGroupId,
      CONVERSATION_HISTORY_TABLE_NAME: conversationHistoryTable.tableName,
      FAVORITES_TABLE_NAME: favoritesTable.tableName,
      BENCHMARK_RUNS_TABLE_NAME: benchmarkRunsTable.tableName,
      ACTIVE_RUN_AUTHORIZATION_INDEX_TABLE_NAME: activeRunAuthorizationIndexTable.tableName,
      CHAT_RUNS_TABLE_NAME: chatRunsTable.tableName,
      CHAT_RUN_EVENTS_TABLE_NAME: chatRunEventsTable.tableName,
      USAGE_EVENTS_TABLE_NAME: usageEventsTable.tableName,
      USAGE_ACCOUNTING_MODE: "shadow",
      DOCUMENT_INGEST_RUNS_TABLE_NAME: documentIngestRunsTable.tableName,
      DOCUMENT_INGEST_RUN_EVENTS_TABLE_NAME: documentIngestRunEventsTable.tableName,
      DOCUMENT_GROUPS_TABLE_NAME: documentGroupsTable.tableName,
      BENCHMARK_BUCKET_NAME: benchmarkBucket.bucketName,
      BENCHMARK_DEFAULT_DATASET_KEY: "datasets/agent/standard-v1.jsonl",
      BENCHMARK_DOWNLOAD_EXPIRES_IN_SECONDS: "900",
      USE_LOCAL_BENCHMARK_RUN_STORE: "false",
      USE_LOCAL_CHAT_RUN_STORE: "false",
      USE_LOCAL_USAGE_EVENT_STORE: "false",
      USAGE_PRICING_CATALOG_JSON: "[]",
      VECTOR_BUCKET_NAME: vectorBucketName,
      MEMORY_VECTOR_INDEX_NAME: memoryVectorIndexName,
      EVIDENCE_VECTOR_INDEX_NAME: evidenceVectorIndexName,
      DEFAULT_MODEL_ID: defaultModelId,
      DEFAULT_MEMORY_MODEL_ID: defaultModelId,
      EMBEDDING_MODEL_ID: embeddingModelId,
      EMBEDDING_DIMENSIONS: String(embeddingDimensions),
      MIN_RETRIEVAL_SCORE: "0.20",
      AUTH_ENABLED: "true",
      AUTH_TENANT_ID: cdk.Aws.ACCOUNT_ID,
      BENCHMARK_EVALUATION_ENABLED: "true",
      BENCHMARK_EVALUATION_TENANT_ID: `benchmark-${cdk.Aws.ACCOUNT_ID}`,
      CORS_ALLOWED_ORIGINS: "*",
      COGNITO_REGION: cdk.Aws.REGION,
      COGNITO_USER_POOL_ID: userPool.userPoolId,
      COGNITO_APP_CLIENT_ID: userPoolClient.userPoolClientId,
      DEBUG_DOWNLOAD_BUCKET_NAME: debugDownloadBucket.bucketName,
      DEBUG_DOWNLOAD_EXPIRES_IN_SECONDS: "900",
      RAG_MONITORING_REQUIRED: "1",
      RAG_SAFETY_STATE_TTL_SECONDS: "600"
    } satisfies ApiRuntimeEnv
    const apiFunctionEnvironment = {
      ...apiEnvironment,
      PDF_OCR_FALLBACK_ENABLED: "true",
      PDF_OCR_FALLBACK_TIMEOUT_MS: "45000"
    } satisfies ApiFunctionRuntimeEnv
    const syncApiTimeout = Duration.seconds(60)
    const apiFn = new lambda.Function(this, "ApiFunction", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda-dist/api")),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 1024,
      timeout: syncApiTimeout,
      logGroup: apiLogGroup,
      environment: apiFunctionEnvironment
    })
    const heavyApiLogGroup = new logs.LogGroup(this, "HeavyApiFunctionLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const heavyApiFn = new lambda.Function(this, "HeavyApiFunction", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda-dist/api")),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 3008,
      timeout: syncApiTimeout,
      logGroup: heavyApiLogGroup,
      environment: apiFunctionEnvironment
    })
    const apiFns = [apiFn, heavyApiFn]

    const chatRunWorkerLogGroup = new logs.LogGroup(this, "ChatRunWorkerLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const chatRunWorkerFn = new lambda.Function(this, "ChatRunWorkerFunction", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda-dist/chat-run-worker")),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 1024,
      timeout: Duration.minutes(15),
      logGroup: chatRunWorkerLogGroup,
      environment: apiEnvironment
    })

    const chatRunMarkFailedLogGroup = new logs.LogGroup(this, "ChatRunMarkFailedLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const chatRunMarkFailedFn = new lambda.Function(this, "ChatRunMarkFailedFunction", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda-dist/chat-run-mark-failed")),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(29),
      logGroup: chatRunMarkFailedLogGroup,
      environment: apiEnvironment
    })

    const chatRunEventsLogGroup = new logs.LogGroup(this, "ChatRunEventsStreamLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const chatRunEventsFn = new lambda.Function(this, "ChatRunEventsStreamFunction", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda-dist/chat-run-events-stream")),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.minutes(15),
      logGroup: chatRunEventsLogGroup,
      environment: apiEnvironment
    })

    const documentIngestRunWorkerLogGroup = new logs.LogGroup(this, "DocumentIngestRunWorkerLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const documentIngestRunWorkerFn = new lambda.Function(this, "DocumentIngestRunWorkerFunction", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda-dist/document-ingest-run-worker")),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 3008,
      timeout: Duration.minutes(15),
      ephemeralStorageSize: Size.gibibytes(4),
      logGroup: documentIngestRunWorkerLogGroup,
      environment: apiFunctionEnvironment
    })

    const documentIngestRunMarkFailedLogGroup = new logs.LogGroup(this, "DocumentIngestRunMarkFailedLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const documentIngestRunMarkFailedFn = new lambda.Function(this, "DocumentIngestRunMarkFailedFunction", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda-dist/document-ingest-run-mark-failed")),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(29),
      logGroup: documentIngestRunMarkFailedLogGroup,
      environment: apiEnvironment
    })

    const benchmarkRunAuthorizationLogGroup = new logs.LogGroup(this, "BenchmarkRunAuthorizationLogGroup", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.RETAIN
    })
    const benchmarkRunAuthorizationFn = new lambda.Function(this, "BenchmarkRunAuthorizationFunction", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda-dist/benchmark-run-authorization-worker")),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(29),
      logGroup: benchmarkRunAuthorizationLogGroup,
      environment: apiEnvironment
    })

    const revocationCleanupLogGroup = new logs.LogGroup(this, "RevocationCleanupLogGroup", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.RETAIN
    })
    const revocationCleanupFn = new lambda.Function(this, "RevocationCleanupFunction", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda-dist/revocation-cleanup-worker")),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 1024,
      timeout: Duration.minutes(5),
      logGroup: revocationCleanupLogGroup,
      environment: apiEnvironment
    })
    const revocationCleanupSchedule = new events.Rule(this, "RevocationCleanupSchedule", {
      description: "Reconcile tenant-scoped deny-first revocation cleanup manifests.",
      schedule: events.Schedule.rate(Duration.minutes(1))
    })
    revocationCleanupSchedule.addTarget(new eventTargets.LambdaFunction(revocationCleanupFn, {
      event: events.RuleTargetInput.fromObject({ limitPerTenant: 100 })
    }))

    const securityAuditReconciliationLogGroup = new logs.LogGroup(this, "SecurityAuditReconciliationLogGroup", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.RETAIN
    })
    const securityAuditReconciliationFn = new lambda.Function(this, "SecurityAuditReconciliationFunction", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda-dist/security-mutation-audit-reconciliation-worker")),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.minutes(1),
      logGroup: securityAuditReconciliationLogGroup,
      environment: apiEnvironment
    })
    const securityAuditReconciliationSchedule = new events.Rule(this, "SecurityAuditReconciliationSchedule", {
      description: "Finalize tenant-scoped security mutation audits after authoritative state reconciliation.",
      schedule: events.Schedule.rate(Duration.minutes(1))
    })
    securityAuditReconciliationSchedule.addTarget(new eventTargets.LambdaFunction(securityAuditReconciliationFn, {
      event: events.RuleTargetInput.fromObject({ tenantId: cdk.Aws.ACCOUNT_ID, limit: 100 })
    }))

    const ragQualityMonitorLogGroup = new logs.LogGroup(this, "RagQualityMonitorLogGroup", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.RETAIN
    })
    const ragQualityMonitorFn = new lambda.Function(this, "RagQualityMonitorFunction", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda-dist/rag-quality-monitor-worker")),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.minutes(5),
      logGroup: ragQualityMonitorLogGroup,
      environment: apiEnvironment
    })
    const ragQualityMonitorSchedule = new events.Rule(this, "RagQualityMonitorSchedule", {
      description: "Evaluate production RAG quality/security signals and apply the approved safety runbook.",
      schedule: events.Schedule.rate(Duration.minutes(5))
    })
    ragQualityMonitorSchedule.addTarget(new eventTargets.LambdaFunction(ragQualityMonitorFn, {
      event: events.RuleTargetInput.fromObject({ windowMinutes: 5 })
    }))

    const createdRagAlertTopic = ragAlertTopicArn
      ? undefined
      : new sns.Topic(this, "RagQualityAlertTopic", {
          displayName: "MemoRAG production quality and safety alerts"
        })
    const ragAlertTopic = ragAlertTopicArn
      ? sns.Topic.fromTopicArn(this, "RagQualityAlertTopic", ragAlertTopicArn)
      : createdRagAlertTopic as sns.Topic
    createdRagAlertTopic?.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      principals: [new iam.AnyPrincipal()],
      actions: ["sns:Publish"],
      resources: [createdRagAlertTopic.topicArn],
      conditions: { Bool: { "aws:SecureTransport": "false" } }
    }))
    if (!ragAlertTopicArn && ragAlertEmail) ragAlertTopic.addSubscription(new subscriptions.EmailSubscription(ragAlertEmail))
    ragQualityMonitorFn.addEnvironment("RAG_ALERT_TOPIC_ARN", ragAlertTopic.topicArn)
    ragAlertTopic.grantPublish(ragQualityMonitorFn)

    const ragControlLoopFailureAlarm = new cloudwatch.Alarm(this, "RagQualityControlLoopFailureAlarm", {
      metric: new cloudwatch.Metric({
        namespace: "MemoRAG/QualityControl",
        metricName: "ControlLoopFailure",
        statistic: "Sum",
        period: Duration.minutes(5)
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING
    })
    const ragCriticalAlertAlarm = new cloudwatch.Alarm(this, "RagQualityCriticalAlertAlarm", {
      metric: new cloudwatch.Metric({
        namespace: "MemoRAG/QualityControl",
        metricName: "CriticalAlertCount",
        statistic: "Sum",
        period: Duration.minutes(5)
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    })
    const ragMonitorLambdaErrorAlarm = new cloudwatch.Alarm(this, "RagQualityMonitorLambdaErrorAlarm", {
      metric: ragQualityMonitorFn.metricErrors({ period: Duration.minutes(5), statistic: "Sum" }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    })
    const revocationCleanupLambdaErrorAlarm = new cloudwatch.Alarm(this, "RevocationCleanupLambdaErrorAlarm", {
      metric: revocationCleanupFn.metricErrors({ period: Duration.minutes(5), statistic: "Sum" }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING
    })
    for (const alarm of [ragControlLoopFailureAlarm, ragCriticalAlertAlarm, ragMonitorLambdaErrorAlarm, revocationCleanupLambdaErrorAlarm]) {
      alarm.addAlarmAction(new cloudwatchActions.SnsAction(ragAlertTopic))
    }

    for (const fn of apiFns) {
      docsBucket.grantReadWrite(fn)
      debugDownloadBucket.grantReadWrite(fn)
      benchmarkBucket.grantRead(fn)
      questionsTable.grantReadWriteData(fn)
      conversationHistoryTable.grantReadWriteData(fn)
      favoritesTable.grantReadWriteData(fn)
      benchmarkRunsTable.grantReadWriteData(fn)
      chatRunsTable.grantReadWriteData(fn)
      chatRunEventsTable.grantReadWriteData(fn)
      usageEventsTable.grantReadWriteData(fn)
      documentIngestRunsTable.grantReadWriteData(fn)
      documentIngestRunEventsTable.grantReadWriteData(fn)
      documentGroupsTable.grantReadWriteData(fn)
      activeRunAuthorizationIndexTable.grantReadWriteData(fn)
    }
    docsBucket.grantReadWrite(chatRunWorkerFn)
    docsBucket.grantReadWrite(documentIngestRunWorkerFn)
    docsBucket.grantReadWrite(ragQualityMonitorFn)
    const revocationCleanupLedgerPatterns = [
      "security/revocation-cleanup/*",
      "security/revocation-cleanup-repairs/*",
      "security/revocation-cleanup-tenants/*",
      "security/revocation-cleanup-tenant-registry-state/*"
    ]
    const revocationCleanupTargetPatterns = [
      "security/account-revocations/*",
      "tenant-artifacts/*",
      "embedding-cache/*",
      "debug-runs/*",
      "quality-control/source-samples/*",
      "source-governance/*",
      "documents/share-grants/*",
      "publication/active/*"
    ]
    const revocationCleanupDocumentPatterns = [
      ...revocationCleanupLedgerPatterns,
      ...revocationCleanupTargetPatterns
    ]
    revocationCleanupFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["s3:ListBucket"],
      resources: [docsBucket.bucketArn],
      conditions: { StringLike: { "s3:prefix": revocationCleanupDocumentPatterns } }
    }))
    revocationCleanupFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["s3:GetObject"],
      resources: revocationCleanupDocumentPatterns.map((pattern) => docsBucket.arnForObjects(pattern))
    }))
    revocationCleanupFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["s3:DeleteObject"],
      resources: revocationCleanupTargetPatterns.map((pattern) => docsBucket.arnForObjects(pattern))
    }))
    docsBucket.grantPut(revocationCleanupFn, "security/revocation-cleanup/*")
    docsBucket.grantPut(revocationCleanupFn, "security/revocation-cleanup-repairs/*")
    docsBucket.grantPut(revocationCleanupFn, "security/revocation-cleanup-tenants/*")
    docsBucket.grantPut(revocationCleanupFn, "security/revocation-cleanup-tenant-registry-state/*")
    const securityAuditObjectPatterns = [
      `security-audit/intents/${cdk.Aws.ACCOUNT_ID}/*`,
      `source-governance/${cdk.Aws.ACCOUNT_ID}/*`
    ]
    securityAuditReconciliationFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["s3:ListBucket"],
      resources: [docsBucket.bucketArn],
      conditions: {
        StringLike: {
          "s3:prefix": securityAuditObjectPatterns
        }
      }
    }))
    securityAuditReconciliationFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["s3:GetObject", "s3:PutObject"],
      resources: securityAuditObjectPatterns.map((pattern) => docsBucket.arnForObjects(pattern))
    }))
    revocationCleanupFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["s3:ListBucket"],
      resources: [benchmarkBucket.bucketArn],
      conditions: { StringLike: { "s3:prefix": ["runs/*"] } }
    }))
    revocationCleanupFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["s3:GetObject", "s3:DeleteObject"],
      resources: [benchmarkBucket.arnForObjects("runs/*")]
    }))
    debugDownloadBucket.grantReadWrite(chatRunWorkerFn)
    chatRunsTable.grantReadWriteData(chatRunWorkerFn)
    activeRunAuthorizationIndexTable.grantReadWriteData(chatRunWorkerFn)
    chatRunsTable.grantReadWriteData(chatRunMarkFailedFn)
    activeRunAuthorizationIndexTable.grantReadWriteData(chatRunMarkFailedFn)
    chatRunsTable.grantReadData(chatRunEventsFn)
    chatRunEventsTable.grantReadWriteData(chatRunWorkerFn)
    usageEventsTable.grantReadWriteData(chatRunWorkerFn)
    chatRunEventsTable.grantReadWriteData(chatRunMarkFailedFn)
    chatRunEventsTable.grantReadData(chatRunEventsFn)
    documentIngestRunsTable.grantReadWriteData(documentIngestRunWorkerFn)
    activeRunAuthorizationIndexTable.grantReadWriteData(documentIngestRunWorkerFn)
    documentIngestRunsTable.grantReadWriteData(documentIngestRunMarkFailedFn)
    activeRunAuthorizationIndexTable.grantReadWriteData(documentIngestRunMarkFailedFn)
    documentIngestRunEventsTable.grantReadWriteData(documentIngestRunWorkerFn)
    documentIngestRunEventsTable.grantReadWriteData(documentIngestRunMarkFailedFn)
    benchmarkRunsTable.grantReadWriteData(benchmarkRunAuthorizationFn)
    activeRunAuthorizationIndexTable.grantReadWriteData(benchmarkRunAuthorizationFn)
    revocationCleanupFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query", "dynamodb:PutItem", "dynamodb:DeleteItem"],
      resources: [activeRunAuthorizationIndexTable.tableArn]
    }))
    for (const table of [benchmarkRunsTable, chatRunsTable, documentIngestRunsTable]) {
      revocationCleanupFn.addToRolePolicy(new iam.PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:UpdateItem", "dynamodb:DescribeTable"],
        resources: [table.tableArn, `${table.tableArn}/index/*`]
      }))
    }
    revocationCleanupFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:DescribeTable"],
      resources: [documentGroupsTable.tableArn, `${documentGroupsTable.tableArn}/index/*`]
    }))
    docsBucket.grantRead(benchmarkRunAuthorizationFn, "security/revocation-cleanup/*")
    docsBucket.grantPut(benchmarkRunAuthorizationFn, "security/revocation-cleanup/*")
    benchmarkBucket.grantRead(benchmarkRunAuthorizationFn, "runs/*")
    benchmarkBucket.grantDelete(benchmarkRunAuthorizationFn, "runs/*")
    documentGroupsTable.grantReadData(chatRunWorkerFn)
    documentGroupsTable.grantReadData(documentIngestRunWorkerFn)
    for (const fn of [...apiFns, chatRunWorkerFn, documentIngestRunWorkerFn]) {
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
          resources: ["*"]
        })
      )
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["s3vectors:PutVectors", "s3vectors:QueryVectors", "s3vectors:GetVectors", "s3vectors:DeleteVectors", "s3vectors:ListVectors"],
          resources: ["*"]
        })
      )
    }
    revocationCleanupFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3vectors:GetVectors", "s3vectors:DeleteVectors"],
        resources: ["*"]
      })
    )
    for (const fn of apiFns) {
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
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
          ],
          resources: [userPool.userPoolArn]
        })
      )
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["textract:DetectDocumentText", "textract:StartDocumentTextDetection", "textract:GetDocumentTextDetection"],
          resources: ["*"]
        })
      )
    }
    for (const fn of [chatRunWorkerFn, documentIngestRunWorkerFn, benchmarkRunAuthorizationFn, revocationCleanupFn]) {
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["cognito-idp:ListUsers", "cognito-idp:AdminGetUser", "cognito-idp:AdminListGroupsForUser"],
          resources: [userPool.userPoolArn]
        })
      )
    }
    revocationCleanupFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cognito-idp:AdminUpdateUserAttributes", "cognito-idp:AdminUserGlobalSignOut"],
        resources: [userPool.userPoolArn]
      })
    )
    documentIngestRunWorkerFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["textract:DetectDocumentText", "textract:StartDocumentTextDetection", "textract:GetDocumentTextDetection"],
        resources: ["*"]
      })
    )

    const apiAccessLogGroup = new logs.LogGroup(this, "RestApiAccessLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const restApi = new apigw.RestApi(this, "RestApi", {
      endpointTypes: [apigw.EndpointType.REGIONAL],
      deployOptions: {
        stageName: "prod",
        loggingLevel: apigw.MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
        metricsEnabled: true,
        accessLogDestination: new apigw.LogGroupLogDestination(apiAccessLogGroup),
        accessLogFormat: apigw.AccessLogFormat.jsonWithStandardFields({
          caller: false,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true
        })
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization", "Last-Event-ID"],
        maxAge: Duration.days(1)
      }
    })
    const restApiBaseUrl = `https://${restApi.restApiId}.execute-api.${cdk.Aws.REGION}.${cdk.Aws.URL_SUFFIX}/prod/`
    const restApiCorsGatewayResponseHeaders = {
      "Access-Control-Allow-Origin": "'*'",
      "Access-Control-Allow-Headers": "'Content-Type, Authorization, Last-Event-ID'",
      "Access-Control-Allow-Methods": "'GET, POST, DELETE, OPTIONS'"
    }
    restApi.addGatewayResponse("Default4xxGatewayResponse", {
      type: apigw.ResponseType.DEFAULT_4XX,
      responseHeaders: restApiCorsGatewayResponseHeaders
    })
    restApi.addGatewayResponse("Default5xxGatewayResponse", {
      type: apigw.ResponseType.DEFAULT_5XX,
      responseHeaders: restApiCorsGatewayResponseHeaders
    })
    const restApiRequestValidator = restApi.addRequestValidator("RequestValidator", {
      requestValidatorName: "basic-request-validator",
      validateRequestBody: true,
      validateRequestParameters: true
    })

    const restAuthorizer = new apigw.CognitoUserPoolsAuthorizer(this, "RestApiCognitoAuthorizer", {
      cognitoUserPools: [userPool]
    })
    const apiMethodOptions: apigw.MethodOptions = {
      authorizationType: apigw.AuthorizationType.COGNITO,
      authorizer: restAuthorizer,
      requestValidator: restApiRequestValidator
    }
    const apiIntegration = new apigw.LambdaIntegration(apiFn, {
      proxy: true,
      timeout: syncApiTimeout
    })
    const heavyApiIntegration = new apigw.LambdaIntegration(heavyApiFn, {
      proxy: true,
      timeout: syncApiTimeout
    })
    restApi.root.addMethod("ANY", apiIntegration, apiMethodOptions)
    const proxy = restApi.root.addResource("{proxy+}")
    proxy.addMethod("ANY", apiIntegration, apiMethodOptions)
    addApiMethod(restApi, "POST", "/chat", heavyApiIntegration, apiMethodOptions)
    addApiMethod(restApi, "POST", "/search", heavyApiIntegration, apiMethodOptions)
    addApiMethod(restApi, "POST", "/benchmark/query", heavyApiIntegration, apiMethodOptions)
    addApiMethod(restApi, "POST", "/benchmark/search", heavyApiIntegration, apiMethodOptions)
    addApiMethod(restApi, "GET", "/documents", apiIntegration, apiMethodOptions)
    addApiMethod(restApi, "POST", "/documents", heavyApiIntegration, apiMethodOptions)
    addApiMethod(restApi, "POST", "/documents/uploads", apiIntegration, apiMethodOptions)
    addApiMethod(restApi, "POST", "/documents/uploads/{uploadId}/content", heavyApiIntegration, apiMethodOptions)
    addApiMethod(restApi, "POST", "/documents/uploads/{uploadId}/ingest", heavyApiIntegration, apiMethodOptions)
    addApiMethod(restApi, "DELETE", "/documents/{documentId}", apiIntegration, apiMethodOptions)
    addApiMethod(restApi, "POST", "/documents/{documentId}/reindex", heavyApiIntegration, apiMethodOptions)
    addApiMethod(restApi, "GET", "/documents/reindex-migrations", apiIntegration, apiMethodOptions)
    addApiMethod(restApi, "POST", "/documents/{documentId}/reindex/stage", heavyApiIntegration, apiMethodOptions)
    addApiMethod(restApi, "POST", "/documents/reindex-migrations/{migrationId}/cutover", heavyApiIntegration, apiMethodOptions)
    addApiMethod(restApi, "POST", "/documents/reindex-migrations/{migrationId}/rollback", heavyApiIntegration, apiMethodOptions)

    const chatRuns = restApi.root.addResource("chat-runs")
    chatRuns.addMethod("POST", apiIntegration, apiMethodOptions)
    const chatRun = chatRuns.addResource("{runId}")
    const chatRunEvents = chatRun.addResource("events")
    chatRunEvents.addMethod(
      "GET",
      new apigw.LambdaIntegration(chatRunEventsFn, {
        proxy: true,
        responseTransferMode: apigw.ResponseTransferMode.STREAM,
        timeout: Duration.minutes(15)
      }),
      apiMethodOptions
    )

    const chatRunWorkerTask = new tasks.LambdaInvoke(this, "ChatRunWorkerTask", {
      lambdaFunction: chatRunWorkerFn,
      payload: sfn.TaskInput.fromObject({
        runId: sfn.JsonPath.stringAt("$.runId"),
        tenantId: sfn.JsonPath.stringAt("$.tenantId")
      }),
      resultPath: "$.worker"
    })
    const chatRunMarkFailedTask = new tasks.LambdaInvoke(this, "ChatRunMarkFailedTask", {
      lambdaFunction: chatRunMarkFailedFn,
      payload: sfn.TaskInput.fromObject({
        runId: sfn.JsonPath.stringAt("$.runId"),
        tenantId: sfn.JsonPath.stringAt("$.tenantId"),
        errorInfo: sfn.JsonPath.objectAt("$.errorInfo")
      }),
      resultPath: "$.markFailed"
    })
    chatRunWorkerTask.addCatch(chatRunMarkFailedTask, {
      errors: ["States.ALL"],
      resultPath: "$.errorInfo"
    })
    const chatRunStateMachineLogGroup = new logs.LogGroup(this, "ChatRunStateMachineLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const chatRunStateMachine = new sfn.StateMachine(this, "ChatRunStateMachine", {
      definitionBody: sfn.DefinitionBody.fromChainable(chatRunWorkerTask),
      logs: {
        destination: chatRunStateMachineLogGroup,
        level: sfn.LogLevel.ALL
      },
      timeout: Duration.minutes(16)
    })
    chatRunWorkerFn.grantInvoke(chatRunStateMachine)
    chatRunMarkFailedFn.grantInvoke(chatRunStateMachine)
    for (const fn of apiFns) {
      chatRunStateMachine.grantStartExecution(fn)
      fn.addEnvironment("CHAT_RUN_STATE_MACHINE_ARN", chatRunStateMachine.stateMachineArn)
    }
    NagSuppressions.addResourceSuppressions(
      chatRunStateMachine,
      [
        {
          id: "AwsSolutions-SF2",
          reason: "X-Ray tracing is intentionally disabled for the MVP chat worker; CloudWatch ALL event logging is retained for troubleshooting."
        }
      ],
      true
    )

    const documentIngestRunWorkerTask = new tasks.LambdaInvoke(this, "DocumentIngestRunWorkerTask", {
      lambdaFunction: documentIngestRunWorkerFn,
      payload: sfn.TaskInput.fromObject({
        runId: sfn.JsonPath.stringAt("$.runId"),
        tenantId: sfn.JsonPath.stringAt("$.tenantId")
      }),
      resultPath: "$.worker"
    })
    const documentIngestRunMarkFailedTask = new tasks.LambdaInvoke(this, "DocumentIngestRunMarkFailedTask", {
      lambdaFunction: documentIngestRunMarkFailedFn,
      payload: sfn.TaskInput.fromObject({
        runId: sfn.JsonPath.stringAt("$.runId"),
        tenantId: sfn.JsonPath.stringAt("$.tenantId"),
        errorInfo: sfn.JsonPath.objectAt("$.errorInfo")
      }),
      resultPath: "$.markFailed"
    })
    documentIngestRunWorkerTask.addCatch(documentIngestRunMarkFailedTask, {
      errors: ["States.ALL"],
      resultPath: "$.errorInfo"
    })
    const documentIngestRunStateMachineLogGroup = new logs.LogGroup(this, "DocumentIngestRunStateMachineLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const documentIngestRunStateMachine = new sfn.StateMachine(this, "DocumentIngestRunStateMachine", {
      definitionBody: sfn.DefinitionBody.fromChainable(documentIngestRunWorkerTask),
      logs: {
        destination: documentIngestRunStateMachineLogGroup,
        level: sfn.LogLevel.ALL
      },
      timeout: Duration.minutes(16)
    })
    documentIngestRunWorkerFn.grantInvoke(documentIngestRunStateMachine)
    documentIngestRunMarkFailedFn.grantInvoke(documentIngestRunStateMachine)
    for (const fn of apiFns) {
      documentIngestRunStateMachine.grantStartExecution(fn)
      fn.addEnvironment("DOCUMENT_INGEST_RUN_STATE_MACHINE_ARN", documentIngestRunStateMachine.stateMachineArn)
    }
    NagSuppressions.addResourceSuppressions(
      documentIngestRunStateMachine,
      [
        {
          id: "AwsSolutions-SF2",
          reason: "X-Ray tracing is intentionally disabled for the MVP ingest worker; CloudWatch ALL event logging is retained for troubleshooting."
        }
      ],
      true
    )

    const benchmarkProjectKey = new kms.Key(this, "BenchmarkProjectKey", {
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const benchmarkProjectLogGroup = new logs.LogGroup(this, "BenchmarkProjectLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const benchmarkProject = new codebuild.Project(this, "BenchmarkProject", {
      source: codebuild.Source.gitHub({
        owner: defaultBenchmarkSource.owner,
        repo: defaultBenchmarkSource.repo,
        branchOrRef: defaultBenchmarkSource.branch
      }),
      encryptionKey: benchmarkProjectKey,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
        privileged: false,
        environmentVariables: {
          COGNITO_USER_POOL_ID: { value: userPool.userPoolId },
          COGNITO_APP_CLIENT_ID: { value: userPoolClient.userPoolClientId },
          BENCHMARK_AUTH_SECRET_ID: { value: benchmarkRunnerAuthSecretId },
          BENCHMARK_RUNNER_GROUP: { value: "BENCHMARK_RUNNER" },
          BENCHMARK_RUNS_TABLE_NAME: { value: benchmarkRunsTable.tableName },
          BENCHMARK_CODEBUILD_LOG_GROUP_NAME: { value: benchmarkProjectLogGroup.logGroupName },
          BENCHMARK_BUCKET_NAME: { value: benchmarkBucket.bucketName },
          BENCHMARK_AUTHORIZATION_FUNCTION_NAME: { value: benchmarkRunAuthorizationFn.functionName },
          ...(ragWorkloadEvidenceS3Key ? { RAG_WORKLOAD_EVIDENCE_S3_KEY: { value: ragWorkloadEvidenceS3Key } } : {}),
          ...(ragPriceCatalogS3Key ? { RAG_PRICE_CATALOG_S3_KEY: { value: ragPriceCatalogS3Key } } : {}),
          ...(ragRuntimeProfileVersion ? { RAG_RUNTIME_PROFILE_VERSION: { value: ragRuntimeProfileVersion } } : {}),
          ...(ragWorkloadProfileVersion ? { RAG_WORKLOAD_PROFILE_VERSION: { value: ragWorkloadProfileVersion } } : {}),
          ...(ragPriceCatalogVersion ? { RAG_PRICE_CATALOG_VERSION: { value: ragPriceCatalogVersion } } : {}),
          ...(ragIndexVersion ? { RAG_INDEX_VERSION: { value: ragIndexVersion } } : {}),
          ...(ragPromptVersion ? { RAG_PROMPT_VERSION: { value: ragPromptVersion } } : {}),
          ...(ragPipelineVersion ? { RAG_PIPELINE_VERSION: { value: ragPipelineVersion } } : {}),
          ...(ragParserVersion ? { RAG_PARSER_VERSION: { value: ragParserVersion } } : {}),
          ...(ragChunkerVersion ? { RAG_CHUNKER_VERSION: { value: ragChunkerVersion } } : {})
        }
      },
      timeout: benchmarkCodeBuildTimeout,
      logging: {
        cloudWatch: {
          logGroup: benchmarkProjectLogGroup
        }
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        env: { shell: "bash" },
        phases: {
          install: {
            "runtime-versions": { nodejs: 22 },
            commands: [
              "set -euo pipefail",
              "LOG_URL=\"${CODEBUILD_BUILD_URL:-https://${AWS_DEFAULT_REGION}.console.aws.amazon.com/codesuite/codebuild/projects/${CODEBUILD_PROJECT_NAME}/build/${CODEBUILD_BUILD_ID}/log?region=${AWS_DEFAULT_REGION}}\"",
              "if [[ \"$CODEBUILD_LOG_PATH\" == *:* ]]; then LOG_GROUP_NAME=\"${CODEBUILD_LOG_PATH%%:*}\"; LOG_STREAM_NAME=\"${CODEBUILD_LOG_PATH#*:}\"; else LOG_GROUP_NAME=\"$BENCHMARK_CODEBUILD_LOG_GROUP_NAME\"; LOG_STREAM_NAME=\"$CODEBUILD_LOG_PATH\"; fi",
              "node infra/scripts/authorize-benchmark-boundary.mjs durable_commit build-metadata",
              "aws dynamodb update-item --table-name \"$BENCHMARK_RUNS_TABLE_NAME\" --key \"{\\\"runId\\\":{\\\"S\\\":\\\"$STORAGE_RUN_ID\\\"}}\" --condition-expression \"#status = :running\" --expression-attribute-names \"{\\\"#status\\\":\\\"status\\\"}\" --update-expression \"SET codeBuildBuildId = :buildId, codeBuildLogUrl = :logUrl, codeBuildLogGroupName = :logGroupName, codeBuildLogStreamName = :logStreamName\" --expression-attribute-values \"{\\\":running\\\":{\\\"S\\\":\\\"running\\\"},\\\":buildId\\\":{\\\"S\\\":\\\"$CODEBUILD_BUILD_ID\\\"},\\\":logUrl\\\":{\\\"S\\\":\\\"$LOG_URL\\\"},\\\":logGroupName\\\":{\\\"S\\\":\\\"$LOG_GROUP_NAME\\\"},\\\":logStreamName\\\":{\\\"S\\\":\\\"$LOG_STREAM_NAME\\\"}}\" >/dev/null",
              "cd \"$CODEBUILD_SRC_DIR\"",
              "npm ci"
            ]
          },
          pre_build: {
            commands: [
              "set -euo pipefail",
              "cd \"$CODEBUILD_SRC_DIR\"",
              "export OUTPUT=./benchmark/.runner-results.jsonl",
              "export SUMMARY=./benchmark/.runner-summary.json",
              "export REPORT=./benchmark/.runner-report.md",
              "export DATASET=./benchmark/.runner-dataset.jsonl",
              "export RAG_WORKLOAD_EVIDENCE_PATH=./benchmark/.workload-evidence.json",
              "export RAG_PRICE_CATALOG_PATH=./benchmark/.price-catalog.json",
              "node -e 'process.stdout.write(JSON.stringify({ tenantId: process.env.TENANT_ID, runId: process.env.RUN_ID, boundary: \"protected_read\" }))' > /tmp/benchmark-authorize-protected-read.json",
              "AUTHORIZATION_FUNCTION_ERROR=\"$(aws lambda invoke --function-name \"$BENCHMARK_AUTHORIZATION_FUNCTION_NAME\" --cli-binary-format raw-in-base64-out --payload fileb:///tmp/benchmark-authorize-protected-read.json --query FunctionError --output text /tmp/benchmark-authorize-protected-read-response.json)\"",
              "if [ \"$AUTHORIZATION_FUNCTION_ERROR\" != \"None\" ]; then exit 1; fi",
              "node -e 'const value = JSON.parse(require(\"node:fs\").readFileSync(\"/tmp/benchmark-authorize-protected-read-response.json\", \"utf-8\")); if (value.authorized !== true || value.boundary !== \"protected_read\" || value.runId !== process.env.RUN_ID || value.tenantId !== process.env.TENANT_ID) process.exit(1)'",
              "if [ -n \"${RAG_WORKLOAD_EVIDENCE_S3_KEY:-}\" ]; then node infra/scripts/authorize-benchmark-boundary.mjs protected_read workload-evidence; aws s3 cp \"s3://$BENCHMARK_BUCKET_NAME/$RAG_WORKLOAD_EVIDENCE_S3_KEY\" \"$RAG_WORKLOAD_EVIDENCE_PATH\"; fi",
              "if [ -n \"${RAG_PRICE_CATALOG_S3_KEY:-}\" ]; then node infra/scripts/authorize-benchmark-boundary.mjs protected_read price-catalog; aws s3 cp \"s3://$BENCHMARK_BUCKET_NAME/$RAG_PRICE_CATALOG_S3_KEY\" \"$RAG_PRICE_CATALOG_PATH\"; fi",
              "export BENCHMARK_SUITE_ID=\"$SUITE_ID\"",
              "node -e 'process.stdout.write(JSON.stringify({ tenantId: process.env.TENANT_ID, runId: process.env.RUN_ID, boundary: \"external_side_effect\" }))' > /tmp/benchmark-authorize-prepare-external-side-effect.json",
              "AUTHORIZATION_FUNCTION_ERROR=\"$(aws lambda invoke --function-name \"$BENCHMARK_AUTHORIZATION_FUNCTION_NAME\" --cli-binary-format raw-in-base64-out --payload fileb:///tmp/benchmark-authorize-prepare-external-side-effect.json --query FunctionError --output text /tmp/benchmark-authorize-prepare-external-side-effect-response.json)\"",
              "if [ \"$AUTHORIZATION_FUNCTION_ERROR\" != \"None\" ]; then exit 1; fi",
              "node -e 'const value = JSON.parse(require(\"node:fs\").readFileSync(\"/tmp/benchmark-authorize-prepare-external-side-effect-response.json\", \"utf-8\")); if (value.authorized !== true || value.boundary !== \"external_side_effect\" || value.runId !== process.env.RUN_ID || value.tenantId !== process.env.TENANT_ID) process.exit(1)'",
              "npm run codebuild:prepare -w @memorag-mvp/benchmark",
              "node infra/scripts/authorize-benchmark-boundary.mjs protected_read runner-token",
              "API_AUTH_TOKEN=\"$(node infra/scripts/resolve-benchmark-auth-token.mjs)\"",
              "export API_AUTH_TOKEN"
            ]
          },
          build: {
            commands: [
              "set -euo pipefail",
              "cd \"$CODEBUILD_SRC_DIR\"",
              "node -e 'process.stdout.write(JSON.stringify({ tenantId: process.env.TENANT_ID, runId: process.env.RUN_ID, boundary: \"external_side_effect\" }))' > /tmp/benchmark-authorize-run-external-side-effect.json",
              "AUTHORIZATION_FUNCTION_ERROR=\"$(aws lambda invoke --function-name \"$BENCHMARK_AUTHORIZATION_FUNCTION_NAME\" --cli-binary-format raw-in-base64-out --payload fileb:///tmp/benchmark-authorize-run-external-side-effect.json --query FunctionError --output text /tmp/benchmark-authorize-run-external-side-effect-response.json)\"",
              "if [ \"$AUTHORIZATION_FUNCTION_ERROR\" != \"None\" ]; then exit 1; fi",
              "node -e 'const value = JSON.parse(require(\"node:fs\").readFileSync(\"/tmp/benchmark-authorize-run-external-side-effect-response.json\", \"utf-8\")); if (value.authorized !== true || value.boundary !== \"external_side_effect\" || value.runId !== process.env.RUN_ID || value.tenantId !== process.env.TENANT_ID) process.exit(1)'",
              "npm run codebuild:run -w @memorag-mvp/benchmark"
            ]
          },
          post_build: {
            commands: [
              "set -euo pipefail",
              "cd \"$CODEBUILD_SRC_DIR\"",
              "export RELEASE_AUDIT=./benchmark/.release-audit.json",
              "export RESULTS_ARTIFACT_STATUS=generation_failed SUMMARY_ARTIFACT_STATUS=generation_failed REPORT_ARTIFACT_STATUS=generation_failed RELEASE_AUDIT_ARTIFACT_STATUS=generation_failed RELEASE_AUDIT_GENERATED=0",
              "if [ -f \"$SUMMARY\" ] && npm run release:audit -w @memorag-mvp/benchmark -- --summary \"$SUMMARY\" --source-root apps/api/src --source-root apps/web/src --output \"$RELEASE_AUDIT\" --report-only; then export RELEASE_AUDIT_GENERATED=1; fi",
              "node -e 'process.stdout.write(JSON.stringify({ tenantId: process.env.TENANT_ID, runId: process.env.RUN_ID, boundary: \"durable_commit\" }))' > /tmp/benchmark-authorize-artifact-durable-commit.json",
              "AUTHORIZATION_FUNCTION_ERROR=\"$(aws lambda invoke --function-name \"$BENCHMARK_AUTHORIZATION_FUNCTION_NAME\" --cli-binary-format raw-in-base64-out --payload fileb:///tmp/benchmark-authorize-artifact-durable-commit.json --query FunctionError --output text /tmp/benchmark-authorize-artifact-durable-commit-response.json)\"",
              "if [ \"$AUTHORIZATION_FUNCTION_ERROR\" != \"None\" ]; then exit 1; fi",
              "node -e 'const value = JSON.parse(require(\"node:fs\").readFileSync(\"/tmp/benchmark-authorize-artifact-durable-commit-response.json\", \"utf-8\")); if (value.authorized !== true || value.boundary !== \"durable_commit\" || value.runId !== process.env.RUN_ID || value.tenantId !== process.env.TENANT_ID) process.exit(1)'",
              "if [ -f \"$OUTPUT\" ]; then node infra/scripts/authorize-benchmark-boundary.mjs durable_commit results-artifact; if aws s3 cp \"$OUTPUT\" \"$OUTPUT_S3_PREFIX/results.jsonl\"; then export RESULTS_ARTIFACT_STATUS=available; else export RESULTS_ARTIFACT_STATUS=upload_failed; fi; fi",
              "if [ -f \"$SUMMARY\" ]; then node infra/scripts/authorize-benchmark-boundary.mjs durable_commit summary-artifact; if aws s3 cp \"$SUMMARY\" \"$OUTPUT_S3_PREFIX/summary.json\"; then export SUMMARY_ARTIFACT_STATUS=available; else export SUMMARY_ARTIFACT_STATUS=upload_failed; fi; fi",
              "if [ -f \"$REPORT\" ]; then node infra/scripts/authorize-benchmark-boundary.mjs durable_commit report-artifact; if aws s3 cp \"$REPORT\" \"$OUTPUT_S3_PREFIX/report.md\"; then export REPORT_ARTIFACT_STATUS=available; else export REPORT_ARTIFACT_STATUS=upload_failed; fi; fi",
              "if [ \"$RELEASE_AUDIT_GENERATED\" = \"1\" ] && [ -f \"$RELEASE_AUDIT\" ]; then node infra/scripts/authorize-benchmark-boundary.mjs durable_commit release-audit-artifact; if aws s3 cp \"$RELEASE_AUDIT\" \"$OUTPUT_S3_PREFIX/release-audit.json\"; then export RELEASE_AUDIT_ARTIFACT_STATUS=available; else export RELEASE_AUDIT_ARTIFACT_STATUS=upload_failed; fi; fi",
              "node infra/scripts/authorize-benchmark-boundary.mjs durable_commit artifact-integrity-update",
              "node infra/scripts/update-benchmark-run-artifacts.mjs",
              "node infra/scripts/authorize-benchmark-boundary.mjs durable_commit metrics-update",
              "node infra/scripts/update-benchmark-run-metrics.mjs"
            ]
          }
        },
        artifacts: { files: ["benchmark/.runner-results.jsonl", "benchmark/.runner-summary.json", "benchmark/.runner-report.md", "benchmark/.release-audit.json"] }
      })
    })
    benchmarkBucket.grantReadWrite(benchmarkProject)
    benchmarkRunAuthorizationFn.grantInvoke(benchmarkProject)
    benchmarkProject.addToRolePolicy(new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [benchmarkRunsTable.tableArn]
    }))
    benchmarkRunnerAuthSecret.grantRead(benchmarkProject)
    benchmarkProject.addToRolePolicy(new iam.PolicyStatement({
      actions: ["cognito-idp:InitiateAuth"],
      resources: ["*"]
    }))
    benchmarkProject.addToRolePolicy(new iam.PolicyStatement({
      actions: ["cognito-idp:AdminGetUser", "cognito-idp:AdminCreateUser", "cognito-idp:AdminSetUserPassword", "cognito-idp:AdminAddUserToGroup"],
      resources: [userPool.userPoolArn]
    }))

    const markRunning = new sfn.CustomState(this, "BenchmarkMarkRunning", {
      stateJson: {
        Type: "Task",
        Resource: "arn:aws:states:::dynamodb:updateItem",
        Parameters: {
          TableName: benchmarkRunsTable.tableName,
          Key: { runId: { "S.$": "$.storageRunId" } },
          ConditionExpression: "#status = :queued",
          UpdateExpression: "SET #status = :status, startedAt = :startedAt, updatedAt = :startedAt",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":status": { S: "running" },
            ":queued": { S: "queued" },
            ":startedAt": { "S.$": "$$.State.EnteredTime" }
          }
        },
        ResultPath: "$.markRunning"
      }
    })
    const startBenchmarkBuild = new sfn.CustomState(this, "BenchmarkStartCodeBuild", {
      stateJson: {
        Type: "Task",
        Resource: "arn:aws:states:::codebuild:startBuild.sync",
        TimeoutSeconds: benchmarkCodeBuildTaskTimeout.toSeconds(),
        Parameters: {
          ProjectName: benchmarkProject.projectName,
          EnvironmentVariablesOverride: [
            { Name: "RUN_ID", "Value.$": "$.runId", Type: "PLAINTEXT" },
            { Name: "STORAGE_RUN_ID", "Value.$": "$.storageRunId", Type: "PLAINTEXT" },
            { Name: "TENANT_ID", "Value.$": "$.tenantId", Type: "PLAINTEXT" },
            { Name: "MODE", "Value.$": "$.mode", Type: "PLAINTEXT" },
            { Name: "SUITE_ID", "Value.$": "$.suiteId", Type: "PLAINTEXT" },
            { Name: "DATASET_S3_URI", "Value.$": "$.datasetS3Uri", Type: "PLAINTEXT" },
            { Name: "OUTPUT_S3_PREFIX", "Value.$": "$.outputS3Prefix", Type: "PLAINTEXT" },
            { Name: "API_BASE_URL", "Value.$": "$.apiBaseUrl", Type: "PLAINTEXT" },
            { Name: "MODEL_ID", "Value.$": "$.modelId", Type: "PLAINTEXT" },
            { Name: "EMBEDDING_MODEL_ID", "Value.$": "$.embeddingModelId", Type: "PLAINTEXT" },
            { Name: "TOP_K", "Value.$": "States.Format('{}', $.topK)", Type: "PLAINTEXT" },
            { Name: "MEMORY_TOP_K", "Value.$": "States.Format('{}', $.memoryTopK)", Type: "PLAINTEXT" },
            { Name: "MIN_SCORE", "Value.$": "States.Format('{}', $.minScore)", Type: "PLAINTEXT" }
          ]
        },
        ResultPath: "$.build"
      }
    })
    const markSucceeded = new sfn.CustomState(this, "BenchmarkMarkSucceeded", {
      stateJson: {
        Type: "Task",
        Resource: "arn:aws:states:::dynamodb:updateItem",
        Parameters: {
          TableName: benchmarkRunsTable.tableName,
          Key: { runId: { "S.$": "$.storageRunId" } },
          ConditionExpression: "#status = :running AND #artifactIntegrity.#integrityStatus = :complete",
          UpdateExpression: "SET #status = :status, completedAt = :completedAt, updatedAt = :completedAt, codeBuildBuildId = :codeBuildBuildId, summaryS3Key = :summaryS3Key, reportS3Key = :reportS3Key, resultsS3Key = :resultsS3Key",
          ExpressionAttributeNames: { "#status": "status", "#artifactIntegrity": "artifactIntegrity", "#integrityStatus": "status" },
          ExpressionAttributeValues: {
            ":status": { S: "succeeded" },
            ":running": { S: "running" },
            ":complete": { S: "complete" },
            ":completedAt": { "S.$": "$$.State.EnteredTime" },
            ":codeBuildBuildId": { "S.$": "$.build.Build.Id" },
            ":summaryS3Key": { "S.$": "$.summaryS3Key" },
            ":reportS3Key": { "S.$": "$.reportS3Key" },
            ":resultsS3Key": { "S.$": "$.resultsS3Key" }
          }
        },
        End: true
      }
    })
    const markFailed = new sfn.CustomState(this, "BenchmarkMarkFailed", {
      stateJson: {
        Type: "Task",
        Resource: "arn:aws:states:::dynamodb:updateItem",
        Parameters: {
          TableName: benchmarkRunsTable.tableName,
          Key: { runId: { "S.$": "$.storageRunId" } },
          ConditionExpression: "#status IN (:queued, :running)",
          UpdateExpression: "SET #status = :status, completedAt = if_not_exists(completedAt, :completedAt), updatedAt = :completedAt, #error = if_not_exists(#error, :error), #artifactIntegrity = if_not_exists(#artifactIntegrity, :artifactIntegrity)",
          ExpressionAttributeNames: { "#status": "status", "#error": "error", "#artifactIntegrity": "artifactIntegrity" },
          ExpressionAttributeValues: {
            ":status": { S: "failed" },
            ":queued": { S: "queued" },
            ":running": { S: "running" },
            ":completedAt": { "S.$": "$$.State.EnteredTime" },
            ":error": { "S.$": "States.JsonToString($.errorInfo)" },
            ":artifactIntegrity": failedBenchmarkArtifactIntegrityAttribute("run_failed_before_artifact_state")
          }
        },
        End: true
      }
    })
    const markTimedOut = new sfn.CustomState(this, "BenchmarkMarkTimedOut", {
      stateJson: {
        Type: "Task",
        Resource: "arn:aws:states:::dynamodb:updateItem",
        Parameters: {
          TableName: benchmarkRunsTable.tableName,
          Key: { runId: { "S.$": "$.storageRunId" } },
          ConditionExpression: "#status = :running",
          UpdateExpression: "SET #status = :status, completedAt = :completedAt, updatedAt = :completedAt, #error = :error, #artifactIntegrity = if_not_exists(#artifactIntegrity, :artifactIntegrity)",
          ExpressionAttributeNames: { "#status": "status", "#error": "error", "#artifactIntegrity": "artifactIntegrity" },
          ExpressionAttributeValues: {
            ":status": { S: "timed_out" },
            ":running": { S: "running" },
            ":completedAt": { "S.$": "$$.State.EnteredTime" },
            ":error": { S: "benchmark_run_timed_out" },
            ":artifactIntegrity": failedBenchmarkArtifactIntegrityAttribute("run_timed_out")
          }
        },
        End: true
      }
    })
    const classifyBenchmarkBuildFailure = new sfn.Choice(this, "ClassifyBenchmarkBuildFailure")
      .when(sfn.Condition.or(
        sfn.Condition.stringEquals("$.errorInfo.Error", "States.Timeout"),
        sfn.Condition.and(
          sfn.Condition.isPresent("$.errorInfo.Cause"),
          sfn.Condition.stringMatches("$.errorInfo.Cause", "*TIMED_OUT*")
        )
      ), markTimedOut)
      .otherwise(markFailed)
    const authorizeBenchmarkStart = new tasks.LambdaInvoke(this, "BenchmarkAuthorizeStart", {
      lambdaFunction: benchmarkRunAuthorizationFn,
      payload: sfn.TaskInput.fromObject({
        runId: sfn.JsonPath.stringAt("$.runId"),
        tenantId: sfn.JsonPath.stringAt("$.tenantId"),
        boundary: "start"
      }),
      payloadResponseOnly: true,
      resultPath: sfn.JsonPath.DISCARD
    })
    const authorizeBenchmarkCommit = new tasks.LambdaInvoke(this, "BenchmarkAuthorizeCommit", {
      lambdaFunction: benchmarkRunAuthorizationFn,
      payload: sfn.TaskInput.fromObject({
        runId: sfn.JsonPath.stringAt("$.runId"),
        tenantId: sfn.JsonPath.stringAt("$.tenantId"),
        boundary: "durable_commit"
      }),
      payloadResponseOnly: true,
      resultPath: sfn.JsonPath.DISCARD
    })
    authorizeBenchmarkStart.addCatch(markFailed, { resultPath: "$.errorInfo" })
    startBenchmarkBuild.addCatch(classifyBenchmarkBuildFailure, { resultPath: "$.errorInfo" })
    authorizeBenchmarkCommit.addCatch(markFailed, { resultPath: "$.errorInfo" })

    const benchmarkStateMachineLogGroup = new logs.LogGroup(this, "BenchmarkStateMachineLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const benchmarkStateMachine = new sfn.StateMachine(this, "BenchmarkStateMachine", {
      definitionBody: sfn.DefinitionBody.fromChainable(
        authorizeBenchmarkStart
          .next(markRunning)
          .next(startBenchmarkBuild)
          .next(authorizeBenchmarkCommit)
          .next(markSucceeded)
      ),
      logs: {
        destination: benchmarkStateMachineLogGroup,
        level: sfn.LogLevel.ALL
      },
      timeout: benchmarkStateMachineTimeout
    })
    NagSuppressions.addResourceSuppressions(
      benchmarkStateMachine,
      [
        {
          id: "AwsSolutions-SF2",
          reason: "X-Ray tracing is intentionally disabled for the MVP benchmark runner to avoid trace-based costs; CloudWatch ALL event logging is retained for audit and troubleshooting."
        }
      ],
      true
    )
    benchmarkRunsTable.grantWriteData(benchmarkStateMachine)
    benchmarkStateMachine.addToRolePolicy(new iam.PolicyStatement({
      actions: ["codebuild:StartBuild", "codebuild:BatchGetBuilds", "codebuild:StopBuild"],
      resources: [benchmarkProject.projectArn]
    }))
    benchmarkStateMachine.addToRolePolicy(new iam.PolicyStatement({
      actions: ["events:PutTargets", "events:PutRule", "events:DescribeRule"],
      resources: ["*"]
    }))
    for (const fn of apiFns) {
      fn.addEnvironment("BENCHMARK_STATE_MACHINE_ARN", benchmarkStateMachine.stateMachineArn)
      fn.addEnvironment("BENCHMARK_TARGET_API_BASE_URL", restApiBaseUrl)
      benchmarkStateMachine.grantStartExecution(fn)
      benchmarkStateMachine.grant(fn, "states:StopExecution", "states:DescribeExecution")
    }
    const benchmarkProjectLogStreamArn = cdk.Stack.of(this).formatArn({
      service: "logs",
      resource: "log-group",
      resourceName: `${benchmarkProjectLogGroup.logGroupName}:log-stream:*`,
      arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME
    })
    for (const fn of apiFns) {
      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: ["logs:GetLogEvents"],
        resources: [benchmarkProjectLogStreamArn]
      }))
      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: ["codebuild:BatchGetBuilds"],
        resources: [benchmarkProject.projectArn]
      }))
    }

    const distribution = new cloudfront.Distribution(this, "FrontendDistribution", {
      defaultRootObject: "index.html",
      enableLogging: true,
      logBucket: accessLogsBucket,
      logFilePrefix: "cloudfront/frontend/",
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" }
      ]
    })

    const webDist = path.join(__dirname, "../../apps/web/dist")
    const includeFrontendDeployment = props?.includeFrontendDeployment ?? fs.existsSync(webDist)
    if (includeFrontendDeployment) {
      new s3deploy.BucketDeployment(this, "DeployFrontend", {
        sources: [
          s3deploy.Source.asset(webDist),
          s3deploy.Source.jsonData("config.json", {
            apiBaseUrl: restApiBaseUrl,
            authMode: "cognito",
            cognitoRegion: cdk.Aws.REGION,
            cognitoUserPoolId: userPool.userPoolId,
            cognitoUserPoolClientId: userPoolClient.userPoolClientId
          })
        ],
        destinationBucket: frontendBucket,
        distribution,
        distributionPaths: ["/*"]
      })
    }

    new cdk.CfnOutput(this, "CognitoUserPoolId", { value: userPool.userPoolId })
    new cdk.CfnOutput(this, "CognitoUserPoolClientId", { value: userPoolClient.userPoolClientId })

    NagSuppressions.addStackSuppressions(
      this,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "CDK-managed Lambda basic execution and bucket deployment provider roles are acceptable for this MVP; application permissions are separately scoped in code."
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "Bedrock model ARNs, Textract document text APIs, S3 object grants, CloudFront invalidation, and S3 Vectors currently require wildcard or generated-object patterns in this MVP."
        },
        {
          id: "AwsSolutions-CFR2",
          reason: "AWS WAF is deferred for MVP cost control; production should attach a managed-rule WebACL."
        },
        {
          id: "AwsSolutions-CFR1",
          reason: "Geo restriction is a business policy decision and is not required for this internal MVP."
        },
        {
          id: "AwsSolutions-CFR4",
          reason: "The MVP uses the default CloudFront certificate; production should use a custom domain certificate with TLSv1.2_2021 or later."
        },
        {
          id: "AwsSolutions-S1",
          reason: "The centralized access log bucket cannot log to itself without recursive log generation."
        },
        {
          id: "AwsSolutions-L1",
          reason: "Application and CDK provider Lambdas use nodejs22.x, which is current for this stack even though this cdk-nag version still flags it."
        },
        {
          id: "AwsSolutions-COG8",
          reason: "Cognito Plus tier is intentionally not enabled to avoid additional recurring costs in this MVP; strong password policy and MFA are enabled as compensating controls."
        }
      ],
      true
    )

    new cdk.CfnOutput(this, "ApiUrl", { value: restApiBaseUrl })
    new cdk.CfnOutput(this, "OpenApiUrl", { value: `${restApiBaseUrl}openapi.json` })
    new cdk.CfnOutput(this, "FrontendUrl", { value: `https://${distribution.distributionDomainName}` })
    new cdk.CfnOutput(this, "VectorBucketName", { value: vectorBucketName })
    new cdk.CfnOutput(this, "MemoryVectorIndexName", { value: memoryVectorIndexName })
    new cdk.CfnOutput(this, "EvidenceVectorIndexName", { value: evidenceVectorIndexName })
    new cdk.CfnOutput(this, "DocumentsBucketName", { value: docsBucket.bucketName })
  }
}

function addTenantItemIndex(table: dynamodb.Table): void {
  table.addGlobalSecondaryIndex({
    indexName: "TenantItemIndex",
    partitionKey: { name: "tenantPartitionId", type: dynamodb.AttributeType.STRING },
    sortKey: { name: "tenantItemId", type: dynamodb.AttributeType.STRING },
    projectionType: dynamodb.ProjectionType.ALL
  })
}

function addApiMethod(
  restApi: apigw.RestApi,
  method: string,
  routePath: string,
  integration: apigw.Integration,
  options: apigw.MethodOptions
): apigw.Method {
  const resource = restApi.root.resourceForPath(routePath.replace(/^\//, ""))
  return resource.addMethod(method, integration, options)
}
