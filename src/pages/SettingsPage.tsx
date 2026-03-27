import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Brain, Sparkles, Zap, LogOut, Shield, FileText, MessageSquare } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { PROVIDERS, VERSIONS, type ModelProvider, type ReasoningEffort } from '@/components/chat/ChatModelSelector';
import { useAuth } from '@/contexts/AuthContext';

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

  // Custom instructions
  const [customInstructions, setCustomInstructions] = useState(
    () => localStorage.getItem('ai-custom-instructions') || ''
  );

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
