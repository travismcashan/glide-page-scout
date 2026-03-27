import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Brain, Sparkles, Zap, LogOut, Shield, FileText, MessageSquare, User as UserIcon, Loader2, RefreshCw, Building2, Briefcase, MapPin, Globe } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { PROVIDERS, VERSIONS, type ModelProvider, type ReasoningEffort } from '@/components/chat/ChatModelSelector';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
};

const DEFAULT_REASONING: Record<ModelProvider, ReasoningEffort> = {
  gemini: 'medium',
  claude: 'high',
  gpt: 'medium',
  perplexity: 'none',
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, profile, isAdmin, signOut } = useAuth();

  // Model settings
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

  // RAG context settings
  const [matchCount, setMatchCount] = useState(
    () => parseInt(localStorage.getItem('rag-match-count') || '50', 10)
  );
  const [matchThreshold, setMatchThreshold] = useState(
    () => parseFloat(localStorage.getItem('rag-match-threshold') || '0.15')
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

  // Characteristics toggles
  const CHARACTERISTICS = [
    { id: 'warm', label: 'Warm', description: 'Caring, empathetic tone' },
    { id: 'enthusiastic', label: 'Enthusiastic', description: 'Energetic and excited' },
    { id: 'headers-lists', label: 'Headers & Lists', description: 'Structured with headings and bullet points' },
    { id: 'emoji', label: 'Emoji', description: 'Sprinkle in relevant emoji 🎯' },
    { id: 'tables', label: 'Tables', description: 'Use tables to organize data' },
    { id: 'gifs', label: 'GIFs', description: 'Include unexpected fun GIFs via Giphy' },
  ] as const;

  const [characteristics, setCharacteristics] = useState<string[]>(() => {
    try { const s = localStorage.getItem('ai-characteristics'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  const toggleCharacteristic = (id: string) => {
    setCharacteristics(prev => {
      const next = prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id];
      localStorage.setItem('ai-characteristics', JSON.stringify(next));
      return next;
    });
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
      if (error || !data?.success) { toast.error('Could not enrich profile — you may not be in Apollo\'s database'); return; }
      const person = data.data?.person || data.data;
      if (!person) { toast.error('No profile data found'); return; }

      const enriched = {
        name: person.name || profile?.display_name,
        title: person.title,
        headline: person.headline,
        organization: person.organization?.name,
        orgIndustry: person.organization?.industry,
        orgSize: person.organization?.estimated_num_employees ? `~${person.organization.estimated_num_employees} employees` : null,
        orgWebsite: person.organization?.website_url || person.organization?.primary_domain,
        city: person.city,
        state: person.state,
        country: person.country,
        linkedin: person.linkedin_url,
        seniority: person.seniority,
        departments: person.departments,
      };
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

  // Auto-enrich on first visit if logged in and no data yet
  useEffect(() => {
    if (user?.email && !aboutMe && !enriching) {
      enrichProfile();
    }
  }, [user?.email]);
  const handleProviderChange = (p: ModelProvider) => {
    setProvider(p);
    localStorage.setItem('chat-provider', p);
    const best = DEFAULT_BEST[p] || VERSIONS[p]?.[VERSIONS[p].length - 1]?.id;
    if (best) {
      setModel(best);
      localStorage.setItem('chat-model', best);
    }
    setReasoning(DEFAULT_REASONING[p] || 'none');
  };

  const handleModelChange = (id: string) => {
    setModel(id);
    localStorage.setItem('chat-model', id);
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
            <p className="text-sm text-muted-foreground mt-1">Choose which model powers your chat and research workflows.</p>
          </div>

          {/* Provider tabs */}
          <div className="flex gap-2">
            {PROVIDERS.map(p => (
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
        </section>

        <div className="border-t border-border" />

        {/* ── Knowledge Context ── */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Knowledge Context</h2>
            <p className="text-sm text-muted-foreground mt-1">Control how much of the knowledge base the AI reads when answering questions.</p>
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

        {/* ── Style & Tone ── */}
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
            <p className="text-xs text-muted-foreground">Toggle specific traits you'd like the AI to use in responses.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CHARACTERISTICS.map(c => (
                <button
                  key={c.id}
                  onClick={() => toggleCharacteristic(c.id)}
                  className={`text-left rounded-lg border p-3 transition-all flex items-center gap-3 ${
                    characteristics.includes(c.id)
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-muted-foreground/30'
                  }`}
                >
                  <Checkbox checked={characteristics.includes(c.id)} className="pointer-events-none" />
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{c.label}</div>
                    <p className="text-xs text-muted-foreground">{c.description}</p>
                  </div>
                </button>
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
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-lg">{(aboutMe.name || '?')[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-semibold text-lg leading-tight">{aboutMe.name}</p>
                  {aboutMe.title && <p className="text-sm text-muted-foreground">{aboutMe.title}</p>}
                  {aboutMe.headline && aboutMe.headline !== aboutMe.title && (
                    <p className="text-xs text-muted-foreground">{aboutMe.headline}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                {aboutMe.organization && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span>{aboutMe.organization}{aboutMe.orgIndustry ? ` · ${aboutMe.orgIndustry}` : ''}</span>
                  </div>
                )}
                {aboutMe.orgSize && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Briefcase className="h-4 w-4 shrink-0" />
                    <span>{aboutMe.orgSize}</span>
                  </div>
                )}
                {(aboutMe.city || aboutMe.state || aboutMe.country) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>{[aboutMe.city, aboutMe.state, aboutMe.country].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {aboutMe.orgWebsite && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="h-4 w-4 shrink-0" />
                    <a href={aboutMe.orgWebsite.startsWith('http') ? aboutMe.orgWebsite : `https://${aboutMe.orgWebsite}`} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">{aboutMe.orgWebsite.replace(/^https?:\/\//, '')}</a>
                  </div>
                )}
              </div>

              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This information is included in every AI conversation so responses are tailored to your role and company.
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setAboutMe(null);
                  localStorage.removeItem('ai-about-me');
                  toast.info('Profile data cleared');
                }}
              >
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
