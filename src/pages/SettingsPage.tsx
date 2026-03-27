import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Brain, Sparkles, Zap, LogOut, Shield } from 'lucide-react';
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
            <h2 className="text-xl font-semibold tracking-tight">AI Model</h2>
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
