import preview from '../../.storybook/preview';
import { MomentsTable } from './moments-table';

const meta = preview.meta({
  component: MomentsTable,
  parameters: { layout: 'padded' },
  title: 'Foundations/Moments',
});

export const Registry = meta.story();
