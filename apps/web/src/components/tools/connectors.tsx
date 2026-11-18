import { Card } from '@/components/ui/card';
import { Plug } from 'lucide-react';

import { field, namedTitle, text } from './format';
import { SettingsLink } from './previews';
import { type ToolRenderer } from './types';

const manageConnectors = (
  <SettingsLink section='connectors'>Manage connectors</SettingsLink>
);

function ConnectorCard({ connector }: { connector: unknown }) {
  const name = text(field(connector, 'name'));

  const host = text(field(connector, 'host'));

  if (!name) {
    return undefined;
  }

  return (
    <Card className='gap-0.5 text-sm' variant='inset'>
      <span className='font-medium'>{name}</span>
      {host && <span className='truncate text-muted-foreground'>{host}</span>}
    </Card>
  );
}

const card: ToolRenderer['preview'] = ({ details }) => (
  <ConnectorCard connector={field(details, 'connector')} />
);

const connectorTitle = namedTitle(
  ({ details }) => field(field(details, 'connector'), 'name'),
  { named: (name) => `the “${name}” connector`, unnamed: 'a connector' }
);

export const connectorRenderers = {
  connector_add: {
    actions: manageConnectors,
    icon: Plug,
    preview: card,
    title: connectorTitle('Adding a connector', 'Added'),
  },
  connector_list: {
    icon: Plug,
    preview: ({ details }) => {
      const connectors = field(details, 'connectors');

      return Array.isArray(connectors) && connectors.length > 0 ? (
        <div className='flex flex-col gap-2'>
          {connectors.map((connector, index) => (
            <ConnectorCard key={index} connector={connector} />
          ))}
        </div>
      ) : undefined;
    },
    title: ({ active }) =>
      active ? 'Listing connectors' : 'Listed connectors',
  },
  connector_remove: {
    actions: manageConnectors,
    icon: Plug,
    preview: card,
    title: connectorTitle('Removing a connector', 'Removed'),
  },
  connector_update: {
    actions: manageConnectors,
    icon: Plug,
    preview: card,
    title: connectorTitle('Updating a connector', 'Updated'),
  },
} satisfies Record<string, ToolRenderer>;
