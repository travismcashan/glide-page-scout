import { ChevronRight, Zap, Brain, Sparkles } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export type ModelProvider = 'gemini' | 'gpt' | 'claude' | 'perplexity';
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';

export type ModelOption = {
  id: string;
  label: string;
  provider: ModelProvider;
  description: string;
  tier: 'fast' | 'balanced' | 'powerful';
  reasoning: ReasoningEffort[];
  reasoningLabels?: Partial<Record<ReasoningEffort, string>>;
};

const PROVIDERS: { id: ModelProvider; label: string }[] = [
  { id: 'gemini', label: 'Gemini' },
  { id: 'claude', label: 'Claude' },
  { id: 'gpt', label: 'GPT' },
  { id: 'perplexity', label: 'Perplexity' },
];

const ALL_REASONING: ReasoningEffort[] = ['none', 'low', 'medium', 'high'];
const THINKING_ONLY: ReasoningEffort[] = ['none', 'high'];

const VERSIONS: Record<ModelProvider, ModelOption[]> = {
  gemini: [
    { id: 'google/gemini-2.5-flash-lite', label: 'Flash Lite', provider: 'gemini', description: 'Fastest, cheapest', tier: 'fast', reasoning: ALL_REASONING },
    { id: 'google/gemini-2.5-flash', label: 'Flash 2.5', provider: 'gemini', description: 'Fast & capable', tier: 'fast', reasoning: ALL_REASONING },
    { id: 'google/gemini-3-flash-preview', label: 'Flash 3.0', provider: 'gemini', description: 'Latest fast model', tier: 'balanced', reasoning: ALL_REASONING },
    { id: 'google/gemini-2.5-pro', label: 'Pro 2.5', provider: 'gemini', description: 'Best reasoning', tier: 'powerful', reasoning: ALL_REASONING },
    { id: 'google/gemini-3.1-pro-preview', label: 'Pro 3.1', provider: 'gemini', description: 'Latest flagship', tier: 'powerful', reasoning: ALL_REASONING },
  ],
  claude: [
    { id: 'claude-haiku', label: 'Haiku 4.5', provider: 'claude', description: 'Fast & affordable', tier: 'fast', reasoning: THINKING_ONLY, reasoningLabels: { high: 'Thinking' } },
    { id: 'claude-sonnet', label: 'Sonnet 4.6', provider: 'claude', description: 'Best balance', tier: 'balanced', reasoning: THINKING_ONLY, reasoningLabels: { high: 'Thinking' } },
    { id: 'claude-opus', label: 'Opus 4.6', provider: 'claude', description: '1M context, most capable', tier: 'powerful', reasoning: THINKING_ONLY, reasoningLabels: { high: 'Thinking' } },
  ],
  gpt: [
    { id: 'openai/gpt-5', label: 'GPT-5', provider: 'gpt', description: 'Powerful all-rounder', tier: 'powerful', reasoning: ALL_REASONING },
    { id: 'openai/gpt-5.2', label: 'GPT-5.2', provider: 'gpt', description: 'Latest, best reasoning', tier: 'powerful', reasoning: ALL_REASONING },
  ],
  perplexity: [
    { id: 'perplexity-sonar', label: 'Sonar', provider: 'perplexity', description: 'Fast web-grounded', tier: 'fast', reasoning: ['none'] },
    { id: 'perplexity-sonar-pro', label: 'Sonar Pro', provider: 'perplexity', description: 'Multi-step reasoning', tier: 'balanced', reasoning: ['none'] },
    { id: 'perplexity-sonar-reasoning', label: 'Reasoning', provider: 'perplexity', description: 'Chain-of-thought', tier: 'powerful', reasoning: ['none'] },
  ],
};

export const MODEL_OPTIONS: ModelOption[] = Object.values(VERSIONS).flat();

const REASONING_META: Record<ReasoningEffort, { label: string; icon: typeof Zap }> = {
  none: { label: 'None', icon: Zap },
  low: { label: 'Light', icon: Zap },
  medium: { label: 'Standard', icon: Brain },
  high: { label: 'Deep', icon: Sparkles },
};

const TIER_COLORS: Record<string, string> = {
  fast: 'text-emerald-500',
  balanced: 'text-blue-500',
  powerful: 'text-amber-500',
};

type Props = {
  model: string;
  reasoning: ReasoningEffort;
  onModelChange: (model: string) => void;
  onReasoningChange: (reasoning: ReasoningEffort) => void;
  disabled?: boolean;
};

export function ChatModelSelector({ model, reasoning, onModelChange, onReasoningChange, disabled }: Props) {
  const selectedModel = MODEL_OPTIONS.find(m => m.id === model) || VERSIONS.gemini[2];
  const selectedProvider = PROVIDERS.find(p => p.id === selectedModel.provider) || PROVIDERS[0];

  const reasoningLabel = selectedModel.reasoningLabels?.[reasoning] ?? REASONING_META[reasoning]?.label ?? '';
  const displayLabel = `${selectedProvider.label} ${selectedModel.label}${reasoning !== 'none' ? ` · ${reasoningLabel}` : ''}`;

  const handleSelect = (modelId: string) => {
    const newModel = MODEL_OPTIONS.find(m => m.id === modelId);
    onModelChange(modelId);
    if (newModel && !newModel.reasoning.includes(reasoning)) {
      onReasoningChange('none');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-0 outline-none px-1.5 py-0.5 rounded">
          {displayLabel}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-48">
        {PROVIDERS.map(provider => {
          const versions = VERSIONS[provider.id];
          return (
            <DropdownMenuSub key={provider.id}>
              <DropdownMenuSubTrigger className={selectedProvider.id === provider.id ? 'bg-accent' : ''}>
                <span className="text-sm">{provider.label}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52" sideOffset={4}>
                {versions.map(v => {
                  const hasReasoning = v.reasoning.length > 1;
                  if (hasReasoning) {
                    return (
                      <DropdownMenuSub key={v.id}>
                        <DropdownMenuSubTrigger className={selectedModel.id === v.id ? 'bg-accent' : ''}>
                          <div className="flex items-center gap-2 flex-1">
                            <span className={`text-[10px] ${TIER_COLORS[v.tier]}`}>●</span>
                            <span className="text-sm">{v.label}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground ml-2">{v.description}</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-36" sideOffset={4}>
                          {v.reasoning.map(r => {
                            const meta = REASONING_META[r];
                            const label = v.reasoningLabels?.[r] ?? meta.label;
                            const Icon = meta.icon;
                            return (
                              <DropdownMenuItem
                                key={r}
                                onClick={() => { handleSelect(v.id); onReasoningChange(r); }}
                                className={selectedModel.id === v.id && reasoning === r ? 'bg-accent' : ''}
                              >
                                <div className="flex items-center gap-2">
                                  <Icon className="h-3.5 w-3.5" />
                                  <span className="text-sm">{label}</span>
                                </div>
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    );
                  }
                  return (
                    <DropdownMenuItem
                      key={v.id}
                      onClick={() => handleSelect(v.id)}
                      className={`flex items-center justify-between ${selectedModel.id === v.id ? 'bg-accent' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] ${TIER_COLORS[v.tier]}`}>●</span>
                        <span className="text-sm">{v.label}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{v.description}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
