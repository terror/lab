import { useState } from 'react';

import { FooterButton, PreviewPassage, Raw } from './previews';
import { toolRenderer } from './registry';
import { type ToolView } from './types';

export {
  type ToolProgress,
  type ToolRecord,
  type ToolResult,
  type ToolView,
  ToolConversation,
  ToolHistory,
} from './types';
export { toolRenderer } from './registry';

export function ToolBody(props: ToolView & { name: string }) {
  const [raw, setRaw] = useState(false);

  const renderer = toolRenderer(props.name);

  const preview = renderer.preview?.(props);

  return (
    <>
      {preview ??
        (props.output && <PreviewPassage>{props.output}</PreviewPassage>)}
      <div className='flex items-center gap-4'>
        {renderer.actions}
        <FooterButton onClick={() => setRaw(!raw)}>
          {raw ? 'Hide raw output' : 'Show raw output'}
        </FooterButton>
      </div>
      {raw && <Raw {...props} />}
    </>
  );
}
