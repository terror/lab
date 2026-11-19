export const THEMES = ['system', 'light', 'dark'] as const;

export const SYNTAX_THEMES = ['pierre', 'github', 'solarized'] as const;

export const CHAT_SORTS = ['activity', 'created', 'title'] as const;

export const PERSONALITIES = ['default', 'quiet'] as const;

export type Preferences = {
  chatSort: (typeof CHAT_SORTS)[number];
  hints: string[];
  lineNumbers: boolean;
  personality: (typeof PERSONALITIES)[number];
  syntaxTheme: (typeof SYNTAX_THEMES)[number];
  theme: (typeof THEMES)[number];
};

export const defaultPreferences: Preferences = {
  chatSort: 'activity',
  hints: [],
  lineNumbers: false,
  personality: 'default',
  syntaxTheme: 'pierre',
  theme: 'system',
};
