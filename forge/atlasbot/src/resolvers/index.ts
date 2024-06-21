import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';
import inspect from 'browser-util-inspect';

// From @forge/resolver which unfortunately doesn't export these types
interface InvokePayload {
  call: {
      functionKey: string;
      payload?: {
          [key in number | string]: any;
      };
      jobId?: string;
  };
  context: {
      [key: string]: any;
  };
}
interface Request {
  payload: {
    [key in number | string]: any;
  };
  context: InvokePayload['context'];
}

async function summarise(request: Request) {
  const atlasWebhookPath = process.env['ATLASBOT_WEBHOOK_PATH'];
  if(!atlasWebhookPath) {
    throw new Error("Missing env var ATLASBOT_WEBHOOK_PATH");
  }
  
  const pageId = request.payload.pageId;
  const confluenceAPIResult = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}?body-format=atlas_doc_format`);

  const json = await confluenceAPIResult.json();
  if(!json.body || !json.body.atlas_doc_format || !json.body.atlas_doc_format.value) {
    throw new Error(`Could not get contents of Confluence page from:\n${inspect(json, false, null)}`);
  }
  const pageContent = JSON.parse(json.body.atlas_doc_format.value as string);
  const webui = json._links.webui as string;
  const base = json._links.base as string;
  const atlasBotAPI = api.asUser().withProvider('slack', 'atlasbot-api');
  if(!await atlasBotAPI.hasCredentials()) {
    await atlasBotAPI.requestCredentials();
  }
  const account = await atlasBotAPI.getAccount();
  const body = {
    slackUserId: account.id,
    pageUrl: `${base}${webui}`,
    pageContent
  };
  const options = {
    method: 'POST',
    body: JSON.stringify(body),
    // Header convention seems to be lowercase with - as separator.
    headers: {'slack-user-id': account.id}
  };
  try {
    // TODO - should be using this but it won't allow any paths with a / in them.
    // await atlasBotAPI.fetch(route`${atlasWebhookPath}`, options);
    // So just use the raw string instead, assuming the user has set the env var value safely.
    const apiResponse = await atlasBotAPI.fetch(atlasWebhookPath, options);
    const ok = apiResponse.ok;
    const status = apiResponse.status;
    if(!ok || status != 200) {
      console.warn(`Call to API returned ok: ${ok} and status ${status}`);
    }
  }
  catch(error) {
    console.error(error);
  }
};

const resolver = new Resolver();
resolver.define('summarise', summarise);
export const handler = resolver.getDefinitions();
