export const THEMES = ['system', 'light', 'dark'] as const;

export const CHAT_SORTS = ['activity', 'created', 'title'] as const;

export type Preferences = {
  chatSort: (typeof CHAT_SORTS)[number];
  lineNumbers: boolean;
  theme: (typeof THEMES)[number];
};

export const defaultPreferences: Preferences = {
  chatSort: 'activity',
  lineNumbers: false,
  theme: 'system',
};
