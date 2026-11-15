import { defineExtension, section } from '@earendil-works/pi-durable';

export const assistant = defineExtension({
  name: 'lab.assistant',
  sections: [section('identity', () => 'You are Lab, a helpful assistant.')],
});
