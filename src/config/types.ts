export type JarvisConfig = {
  daemon: {
    port: number;
    data_dir: string;
    db_path: string;
  };
  llm: {
    primary: string;  // provider name
    fallback: string[];
    anthropic?: { api_key: string; model?: string };
    openai?: { api_key: string; model?: string };
    ollama?: { base_url?: string; model?: string };
  };
  personality: {
    core_traits: string[];
  };
  authority: {
    default_level: number;
  };
  active_role: string;  // role file name
};

export const DEFAULT_CONFIG: JarvisConfig = {
  daemon: {
    port: 3142,
    data_dir: '~/.jarvis',
    db_path: '~/.jarvis/jarvis.db',
  },
  llm: {
    primary: 'anthropic',
    fallback: ['openai', 'ollama'],
    anthropic: {
      api_key: '',
      model: 'claude-sonnet-4-5-20250929',
    },
    openai: {
      api_key: '',
      model: 'gpt-4o',
    },
    ollama: {
      base_url: 'http://localhost:11434',
      model: 'llama3',
    },
  },
  personality: {
    core_traits: [
      'loyal',
      'efficient',
      'proactive',
      'respectful',
      'adaptive',
    ],
  },
  authority: {
    default_level: 3,
  },
  active_role: 'default',
};
