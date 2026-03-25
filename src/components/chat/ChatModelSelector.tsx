import { ChevronDown, Zap, Brain, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type ModelProvider = 'gemini' | 'gpt' | 'claude' | 'perplexity';
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';

export type ModelOption = {
  id: string;
  label: string;
  provider: ModelProvider;
  description: string;
  tier: 'fast' | 'balanced' | 'powerful';
};

const PROVIDERS: { id: ModelProvider; label: string }[] = [
  { id: 'gemini', label: 'Gemini' },
  { id: 'claude', label: 'Claude' },
  { id: 'gpt', label: 'GPT' },
  { id: 'perplexity', label: 'Perplexity' },
];

const VERSIONS: Record<ModelProvider, ModelOption[]> = {
  gemini: [
    { id: 'google/gemini-2.5-flash-lite', label: 'Flash Lite', provider: 'gemini', description: 'Fastest, cheapest', tier: 'fast' },
    { id: 'google/gemini-2.5-flash', label: 'Flash 2.5', provider: 'gemini', description: 'Fast & capable', tier: 'fast' },
    { id: 'google/gemini-3-flash-preview', label: 'Flash 3.0', provider: 'gemini', description: 'Latest fast model', tier: 'balanced' },
    { id: 'google/gemini-2.5-pro', label: 'Pro 2.5', provider: 'gemini', description: 'Best reasoning', tier: 'powerful' },
    { id: 'google/gemini-3.1-pro-preview', label: 'Pro 3.1', provider: 'gemini', description: 'Latest flagship', tier: 'powerful' },
  ],
  claude: [
    { id: 'claude-haiku', label: 'Haiku', provider: 'claude', description: 'Fast & affordable', tier: 'fast' },
    { id: 'claude-sonnet', label: 'Sonnet 4', provider: 'claude', description: 'Best balance', tier: 'balanced' },
    { id: 'claude-opus', label: 'Opus 4', provider: 'claude', description: 'Most capable', tier: 'powerful' },
  ],
  gpt: [
    { id: 'openai/gpt-5-nano', label: 'Nano', provider: 'gpt', description: 'Fast & efficient', tier: 'fast' },
    { id: 'openai/gpt-5-mini', label: 'Mini', provider: 'gpt', description: 'Balanced performance', tier: 'balanced' },
    { id: 'openai/gpt-5', label: 'GPT-5', provider: 'gpt', description: 'Powerful all-rounder', tier: 'powerful' },
    { id: 'openai/gpt-5.2', label: 'GPT-5.2', provider: 'gpt', description: 'Latest, best reasoning', tier: 'powerful' },
  ],
  perplexity: [
    { id: 'perplexity-sonar', label: 'Sonar', provider: 'perplexity', description: 'Fast web search', tier: 'fast' },
    { id: 'perplexity-sonar-pro', label: 'Sonar Pro', provider: 'perplexity', description: 'Multi-step + citations', tier: 'balanced' },
    { id: 'perplexity-sonar-reasoning', label: 'Sonar Reasoning', provider: 'perplexity', description: 'Chain-of-thought', tier: 'powerful' },
  ],
};

// Flatten for lookup
export const MODEL_OPTIONS: ModelOption[] = Object.values(VERSIONS).flat();

const REASONING_OPTIONS: { value: ReasoningEffort; label: string; icon: typeof Zap }[] = [
  { value: 'none', label: 'None', icon: Zap },
  { value: 'low', label: 'Light', icon: Zap },
  { value: 'medium', label: 'Standard', icon: Brain },
  { value: 'high', label: 'Deep', icon: Sparkles },
];

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
  const selectedReasoning = REASONING_OPTIONS.find(r => r.value === reasoning) || REASONING_OPTIONS[0];
  const versionsForProvider = VERSIONS[selectedModel.provider];

  const handleProviderChange = (provider: ModelProvider) => {
    // Pick the first version of the new provider
    const firstVersion = VERSIONS[provider][0];
    onModelChange(firstVersion.id);
  };

  const btnClass = "h-auto px-2 py-0 text-base font-normal text-muted-foreground gap-1 hover:text-foreground";

  return (
    <div className="flex items-center gap-0.5">
      {/* 1. Provider */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <Button variant="ghost" size="sm" className={btnClass}>
            {selectedProvider.label}
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {PROVIDERS.map(p => (
            <DropdownMenuItem
              key={p.id}
              onClick={() => handleProviderChange(p.id)}
              className={selectedProvider.id === p.id ? 'bg-accent' : ''}
            >
              <span className="text-sm">{p.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="text-muted-foreground/40">·</span>

      {/* 2. Version */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <Button variant="ghost" size="sm" className={btnClass}>
            <span className={TIER_COLORS[selectedModel.tier]}>●</span>
            {selectedModel.label}
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {versionsForProvider.map(m => (
            <DropdownMenuItem
              key={m.id}
              onClick={() => onModelChange(m.id)}
              className={`flex items-center justify-between ${selectedModel.id === m.id ? 'bg-accent' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-[10px] ${TIER_COLORS[m.tier]}`}>●</span>
                <span className="text-sm">{m.label}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{m.description}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="text-muted-foreground/40">·</span>

      {/* 3. Reasoning */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <Button variant="ghost" size="sm" className={btnClass}>
            <selectedReasoning.icon className="h-3.5 w-3.5" />
            {selectedReasoning.label}
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          {REASONING_OPTIONS.map(r => (
            <DropdownMenuItem
              key={r.value}
              onClick={() => onReasoningChange(r.value)}
              className={selectedReasoning.value === r.value ? 'bg-accent' : ''}
            >
              <div className="flex items-center gap-2">
                <r.icon className="h-3.5 w-3.5" />
                <span className="text-sm">{r.label}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
