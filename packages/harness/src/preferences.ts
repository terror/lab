export const THEMES = ['system', 'light', 'dark'] as const;

export const CHAT_SORTS = ['activity', 'created', 'title'] as const;

export const PERSONALITIES = ['default', 'quiet'] as const;

export type Preferences = {
  chatSort: (typeof CHAT_SORTS)[number];
  lineNumbers: boolean;
  personality: (typeof PERSONALITIES)[number];
  theme: (typeof THEMES)[number];
};

export const defaultPreferences: Preferences = {
  chatSort: 'activity',
  lineNumbers: false,
  personality: 'default',
  theme: 'system',
};
