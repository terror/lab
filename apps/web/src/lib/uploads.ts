import { call, client } from './client';

export async function uploadDocument(document: File, thumbnail?: Blob) {
  const { id } = await call(
    client.uploads.$post({
      form: {
        document,
        ...(thumbnail && {
          thumbnail: new File([thumbnail], 'thumbnail.png', {
            type: 'image/png',
          }),
        }),
      },
    })
  );

  return id;
}

export function uploadUrl(id: string) {
  return client.uploads[':id'].$url({ param: { id } }).href;
}

export function uploadThumbnailUrl(id: string) {
  return client.uploads[':id'].thumbnail.$url({ param: { id } }).href;
}
