import preview from '../../.storybook/preview';
import { setStorageUser } from '../lib/storage';
import { MomentsTable } from './moments-table';

const meta = preview.meta({
  component: MomentsTable,
  beforeEach: () => setStorageUser('storybook'),
  parameters: { layout: 'padded' },
  title: 'Foundations/Moments',
});

export const Registry = meta.story();
