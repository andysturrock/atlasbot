import api, { route } from '@forge/api';
import Resolver from '@forge/resolver';
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
  if (!atlasWebhookPath) {
    throw new Error("Missing env var ATLASBOT_WEBHOOK_PATH");
  }

  const pageId = request.payload.pageId;
  const sendToSlack = request.payload.sendToSlack;
  const type = request.payload.type;
  let path = route`/wiki/api/v2/pages/${pageId}?body-format=atlas_doc_format`;
  if(type == 'blogpost') {
    path  = route`/wiki/api/v2/blogposts/${pageId}?body-format=atlas_doc_format`;
  }
  let confluenceAPIResult = await api.asUser().requestConfluence(path);

  // There's more fields than this in reality.
  type Page = {
    id: string,
    version: {
      number: number
    },
    title: string,
    body: {
      atlas_doc_format: {
        value: string
      }
    },
    _links: {
      editui: string,
      webui: string,
      tinyui: string,
      base: string
    }
  };
  let page = await confluenceAPIResult.json() as Page;
  if (!page.body || !page.body.atlas_doc_format || !page.body.atlas_doc_format.value) {
    throw new Error(`Could not get contents of Confluence page ${path.value}.  Got:\n${inspect(page, false, null)}`);
  }

  // Strip out any existing tl;dr section
  type Text = {
    type: 'text',
    text: string
  };
  type AtlasDoc = {
    type: 'doc',
    content: 
      {
        type: string,
        attrs?: { level: number },
        content?: Text[]
      }[]
  };
  const atlasDoc = JSON.parse(page.body.atlas_doc_format.value) as AtlasDoc;
  if(atlasDoc.content[0].type == 'heading' && atlasDoc.content[0].content[0].text == 'tl;dr') {
    // Remove the heading, the following paragraph and the horizontal divider
    atlasDoc.content.splice(0, 3);
  }

  // Get the Slack provider and request creds if required.
  const atlasBotAPI = api.asUser().withProvider('slack', 'atlasbot-api');
  if (!await atlasBotAPI.hasCredentials()) {
    await atlasBotAPI.requestCredentials();
  }

  // Call the API (Lambda in AWS)
  const account = await atlasBotAPI.getAccount();
  const webui = page._links.webui;
  const base = page._links.base;
  const body = {
    slackUserId: account.id,
    pageUrl: `${base}${webui}`,
    pageContent: atlasDoc,
    sendToSlack
  };
  const options = {
    method: 'POST',
    body: JSON.stringify(body),
    // Header convention seems to be lowercase with - as separator.
    headers: { 'slack-user-id': account.id }
  };
  try {
    // TODO - should be using this but it won't allow any paths with a / in them.
    // await atlasBotAPI.fetch(route`${atlasWebhookPath}`, options);
    // So just use the raw string instead, assuming the user has set the env var value safely.
    let apiResponse = await atlasBotAPI.fetch(atlasWebhookPath, options);
    let ok = apiResponse.ok;
    let status = apiResponse.status;
    if (!ok || status != 200) {
      console.warn(`Call to API returned ok: ${ok} and status ${status}`);
    }
    type SummaryResponse = {
      summary: string
    };
    const summaryResponse = await apiResponse.json() as SummaryResponse;

    if(!sendToSlack) {
      // Now insert the tl;dr section into the page.
      let text: Text = {
        text: 'tl;dr',
        type: 'text'
      };
      const heading = {
        type: 'heading',
        attrs: { level: 2 },
        content: [text]
      };
      text = {
        text: summaryResponse.summary,
        type: 'text'
      };
      const paragraph = {
        type: 'paragraph',
        content: [
          text
        ]
      };
      // Type "rule" is a horizontal divider
      const rule =  {
        type: 'rule'
      };
      atlasDoc.content.unshift(rule);
      atlasDoc.content.unshift(paragraph);
      atlasDoc.content.unshift(heading);

      type Body = {
        id: string,
        status: string,
        title: string
        body: {
          representation: string,
          value: string
        },
        version: {
          number: number,
          message: string
        },
      };
      const body: Body = {
        id: pageId,
        status: 'current',
        title: page.title,
        body: {
          representation: 'atlas_doc_format',
          value: JSON.stringify(atlasDoc)
        },
        version: {
          number: page.version.number + 1,
          message: 'tl;dr section added by AtlasBot'
        }
      };

      path = route`/wiki/api/v2/pages/${pageId}`;
      if(type == 'blogpost') {
        path  = route`/wiki/api/v2/blogposts/${pageId}`;
      }
      
      confluenceAPIResult = await api.asUser().requestConfluence(path, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      page = await confluenceAPIResult.json() as Page;
      ok = confluenceAPIResult.ok;
      status = confluenceAPIResult.status;
      if(!ok || status != 200) {
        throw new Error(`Error updating Confluence page: ${confluenceAPIResult.statusText}`);
      }
      const url = `${page._links.base}${page._links.webui}`;
      return url;
    }
  }
  catch (error) {
    console.error(error);
  }
};

const resolver = new Resolver();
resolver.define('summarise', summarise);
export const handler = resolver.getDefinitions();
