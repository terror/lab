import { defineExtension } from '@earendil-works/pi-durable';

import { echo } from '../tools/echo';

export const lab = defineExtension({ name: 'lab', tools: [echo] });
