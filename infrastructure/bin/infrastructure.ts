#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BuyLocalsStack } from '../lib/buy-locals-stack';

const app = new cdk.App();

const stage = app.node.tryGetContext('stage') || 'dev';
const stackName = `BuyLocals-${stage}`;

new BuyLocalsStack(app, stackName, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  stage,
  tags: {
    Project: 'BuyLocals',
    Environment: stage,
  },
});