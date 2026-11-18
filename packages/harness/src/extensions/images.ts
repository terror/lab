import {
  type ConversationId,
  defineExtension,
  defineTool,
  section,
} from '@earendil-works/pi-durable';
import { arr, int, obj, opt, str } from '@earendil-works/pi-schema';

import { caught, once, text } from './results';

export type ImageRequest = { images: number[]; name: string; prompt: string };

export type GeneratedImage = {
  data: string;
  libraryId: number;
  mimeType: string;
  name: string;
  size: number;
  uploadId: string;
};

export type ImageAccess = {
  available(): Promise<boolean>;
  generate(
    conversationId: ConversationId,
    request: ImageRequest,
    signal: AbortSignal | undefined
  ): Promise<GeneratedImage>;
};

export function images(access: ImageAccess) {
  const imageGenerate = defineTool({
    name: 'image_generate',
    description:
      "Create an image from a prompt, or edit images from the user's library by passing their ids. Saves the image to the library, shows it in the chat, and returns its library id.",
    callers: ['model'],
    parameters: obj({
      images: opt(
        arr(int({ minimum: 1 }), {
          description: 'Library ids of images to edit or combine.',
          maxItems: 4,
        })
      ),
      name: str({
        description: 'A short file name for the library, such as red-fox.',
        maxLength: 100,
        minLength: 1,
      }),
      prompt: str({
        description: 'What to create, or how to change the images.',
        maxLength: 4_000,
        minLength: 1,
      }),
    }),
    execute: (args, api, context) =>
      caught(async () => {
        const { data, ...saved } = await once(api, 'image', context, () =>
          access.generate(
            api.conversationId,
            {
              images: args.images ?? [],
              name: args.name,
              prompt: args.prompt,
            },
            context.abortSignal
          )
        );

        return {
          details: saved,
          output: [
            ...text(
              `Saved ${saved.name} to the library as id ${saved.libraryId}.`
            ),
            { data, mimeType: saved.mimeType, type: 'image' as const },
          ],
        };
      }),
  });

  return defineExtension({
    name: 'lab.images',
    sections: [
      section('images', async () =>
        (await access.available())
          ? "You can create images with image_generate. To edit or combine images, pass their library ids, which library_search finds. Each image is saved to the user's library and shown in the chat."
          : undefined
      ),
    ],
    tools: [imageGenerate],
  });
}
