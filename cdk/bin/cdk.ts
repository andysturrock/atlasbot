#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {LambdaStack} from '../lib/lambda-stack';
import {getEnv} from '../lib/common';
import {SecretsManagerStack} from '../lib/secretsmanager-stack';

const lambdaVersion = getEnv('LAMBDA_VERSION', false)!;
const customDomainName = getEnv('CUSTOM_DOMAIN_NAME', false)!;
const route53ZoneId = getEnv('R53_ZONE_ID', false)!;
const atlasBotDomainName = `atlasbot.${customDomainName}`;

const app = new cdk.App();

const region = 'eu-west-2';

// TODO maybe unhardcode region, but OK for now as always want London to minimise latency and for data residency purposes.

const secretsManagerStack = new SecretsManagerStack(app, 'atlasBotSecretsManagerStack', {
  env: {region},
  customDomainName,
});

new LambdaStack(app, 'atlasBotLambdaStack', {
  env: {region},
  atlasBotSecret: secretsManagerStack.atlasBotSecret,
  lambdaVersion,
  customDomainName,
  atlasBotDomainName,
  route53ZoneId
});

