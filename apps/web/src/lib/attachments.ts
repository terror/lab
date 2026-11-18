import {
  type Attachment,
  attachmentTextLimit,
  imageTypes,
} from '@lab/server/schemas';

import { type LibraryItem, libraryItemUrl } from './library';
import { uploadDocument } from './uploads';

export type { Attachment };

type ImageType = (typeof imageTypes)[number];

const MAX_DIMENSION = 2000;

const MAX_IMAGE_BYTES = 4_000_000;

const MAX_PDF_BYTES = 20_000_000;

function isPdf(file: File) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export type TextLimit = { chars: number; model: string };

export function textLimit(
  model: { contextWindow: number; name: string } | undefined
): TextLimit {
  return {
    chars: attachmentTextLimit(model?.contextWindow),
    model: model?.name ?? 'this model',
  };
}

function checkText(name: string, text: string, limit: TextLimit) {
  if (text.length > limit.chars) {
    throw new Error(
      `Couldn’t attach ${name} because it has too much text for ${limit.model}. Try a shorter file.`
    );
  }
}

async function readPdf(file: File, limit: TextLimit): Promise<Attachment> {
  if (file.size > MAX_PDF_BYTES) {
    throw new Error(
      `Couldn’t attach ${file.name} because it’s too large. Try a smaller file.`
    );
  }

  const { readPdf: parsePdf } = await import('./pdf');

  const { text, thumbnail } = await parsePdf(file);

  if (!text) {
    throw new Error(
      `Couldn’t read any text in ${file.name}. Try a PDF with selectable text.`
    );
  }

  checkText(file.name, text, limit);

  const uploadId = await uploadDocument(
    new File([file], file.name, { type: 'application/pdf' }),
    thumbnail
  );

  return { name: file.name, text, type: 'file', uploadId };
}

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

export async function readAttachment(
  file: File,
  limit: TextLimit
): Promise<Attachment> {
  if (isImageType(file.type)) {
    const blob = await shrink(file);

    if (!isImageType(blob.type)) {
      throw new Error(
        `Couldn’t convert ${file.name}. Try a PNG or JPEG instead.`
      );
    }

    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error(
        `Couldn’t attach ${file.name} because it’s too large. Try a smaller image.`
      );
    }

    return {
      data: await encode(blob),
      mimeType: blob.type,
      name: file.name,
      type: 'image',
    };
  }

  if (isPdf(file)) {
    return readPdf(file, limit);
  }

  if (file.size > limit.chars * 4) {
    throw new Error(
      `Couldn’t attach ${file.name} because it has too much text for ${limit.model}. Try a shorter file.`
    );
  }

  const text = await file.text();

  if (text.includes('\u0000')) {
    throw new Error(
      `Couldn’t read ${file.name} as text. Attach text files, PDFs, or images.`
    );
  }

  checkText(file.name, text, limit);

  return { name: file.name, text, type: 'file' };
}

export async function readLibraryItem(
  item: LibraryItem,
  limit: TextLimit
): Promise<Attachment> {
  const response = await fetch(libraryItemUrl(item.id));

  if (!response.ok) {
    throw new Error(`Couldn’t load ${item.name}. Try again.`);
  }

  if (item.kind === 'file') {
    const text = await response.text();

    checkText(item.name, text, limit);

    return {
      libraryId: item.id,
      name: item.name,
      text,
      type: 'file',
      ...(item.upload && { uploadId: item.upload.id }),
    };
  }

  const attachment = await readAttachment(
    new File([await response.blob()], item.name, { type: item.mimeType }),
    limit
  );

  return { ...attachment, libraryId: item.id };
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
