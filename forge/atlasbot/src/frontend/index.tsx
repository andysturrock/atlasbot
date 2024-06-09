import React, { useState } from 'react';
import ForgeReconciler, { Button, useProductContext } from '@forge/react';
import { invoke } from '@forge/bridge';
import inspect from 'browser-util-inspect';

function App() {
  const context = useProductContext();
  const [isSummarising, setSummarising] = useState(false);

  async function onClick(e: any) {
    if(context) {
      setSummarising(true);
      const pageId = context.extension.content.id;
      await invoke('summarise', { pageId });
      setSummarising(false);
    }
    else {
      console.error("Failed to get context");
    }
  }
  
  return (
    <>
      <Button onClick={onClick} isDisabled={isSummarising}>
        Send AI Summary to Slack
      </Button>
    </>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
