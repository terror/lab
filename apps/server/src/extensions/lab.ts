import { defineExtension } from '@lab/harness-pi';

import { echo } from '../tools/echo';

export const lab = defineExtension({ name: 'lab', tools: [echo] });
