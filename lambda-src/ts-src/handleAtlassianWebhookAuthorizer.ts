import {APIGatewayAuthorizerResult, APIGatewayRequestAuthorizerEvent} from 'aws-lambda';
import 'source-map-support/register';
import {generatePolicy} from './authorization';
import {validateUserToken} from './slackAPI';

export async function handleAtlassianWebhookAuthorizer(event: APIGatewayRequestAuthorizerEvent): Promise<APIGatewayAuthorizerResult> {
  try {
    if(event.headers) {
      // Seems to sometimes have uppercase A, sometimes not.
      let token = event.headers["authorization"]?.replace('Bearer ', '');
      if(!token) {
        token = event.headers["Authorization"]?.replace('Bearer ', '');
      }
      if(!token) {
        throw new Error("Missing Authorization header");
      }
      const slackUserId = await validateUserToken(token);
      if(!slackUserId) {
        throw new Error("Invalid token from Slack auth.");
      }
      const headerSlackId = event.headers["slack-user-id"];
      if(slackUserId != headerSlackId) {
        throw new Error(`Slack token is for incorrect user.  Header contained ${headerSlackId}, token was for ${slackUserId}`);
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
    return generatePolicy('user', 'Deny', event.methodArn);
  }
}
