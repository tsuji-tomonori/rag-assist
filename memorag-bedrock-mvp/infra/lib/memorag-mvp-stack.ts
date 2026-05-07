import * as fs from "node:fs"
import * as path from "node:path"
import * as cdk from "aws-cdk-lib"
import { Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib"
import * as apigw from "aws-cdk-lib/aws-apigateway"
import * as cloudfront from "aws-cdk-lib/aws-cloudfront"
import * as codebuild from "aws-cdk-lib/aws-codebuild"
import * as origins from "aws-cdk-lib/aws-cloudfront-origins"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import * as iam from "aws-cdk-lib/aws-iam"
import * as kms from "aws-cdk-lib/aws-kms"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as logs from "aws-cdk-lib/aws-logs"
import * as cognito from "aws-cdk-lib/aws-cognito"
import * as s3 from "aws-cdk-lib/aws-s3"
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment"
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager"
import * as sfn from "aws-cdk-lib/aws-stepfunctions"
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks"
import * as cr from "aws-cdk-lib/custom-resources"
import { NagSuppressions } from "cdk-nag"
import type { Construct } from "constructs"

export interface MemoRagMvpStackProps extends StackProps {
  readonly includeFrontendDeployment?: boolean
}

const appRoles = [
  "CHAT_USER",
  "ANSWER_EDITOR",
  "RAG_GROUP_MANAGER",
  "BENCHMARK_OPERATOR",
  "BENCHMARK_RUNNER",
  "USER_ADMIN",
  "ACCESS_ADMIN",
  "COST_AUDITOR",
  "SYSTEM_ADMIN"
] as const

const defaultResourceTags = {
  Project: "memorag-bedrock-mvp",
  Application: "MemoRAG",
  ManagedBy: "aws-cdk",
  Repository: "tsuji-tomonori/rag-assist"
} as const

const benchmarkCodeBuildTimeout = Duration.hours(8)
const benchmarkStateMachineTimeout = Duration.hours(9)

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
    const benchmarkSourceOwner = String(this.node.tryGetContext("benchmarkSourceOwner") ?? "tsuji-tomonori")
    const benchmarkSourceRepo = String(this.node.tryGetContext("benchmarkSourceRepo") ?? "rag-assist")
    const benchmarkSourceBranch = String(this.node.tryGetContext("benchmarkSourceBranch") ?? "main")

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

    const conversationHistoryTable = new dynamodb.Table(this, "ConversationHistoryTable", {
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "id", type: dynamodb.AttributeType.STRING },
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

    const chatRunsTable = new dynamodb.Table(this, "ChatRunsTable", {
      partitionKey: { name: "runId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY
    })

    const chatRunEventsTable = new dynamodb.Table(this, "ChatRunEventsTable", {
      partitionKey: { name: "runId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "seq", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY
    })

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
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: false, otp: true },
      passwordPolicy: { minLength: 12, requireLowercase: true, requireUppercase: true, requireDigits: true, requireSymbols: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const userPoolResource = userPool.node.defaultChild as cognito.CfnUserPool
    userPoolResource.addPropertyOverride("UserPoolTags", commonResourceTags)

    const signupRoleAssignmentLogGroup = new logs.LogGroup(this, "SignupRoleAssignmentLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const signupRoleAssignmentFn = new lambda.Function(this, "SignupRoleAssignmentFunction", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda-dist/cognito-post-confirmation")),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: Duration.seconds(10),
      logGroup: signupRoleAssignmentLogGroup,
      environment: {
        DEFAULT_SIGNUP_GROUP_NAME: "CHAT_USER"
      }
    })
    signupRoleAssignmentFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cognito-idp:AdminAddUserToGroup"],
        resources: [
          Stack.of(this).formatArn({
            service: "cognito-idp",
            resource: "userpool",
            resourceName: "*"
          })
        ]
      })
    )
    userPool.addTrigger(cognito.UserPoolOperation.POST_CONFIRMATION, signupRoleAssignmentFn)

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

    for (const role of appRoles) {
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
      CONVERSATION_HISTORY_TABLE_NAME: conversationHistoryTable.tableName,
      BENCHMARK_RUNS_TABLE_NAME: benchmarkRunsTable.tableName,
      CHAT_RUNS_TABLE_NAME: chatRunsTable.tableName,
      CHAT_RUN_EVENTS_TABLE_NAME: chatRunEventsTable.tableName,
      BENCHMARK_BUCKET_NAME: benchmarkBucket.bucketName,
      BENCHMARK_DEFAULT_DATASET_KEY: "datasets/agent/standard-v1.jsonl",
      BENCHMARK_DOWNLOAD_EXPIRES_IN_SECONDS: "900",
      USE_LOCAL_QUESTION_STORE: "false",
      USE_LOCAL_CONVERSATION_HISTORY_STORE: "false",
      USE_LOCAL_BENCHMARK_RUN_STORE: "false",
      USE_LOCAL_CHAT_RUN_STORE: "false",
      VECTOR_BUCKET_NAME: vectorBucketName,
      MEMORY_VECTOR_INDEX_NAME: memoryVectorIndexName,
      EVIDENCE_VECTOR_INDEX_NAME: evidenceVectorIndexName,
      DEFAULT_MODEL_ID: defaultModelId,
      DEFAULT_MEMORY_MODEL_ID: defaultModelId,
      EMBEDDING_MODEL_ID: embeddingModelId,
      EMBEDDING_DIMENSIONS: String(embeddingDimensions),
      MIN_RETRIEVAL_SCORE: "0.20",
      AUTH_ENABLED: "true",
      COGNITO_REGION: cdk.Aws.REGION,
      COGNITO_USER_POOL_ID: userPool.userPoolId,
      COGNITO_APP_CLIENT_ID: userPoolClient.userPoolClientId,
      DEBUG_DOWNLOAD_BUCKET_NAME: debugDownloadBucket.bucketName,
      DEBUG_DOWNLOAD_EXPIRES_IN_SECONDS: "900"
    }
    const apiFunctionEnvironment = {
      ...apiEnvironment,
      PDF_OCR_FALLBACK_ENABLED: "true",
      PDF_OCR_FALLBACK_TIMEOUT_MS: "45000"
    }
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

    docsBucket.grantReadWrite(apiFn)
    docsBucket.grantReadWrite(chatRunWorkerFn)
    debugDownloadBucket.grantReadWrite(apiFn)
    debugDownloadBucket.grantReadWrite(chatRunWorkerFn)
    benchmarkBucket.grantRead(apiFn)
    questionsTable.grantReadWriteData(apiFn)
    conversationHistoryTable.grantReadWriteData(apiFn)
    benchmarkRunsTable.grantReadWriteData(apiFn)
    chatRunsTable.grantReadWriteData(apiFn)
    chatRunsTable.grantReadWriteData(chatRunWorkerFn)
    chatRunsTable.grantReadWriteData(chatRunMarkFailedFn)
    chatRunsTable.grantReadData(chatRunEventsFn)
    chatRunEventsTable.grantReadWriteData(apiFn)
    chatRunEventsTable.grantReadWriteData(chatRunWorkerFn)
    chatRunEventsTable.grantReadWriteData(chatRunMarkFailedFn)
    chatRunEventsTable.grantReadData(chatRunEventsFn)
    for (const fn of [apiFn, chatRunWorkerFn]) {
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
    apiFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cognito-idp:ListUsers", "cognito-idp:AdminListGroupsForUser", "cognito-idp:AdminAddUserToGroup", "cognito-idp:AdminRemoveUserFromGroup"],
        resources: [userPool.userPoolArn]
      })
    )
    apiFn.addToRolePolicy(
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
    restApi.root.addMethod("ANY", apiIntegration, apiMethodOptions)
    const proxy = restApi.root.addResource("{proxy+}")
    proxy.addMethod("ANY", apiIntegration, apiMethodOptions)

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
        runId: sfn.JsonPath.stringAt("$.runId")
      }),
      resultPath: "$.worker"
    })
    const chatRunMarkFailedTask = new tasks.LambdaInvoke(this, "ChatRunMarkFailedTask", {
      lambdaFunction: chatRunMarkFailedFn,
      payload: sfn.TaskInput.fromObject({
        runId: sfn.JsonPath.stringAt("$.runId"),
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
    chatRunStateMachine.grantStartExecution(apiFn)
    apiFn.addEnvironment("CHAT_RUN_STATE_MACHINE_ARN", chatRunStateMachine.stateMachineArn)
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

    const benchmarkProjectKey = new kms.Key(this, "BenchmarkProjectKey", {
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const benchmarkProject = new codebuild.Project(this, "BenchmarkProject", {
      source: codebuild.Source.gitHub({
        owner: benchmarkSourceOwner,
        repo: benchmarkSourceRepo,
        branchOrRef: benchmarkSourceBranch
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
          BENCHMARK_RUNS_TABLE_NAME: { value: benchmarkRunsTable.tableName }
        }
      },
      timeout: benchmarkCodeBuildTimeout,
      logging: {
        cloudWatch: {
          logGroup: new logs.LogGroup(this, "BenchmarkProjectLogGroup", {
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: RemovalPolicy.DESTROY
          })
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
              "aws dynamodb update-item --table-name \"$BENCHMARK_RUNS_TABLE_NAME\" --key \"{\\\"runId\\\":{\\\"S\\\":\\\"$RUN_ID\\\"}}\" --update-expression \"SET codeBuildBuildId = :buildId, codeBuildLogUrl = :logUrl\" --expression-attribute-values \"{\\\":buildId\\\":{\\\"S\\\":\\\"$CODEBUILD_BUILD_ID\\\"},\\\":logUrl\\\":{\\\"S\\\":\\\"$LOG_URL\\\"}}\" >/dev/null",
              "cd \"$CODEBUILD_SRC_DIR/memorag-bedrock-mvp\"",
              "npm ci"
            ]
          },
          pre_build: {
            commands: [
              "set -euo pipefail",
              "cd \"$CODEBUILD_SRC_DIR/memorag-bedrock-mvp\"",
              "export OUTPUT=./benchmark/.runner-results.jsonl",
              "export SUMMARY=./benchmark/.runner-summary.json",
              "export REPORT=./benchmark/.runner-report.md",
              "export DATASET=./benchmark/.runner-dataset.jsonl",
              "export BENCHMARK_SUITE_ID=\"$SUITE_ID\"",
              "if [ \"$SUITE_ID\" = \"standard-agent-v1\" ] || [ \"$SUITE_ID\" = \"smoke-agent-v1\" ] || [ \"$SUITE_ID\" = \"clarification-smoke-v1\" ] || [ \"$SUITE_ID\" = \"search-standard-v1\" ] || [ \"$SUITE_ID\" = \"search-smoke-v1\" ]; then export BENCHMARK_CORPUS_DIR=benchmark/corpus/standard-agent-v1; export BENCHMARK_CORPUS_SUITE_ID=standard-agent-v1; fi",
              "if [ \"$SUITE_ID\" = \"allganize-rag-evaluation-ja-v1\" ]; then export ALLGANIZE_RAG_DATASET_OUTPUT=\"$DATASET\"; export ALLGANIZE_RAG_CORPUS_DIR=./benchmark/.runner-allganize-corpus; export BENCHMARK_CORPUS_DIR=\"$ALLGANIZE_RAG_CORPUS_DIR\"; npm run prepare:allganize-ja -w @memorag-mvp/benchmark; elif [ \"$SUITE_ID\" = \"mmrag-docqa-v1\" ]; then export MMRAG_DOCQA_DATASET_OUTPUT=\"$DATASET\"; export MMRAG_DOCQA_CORPUS_DIR=./benchmark/.runner-mmrag-docqa-corpus; export BENCHMARK_CORPUS_DIR=\"$MMRAG_DOCQA_CORPUS_DIR\"; export BENCHMARK_CORPUS_SUITE_ID=mmrag-docqa-v1; npm run prepare:mmrag-docqa -w @memorag-mvp/benchmark; else aws s3 cp \"$DATASET_S3_URI\" \"$DATASET\"; fi",
              "API_AUTH_TOKEN=\"$(node infra/scripts/resolve-benchmark-auth-token.mjs)\"",
              "export API_AUTH_TOKEN"
            ]
          },
          build: {
            commands: [
              "set -euo pipefail",
              "cd \"$CODEBUILD_SRC_DIR/memorag-bedrock-mvp\"",
              "if [ \"$MODE\" = \"search\" ]; then API_BASE_URL=\"$API_BASE_URL\" EMBEDDING_MODEL_ID=\"$EMBEDDING_MODEL_ID\" TOP_K=\"$TOP_K\" npm run start:search -w @memorag-mvp/benchmark; else API_BASE_URL=\"$API_BASE_URL\" MODEL_ID=\"$MODEL_ID\" EMBEDDING_MODEL_ID=\"$EMBEDDING_MODEL_ID\" TOP_K=\"$TOP_K\" MEMORY_TOP_K=\"$MEMORY_TOP_K\" MIN_SCORE=\"$MIN_SCORE\" npm run start -w @memorag-mvp/benchmark; fi"
            ]
          },
          post_build: {
            commands: [
              "set -euo pipefail",
              "cd \"$CODEBUILD_SRC_DIR/memorag-bedrock-mvp\"",
              "if [ ! -f \"$OUTPUT\" ]; then printf '' > \"$OUTPUT\"; fi",
              "if [ ! -f \"$SUMMARY\" ]; then printf '{\"total\":0,\"succeeded\":0,\"failedHttp\":0,\"metrics\":{\"errorRate\":1}}\\n' > \"$SUMMARY\"; fi",
              "if [ ! -f \"$REPORT\" ]; then printf '# Benchmark runner failed\\n\\nCodeBuild failed before benchmark artifacts were produced. See the CodeBuild log URL recorded on the benchmark run.\\n' > \"$REPORT\"; fi",
              "aws s3 cp \"$OUTPUT\" \"$OUTPUT_S3_PREFIX/results.jsonl\"",
              "aws s3 cp \"$SUMMARY\" \"$OUTPUT_S3_PREFIX/summary.json\"",
              "aws s3 cp \"$REPORT\" \"$OUTPUT_S3_PREFIX/report.md\"",
              "node infra/scripts/update-benchmark-run-metrics.mjs"
            ]
          }
        },
        artifacts: { files: ["benchmark/.runner-results.jsonl", "benchmark/.runner-summary.json", "benchmark/.runner-report.md"] }
      })
    })
    benchmarkBucket.grantReadWrite(benchmarkProject)
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
          Key: { runId: { "S.$": "$.runId" } },
          UpdateExpression: "SET #status = :status, startedAt = :startedAt, updatedAt = :startedAt",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":status": { S: "running" },
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
        Parameters: {
          ProjectName: benchmarkProject.projectName,
          EnvironmentVariablesOverride: [
            { Name: "RUN_ID", "Value.$": "$.runId", Type: "PLAINTEXT" },
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
          Key: { runId: { "S.$": "$.runId" } },
          UpdateExpression: "SET #status = :status, completedAt = :completedAt, updatedAt = :completedAt, codeBuildBuildId = :codeBuildBuildId, summaryS3Key = :summaryS3Key, reportS3Key = :reportS3Key, resultsS3Key = :resultsS3Key",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":status": { S: "succeeded" },
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
          Key: { runId: { "S.$": "$.runId" } },
          UpdateExpression: "SET #status = :status, completedAt = :completedAt, updatedAt = :completedAt, #error = :error",
          ExpressionAttributeNames: { "#status": "status", "#error": "error" },
          ExpressionAttributeValues: {
            ":status": { S: "failed" },
            ":completedAt": { "S.$": "$$.State.EnteredTime" },
            ":error": { "S.$": "States.JsonToString($.errorInfo)" }
          }
        },
        End: true
      }
    })
    startBenchmarkBuild.addCatch(markFailed, { resultPath: "$.errorInfo" })

    const benchmarkStateMachineLogGroup = new logs.LogGroup(this, "BenchmarkStateMachineLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const benchmarkStateMachine = new sfn.StateMachine(this, "BenchmarkStateMachine", {
      definitionBody: sfn.DefinitionBody.fromChainable(markRunning.next(startBenchmarkBuild).next(markSucceeded)),
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
    apiFn.addEnvironment("BENCHMARK_STATE_MACHINE_ARN", benchmarkStateMachine.stateMachineArn)
    apiFn.addEnvironment("BENCHMARK_TARGET_API_BASE_URL", restApiBaseUrl)
    benchmarkStateMachine.grantStartExecution(apiFn)
    benchmarkStateMachine.grant(apiFn, "states:StopExecution", "states:DescribeExecution")

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
