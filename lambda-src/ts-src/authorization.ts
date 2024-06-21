import 'source-map-support/register';
import {APIGatewayAuthorizerResult, PolicyDocument, Statement} from 'aws-lambda';

/**
 * Create a AuthResponse policy to be used as the return value of an APIGateway authorizer lambda.
 * @param principalId The Principal for the policy
 * @param effect Should be one of 'Allow' or 'Deny'
 * @param resource The resource or resources the policy should apply to.  Will probably be the API method ARN.
 * @returns 
 */
export function generatePolicy(principalId: string, effect: 'Allow' | 'Deny', resource: string | string[]): APIGatewayAuthorizerResult {
  const policyDocument: PolicyDocument = {
    Version: '',
    Statement: []
  };
  const apiGatewayAuthorizerResult: APIGatewayAuthorizerResult = {
    principalId: '',
    policyDocument
  };

  apiGatewayAuthorizerResult.principalId = principalId;
  if((effect.length > 0) && (Boolean(resource))) {
    policyDocument.Version = '2012-10-17';
    policyDocument.Statement = [];
    const statement: Statement = {
      Action: 'execute-api:Invoke',
      Effect: effect,
      Resource: resource
    };
    statement.Action = 'execute-api:Invoke';
    statement.Effect = effect;
    statement.Resource = resource;
    policyDocument.Statement[0] = statement;
    apiGatewayAuthorizerResult.policyDocument = policyDocument;
  }

  return apiGatewayAuthorizerResult;
}

