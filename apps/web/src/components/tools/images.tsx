import { ImageCard } from '@/components/image-card';
import { uploadUrl } from '@/lib/uploads';
import { ImagePlus } from 'lucide-react';

import { field, namedTitle, text } from './format';
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

function Generated({ active, details }: ToolView) {
  const uploadId = text(field(details, 'uploadId'));

  if (!active && !uploadId) {
    return undefined;
  }

  return (
    <ImageCard
      className='max-h-72'
      frame='aspect-square h-72'
      name={text(field(details, 'name')) ?? 'Image'}
      src={uploadId ? uploadUrl(uploadId) : undefined}
    />
  );
}

export const imageRenderers = {
  image_generate: {
    icon: ImagePlus,
    inline: (view) => <Generated {...view} />,
    title: (view) => titles[mode(view)](view),
    yields: 'file',
  },
} satisfies Record<string, ToolRenderer>;
