import { defineExtension } from '@lab/framework';

import { echo } from '../tools/echo';

export const lab = defineExtension({ name: 'lab', tools: [echo] });
