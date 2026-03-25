import { useState } from 'react';
import { ChevronDown, Zap, Brain, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

export type ModelProvider = 'gemini' | 'gpt' | 'claude' | 'perplexity';

export type ModelOption = {
  id: string;
  label: string;
  provider: ModelProvider;
  description: string;
  tier: 'fast' | 'balanced' | 'powerful';
};

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';

export const MODEL_OPTIONS: ModelOption[] = [
  // Gemini
  { id: 'google/gemini-2.5-flash-lite', label: 'Flash Lite', provider: 'gemini', description: 'Fastest, cheapest', tier: 'fast' },
  { id: 'google/gemini-2.5-flash', label: 'Flash 2.5', provider: 'gemini', description: 'Fast & capable', tier: 'fast' },
  { id: 'google/gemini-3-flash-preview', label: 'Flash 3.0', provider: 'gemini', description: 'Latest fast model', tier: 'balanced' },
  { id: 'google/gemini-2.5-pro', label: 'Pro 2.5', provider: 'gemini', description: 'Best reasoning', tier: 'powerful' },
  { id: 'google/gemini-3.1-pro-preview', label: 'Pro 3.1', provider: 'gemini', description: 'Latest flagship', tier: 'powerful' },
  // Claude
  { id: 'claude-haiku', label: 'Haiku', provider: 'claude', description: 'Fast & affordable', tier: 'fast' },
  { id: 'claude-sonnet', label: 'Sonnet 4', provider: 'claude', description: 'Best balance', tier: 'balanced' },
  { id: 'claude-opus', label: 'Opus 4', provider: 'claude', description: 'Most capable', tier: 'powerful' },
  // GPT
  { id: 'openai/gpt-5-nano', label: 'GPT-5 Nano', provider: 'gpt', description: 'Fast & efficient', tier: 'fast' },
  { id: 'openai/gpt-5-mini', label: 'GPT-5 Mini', provider: 'gpt', description: 'Balanced performance', tier: 'balanced' },
  { id: 'openai/gpt-5', label: 'GPT-5', provider: 'gpt', description: 'Powerful all-rounder', tier: 'powerful' },
  { id: 'openai/gpt-5.2', label: 'GPT-5.2', provider: 'gpt', description: 'Latest, best reasoning', tier: 'powerful' },
];

export const REASONING_OPTIONS: { value: ReasoningEffort; label: string; icon: typeof Zap; description: string }[] = [
  { value: 'none', label: 'None', icon: Zap, description: 'No extra reasoning' },
  { value: 'low', label: 'Light', icon: Zap, description: 'Quick reasoning' },
  { value: 'medium', label: 'Standard', icon: Brain, description: 'Balanced depth' },
  { value: 'high', label: 'Deep', icon: Sparkles, description: 'Maximum depth' },
];

const TIER_COLORS: Record<string, string> = {
  fast: 'text-emerald-500',
  balanced: 'text-blue-500',
  powerful: 'text-amber-500',
};

const PROVIDER_LABELS: Record<ModelProvider, string> = {
  gemini: 'Gemini',
  gpt: 'GPT',
  claude: 'Claude',
};

type Props = {
  model: string;
  reasoning: ReasoningEffort;
  onModelChange: (model: string) => void;
  onReasoningChange: (reasoning: ReasoningEffort) => void;
  disabled?: boolean;
};

export function ChatModelSelector({ model, reasoning, onModelChange, onReasoningChange, disabled }: Props) {
  const selectedModel = MODEL_OPTIONS.find(m => m.id === model) || MODEL_OPTIONS[2]; // default Flash 3.0
  const selectedReasoning = REASONING_OPTIONS.find(r => r.value === reasoning) || REASONING_OPTIONS[0];

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Model selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-muted-foreground gap-1">
            <span className={TIER_COLORS[selectedModel.tier]}>●</span>
            {selectedModel.label}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal">Gemini</DropdownMenuLabel>
          {MODEL_OPTIONS.filter(m => m.provider === 'gemini').map(m => (
            <DropdownMenuItem
              key={m.id}
              onClick={() => onModelChange(m.id)}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className={`text-[10px] ${TIER_COLORS[m.tier]}`}>●</span>
                <span className="text-sm">{m.label}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{m.description}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal">Claude</DropdownMenuLabel>
          {MODEL_OPTIONS.filter(m => m.provider === 'claude').map(m => (
            <DropdownMenuItem
              key={m.id}
              onClick={() => onModelChange(m.id)}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className={`text-[10px] ${TIER_COLORS[m.tier]}`}>●</span>
                <span className="text-sm">{m.label}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{m.description}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal">GPT</DropdownMenuLabel>
          {MODEL_OPTIONS.filter(m => m.provider === 'gpt').map(m => (
            <DropdownMenuItem
              key={m.id}
              onClick={() => onModelChange(m.id)}
              className="flex items-center justify-between"
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

      {/* Reasoning selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-muted-foreground gap-1">
            <selectedReasoning.icon className="h-3 w-3" />
            {selectedReasoning.label}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal">Reasoning Depth</DropdownMenuLabel>
          {REASONING_OPTIONS.map(r => (
            <DropdownMenuItem
              key={r.value}
              onClick={() => onReasoningChange(r.value)}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <r.icon className="h-3.5 w-3.5" />
                <span className="text-sm">{r.label}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{r.description}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
