import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, Sparkles, Zap, LogOut, Shield, FileText, MessageSquare, User as UserIcon, Loader2, RefreshCw, Building2, Briefcase, MapPin, Globe, Sun, Moon, Monitor, FileQuestion } from 'lucide-react';
import { useTheme } from 'next-themes';
import AppHeader from '@/components/AppHeader';
import { PROVIDERS, VERSIONS, MODEL_OPTIONS, type ModelProvider, type ReasoningEffort } from '@/components/chat/ChatModelSelector';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PromptLibrary } from '@/components/PromptLibrary';

const TIER_DOT: Record<string, string> = {
  fast: 'bg-emerald-500',
  balanced: 'bg-blue-500',
  powerful: 'bg-amber-500',
};

const DEFAULT_BEST: Record<ModelProvider, string> = {
  gemini: 'google/gemini-3.1-pro-preview',
  claude: 'claude-opus',
  gpt: 'openai/gpt-5.2',
  perplexity: 'perplexity-sonar-reasoning-pro',
  council: 'council-synthesis',
};

const DEFAULT_REASONING: Record<ModelProvider, ReasoningEffort> = {
  gemini: 'medium',
  claude: 'high',
  gpt: 'medium',
  perplexity: 'none',
  council: 'none',
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, profile, isAdmin, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  // Chat mode: 'individual' or 'council'
  const [chatMode, setChatModeRaw] = useState<'individual' | 'council'>(
    () => (localStorage.getItem('chat-mode') as 'individual' | 'council') || 'individual'
  );
  const setChatMode = (mode: 'individual' | 'council') => {
    setChatModeRaw(mode);
    localStorage.setItem('chat-mode', mode);
    // Also update the active provider/model to match
    if (mode === 'council') {
      setProvider('council');
      localStorage.setItem('chat-provider', 'council');
      setModel('council-synthesis');
      localStorage.setItem('chat-model', 'council-synthesis');
    } else {
      const savedProvider = localStorage.getItem('chat-individual-provider') as ModelProvider || 'gemini';
      const savedModel = localStorage.getItem('chat-individual-model') || DEFAULT_BEST[savedProvider];
      setProvider(savedProvider);
      localStorage.setItem('chat-provider', savedProvider);
      setModel(savedModel);
      localStorage.setItem('chat-model', savedModel);
    }
  };

  const [provider, setProvider] = useState<ModelProvider>(
    () => (localStorage.getItem('chat-provider') as ModelProvider) || 'gemini'
  );
  const [model, setModel] = useState(
    () => localStorage.getItem('chat-model') || 'google/gemini-3.1-pro-preview'
  );
  const [reasoning, setReasoning] = useState<ReasoningEffort>(
    () => {
      const p = (localStorage.getItem('chat-provider') as ModelProvider) || 'gemini';
      return DEFAULT_REASONING[p] || 'medium';
    }
  );

  // Council model slots
  type CouncilSlot = { provider: ModelProvider; modelId: string; reasoning?: ReasoningEffort };
  const defaultCouncilSlots: CouncilSlot[] = [
    { provider: 'gemini', modelId: 'google/gemini-3-flash-preview', reasoning: 'none' },
    { provider: 'claude', modelId: 'claude-sonnet', reasoning: 'none' },
    { provider: 'gpt', modelId: 'openai/gpt-5-mini', reasoning: 'none' },
  ];
  const [councilSlots, setCouncilSlots] = useState<CouncilSlot[]>(() => {
    try {
      const saved = localStorage.getItem('council-models');
      return saved ? JSON.parse(saved) : defaultCouncilSlots;
    } catch { return defaultCouncilSlots; }
  });
  const updateCouncilSlot = (index: number, modelId: string) => {
    const modelOpt = MODEL_OPTIONS.find(m => m.id === modelId);
    if (!modelOpt) return;
    const next = [...councilSlots];
    // Reset reasoning if new model doesn't support current reasoning
    const currentReasoning = next[index]?.reasoning || 'none';
    const newReasoning = modelOpt.reasoning.includes(currentReasoning) ? currentReasoning : 'none';
    next[index] = { provider: modelOpt.provider, modelId, reasoning: newReasoning };
    setCouncilSlots(next);
    localStorage.setItem('council-models', JSON.stringify(next));
  };
  const updateCouncilSlotReasoning = (index: number, reasoning: ReasoningEffort) => {
    const next = [...councilSlots];
    next[index] = { ...next[index], reasoning };
    setCouncilSlots(next);
    localStorage.setItem('council-models', JSON.stringify(next));
  };

  // Synthesis model for council
  const [synthesisModel, setSynthesisModel] = useState<CouncilSlot>(() => {
    try {
      const saved = localStorage.getItem('council-synthesis-model');
      return saved ? JSON.parse(saved) : { provider: 'claude' as ModelProvider, modelId: 'claude-opus', reasoning: 'high' };
    } catch { return { provider: 'claude' as ModelProvider, modelId: 'claude-opus', reasoning: 'high' }; }
  });
  const updateSynthesisModel = (modelId: string) => {
    const modelOpt = MODEL_OPTIONS.find(m => m.id === modelId);
    if (!modelOpt) return;
    const currentReasoning = synthesisModel.reasoning || 'none';
    const newReasoning = modelOpt.reasoning.includes(currentReasoning) ? currentReasoning : 'none';
    const next = { provider: modelOpt.provider, modelId, reasoning: newReasoning };
    setSynthesisModel(next);
    localStorage.setItem('council-synthesis-model', JSON.stringify(next));
  };
  const updateSynthesisReasoning = (reasoning: ReasoningEffort) => {
    const next = { ...synthesisModel, reasoning };
    setSynthesisModel(next);
    localStorage.setItem('council-synthesis-model', JSON.stringify(next));
  };

  const [matchCount, setMatchCount] = useState(
    () => parseInt(localStorage.getItem('rag-match-count') || '50', 10)
  );
  const [matchThreshold, setMatchThreshold] = useState(
    () => parseFloat(localStorage.getItem('rag-match-threshold') || '0.15')
  );
  const [contextWindowSize, setContextWindowSize] = useState<'small' | 'medium' | 'large'>(
    () => (localStorage.getItem('ai-context-window') as 'small' | 'medium' | 'large') || 'medium'
  );

  // Google Docs import settings
  const [tabMode, setTabMode] = useState<'all' | 'choose'>(
    () => (localStorage.getItem('drive-tab-mode') as 'all' | 'choose') || 'all'
  );
  const [tabDocMode, setTabDocMode] = useState<'separate' | 'merged'>(
    () => (localStorage.getItem('drive-tab-doc-mode') as 'separate' | 'merged') || 'separate'
  );

  // Style & tone preset
  const TONE_PRESETS = [
    { id: 'default', label: 'Default', description: 'Preset style and tone' },
    { id: 'professional', label: 'Professional', description: 'Polished and precise' },
    { id: 'friendly', label: 'Friendly', description: 'Warm and chatty' },
    { id: 'candid', label: 'Candid', description: 'Direct and encouraging' },
    { id: 'quirky', label: 'Quirky', description: 'Playful and imaginative' },
    { id: 'efficient', label: 'Efficient', description: 'Concise and plain' },
    { id: 'cynical', label: 'Cynical', description: 'Critical and sarcastic' },
  ] as const;

  const [tonePreset, setTonePreset] = useState(
    () => localStorage.getItem('ai-tone-preset') || 'default'
  );

  // Per-characteristic levels
  const CHARACTERISTICS = [
    { id: 'warmth', label: 'Warmth & Friendliness', description: 'How personable and approachable' },
    { id: 'emoji', label: 'Emoji Usage', description: 'Frequency of emoji in responses' },
    { id: 'headers-lists', label: 'Tables & Structure', description: 'Headers, lists, and tables' },
    { id: 'enthusiasm', label: 'Enthusiasm', description: 'Energy and excitement level' },
    { id: 'gifs', label: 'GIFs & Media', description: 'Include GIFs or visual media' },
    { id: 'verbosity', label: 'Detail Level', description: 'How thorough vs. concise' },
  ] as const;

  const CHAR_LEVELS = [
    { id: 'more', label: 'More' },
    { id: 'default', label: 'Default' },
    { id: 'less', label: 'Less' },
  ] as const;

  const [charSettings, setCharSettings] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('ai-char-settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    // Migrate from old single level
    const oldLevel = localStorage.getItem('ai-characteristics-level') || 'default';
    const defaults: Record<string, string> = {};
    CHARACTERISTICS.forEach(c => { defaults[c.id] = oldLevel; });
    return defaults;
  });

  const updateCharSetting = (id: string, level: string) => {
    const updated = { ...charSettings, [id]: level };
    setCharSettings(updated);
    localStorage.setItem('ai-char-settings', JSON.stringify(updated));
    // Build backward-compat characteristics array
    const traits: string[] = [];
    if (updated.warmth === 'more') traits.push('warm');
    if (updated.enthusiasm === 'more') traits.push('enthusiastic');
    if (updated['headers-lists'] !== 'less') traits.push('headers-lists');
    if (updated.emoji === 'more') traits.push('emoji');
    if (updated.gifs === 'more') traits.push('gifs');
    if (updated.verbosity === 'more') traits.push('verbose');
    localStorage.setItem('ai-characteristics', JSON.stringify(traits));
    localStorage.setItem('ai-characteristics-level', 
      Object.values(updated).every(v => v === 'more') ? 'more' 
      : Object.values(updated).every(v => v === 'less') ? 'less' 
      : 'default'
    );
  };
  const [customInstructions, setCustomInstructions] = useState(
    () => localStorage.getItem('ai-custom-instructions') || ''
  );

  // About Me - enriched profile
  const [aboutMe, setAboutMe] = useState<Record<string, any> | null>(() => {
    try { const s = localStorage.getItem('ai-about-me'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [enriching, setEnriching] = useState(false);

  const enrichProfile = useCallback(async () => {
    if (!user?.email) { toast.error('No email available'); return; }
    setEnriching(true);
    try {
      const nameParts = (profile?.display_name || '').split(' ');
      const { data, error } = await supabase.functions.invoke('apollo-enrich', {
        body: { email: user.email, firstName: nameParts[0] || undefined, lastName: nameParts.slice(1).join(' ') || undefined },
      });
      if (error) { toast.error('Could not enrich profile'); return; }
      const person = data?.data?.person || data?.data || (data?.found ? data : null);
      if (!person) { toast.error('No profile data found'); return; }

      const emailDomain = user.email.split('@')[1];
      const apolloOrgDomain = person.organizationDomain || person.organization?.primary_domain;

      // Try to find the employment entry matching the user's email domain
      const empHistory: any[] = person.employmentHistory || [];
      const matchingJob = empHistory.find((e: any) =>
        e.current && e.organizationName && apolloOrgDomain && emailDomain &&
        (apolloOrgDomain.toLowerCase().includes(emailDomain.split('.')[0].toLowerCase()) ||
         emailDomain.toLowerCase().includes((e.organizationName || '').toLowerCase().replace(/[^a-z0-9]/g, '')))
      ) || empHistory.find((e: any) =>
        e.current && e.organizationName
      );

      // Prefer org data that matches email domain over Apollo's default org
      const emailMatchesApolloOrg = apolloOrgDomain && emailDomain &&
        apolloOrgDomain.toLowerCase().replace(/^www\./, '') === emailDomain.toLowerCase();
      
      // If Apollo's org doesn't match email domain, try to use the matching job's org name
      const primaryOrgName = emailMatchesApolloOrg
        ? (person.organizationName || person.organization?.name)
        : (matchingJob?.organizationName || person.organizationName || person.organization?.name);

      const orgDomain = emailMatchesApolloOrg ? apolloOrgDomain : (emailDomain || apolloOrgDomain);

      const enriched: Record<string, any> = {
        name: (person.name && person.name.trim()) || (person.firstName && person.lastName ? `${person.firstName} ${person.lastName}`.trim() : '') || profile?.display_name,
        title: person.title,
        headline: person.headline,
        photoUrl: person.photoUrl || person.photo_url,
        email: person.email || user.email,
        phone: person.phone,
        city: person.city || person.organizationCity,
        state: person.state || person.organizationState,
        country: person.country || person.organizationCountry,
        linkedin: person.linkedinUrl || person.linkedin_url,
        twitter: person.twitterUrl || person.twitter_url,
        github: person.githubUrl || person.github_url,
        seniority: person.seniority,
        departments: person.departments,
        employmentHistory: empHistory,
        organization: primaryOrgName,
        orgIndustry: emailMatchesApolloOrg ? (person.organizationIndustry || person.organization?.industry) : null,
        orgSize: emailMatchesApolloOrg ? (person.organizationSize || person.organization?.estimated_num_employees) : null,
        orgWebsite: orgDomain,
        orgLogo: emailMatchesApolloOrg ? (person.organizationLogo || person.organization?.logo_url) : null,
        orgDescription: emailMatchesApolloOrg ? (person.organizationDescription || person.organization?.short_description) : null,
        orgFounded: emailMatchesApolloOrg ? (person.organizationFounded || person.organization?.founded_year) : null,
        orgRevenue: emailMatchesApolloOrg ? person.organizationRevenue : null,
        orgKeywords: emailMatchesApolloOrg ? (person.organizationKeywords || []) : [],
        orgTechnologies: emailMatchesApolloOrg ? (person.organizationTechnologies || []) : [],
        orgCity: person.organizationCity,
        orgState: person.organizationState,
        orgCountry: person.organizationCountry,
        orgLinkedin: person.organizationLinkedin,
        orgHeadcountGrowth6mo: person.organizationHeadcountGrowth6mo,
        orgHeadcountGrowth12mo: person.organizationHeadcountGrowth12mo,
      };

      // Also fetch Ocean.io for deeper company data using email domain
      if (orgDomain) {
        try {
          const { data: oceanData } = await supabase.functions.invoke('ocean-enrich', {
            body: { domain: orgDomain },
          });
          if (oceanData?.success) {
            enriched.oceanCompany = oceanData;
          }
        } catch { /* Ocean is optional */ }
      }

      setAboutMe(enriched);
      localStorage.setItem('ai-about-me', JSON.stringify(enriched));
      toast.success('Profile enriched!');
    } catch {
      toast.error('Failed to enrich profile');
    } finally {
      setEnriching(false);
    }
  }, [user, profile]);

  // Personal bio & role
  const [personalBio, setPersonalBio] = useState(
    () => localStorage.getItem('ai-personal-bio') || ''
  );
  const [myRole, setMyRole] = useState(
    () => localStorage.getItem('ai-my-role') || ''
  );

  // Location & timezone (auto-detected via IP)
  const [locationData, setLocationData] = useState<Record<string, any> | null>(() => {
    try { const s = localStorage.getItem('ai-location'); return s ? JSON.parse(s) : null; } catch { return null; }
  });

  useEffect(() => {
    // Auto-detect location if not cached
    if (!locationData) {
      fetch('https://ipapi.co/json/')
        .then(r => r.json())
        .then(data => {
          if (data?.city) {
            const loc = {
              city: data.city,
              region: data.region,
              country: data.country_name,
              timezone: data.timezone,
            };
            setLocationData(loc);
            localStorage.setItem('ai-location', JSON.stringify(loc));
          }
        })
        .catch(() => {});
    }
  }, []);

  // Auto-enrich on first visit if logged in and no data yet
  useEffect(() => {
    if (user?.email && !aboutMe && !enriching) {
      enrichProfile();
    }
  }, [user?.email]);
  const handleProviderChange = (p: ModelProvider) => {
    setProvider(p);
    localStorage.setItem('chat-provider', p);
    localStorage.setItem('chat-individual-provider', p);
    const best = DEFAULT_BEST[p] || VERSIONS[p]?.[VERSIONS[p].length - 1]?.id;
    if (best) {
      setModel(best);
      localStorage.setItem('chat-model', best);
      localStorage.setItem('chat-individual-model', best);
    }
    setReasoning(DEFAULT_REASONING[p] || 'none');
  };

  const handleModelChange = (id: string) => {
    setModel(id);
    localStorage.setItem('chat-model', id);
    localStorage.setItem('chat-individual-model', id);
  };

  useEffect(() => {
    localStorage.setItem('rag-match-count', String(matchCount));
  }, [matchCount]);

  useEffect(() => {
    localStorage.setItem('rag-match-threshold', String(matchThreshold));
  }, [matchThreshold]);

  const versions = VERSIONS[provider] || [];
  const activeModel = versions.find(v => v.id === model);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-12">
        {/* ── AI Model ── */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">AI Model Defaults</h2>
            <p className="text-sm text-muted-foreground mt-1">Choose your default chat mode and configure models for each.</p>
          </div>

          {/* Mode toggle */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Default Chat Mode</label>
            <div className="flex gap-2">
              <Button
                variant={chatMode === 'individual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChatMode('individual')}
                className="gap-1.5"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Individual
              </Button>
              <Button
                variant={chatMode === 'council' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChatMode('council')}
                className="gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Model Council
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {chatMode === 'individual'
                ? 'Chat uses a single model. Fast and focused.'
                : 'Chat runs 3 models in parallel, then synthesizes the best answer from all three.'}
            </p>
          </div>

          {/* ── Individual model settings ── */}
          {chatMode === 'individual' && (
            <div className="space-y-6">
              {/* Provider tabs — exclude council */}
              <div className="flex gap-2">
                {PROVIDERS.filter(p => p.id !== 'council').map(p => (
                  <Button
                    key={p.id}
                    variant={provider === p.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleProviderChange(p.id)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>

              {/* Model grid */}
              <div className="grid gap-3 sm:grid-cols-2">
                {versions.map(v => (
                  <button
                    key={v.id}
                    onClick={() => handleModelChange(v.id)}
                    className={`text-left rounded-lg border p-4 transition-all ${
                      model === v.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${TIER_DOT[v.tier]}`} />
                      <span className="font-medium">{v.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{v.description}</p>
                  </button>
                ))}
              </div>

              {/* Reasoning effort */}
              {activeModel && activeModel.reasoning.length > 1 && (
                <div className="space-y-3">
                  <label className="text-sm font-medium">Reasoning Effort</label>
                  <div className="flex gap-2">
                    {activeModel.reasoning.map(r => {
                      const label = activeModel.reasoningLabels?.[r] || (r === 'none' ? 'Fast' : r === 'medium' ? 'Thinking' : r === 'high' ? 'Pro' : r);
                      const Icon = r === 'high' ? Sparkles : r === 'medium' ? Brain : Zap;
                      return (
                        <Button
                          key={r}
                          variant={reasoning === r ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setReasoning(r)}
                          className="gap-1.5"
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Model Council settings ── */}
          {chatMode === 'council' && (() => {
            const COUNCIL_PRESETS: { id: string; label: string; icon: typeof Zap; description: string; slots: CouncilSlot[] }[] = [
              {
                id: 'faster', label: 'Faster', icon: Zap, description: 'Cheapest & fastest',
                slots: [
                  { provider: 'gemini', modelId: 'google/gemini-2.5-flash-lite', reasoning: 'none' },
                  { provider: 'claude', modelId: 'claude-haiku', reasoning: 'none' },
                  { provider: 'gpt', modelId: 'openai/gpt-5-nano', reasoning: 'none' },
                ],
              },
              {
                id: 'default', label: 'Balanced', icon: Brain, description: 'Good quality, reasonable speed',
                slots: [
                  { provider: 'gemini', modelId: 'google/gemini-3-flash-preview', reasoning: 'none' },
                  { provider: 'claude', modelId: 'claude-sonnet', reasoning: 'none' },
                  { provider: 'gpt', modelId: 'openai/gpt-5-mini', reasoning: 'none' },
                ],
              },
              {
                id: 'deeper', label: 'Deeper', icon: Sparkles, description: 'Best models with reasoning',
                slots: [
                  { provider: 'gemini', modelId: 'google/gemini-3.1-pro-preview', reasoning: 'high' },
                  { provider: 'claude', modelId: 'claude-opus', reasoning: 'high' },
                  { provider: 'gpt', modelId: 'openai/gpt-5.2', reasoning: 'high' },
                ],
              },
            ];
            const activePresetId = COUNCIL_PRESETS.find(p =>
              p.slots.every((s, i) => councilSlots[i]?.modelId === s.modelId && (councilSlots[i]?.reasoning || 'none') === s.reasoning)
            )?.id || null;

            return (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Choose which 3 models participate in the council. Each runs independently, then a synthesis model merges the results.</p>

              {/* Presets */}
              <div className="flex gap-2">
                {COUNCIL_PRESETS.map(preset => {
                  const Icon = preset.icon;
                  return (
                    <Button
                      key={preset.id}
                      variant={activePresetId === preset.id ? 'default' : 'outline'}
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        setCouncilSlots(preset.slots);
                        localStorage.setItem('council-models', JSON.stringify(preset.slots));
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {activePresetId ? COUNCIL_PRESETS.find(p => p.id === activePresetId)?.description : 'Custom configuration'}
              </p>

              {councilSlots.map((slot, i) => {
                const slotModel = MODEL_OPTIONS.find(m => m.id === slot.modelId);
                const slotReasoning = slotModel?.reasoning || ['none'];
                const hasReasoning = slotReasoning.length > 1;
                return (
                  <div key={i} className="space-y-1.5">
                    <label className="text-sm font-medium">Model {i + 1}</label>
                    <div className="flex gap-2">
                      <Select value={slot.modelId} onValueChange={(v) => updateCouncilSlot(i, v)}>
                        <SelectTrigger className="w-[220px]">
                          <SelectValue>
                            {slotModel ? `${slotModel.label}` : 'Select model'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-w-[260px]">
                          {PROVIDERS.filter(p => p.id !== 'council').map(p => {
                            const models = VERSIONS[p.id] || [];
                            if (models.length === 0) return null;
                            return [
                              <div key={`hdr-${p.id}`} className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5 font-medium mt-1 first:mt-0">
                                {p.label}
                              </div>,
                              ...models.map(m => (
                                <SelectItem key={m.id} value={m.id}>
                                  <div className="flex items-center gap-2">
                                    <span className={`h-2 w-2 rounded-full shrink-0 ${TIER_DOT[m.tier]}`} />
                                    <span className="truncate">{m.label}</span>
                                  </div>
                                </SelectItem>
                              ))
                            ];
                          })}
                        </SelectContent>
                      </Select>
                      {hasReasoning && (
                        <Select value={slot.reasoning || 'none'} onValueChange={(v) => updateCouncilSlotReasoning(i, v as ReasoningEffort)}>
                          <SelectTrigger className="w-[130px]">
                            <SelectValue>
                              {slotModel?.reasoningLabels?.[slot.reasoning || 'none'] || (slot.reasoning === 'none' ? 'Fast' : slot.reasoning === 'medium' ? 'Thinking' : 'Pro')}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {slotReasoning.map(r => (
                              <SelectItem key={r} value={r}>
                                {slotModel?.reasoningLabels?.[r] || (r === 'none' ? 'Fast' : r === 'medium' ? 'Thinking' : r === 'high' ? 'Pro' : r)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Synthesis model */}
              <div className="space-y-1.5 pt-2 border-t border-border">
                <label className="text-sm font-medium">Synthesis Model</label>
                <p className="text-xs text-muted-foreground">Merges all three responses into a final answer.</p>
                <div className="flex gap-2">
                  <Select value={synthesisModel.modelId} onValueChange={updateSynthesisModel}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue>
                        {MODEL_OPTIONS.find(m => m.id === synthesisModel.modelId)?.label || 'Select model'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-w-[260px]">
                      {PROVIDERS.filter(p => p.id !== 'council').map(p => {
                        const models = VERSIONS[p.id] || [];
                        if (models.length === 0) return null;
                        return [
                          <div key={`synth-hdr-${p.id}`} className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5 font-medium mt-1 first:mt-0">
                            {p.label}
                          </div>,
                          ...models.map(m => (
                            <SelectItem key={m.id} value={m.id}>
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full shrink-0 ${TIER_DOT[m.tier]}`} />
                                <span className="truncate">{m.label}</span>
                              </div>
                            </SelectItem>
                          ))
                        ];
                      })}
                    </SelectContent>
                  </Select>
                  {(() => {
                    const synthModelOpt = MODEL_OPTIONS.find(m => m.id === synthesisModel.modelId);
                    const synthReasoning = synthModelOpt?.reasoning || ['none'];
                    if (synthReasoning.length <= 1) return null;
                    return (
                      <Select value={synthesisModel.reasoning || 'none'} onValueChange={(v) => updateSynthesisReasoning(v as ReasoningEffort)}>
                        <SelectTrigger className="w-[130px]">
                          <SelectValue>
                            {synthModelOpt?.reasoningLabels?.[synthesisModel.reasoning || 'none'] || (synthesisModel.reasoning === 'none' ? 'Fast' : synthesisModel.reasoning === 'medium' ? 'Thinking' : 'Pro')}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {synthReasoning.map(r => (
                            <SelectItem key={r} value={r}>
                              {synthModelOpt?.reasoningLabels?.[r] || (r === 'none' ? 'Fast' : r === 'medium' ? 'Thinking' : r === 'high' ? 'Pro' : r)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  })()}
                </div>
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                <p className="text-xs text-foreground/80 leading-relaxed">
                  💡 For best results, choose models from different providers (e.g., one Gemini, one GPT, one Claude) to get diverse perspectives.
                </p>
              </div>
            </div>
            );
          })()}
        </section>

        <div className="border-t border-border" />

        {/* ── Knowledge Context ── */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Knowledge Context</h2>
            <p className="text-sm text-muted-foreground mt-1">Control how much of the knowledge base the AI reads when answering questions.</p>
          </div>

          {/* Presets */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { name: '⚡ Quick & Loose', desc: 'Minimal reading, fast responses. Good for simple questions where speed matters most.', chunks: 15, threshold: 0.10 },
              { name: '🎯 Everyday Driver', desc: 'Recommended default. Balanced depth and speed for most questions.', chunks: 50, threshold: 0.15 },
              { name: '🔬 Gotta Be Right', desc: 'Exhaustive search, strict filtering. Use when accuracy is critical and speed isn\'t.', chunks: 100, threshold: 0.50 },
            ].map(p => {
              const active = matchCount === p.chunks && Math.abs(matchThreshold - p.threshold) < 0.01;
              return (
                <button
                  key={p.name}
                  onClick={() => { setMatchCount(p.chunks); setMatchThreshold(p.threshold); }}
                  className={`text-left rounded-lg border px-3 py-2.5 transition-all ${active ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-border hover:border-primary/40 hover:bg-muted/50'}`}
                >
                  <p className={`text-sm font-semibold ${active ? 'text-primary' : ''}`}>{p.name}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{p.desc}</p>
                </button>
              );
            })}
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">How much to read</label>
                <span className="text-sm text-muted-foreground tabular-nums">{matchCount} chunks</span>
              </div>
              <Slider
                value={[matchCount]}
                onValueChange={([v]) => setMatchCount(v)}
                min={5}
                max={100}
                step={5}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Less · Faster</span>
                <span>More · Slower</span>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 leading-relaxed">
                {matchCount <= 15
                  ? 'Minimal context — the AI reads only the most relevant snippets. Responses are fast but may miss important details spread across your knowledge base.'
                  : matchCount <= 35
                  ? 'Moderate context — a good balance of speed and coverage. The AI pulls in enough material to give informed answers without being overwhelmed.'
                  : matchCount <= 65
                  ? 'Broad context — the AI reads a large portion of matching documents. Great for complex questions that draw on multiple sources, though responses may take a bit longer.'
                  : 'Maximum context — the AI considers nearly everything relevant in your knowledge base. Best for deep research or comprehensive answers, but expect slower response times.'}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">How picky to be</label>
                <span className="text-sm text-muted-foreground tabular-nums">{(matchThreshold * 100).toFixed(0)}% similarity</span>
              </div>
              <Slider
                value={[matchThreshold * 100]}
                onValueChange={([v]) => setMatchThreshold(v / 100)}
                min={5}
                max={80}
                step={5}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Less picky · Broader</span>
                <span>More picky · Precise</span>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 leading-relaxed">
                {matchThreshold <= 0.15
                  ? 'Very loose matching — the AI will consider documents even if they\'re only loosely related to your question. Good for exploratory queries, but may include some irrelevant context.'
                  : matchThreshold <= 0.30
                  ? 'Balanced matching — documents need to be reasonably related to your question. This filters out noise while still surfacing useful context that isn\'t an exact match.'
                  : matchThreshold <= 0.55
                  ? 'Strict matching — only documents closely related to your question are included. Reduces noise significantly, but may miss tangentially relevant information.'
                  : 'Very strict matching — only highly relevant documents are considered. Best when you want precise, focused answers and your knowledge base is well-organized. May return fewer results.'}
              </p>
            </div>

            {/* Combined interaction callout */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                💡 How these combine
              </p>
              <p className="text-xs text-foreground/80 leading-relaxed">
                {matchCount <= 25 && matchThreshold <= 0.20
                  ? 'The AI will quickly scan a small number of loosely related documents. Fast and exploratory, but answers may lack depth or include tangential information.'
                  : matchCount <= 25 && matchThreshold <= 0.45
                  ? 'The AI reads a small set of reasonably relevant documents. Quick and fairly focused — good for simple, direct questions.'
                  : matchCount <= 25
                  ? 'The AI reads very few, highly relevant documents. Lightning-fast and laser-focused, but may miss useful context that doesn\'t exactly match your question.'
                  : matchCount <= 60 && matchThreshold <= 0.20
                  ? 'The AI reads a good amount of broadly related material. Balanced speed with wide coverage — great for general exploration and open-ended questions.'
                  : matchCount <= 60 && matchThreshold <= 0.45
                  ? 'The AI reads a solid amount of well-matched documents. The sweet spot for most use cases — thorough answers without too much noise or wait time.'
                  : matchCount <= 60
                  ? 'The AI reads a moderate amount of strictly relevant documents. Focused and thorough — ideal when you want precise answers from well-organized knowledge.'
                  : matchThreshold <= 0.20
                  ? 'The AI casts the widest possible net, reading extensively from loosely related sources. Best for deep research where you don\'t want to miss anything, but expect slower responses with some noise.'
                  : matchThreshold <= 0.45
                  ? 'The AI reads extensively but filters for reasonable relevance. Comprehensive and balanced — great for complex questions that span multiple topics in your knowledge base.'
                  : 'The AI reads as much as possible but only from highly relevant sources. Maximum depth with maximum precision — best for thorough research on well-documented topics. Slowest but cleanest results.'}
              </p>
            </div>
          </div>
        </section>

        <div className="border-t border-border" />

        {/* ── Response Size ── */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Response Size</h2>
            <p className="text-sm text-muted-foreground mt-1">Control how long the AI's responses can be. This sets the maximum output tokens for the model.</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {([
              { key: 'small' as const, emoji: '⚡', label: 'Short', desc: 'Concise, quick answers. ~16K tokens max. Best for simple questions where you want fast, focused responses.' },
              { key: 'medium' as const, emoji: '⚖️', label: 'Medium', desc: 'Balanced depth and speed. ~64K tokens max. Recommended default for most conversations.' },
              { key: 'large' as const, emoji: '📖', label: 'Long', desc: 'Deep, thorough analysis. ~128K tokens max. Use for complex research or when you need exhaustive detail.' },
            ]).map(p => {
              const active = contextWindowSize === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => {
                    setContextWindowSize(p.key);
                    localStorage.setItem('ai-context-window', p.key);
                  }}
                  className={`text-left rounded-lg border px-3 py-2.5 transition-all ${active ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-border hover:border-primary/40 hover:bg-muted/50'}`}
                >
                  <p className={`text-sm font-semibold ${active ? 'text-primary' : ''}`}>{p.emoji} {p.label}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{p.desc}</p>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-xs text-foreground/80 leading-relaxed">
              💡 <strong>How this works:</strong> This controls the maximum number of tokens the AI can use in its response. "Short" keeps answers concise and fast. "Medium" gives the AI room for detailed explanations. "Long" allows maximum-depth analysis — useful for research questions but responses take longer.
              {contextWindowSize === 'small' && ' Claude models get 16K tokens, Gemini/GPT get 16K, Perplexity gets 4K.'}
              {contextWindowSize === 'medium' && ' Claude Opus gets 128K tokens, other Claude models get 64K, Gemini/GPT get 64K, Perplexity gets 16K.'}
              {contextWindowSize === 'large' && ' Claude Opus gets 128K tokens (max), Gemini/GPT get 128K, Perplexity gets 16K (max).'}
            </p>
          </div>
        </section>

        <div className="border-t border-border" />
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2"><Sparkles className="h-5 w-5" /> Style &amp; Tone</h2>
            <p className="text-sm text-muted-foreground mt-1">Set a personality preset for how the AI communicates with you.</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {TONE_PRESETS.map(t => (
              <button
                key={t.id}
                onClick={() => {
                  setTonePreset(t.id);
                  localStorage.setItem('ai-tone-preset', t.id);
                }}
                className={`text-left rounded-lg border p-4 transition-all ${
                  tonePreset === t.id
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <div className="font-medium text-sm">{t.label}</div>
                <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
              </button>
            ))}
          </div>

          {/* Characteristics */}
          <div className="space-y-3 pt-2">
            <label className="text-sm font-medium">Characteristics</label>
            <p className="text-xs text-muted-foreground">Fine-tune each aspect of the AI's personality. All are on — just set the level.</p>
            <div className="space-y-2">
              {CHARACTERISTICS.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="text-[11px] text-muted-foreground">{c.description}</p>
                  </div>
                  <Select value={charSettings[c.id] || 'default'} onValueChange={(v) => updateCharSetting(c.id, v)}>
                    <SelectTrigger className="w-[100px] h-8 text-xs shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHAR_LEVELS.map(l => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="border-t border-border" />

        {/* ── Custom Instructions ── */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Custom Instructions</h2>
            <p className="text-sm text-muted-foreground mt-1">Tell the AI how you'd like it to respond. These instructions are included in every conversation.</p>
          </div>

          <div className="space-y-3">
            <Textarea
              placeholder="e.g. Always respond in bullet points. Focus on actionable recommendations. Use a consultative tone. When analyzing competitors, prioritize SEO and content strategy insights."
              value={customInstructions}
              onChange={(e) => {
                setCustomInstructions(e.target.value);
                localStorage.setItem('ai-custom-instructions', e.target.value);
              }}
              className="min-h-[120px] resize-y text-sm"
              maxLength={2000}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {customInstructions.length > 0
                  ? 'These instructions will be applied to all future conversations.'
                  : 'No custom instructions set — the AI will use its default behavior.'}
              </p>
              <span className="text-xs text-muted-foreground tabular-nums">{customInstructions.length}/2,000</span>
            </div>
            {customInstructions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setCustomInstructions('');
                  localStorage.removeItem('ai-custom-instructions');
                }}
              >
                Clear instructions
              </Button>
            )}
          </div>
        </section>

        <div className="border-t border-border" />

        {/* ── About Me ── */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2"><UserIcon className="h-5 w-5" /> About Me</h2>
              <p className="text-sm text-muted-foreground mt-1">The AI uses this to personalize responses. Auto-populated from your professional profile.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={enrichProfile}
              disabled={enriching || !user?.email}
            >
              {enriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {aboutMe ? 'Refresh' : 'Look me up'}
            </Button>
          </div>

          {enriching && !aboutMe && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Looking you up…
            </div>
          )}


          {aboutMe && (
            <div className="rounded-lg border border-border p-4 space-y-5">
              {/* Person header */}
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={aboutMe.photoUrl || profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-lg">{(aboutMe.name || '?')[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-semibold text-lg leading-tight">{aboutMe.name}</p>
                  {aboutMe.title && <p className="text-sm text-muted-foreground">{aboutMe.title}</p>}
                  {aboutMe.headline && aboutMe.headline !== aboutMe.title && (
                    <p className="text-xs text-muted-foreground">{aboutMe.headline}</p>
                  )}
                  {/* Social links */}
                  <div className="flex gap-2 pt-1">
                    {aboutMe.linkedin && (
                      <a href={aboutMe.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground underline">LinkedIn</a>
                    )}
                    {aboutMe.twitter && (
                      <a href={aboutMe.twitter} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground underline">Twitter</a>
                    )}
                    {aboutMe.github && (
                      <a href={aboutMe.github} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground underline">GitHub</a>
                    )}
                  </div>
                </div>
              </div>

              {/* Person details grid */}
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                {aboutMe.organization && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span>{aboutMe.organization}{aboutMe.orgIndustry ? ` · ${aboutMe.orgIndustry}` : ''}</span>
                  </div>
                )}
                {aboutMe.seniority && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Shield className="h-4 w-4 shrink-0" />
                    <span className="capitalize">{aboutMe.seniority}{aboutMe.departments?.length ? ` · ${aboutMe.departments.join(', ')}` : ''}</span>
                  </div>
                )}
                {(aboutMe.city || aboutMe.state || aboutMe.country || locationData?.city) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>{[aboutMe.city || locationData?.city, aboutMe.state || locationData?.region, aboutMe.country || locationData?.country].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {aboutMe.orgWebsite && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="h-4 w-4 shrink-0" />
                    <a href={aboutMe.orgWebsite.startsWith('http') ? aboutMe.orgWebsite : `https://${aboutMe.orgWebsite}`} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">{aboutMe.orgWebsite.replace(/^https?:\/\//, '')}</a>
                  </div>
                )}
              </div>

              {/* Employment History */}
              {aboutMe.employmentHistory?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1.5"><Briefcase className="h-4 w-4" /> Work History</p>
                  <div className="space-y-1.5 pl-1">
                    {aboutMe.employmentHistory.filter((e: any) => e.title || e.organizationName).slice(0, 8).map((e: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 mt-2 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-medium">{e.title || 'Role'}</span>
                          {e.organizationName && <span className="text-muted-foreground"> at {e.organizationName}</span>}
                          {(e.startDate || e.endDate) && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({e.startDate || '?'} – {e.current ? 'Present' : e.endDate || '?'})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Company Details */}
              {(aboutMe.orgDescription || aboutMe.orgSize || aboutMe.orgFounded || aboutMe.orgRevenue) && (
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    {aboutMe.orgLogo && <img src={aboutMe.orgLogo} alt="" className="h-4 w-4 rounded" />}
                    <Building2 className="h-4 w-4" /> {aboutMe.organization || 'Company'}
                  </p>
                  {aboutMe.orgDescription && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{aboutMe.orgDescription}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {aboutMe.orgSize && <span>👥 ~{typeof aboutMe.orgSize === 'number' ? aboutMe.orgSize.toLocaleString() : aboutMe.orgSize} employees</span>}
                    {aboutMe.orgFounded && <span>📅 Founded {aboutMe.orgFounded}</span>}
                    {aboutMe.orgRevenue && <span>💰 {aboutMe.orgRevenue}</span>}
                    {aboutMe.orgHeadcountGrowth12mo != null && (
                      <span>{aboutMe.orgHeadcountGrowth12mo >= 0 ? '📈' : '📉'} {(aboutMe.orgHeadcountGrowth12mo * 100).toFixed(1)}% headcount (12mo)</span>
                    )}
                  </div>
                  {aboutMe.orgKeywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {aboutMe.orgKeywords.slice(0, 10).map((kw: string, i: number) => (
                        <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{kw}</span>
                      ))}
                    </div>
                  )}
                  {aboutMe.orgTechnologies?.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <p className="text-xs text-muted-foreground font-medium">Tech Stack</p>
                      <div className="flex flex-wrap gap-1">
                        {aboutMe.orgTechnologies.slice(0, 15).map((t: string, i: number) => (
                          <span key={i} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Ocean.io Company Data */}
              {aboutMe.oceanCompany && (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    {aboutMe.oceanCompany.logo && <img src={aboutMe.oceanCompany.logo} alt="" className="h-4 w-4 rounded" />}
                    Ocean.io · {aboutMe.oceanCompany.companyName || aboutMe.organization || 'Company Intel'}
                  </p>
                  {aboutMe.oceanCompany.description && aboutMe.oceanCompany.description !== aboutMe.orgDescription && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{aboutMe.oceanCompany.description}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {aboutMe.oceanCompany.employeeCountLinkedin && <span>👥 {aboutMe.oceanCompany.employeeCountLinkedin.toLocaleString()} employees (LinkedIn)</span>}
                    {aboutMe.oceanCompany.companySize && <span>📊 {aboutMe.oceanCompany.companySize}</span>}
                    {aboutMe.oceanCompany.revenue && <span>💰 {aboutMe.oceanCompany.revenue}</span>}
                    {aboutMe.oceanCompany.yearFounded && <span>📅 Founded {aboutMe.oceanCompany.yearFounded}</span>}
                    {aboutMe.oceanCompany.primaryCountry && <span>🌍 {aboutMe.oceanCompany.primaryCountry}</span>}
                    {aboutMe.oceanCompany.webTraffic?.monthlyVisits && <span>🌐 {Math.round(aboutMe.oceanCompany.webTraffic.monthlyVisits).toLocaleString()} visits/mo</span>}
                  </div>
                  {aboutMe.oceanCompany.industries?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {aboutMe.oceanCompany.industries.slice(0, 8).map((ind: string, i: number) => (
                        <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{ind}</span>
                      ))}
                    </div>
                  )}
                  {aboutMe.oceanCompany.technologies?.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <p className="text-xs text-muted-foreground font-medium">Technologies (Ocean)</p>
                      <div className="flex flex-wrap gap-1">
                        {aboutMe.oceanCompany.technologies.slice(0, 15).map((t: string, i: number) => (
                          <span key={i} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {aboutMe.oceanCompany.departmentSizes?.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {aboutMe.oceanCompany.departmentSizes.slice(0, 8).map((d: any, i: number) => (
                        <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                          {typeof d === 'string' ? d : `${d.name || d.department}: ${d.count || d.size}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Location & Timezone — editable */}
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <label className="text-sm font-medium">Location & Timezone</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 text-xs gap-1"
                    onClick={() => {
                      localStorage.removeItem('ai-location');
                      setLocationData(null);
                       fetch('https://ipapi.co/json/')
                        .then(r => r.json())
                        .then(data => {
                          if (data?.city) {
                            const loc = { city: data.city, region: data.region, country: data.country_name, timezone: data.timezone };
                            setLocationData(loc);
                            localStorage.setItem('ai-location', JSON.stringify(loc));
                            toast.success('Location re-detected');
                          }
                        })
                        .catch(() => toast.error('Could not detect location'));
                    }}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Re-detect
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">City</label>
                    <input type="text" value={locationData?.city || ''} onChange={(e) => { const u = { ...locationData, city: e.target.value }; setLocationData(u); localStorage.setItem('ai-location', JSON.stringify(u)); }} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm" placeholder="e.g. San Francisco" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Region</label>
                    <input type="text" value={locationData?.region || ''} onChange={(e) => { const u = { ...locationData, region: e.target.value }; setLocationData(u); localStorage.setItem('ai-location', JSON.stringify(u)); }} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm" placeholder="e.g. California" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Country</label>
                    <input type="text" value={locationData?.country || ''} onChange={(e) => { const u = { ...locationData, country: e.target.value }; setLocationData(u); localStorage.setItem('ai-location', JSON.stringify(u)); }} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm" placeholder="e.g. United States" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Timezone</label>
                    <input type="text" value={locationData?.timezone || ''} onChange={(e) => { const u = { ...locationData, timezone: e.target.value }; setLocationData(u); localStorage.setItem('ai-location', JSON.stringify(u)); }} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm" placeholder="e.g. America/Los_Angeles" />
                  </div>
                </div>
              </div>

              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This information is included in every AI conversation so responses are tailored to your role and company.
                </p>
              </div>

              <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setAboutMe(null); localStorage.removeItem('ai-about-me'); toast.info('Profile data cleared'); }}>
                Clear profile data
              </Button>
            </div>
          )}

          {!aboutMe && !enriching && (
            <p className="text-sm text-muted-foreground py-2">No profile data yet. Click "Look me up" to auto-populate from your professional profile.</p>
          )}

          {/* My Role */}
          <div className="space-y-3 pt-2">
            <label className="text-sm font-medium">My Role</label>
            <p className="text-xs text-muted-foreground">Describe what you do day-to-day so the AI understands your perspective and priorities.</p>
            <Textarea
              placeholder="e.g. I lead the marketing team and oversee website strategy, content production, and lead generation. I work closely with sales to align on messaging and evaluate new tools for our martech stack."
              value={myRole}
              onChange={(e) => {
                setMyRole(e.target.value);
                localStorage.setItem('ai-my-role', e.target.value);
              }}
              className="min-h-[80px] resize-y text-sm"
              maxLength={1000}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {myRole.length > 0 ? 'The AI will tailor recommendations to your responsibilities.' : 'Optional — helps the AI frame advice for your specific role.'}
              </p>
              <span className="text-xs text-muted-foreground tabular-nums">{myRole.length}/1,000</span>
            </div>
          </div>

          {/* Personal bio */}
          <div className="space-y-3 pt-2">
            <label className="text-sm font-medium">Your Bio</label>
            <p className="text-xs text-muted-foreground">Add anything else the AI should know about you — your background, expertise, how you like to work, etc.</p>
            <Textarea
              placeholder="e.g. I'm a digital marketing strategist specializing in B2B SaaS. I focus on conversion optimization and content strategy. I prefer data-driven recommendations with specific action items."
              value={personalBio}
              onChange={(e) => {
                setPersonalBio(e.target.value);
                localStorage.setItem('ai-personal-bio', e.target.value);
              }}
              className="min-h-[100px] resize-y text-sm"
              maxLength={2000}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {personalBio.length > 0 ? 'This bio is included alongside your enriched profile in every conversation.' : 'Optional — add a personal touch beyond what Apollo knows.'}
              </p>
              <span className="text-xs text-muted-foreground tabular-nums">{personalBio.length}/2,000</span>
            </div>
          </div>
        </section>

        <div className="border-t border-border" />

        {/* ── Google Docs Import ── */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2"><FileText className="h-5 w-5" /> Google Docs Import</h2>
            <p className="text-sm text-muted-foreground mt-1">Control how multi-tab Google Docs are imported into the knowledge base.</p>
          </div>

          <div className="space-y-5">
            <div className="space-y-3">
              <label className="text-sm font-medium">Tab Selection</label>
              <p className="text-xs text-muted-foreground">When a Google Doc has multiple tabs, how should they be handled?</p>
              <RadioGroup
                value={tabMode}
                onValueChange={(v: string) => {
                  const val = v as 'all' | 'choose';
                  setTabMode(val);
                  localStorage.setItem('drive-tab-mode', val);
                }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="settings-tab-all" />
                  <Label htmlFor="settings-tab-all" className="cursor-pointer">Import all tabs automatically</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="choose" id="settings-tab-choose" />
                  <Label htmlFor="settings-tab-choose" className="cursor-pointer">Let me choose which tabs to import</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Document Handling</label>
              <p className="text-xs text-muted-foreground">How should imported tabs be stored in the knowledge base?</p>
              <RadioGroup
                value={tabDocMode}
                onValueChange={(v: string) => {
                  const val = v as 'separate' | 'merged';
                  setTabDocMode(val);
                  localStorage.setItem('drive-tab-doc-mode', val);
                }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="separate" id="settings-doc-separate" />
                  <Label htmlFor="settings-doc-separate" className="cursor-pointer">Each tab as a separate document</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="merged" id="settings-doc-merged" />
                  <Label htmlFor="settings-doc-merged" className="cursor-pointer">Merge all tabs into one document</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </section>

        <div className="border-t border-border" />

        {/* ── Appearance ── */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2"><Sun className="h-5 w-5" /> Appearance</h2>
            <p className="text-sm text-muted-foreground mt-1">Choose your preferred color mode.</p>
          </div>

          <div className="flex gap-2">
            {([
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dark', label: 'Dark', icon: Moon },
              { value: 'system', label: 'Auto', icon: Monitor },
            ] as const).map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={theme === value ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5"
                onClick={() => setTheme(value)}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Button>
            ))}
          </div>
        </section>

        <div className="border-t border-border" />

        {/* ── Prompt Library ── */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <FileQuestion className="h-5 w-5" /> Prompt Library
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Pre-built prompts for site analysis, strategy, and deliverables.</p>
          </div>
          <PromptLibrary
            domain=""
            companyName=""
            onRunPrompt={() => {
              toast.info('Open a site first, then use prompts from the Chat tab.');
            }}
          />
        </section>

        <div className="border-t border-border" />

        {/* ── Account ── */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Account</h2>
            <p className="text-sm text-muted-foreground mt-1">Manage your profile and access.</p>
          </div>

          {user ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg border border-border">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback>{(profile?.display_name || '?')[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{profile?.display_name || 'User'}</p>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                </div>
                {isAdmin && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/admin')}>
                    <Shield className="h-3.5 w-3.5" /> Admin Panel
                  </Button>
                )}
              </div>
              <Button variant="outline" className="gap-2" onClick={() => signOut()}>
                <LogOut className="h-4 w-4" /> Sign Out
              </Button>
            </div>
          ) : (
            <Button onClick={() => navigate('/login')}>Sign In with Google</Button>
          )}
        </section>
      </main>
    </div>
  );
}
