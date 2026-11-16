import { type Attachment, imageTypes } from '@lab/server/schemas';

export type { Attachment };

type ImageType = (typeof imageTypes)[number];

const MAX_DIMENSION = 2000;

const MAX_IMAGE_BYTES = 4_000_000;

const MAX_TEXT_BYTES = 200_000;

function isImageType(type: string): type is ImageType {
  return imageTypes.some((candidate) => candidate === type);
}

function encode(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      const url = typeof reader.result === 'string' ? reader.result : '';

      resolve(url.slice(url.indexOf(',') + 1));
    });

    reader.addEventListener('error', () => reject(reader.error));

    reader.readAsDataURL(blob);
  });
}

async function shrink(file: File) {
  if (file.type === 'image/gif') {
    return file;
  }

  const bitmap = await createImageBitmap(file);

  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(bitmap.width, bitmap.height)
  );

  if (scale === 1 && file.size <= MAX_IMAGE_BYTES) {
    bitmap.close();
    return file;
  }

  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(width, height);

  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.convertToBlob({ quality: 0.85, type: 'image/webp' });
}

export async function readAttachment(file: File): Promise<Attachment> {
  if (isImageType(file.type)) {
    const blob = await shrink(file);

    if (!isImageType(blob.type)) {
      throw new Error(`${file.name} could not be converted`);
    }

    return {
      data: await encode(blob),
      mimeType: blob.type,
      name: file.name,
      type: 'image',
    };
  }

  if (file.size > MAX_TEXT_BYTES) {
    throw new Error(`${file.name} is too large to attach`);
  }

  const text = await file.text();

  if (text.includes('\u0000')) {
    throw new Error(`${file.name} is not a text file`);
  }

  return { name: file.name, text, type: 'file' };
}

export function imageSource({
  data,
  mimeType,
}: {
  data: string;
  mimeType: string;
}) {
  return `data:${mimeType};base64,${data}`;
}
