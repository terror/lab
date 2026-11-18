import { ImagePlus } from 'lucide-react';

import { field, namedTitle } from './format';
import { SavedFile } from './sandbox';
import { type ToolRenderer, type ToolView } from './types';

const imageTitle = namedTitle(({ details }) => field(details, 'name'), {
  named: (name) => name,
  unnamed: 'an image',
});

const titles = {
  create: imageTitle('Creating an image', 'Created'),
  edit: imageTitle('Editing an image', 'Edited'),
};

function mode({ args }: ToolView) {
  return Array.isArray(args.images) && args.images.length > 0
    ? 'edit'
    : 'create';
}

export const imageRenderers = {
  image_generate: {
    icon: ImagePlus,
    inline: (view) => <SavedFile {...view} />,
    title: (view) => titles[mode(view)](view),
  },
} satisfies Record<string, ToolRenderer>;
