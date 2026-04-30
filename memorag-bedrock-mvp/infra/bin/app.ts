#!/usr/bin/env node
import "source-map-support/register"
import * as cdk from "aws-cdk-lib"
import { AwsSolutionsChecks } from "cdk-nag"
import { MemoRagMvpStack } from "../lib/memorag-mvp-stack"

const app = new cdk.App()
cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }))

new MemoRagMvpStack(app, "MemoRagMvpStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? "ap-northeast-1"
  }
})
