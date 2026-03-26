import { useState } from 'react';
import { Zap, Brain, Sparkles, ChevronDown } from 'lucide-react';
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

export const PROVIDERS: { id: ModelProvider; label: string }[] = [
  { id: 'gemini', label: 'Gemini' },
  { id: 'claude', label: 'Claude' },
  { id: 'gpt', label: 'GPT' },
  { id: 'perplexity', label: 'Perplexity' },
];

const ALL_REASONING: ReasoningEffort[] = ['none', 'low', 'medium', 'high'];
const THINKING_ONLY: ReasoningEffort[] = ['none', 'high'];

export const VERSIONS: Record<ModelProvider, ModelOption[]> = {
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

/* ─── Model Version Picker (filtered by current provider) ─── */

type ModelPickerProps = {
  model: string;
  provider: ModelProvider;
  onModelChange: (model: string) => void;
  disabled?: boolean;
};

export function ChatModelPicker({ model, provider, onModelChange, disabled }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const versions = VERSIONS[provider] || [];
  const selectedModel = versions.find(m => m.id === model) || versions[0];

  const handleSelect = (modelId: string) => {
    onModelChange(modelId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-0 outline-none px-1.5 py-0.5 rounded flex items-center gap-1">
          {selectedModel?.label || 'Model'}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[220px] p-1.5" sideOffset={10}>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5 font-medium">
          Model
        </div>
        {versions.map(v => (
          <button
            key={v.id}
            onClick={() => handleSelect(v.id)}
            className={cn(
              'w-full text-left rounded-md px-2 py-2 transition-colors flex items-start gap-2',
              selectedModel?.id === v.id
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
      </PopoverContent>
    </Popover>
  );
}

/* ─── Provider Picker (company: Gemini/Claude/GPT/Perplexity) ─── */

type ProviderPickerProps = {
  provider: ModelProvider;
  model?: string;
  onProviderChange: (provider: ModelProvider) => void;
  disabled?: boolean;
};

export function ChatProviderPicker({ provider, model, onProviderChange, disabled }: ProviderPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0];
  const selectedModel = model ? MODEL_OPTIONS.find(m => m.id === model) : undefined;
  const displayLabel = selectedModel ? `${selected.label} ${selectedModel.label}` : selected.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-0 outline-none px-1.5 py-0.5 rounded flex items-center gap-1">
          {displayLabel}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[160px] p-1.5" sideOffset={10}>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5 font-medium">
          Provider
        </div>
        {PROVIDERS.map(p => (
          <button
            key={p.id}
            onClick={() => { onProviderChange(p.id); setOpen(false); }}
            className={cn(
              'w-full text-left rounded-md px-2 py-2 transition-colors text-sm',
              provider === p.id
                ? 'bg-accent text-accent-foreground font-medium'
                : 'hover:bg-muted/50'
            )}
          >
            {p.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/* ─── Reasoning Picker ─── */

type ReasoningPickerProps = {
  model: string;
  reasoning: ReasoningEffort;
  onReasoningChange: (reasoning: ReasoningEffort) => void;
  disabled?: boolean;
};

export function ChatReasoningPicker({ model, reasoning, onReasoningChange, disabled }: ReasoningPickerProps) {
  const [open, setOpen] = useState(false);
  const selectedModel = MODEL_OPTIONS.find(m => m.id === model);
  const availableReasoning = selectedModel?.reasoning || ['none'];

  if (availableReasoning.length <= 1) return null;

  const currentLabel = selectedModel?.reasoningLabels?.[reasoning] ?? REASONING_META[reasoning]?.label ?? 'None';
  const CurrentIcon = REASONING_META[reasoning]?.icon || Zap;

  const handleSelect = (r: ReasoningEffort) => {
    onReasoningChange(r);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-0 outline-none px-1.5 py-0.5 rounded flex items-center gap-1">
          <CurrentIcon className="h-3 w-3" />
          {currentLabel}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[160px] p-1.5" sideOffset={10}>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5 font-medium">
          Reasoning
        </div>
        {availableReasoning.map(r => {
          const meta = REASONING_META[r];
          const label = selectedModel?.reasoningLabels?.[r] ?? meta.label;
          const Icon = meta.icon;
          return (
            <button
              key={r}
              onClick={() => handleSelect(r)}
              className={cn(
                'w-full text-left rounded-md px-2 py-2 transition-colors flex items-center gap-2',
                reasoning === r
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted/50'
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="text-sm">{label}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

/* ─── Legacy combined selector (kept for backward compat) ─── */

type Props = {
  model: string;
  reasoning: ReasoningEffort;
  onModelChange: (model: string) => void;
  onReasoningChange: (reasoning: ReasoningEffort) => void;
  disabled?: boolean;
};

export function ChatModelSelector({ model, reasoning, onModelChange, onReasoningChange, disabled }: Props) {
  const selectedModel = MODEL_OPTIONS.find(m => m.id === model) || VERSIONS.gemini[2];
  const provider = selectedModel.provider;

  return (
    <div className="flex items-center gap-0.5">
      <ChatModelPicker model={model} provider={provider} onModelChange={(id) => {
        const newModel = MODEL_OPTIONS.find(m => m.id === id);
        onModelChange(id);
        if (newModel && !newModel.reasoning.includes(reasoning)) {
          onReasoningChange('none');
        }
      }} disabled={disabled} />
      <ChatReasoningPicker model={model} reasoning={reasoning} onReasoningChange={onReasoningChange} disabled={disabled} />
    </div>
  );
}
