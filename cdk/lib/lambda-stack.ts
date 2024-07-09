import { Duration, Stack } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { LambdaStackProps } from './common';

export class LambdaStack extends Stack {
  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    // Semantic versioning has dots as separators but this is invalid in a URL
    // so replace the dots with underscores first.
    const lambdaVersionIdForURL = props.lambdaVersion.replace(/\./g, '_');

    // Common props for all lambdas, so define them once here.
    const allLambdaProps = {
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
      },
      logRetention: logs.RetentionDays.THREE_DAYS,
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(30),
    };

    // The lambda for handling the callback for the Slack install
    const handleSlackAuthRedirectLambda = new lambda.Function(this, "handleSlackAuthRedirectLambda", {
      handler: "handleSlackAuthRedirect.handleSlackAuthRedirect",
      functionName: 'atlasBot-handleSlackAuthRedirect',
      code: lambda.Code.fromAsset("../lambda-src/dist/handleSlackAuthRedirect"),
      ...allLambdaProps
    });
    // Allow read access to the secret it needs
    props.atlasBotSecret.grantRead(handleSlackAuthRedirectLambda);

    // Create the lambda for handling Atlassian webhooks.
    const handleAtlassianWebhookLambda = new lambda.Function(this, "handleAtlassianWebhookLambda", {
      handler: "handleAtlassianWebhook.handleAtlassianWebhook",
      functionName: 'atlasBot-handleAtlassianWebhook',
      code: lambda.Code.fromAsset("../lambda-src/dist/handleAtlassianWebhook"),
      memorySize: 512,
      ...allLambdaProps
    });
    // Set the role name to something short otherwise the GCP workload federation stuff doesn't work.
    // It maps the role name to the attribute google.subject which is only allowed to be 127 chars long.
    // So if the role name is too long you get the error:
    // The size of mapped attribute google.subject exceeds the 127 bytes limit. Either modify your attribute mapping or the incoming assertion to produce a mapped attribute that is less than 127 bytes.
    const role = handleAtlassianWebhookLambda.role?.node.defaultChild as iam.CfnRole;
    // role.roleName = role.node.addr;
    role.roleName = "handleAtlassianWebhookLambdaRole";
    // Allow read access to the secret it needs
    props.atlasBotSecret.grantRead(handleAtlassianWebhookLambda);

    // Lambda for authorizing the calls from Atlassian
    const handleAtlassianWebhookAuthorizerLambda = new lambda.Function(this, "handleAtlassianWebhookAuthorizerLambda", {
      handler: "handleAtlassianWebhookAuthorizer.handleAtlassianWebhookAuthorizer",
      functionName: 'atlasBot-handleAtlassianWebhookAuthorizer',
      code: lambda.Code.fromAsset("../lambda-src/dist/handleAtlassianWebhookAuthorizer"),
      memorySize: 512,
      ...allLambdaProps
    });
    const handleAtlassianWebhookAuthorizer = new apigateway.RequestAuthorizer(this, 'handleAtlassianWebhookAuthorizer', {
      handler: handleAtlassianWebhookAuthorizerLambda,
      authorizerName: 'handleAtlassianWebhookAuthorizer',
      resultsCacheTtl: Duration.seconds(0),
      identitySources: ["method.request.header.Authorization"]
    });
    // Allow read access to the secret it needs
    props.atlasBotSecret.grantRead(handleAtlassianWebhookAuthorizerLambda);

    // Get hold of the hosted zone which has previously been created
    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'R53Zone', {
      zoneName: props.customDomainName,
      hostedZoneId: props.route53ZoneId,
    });

    // Create the cert for the gateway.
    // Usefully, this writes the DNS Validation CNAME records to the R53 zone,
    // which is great as normal Cloudformation doesn't do that.
    const acmCertificateForCustomDomain = new acm.DnsValidatedCertificate(this, 'CustomDomainCertificate', {
      domainName: props.atlasBotDomainName,
      hostedZone: zone,
      validation: acm.CertificateValidation.fromDns(zone),
    });

    // Create the custom domain
    const customDomain = new apigateway.DomainName(this, 'CustomDomainName', {
      domainName: props.atlasBotDomainName,
      certificate: acmCertificateForCustomDomain,
      endpointType: apigateway.EndpointType.REGIONAL,
      securityPolicy: apigateway.SecurityPolicy.TLS_1_2
    });

    // This is the API Gateway which then calls the initial response and auth redirect lambdas
    const api = new apigateway.RestApi(this, "APIGateway", {
      restApiName: "/atlasBot",
      description: "Service for /atlasBot Slack command.",
      deploy: false // create the deployment below
    });

    // By default CDK creates a deployment and a "prod" stage.  That means the URL is something like
    // https://2z2ockh6g5.execute-api.eu-west-2.amazonaws.com/prod/
    // We want to create the stage to match the version id.
    const apiGatewayDeployment = new apigateway.Deployment(this, 'ApiGatewayDeployment', {
      api: api,
    });
    const stage = new apigateway.Stage(this, 'Stage', {
      deployment: apiGatewayDeployment,
      loggingLevel: apigateway.MethodLoggingLevel.INFO,
      dataTraceEnabled: true,
      stageName: lambdaVersionIdForURL
    });

    // Connect the API Gateway to the lambdas
    const handleSlackAuthRedirectLambdaIntegration = new apigateway.LambdaIntegration(handleSlackAuthRedirectLambda, {
      requestTemplates: {"application/json": '{ "statusCode": "200" }'}
    });
    const handleAtlassianWebhookLambdaIntegration = new apigateway.LambdaIntegration(handleAtlassianWebhookLambda, {
      requestTemplates: {"application/json": '{ "statusCode": "200" }'}
    });
    const handleSlackAuthRedirectResource = api.root.addResource('slack-oauth-redirect');
    const handleAtlassianWebhookResource = api.root.addResource('atlas-webhook');
    // And add the methods.
    handleSlackAuthRedirectResource.addMethod("GET", handleSlackAuthRedirectLambdaIntegration);
    handleAtlassianWebhookResource.addMethod("POST", handleAtlassianWebhookLambdaIntegration, {
      authorizer: handleAtlassianWebhookAuthorizer
    });
    

    // Create the R53 "A" record to map from the custom domain to the actual API URL
    new route53.ARecord(this, 'CustomDomainAliasRecord', {
      recordName: props.atlasBotDomainName,
      zone: zone,
      target: route53.RecordTarget.fromAlias(new targets.ApiGatewayDomain(customDomain))
    });
    // And path mapping to the API
    customDomain.addBasePathMapping(api, {basePath: `${lambdaVersionIdForURL}`, stage: stage});
  }
}
