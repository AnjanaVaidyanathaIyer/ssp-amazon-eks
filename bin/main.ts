#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';

// Sample construct
import BlueprintConstruct from '../examples/blueprint-construct'

const app = new cdk.App();

const account = process.env.CDK_DEFAULT_ACCOUNT
const region = process.env.CDK_DEFAULT_REGION
const props = { env: { account, region } }

new BlueprintConstruct(app, 'blueprint-construct', props);