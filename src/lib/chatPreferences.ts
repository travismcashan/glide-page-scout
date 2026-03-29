import { MODEL_OPTIONS, VERSIONS, type ModelProvider, type ReasoningEffort } from '@/components/chat/ChatModelSelector';

export type ChatMode = 'individual' | 'council';

export type ResolvedChatSelection = {
  mode: ChatMode;
  provider: ModelProvider;
  model: string;
  reasoning: ReasoningEffort;
};

export const DEFAULT_BEST: Record<ModelProvider, string> = {
  gemini: 'google/gemini-3.1-pro-preview',
  claude: 'claude-opus',
  gpt: 'openai/gpt-5.2',
  perplexity: 'perplexity-sonar-reasoning-pro',
  council: 'council-synthesis',
};

export const DEFAULT_REASONING: Record<ModelProvider, ReasoningEffort> = {
  gemini: 'medium',
  claude: 'high',
  gpt: 'medium',
  perplexity: 'none',
  council: 'none',
};

const PROVIDERS = new Set<ModelProvider>(Object.keys(VERSIONS) as ModelProvider[]);

function isProvider(value: string | null): value is ModelProvider {
  return !!value && PROVIDERS.has(value as ModelProvider);
}

function getStoredIndividualProvider(storage: Storage): ModelProvider {
  const saved = storage.getItem('chat-individual-provider') ?? storage.getItem('chat-provider');
  if (isProvider(saved) && saved !== 'council') return saved;
  return 'gemini';
}

function getProviderForModel(model: string | null): ModelProvider | null {
  if (!model) return null;
  return MODEL_OPTIONS.find(option => option.id === model)?.provider ?? null;
}

export function getDefaultModelForProvider(provider: ModelProvider): string {
  return DEFAULT_BEST[provider] || VERSIONS[provider]?.[VERSIONS[provider].length - 1]?.id || 'google/gemini-3.1-pro-preview';
}

export function resolveStoredIndividualChatSelection(storage: Storage = window.localStorage) {
  const preferredProvider = getStoredIndividualProvider(storage);
  const savedModel = storage.getItem('chat-individual-model') ?? storage.getItem('chat-model');
  const modelProvider = getProviderForModel(savedModel);
  const hasCompatibleModel = !!savedModel && !!modelProvider && modelProvider !== 'council';
  const provider = hasCompatibleModel ? (modelProvider as ModelProvider) : preferredProvider;
  const model = hasCompatibleModel ? (savedModel as string) : getDefaultModelForProvider(provider);

  return {
    provider,
    model,
    reasoning: DEFAULT_REASONING[provider] || 'medium',
  };
}

export function resolveStoredChatSelection(storage: Storage = window.localStorage): ResolvedChatSelection {
  const mode = storage.getItem('chat-mode') === 'council' ? 'council' : 'individual';

  if (mode === 'council') {
    return {
      mode,
      provider: 'council',
      model: 'council-synthesis',
      reasoning: DEFAULT_REASONING.council,
    };
  }

  return {
    mode,
    ...resolveStoredIndividualChatSelection(storage),
  };
}

export function persistResolvedChatSelection(selection: ResolvedChatSelection, storage: Storage = window.localStorage) {
  storage.setItem('chat-mode', selection.mode);

  if (selection.mode === 'council' || selection.provider === 'council') {
    storage.setItem('chat-provider', 'council');
    storage.setItem('chat-model', 'council-synthesis');
    return;
  }

  storage.setItem('chat-provider', selection.provider);
  storage.setItem('chat-model', selection.model);
  storage.setItem('chat-individual-provider', selection.provider);
  storage.setItem('chat-individual-model', selection.model);
}