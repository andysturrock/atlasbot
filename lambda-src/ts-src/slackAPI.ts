import { Block, KnownBlock, ModalView } from "@slack/bolt";
import { LogLevel, ViewsOpenArguments, WebClient } from "@slack/web-api";
import axios from 'axios';
import util from 'util';
import { getSecretValue } from './awsAPI';

async function createClient() {
  const slackBotToken = await getSecretValue('AtlasBot', 'slackBotToken');

  return new WebClient(slackBotToken, {
    logLevel: LogLevel.INFO
  });
}

export type SignInWithSlackUserInfo = {
  userId?: string,
  enterpriseId?: string
}
export async function getSignInWithSlackUserInfo(token: string) {
  const userWebClient = new WebClient(token, {
    logLevel: LogLevel.DEBUG
  });
  const openIDConnectUserInfoResponse = await userWebClient.openid.connect.userInfo();
  console.log(`openIDConnectUserInfoResponse: ${util.inspect(openIDConnectUserInfoResponse, false, null)}}`)
  const signInWithSlackUserInfo: SignInWithSlackUserInfo = {
    userId: openIDConnectUserInfoResponse.sub,
    enterpriseId: openIDConnectUserInfoResponse["https://slack.com/enterprise_id"]
  };
  return signInWithSlackUserInfo;
}

export async function openView(trigger_id: string, modalView: ModalView) {
  const client = await createClient();
  const viewsOpenArguments: ViewsOpenArguments = {
    trigger_id,
    view: modalView
  };
  await client.views.open(viewsOpenArguments);
}

export async function getSlackUserTimeZone(userId: string) {
  const client = await createClient();
  const result = await client.users.info({
    user: userId
  });
  if(!result.user?.tz) {
    throw new Error("Cannot get timezone from user object");
  }
  return result.user.tz;
}

export async function getUserEmailAddress(userId: string) {
  const client = await createClient();
  const userResult = await client.users.info({
    user: userId
  });
  return userResult.user?.profile?.email;
}

export type ChannelMember = {
  slackId: string,
  email: string
};

export async function scheduleMessage(channelId: string, text:string, blocks: (KnownBlock | Block)[], when: Date) {
  const client = await createClient();
  const response = await client.chat.scheduleMessage({
    channel: channelId,
    text,
    blocks,
    post_at: Math.floor(when.getTime() / 1000)
  });
  if(response.error) {
    throw new Error(`Error scheduling message: ${response.error}`);
  }
}

export async function postMessage(channelId: string, text:string, blocks: (KnownBlock | Block)[]) {
  const client = await createClient();
  await client.chat.postMessage({
    channel: channelId,
    text,
    blocks
  });
}

export async function postToResponseUrl(responseUrl: string, response_type: "ephemeral" | "in_channel", text: string, blocks: KnownBlock[]) {
  const messageBody = {
    response_type,
    text,
    blocks
  };
  const result = await axios.post(responseUrl, messageBody);
  if(result.status !== 200) {
    throw new Error(`Error ${util.inspect(result.statusText)} posting response: ${util.inspect(result.data)}`);
  }
  return result;
}

export async function postErrorMessageToResponseUrl(responseUrl: string, text: string) {
  const blocks: KnownBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text
      }
    }
  ];
  await postToResponseUrl(responseUrl, "ephemeral", text, blocks);
}

export async function postEphemeralMessage(channelId: string, userId: string, text:string, blocks: (KnownBlock | Block)[]) {
  const client = await createClient();
  await client.chat.postEphemeral({
    user: userId,
    channel: channelId,
    text,
    blocks
  });  
}

export async function postEphmeralErrorMessage(channelId: string, userId:string, text: string) {
  const blocks: KnownBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text
      }
    }
  ];
  await postEphemeralMessage(channelId, userId, text, blocks);
}

export type SlashCommandPayload = {
  token: string,
  team_id: string,
  team_domain: string,
  channel_id: string,
  channel_name: string,
  user_id: string,
  user_name: string,
  command: string,
  text: string,
  api_app_id: string,
  is_enterprise_install: string,
  response_url: string,
  trigger_id: string
};

export type Action = {
  action_id: string,
  value: string
};

export type InteractionPayload = {
  type: string,
  user: {
    id: string,
    username: string,
    name: string,
    team_id: string,
  },
  container: {
    type: string,
    message_ts: string,
    channel_id: string,
    is_ephemeral: boolean
  },
  team: {
    id: string,
    domain: string
  },
  channel: {
    id: string,
    name: string,
  },
  message: {
    type: 'message',
    subtype: string,
    text: string,
    ts: string,
    bot_id: string,
  },
  response_url: string,
  actions: Action[]
};