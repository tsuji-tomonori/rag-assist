import * as fs from "node:fs"
import * as path from "node:path"
import * as cdk from "aws-cdk-lib"
import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib"
import * as apigw from "aws-cdk-lib/aws-apigateway"
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2"
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations"
import * as cloudfront from "aws-cdk-lib/aws-cloudfront"
import * as origins from "aws-cdk-lib/aws-cloudfront-origins"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import * as iam from "aws-cdk-lib/aws-iam"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as logs from "aws-cdk-lib/aws-logs"
import * as cognito from "aws-cdk-lib/aws-cognito"
import * as s3 from "aws-cdk-lib/aws-s3"
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment"
import * as cr from "aws-cdk-lib/custom-resources"
import { NagSuppressions } from "cdk-nag"
import { Construct } from "constructs"

export interface MemoRagMvpStackProps extends StackProps {
  readonly includeFrontendDeployment?: boolean
}

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
        USE_LOCAL_QUESTION_STORE: "false",
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
        COGNITO_APP_CLIENT_ID: userPoolClient.userPoolClientId
      }
    })

    docsBucket.grantReadWrite(apiFn)
    questionsTable.grantReadWriteData(apiFn)
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
        allowHeaders: ["Content-Type"],
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
          s3deploy.Source.jsonData("config.json", { apiBaseUrl: httpStage.url })
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
