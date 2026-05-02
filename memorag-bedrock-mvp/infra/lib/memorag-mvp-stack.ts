import * as fs from "node:fs"
import * as path from "node:path"
import * as cdk from "aws-cdk-lib"
import { Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib"
import * as apigw from "aws-cdk-lib/aws-apigateway"
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2"
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations"
import * as cloudfront from "aws-cdk-lib/aws-cloudfront"
import * as codebuild from "aws-cdk-lib/aws-codebuild"
import * as origins from "aws-cdk-lib/aws-cloudfront-origins"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import * as iam from "aws-cdk-lib/aws-iam"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as logs from "aws-cdk-lib/aws-logs"
import * as cognito from "aws-cdk-lib/aws-cognito"
import * as s3 from "aws-cdk-lib/aws-s3"
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment"
import * as sfn from "aws-cdk-lib/aws-stepfunctions"
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
  "BENCHMARK_RUNNER",
  "USER_ADMIN",
  "ACCESS_ADMIN",
  "COST_AUDITOR",
  "SYSTEM_ADMIN"
] as const

export class MemoRagMvpStack extends Stack {
  constructor(scope: Construct, id: string, props?: MemoRagMvpStackProps) {
    super(scope, id, props)

    const embeddingDimensions = Number(this.node.tryGetContext("embeddingDimensions") ?? 1024)
    const defaultModelId = String(this.node.tryGetContext("defaultModelId") ?? "amazon.nova-lite-v1:0")
    const embeddingModelId = String(this.node.tryGetContext("embeddingModelId") ?? "amazon.titan-embed-text-v2:0")
    const suffix = this.node.addr.slice(0, 8).toLowerCase()
    const vectorBucketName = `memorag-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}-${suffix}`
    const memoryVectorIndexName = "memory-index"
    const evidenceVectorIndexName = "evidence-index"
    const benchmarkRunnerAuthSecretId = String(this.node.tryGetContext("benchmarkRunnerAuthSecretId") ?? "")
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

    new s3deploy.BucketDeployment(this, "DeployBenchmarkDatasets", {
      sources: [
        s3deploy.Source.data("smoke-v1.jsonl", fs.readFileSync(path.join(__dirname, "../../benchmark/dataset.sample.jsonl"), "utf-8")),
        s3deploy.Source.data("standard-v1.jsonl", fs.readFileSync(path.join(__dirname, "../../benchmark/dataset.sample.jsonl"), "utf-8"))
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
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: false, otp: true },
      passwordPolicy: { minLength: 12, requireLowercase: true, requireUppercase: true, requireDigits: true, requireSymbols: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY
    })

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

    const apiLogGroup = new logs.LogGroup(this, "ApiFunctionLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const apiFn = new lambda.Function(this, "ApiFunction", {
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda-dist/api")),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 1024,
      timeout: Duration.seconds(60),
      logGroup: apiLogGroup,
      environment: {
        NODE_ENV: "production",
        USE_LOCAL_VECTOR_STORE: "false",
        MOCK_BEDROCK: "false",
        DOCS_BUCKET_NAME: docsBucket.bucketName,
        QUESTION_TABLE_NAME: questionsTable.tableName,
        CONVERSATION_HISTORY_TABLE_NAME: conversationHistoryTable.tableName,
        BENCHMARK_RUNS_TABLE_NAME: benchmarkRunsTable.tableName,
        BENCHMARK_BUCKET_NAME: benchmarkBucket.bucketName,
        BENCHMARK_DEFAULT_DATASET_KEY: "datasets/agent/standard-v1.jsonl",
        BENCHMARK_DOWNLOAD_EXPIRES_IN_SECONDS: "900",
        USE_LOCAL_QUESTION_STORE: "false",
        USE_LOCAL_CONVERSATION_HISTORY_STORE: "false",
        USE_LOCAL_BENCHMARK_RUN_STORE: "false",
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
    })

    docsBucket.grantReadWrite(apiFn)
    debugDownloadBucket.grantReadWrite(apiFn)
    benchmarkBucket.grantRead(apiFn)
    questionsTable.grantReadWriteData(apiFn)
    conversationHistoryTable.grantReadWriteData(apiFn)
    benchmarkRunsTable.grantReadWriteData(apiFn)
    apiFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
        resources: ["*"]
      })
    )
    apiFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3vectors:PutVectors", "s3vectors:QueryVectors", "s3vectors:GetVectors", "s3vectors:DeleteVectors", "s3vectors:ListVectors"],
        resources: ["*"]
      })
    )

    const httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      createDefaultStage: false,
      corsPreflight: {
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.DELETE, apigwv2.CorsHttpMethod.OPTIONS],
        allowOrigins: ["*"],
        maxAge: Duration.days(1)
      }
    })

    const apiAccessLogGroup = new logs.LogGroup(this, "HttpApiAccessLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    })
    const httpStage = new apigwv2.HttpStage(this, "HttpApiDefaultStage", {
      httpApi,
      stageName: "$default",
      autoDeploy: true,
      accessLogSettings: {
        destination: new apigwv2.LogGroupLogDestination(apiAccessLogGroup),
        format: apigw.AccessLogFormat.jsonWithStandardFields({
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
      }
    })

    const jwtAuthorizer = new apigwv2.CfnAuthorizer(this, "HttpApiJwtAuthorizer", {
      apiId: httpApi.apiId,
      authorizerType: "JWT",
      identitySource: ["$request.header.Authorization"],
      name: "CognitoJwtAuthorizer",
      jwtConfiguration: {
        audience: [userPoolClient.userPoolClientId],
        issuer: userPool.userPoolProviderUrl
      }
    })

    const preflightRoutes = httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [apigwv2.HttpMethod.OPTIONS],
      integration: new integrations.HttpLambdaIntegration("PreflightApiIntegration", apiFn)
    })
    const preflightRootRoutes = httpApi.addRoutes({
      path: "/",
      methods: [apigwv2.HttpMethod.OPTIONS],
      integration: new integrations.HttpLambdaIntegration("PreflightRootIntegration", apiFn)
    })
    NagSuppressions.addResourceSuppressions(
      [...preflightRoutes, ...preflightRootRoutes],
      [
        {
          id: "AwsSolutions-APIG4",
          reason: "CORS preflight OPTIONS routes must remain unauthenticated so browsers can complete access control checks before JWT-protected API requests."
        }
      ],
      true
    )

    const protectedRoutes = httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration: new integrations.HttpLambdaIntegration("ApiIntegration", apiFn)
    })
    const rootRoutes = httpApi.addRoutes({
      path: "/",
      methods: [apigwv2.HttpMethod.ANY],
      integration: new integrations.HttpLambdaIntegration("RootIntegration", apiFn)
    })

    for (const route of [...protectedRoutes, ...rootRoutes]) {
      const cfnRoute = route.node.defaultChild as apigwv2.CfnRoute
      cfnRoute.authorizationType = "JWT"
      cfnRoute.authorizerId = jwtAuthorizer.ref
      cfnRoute.addDependency(jwtAuthorizer)
    }

    const benchmarkProject = new codebuild.Project(this, "BenchmarkProject", {
      source: codebuild.Source.gitHub({
        owner: benchmarkSourceOwner,
        repo: benchmarkSourceRepo,
        branchOrRef: benchmarkSourceBranch
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
        privileged: false,
        environmentVariables: {
          COGNITO_APP_CLIENT_ID: { value: userPoolClient.userPoolClientId },
          BENCHMARK_AUTH_SECRET_ID: { value: benchmarkRunnerAuthSecretId }
        }
      },
      timeout: Duration.hours(2),
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
        phases: {
          install: {
            "runtime-versions": { nodejs: 22 },
            commands: ["cd \"$CODEBUILD_SRC_DIR/memorag-bedrock-mvp\"", "npm ci"]
          },
          pre_build: {
            commands: [
              "cd \"$CODEBUILD_SRC_DIR/memorag-bedrock-mvp\"",
              "aws s3 cp \"$DATASET_S3_URI\" ./benchmark/.runner-dataset.jsonl",
              "export OUTPUT=./benchmark/.runner-results.jsonl",
              "export SUMMARY=./benchmark/.runner-summary.json",
              "export REPORT=./benchmark/.runner-report.md",
              "export DATASET=./benchmark/.runner-dataset.jsonl",
              "if [ -n \"$BENCHMARK_AUTH_SECRET_ID\" ]; then SECRET_JSON=\"$(aws secretsmanager get-secret-value --secret-id \"$BENCHMARK_AUTH_SECRET_ID\" --query SecretString --output text)\"; export API_AUTH_TOKEN=\"$(SECRET_JSON=\"$SECRET_JSON\" COGNITO_APP_CLIENT_ID=\"$COGNITO_APP_CLIENT_ID\" node -e 'const { execFileSync } = require(\"node:child_process\"); const secret = JSON.parse(process.env.SECRET_JSON || \"{}\"); if (secret.idToken || secret.token) { console.log(secret.idToken || secret.token); process.exit(0); } const output = execFileSync(\"aws\", [\"cognito-idp\", \"initiate-auth\", \"--auth-flow\", \"USER_PASSWORD_AUTH\", \"--client-id\", process.env.COGNITO_APP_CLIENT_ID, \"--auth-parameters\", `USERNAME=${secret.username},PASSWORD=${secret.password}`], { encoding: \"utf8\" }); console.log(JSON.parse(output).AuthenticationResult.IdToken);')\"; fi"
            ]
          },
          build: {
            commands: [
              "cd \"$CODEBUILD_SRC_DIR/memorag-bedrock-mvp\"",
              "if [ \"$MODE\" = \"search\" ]; then API_BASE_URL=\"$API_BASE_URL\" EMBEDDING_MODEL_ID=\"$EMBEDDING_MODEL_ID\" TOP_K=\"$TOP_K\" npm run start:search -w @memorag-mvp/benchmark; else API_BASE_URL=\"$API_BASE_URL\" MODEL_ID=\"$MODEL_ID\" EMBEDDING_MODEL_ID=\"$EMBEDDING_MODEL_ID\" TOP_K=\"$TOP_K\" MEMORY_TOP_K=\"$MEMORY_TOP_K\" MIN_SCORE=\"$MIN_SCORE\" npm run start -w @memorag-mvp/benchmark; fi"
            ]
          },
          post_build: {
            commands: [
              "cd \"$CODEBUILD_SRC_DIR/memorag-bedrock-mvp\"",
              "aws s3 cp ./benchmark/.runner-results.jsonl \"$OUTPUT_S3_PREFIX/results.jsonl\"",
              "aws s3 cp ./benchmark/.runner-summary.json \"$OUTPUT_S3_PREFIX/summary.json\"",
              "aws s3 cp ./benchmark/.runner-report.md \"$OUTPUT_S3_PREFIX/report.md\""
            ]
          }
        },
        artifacts: { files: ["benchmark/.runner-results.jsonl", "benchmark/.runner-summary.json", "benchmark/.runner-report.md"] }
      })
    })
    benchmarkBucket.grantReadWrite(benchmarkProject)
    benchmarkProject.addToRolePolicy(new iam.PolicyStatement({
      actions: ["secretsmanager:GetSecretValue", "cognito-idp:InitiateAuth"],
      resources: ["*"]
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

    const benchmarkStateMachine = new sfn.StateMachine(this, "BenchmarkStateMachine", {
      definitionBody: sfn.DefinitionBody.fromChainable(markRunning.next(startBenchmarkBuild).next(markSucceeded)),
      timeout: Duration.hours(3)
    })
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
    apiFn.addEnvironment("BENCHMARK_TARGET_API_BASE_URL", httpStage.url)
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
            apiBaseUrl: httpStage.url,
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
          reason: "Bedrock model ARNs, S3 object grants, CloudFront invalidation, and S3 Vectors currently require wildcard or generated-object patterns in this MVP."
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

    new cdk.CfnOutput(this, "ApiUrl", { value: httpStage.url })
    new cdk.CfnOutput(this, "OpenApiUrl", { value: `${httpStage.url}openapi.json` })
    new cdk.CfnOutput(this, "FrontendUrl", { value: `https://${distribution.distributionDomainName}` })
    new cdk.CfnOutput(this, "VectorBucketName", { value: vectorBucketName })
    new cdk.CfnOutput(this, "MemoryVectorIndexName", { value: memoryVectorIndexName })
    new cdk.CfnOutput(this, "EvidenceVectorIndexName", { value: evidenceVectorIndexName })
    new cdk.CfnOutput(this, "DocumentsBucketName", { value: docsBucket.bucketName })
  }
}
