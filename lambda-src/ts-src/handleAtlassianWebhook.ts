import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda";
import {GenerateContentRequest, GenerateContentResponse, GenerativeModel, VertexAI} from '@google-cloud/vertexai';
import {postMessage} from './slackAPI';
import {KnownBlock, RichTextBlock, SectionBlock} from '@slack/bolt';
import {getSecretValue} from './awsAPI';

type CodeBlock = {
  type: 'codeBlock',
  attrs: {
    language: string
  },
  content: Content
};
type InlineCard = {
  type: 'inlineCard',
  attrs: {
    url: string
  }
};
type Text = {
  type: 'text',
  text: string
};
type Paragraph = {
  type: 'paragraph',
  content?: Content
};
type Heading = {
  type: 'heading',
  content: Content
};
type Doc = {
  type: 'doc',
  content: Content
};
type Unknown = {
  type: string,
  content?: Content
};
type Content = (Doc | InlineCard | Text | Paragraph | Heading | CodeBlock)[];
type Body = {
  type: 'body',
  content: Content
};

function extractContent(content: Content) {
  let extractedContent = "";
  for(const contentBlock of content) {
    switch(contentBlock.type) {
    case 'doc':
    case 'codeBlock':
    case 'heading':
    case 'paragraph': {
      if(contentBlock.content) {
        extractedContent = `${extractedContent} ${extractContent(contentBlock.content)}`;
      }
      break;
    }
    case 'inlineCard': {
      const inlineCard: InlineCard = contentBlock;
      extractedContent = `${extractedContent} ${inlineCard.attrs.url}`;
      break;
    }
    case 'text': {
      const text: Text = contentBlock;
      extractedContent = `${extractedContent} ${text.text}`;
      break;
    }
    default: {
      const unknownBlock = contentBlock as Unknown;
      console.warn(`Unexpected type of content: ${unknownBlock.type}`);
    }
    }
  }

  return extractedContent;
}

export async function handleAtlassianWebhook(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if(!event.body) {
      throw new Error("Missing event body");
    }
    type EventBody = {
      slackUserId: string,
      pageUrl: string,
      pageContent: Body
    };
    const body = JSON.parse(event.body) as EventBody;

    const extractedContent = extractContent(body.pageContent.content);

    // Rather annoyingly Google seems to only get config from the filesystem.
    process.env["GOOGLE_APPLICATION_CREDENTIALS"] = "./clientLibraryConfig-aws-atlasbot.json";
    
    const gcpProjectId = await getSecretValue('AtlasBot', 'gcpProjectId');
    const vertexAI = new VertexAI({project: gcpProjectId, location: 'europe-west2'});
    const generativeModel = vertexAI.getGenerativeModel({
      model: 'gemini-1.5-flash-001',
    });
    const summary = await generateSummary(generativeModel, extractedContent);

    const blocks: KnownBlock[] = [];
    const sectionBlock: SectionBlock = {
      type: 'section',
      text: {
        type: "mrkdwn",
        text: `Summary of ${body.pageUrl}`
      }
    };
    const richTextBlock: RichTextBlock = {
      type: 'rich_text',
      elements: [
        {
          type: "rich_text_quote",
          elements: [
            {
              type: "text",
              text: summary
            }
          ]
        }
      ]
    };
    blocks.push(sectionBlock);
    blocks.push(richTextBlock);
    await postMessage(body.slackUserId, `Summary of ${body.pageUrl}`, blocks);
    
    const result: APIGatewayProxyResult = {
      body: "OK",
      statusCode: 200
    };

    return result;
  }
  catch (error) {
    console.error(error);
    const result: APIGatewayProxyResult = {
      body: "Error - please check logs",
      statusCode: 500
    };
    return result;
  }
}

async function generateSummary(generativeModel: GenerativeModel, text: string) {
  const prompt = "Please summarise the following text in 100 words or less:";
  const generateContentRequest: GenerateContentRequest = {
    contents: [
      {
        parts: [
          {
            text: `${prompt}\n\n${text}`
          }
        ],
        role: 'user'
      }
    ]
  };

  const resp = await generativeModel.generateContent(generateContentRequest);
  const contentResponse: GenerateContentResponse = resp.response;
  if(!contentResponse.candidates) {
    return "Cannot generate summary";
  }
  return contentResponse.candidates[0].content.parts[0].text || "Cannot generate summary";
}
