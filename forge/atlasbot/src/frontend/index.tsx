
import { invoke, router } from '@forge/bridge';
import ForgeReconciler, { Button, ButtonGroup, Stack, useProductContext } from '@forge/react';
import React, { useState } from 'react';

function App() {
  const context = useProductContext();
  const [isSummarising, setSummarising] = useState(false);

  async function onSendToSlackClick(e: any) {
    if(context) {
      setSummarising(true);
      const pageId = context.extension.content.id;
      await invoke('summarise', { pageId, sendToSlack: true });
      setSummarising(false);
    }
    else {
      console.error("Failed to get context");
    }
  }

  async function onInsertSummaryClick(e: any) {
    if(context) {
      setSummarising(true);
      const pageId = context.extension.content.id;
      const url = await invoke('summarise', { pageId, sendToSlack: false }) as string;
      setSummarising(false);
      // Reload the page to show the latest version.
      router.navigate(url);
    }
    else {
      console.error("Failed to get context");
    }
  }
  
  return (
    <ButtonGroup label="AI Summaries">
      <Stack alignBlock="start" alignInline="start" space="space.100">
        <Button onClick={onSendToSlackClick} isDisabled={isSummarising}>
          Send AI Summary to Slack
        </Button>
        <Button onClick={onInsertSummaryClick} isDisabled={isSummarising}>
          Insert/Update AI Summary here
        </Button>
      </Stack>
    </ButtonGroup>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
