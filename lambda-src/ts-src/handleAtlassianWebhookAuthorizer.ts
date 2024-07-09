import { APIGatewayAuthorizerResult, APIGatewayRequestAuthorizerEvent } from 'aws-lambda';
import 'source-map-support/register';
import util from 'util';
import { generatePolicy } from './authorization';
import { getSecretValue } from './awsAPI';
import { getSignInWithSlackUserInfo } from './slackAPI';

export async function handleAtlassianWebhookAuthorizer(event: APIGatewayRequestAuthorizerEvent): Promise<APIGatewayAuthorizerResult> {
  try {
    const slackEnterpriseId = await getSecretValue('AtlasBot', 'slackEnterpriseId');
    if(event.headers) {
      // Seems to sometimes have uppercase A, sometimes not.
      let token = event.headers["authorization"]?.replace('Bearer ', '');
      if(!token) {
        token = event.headers["Authorization"]?.replace('Bearer ', '');
      }
      if(!token) {
        throw new Error("Missing Authorization header");
      }
      const userInfo = await getSignInWithSlackUserInfo(token);
      const headerSlackId = event.headers["slack-user-id"];
      if(userInfo.userId != headerSlackId) {
        throw new Error(`Slack token is for incorrect user.  Header contained ${headerSlackId}, token was for ${userInfo.userId}`);
      }
      if(userInfo.enterpriseId != slackEnterpriseId) {
        throw new Error(`Slack token is for incorrect enterprise.  Header contained ${userInfo.enterpriseId}, token was for ${slackEnterpriseId}`);
      }

      const policy = generatePolicy('user', "Allow", event.methodArn);
      return policy;
    }
    else {
      throw new Error("Missing event.headers");
    }
  }
  catch (error) {
    console.error(error);
    console.error(util.inspect(error, false, null));
    return generatePolicy('user', 'Deny', event.methodArn);
  }
}
