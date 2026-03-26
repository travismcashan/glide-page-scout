import { useState } from 'react';
import { Zap, Brain, Sparkles } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

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
    { id: 'perplexity-sonar-reasoning-pro', label: 'Reasoning Pro', provider: 'perplexity', description: 'Advanced reasoning', tier: 'powerful', reasoning: ['none'] },
  ],
};

export const MODEL_OPTIONS: ModelOption[] = Object.values(VERSIONS).flat();

const REASONING_META: Record<ReasoningEffort, { label: string; icon: typeof Zap }> = {
  none: { label: 'None', icon: Zap },
  low: { label: 'Light', icon: Zap },
  medium: { label: 'Standard', icon: Brain },
  high: { label: 'Deep', icon: Sparkles },
};

const TIER_DOT: Record<string, string> = {
  fast: 'bg-emerald-500',
  balanced: 'bg-blue-500',
  powerful: 'bg-amber-500',
};

type Props = {
  model: string;
  reasoning: ReasoningEffort;
  onModelChange: (model: string) => void;
  onReasoningChange: (reasoning: ReasoningEffort) => void;
  disabled?: boolean;
};

export function ChatModelSelector({ model, reasoning, onModelChange, onReasoningChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const selectedModel = MODEL_OPTIONS.find(m => m.id === model) || VERSIONS.gemini[2];
  const selectedProvider = PROVIDERS.find(p => p.id === selectedModel.provider) || PROVIDERS[0];
  const [activeTab, setActiveTab] = useState<ModelProvider>(selectedProvider.id);

  const reasoningLabel = selectedModel.reasoningLabels?.[reasoning] ?? REASONING_META[reasoning]?.label ?? '';
  const displayLabel = `${selectedProvider.label} ${selectedModel.label}${reasoning !== 'none' ? ` · ${reasoningLabel}` : ''}`;

  const handleSelectModel = (modelId: string) => {
    const newModel = MODEL_OPTIONS.find(m => m.id === modelId);
    onModelChange(modelId);
    if (newModel && !newModel.reasoning.includes(reasoning)) {
      onReasoningChange('none');
    }
    // If the new model doesn't support reasoning, close immediately
    if (newModel && newModel.reasoning.length <= 1) {
      setOpen(false);
    }
  };

  const handleSelectReasoning = (r: ReasoningEffort) => {
    onReasoningChange(r);
    setOpen(false);
  };

  const versions = VERSIONS[activeTab];
  const currentModelInTab = versions.find(v => v.id === selectedModel.id);
  // Show reasoning options for the currently selected model in this tab, or the highlighted one
  const reasoningModel = currentModelInTab || (selectedModel.provider === activeTab ? selectedModel : null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-0 outline-none px-1.5 py-0.5 rounded">
          {displayLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-[420px] p-0"
        sideOffset={8}
      >
        {/* Provider tabs */}
        <div className="flex border-b border-border">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => setActiveTab(p.id)}
              className={cn(
                'flex-1 text-xs font-medium py-2.5 px-1 transition-colors border-b-2 -mb-px',
                activeTab === p.id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex">
          {/* Models column */}
          <div className="flex-1 p-1.5 border-r border-border min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5 font-medium">
              Model
            </div>
            {versions.map(v => (
              <button
                key={v.id}
                onClick={() => handleSelectModel(v.id)}
                className={cn(
                  'w-full text-left rounded-md px-2 py-2 transition-colors flex items-start gap-2',
                  selectedModel.id === v.id
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted/50'
                )}
              >
                <span className={cn('h-2 w-2 rounded-full mt-1 shrink-0', TIER_DOT[v.tier])} />
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-tight">{v.label}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">{v.description}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Reasoning column */}
          <div className="w-[140px] p-1.5 shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5 font-medium">
              Reasoning
            </div>
            {reasoningModel && reasoningModel.reasoning.length > 1 ? (
              reasoningModel.reasoning.map(r => {
                const meta = REASONING_META[r];
                const label = reasoningModel.reasoningLabels?.[r] ?? meta.label;
                const Icon = meta.icon;
                return (
                  <button
                    key={r}
                    onClick={() => handleSelectReasoning(r)}
                    className={cn(
                      'w-full text-left rounded-md px-2 py-2 transition-colors flex items-center gap-2',
                      selectedModel.id === reasoningModel.id && reasoning === r
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-sm">{label}</span>
                  </button>
                );
              })
            ) : (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                {activeTab === 'perplexity'
                  ? 'Built-in web search'
                  : 'Select a model with reasoning support'}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
