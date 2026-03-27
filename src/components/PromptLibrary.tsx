import { useState } from 'react';
import { Brain, Lightbulb, Play, FileText, Plus, Pencil, Trash2, BookOpen, Sparkles, ChevronRight, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export type PromptTemplate = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon: 'brain' | 'lightbulb' | 'sparkles' | 'globe' | 'book';
  mode: 'deep-research' | 'chat' | 'observations';
  builtIn?: boolean;
};

const ICON_MAP = {
  brain: Brain,
  lightbulb: Lightbulb,
  sparkles: Sparkles,
  globe: Globe,
  book: BookOpen,
};

type Props = {
  domain: string;
  companyName: string;
  onRunPrompt: (template: PromptTemplate) => void;
};

const STORAGE_KEY = 'prompt-library-custom';

function getCustomTemplates(): PromptTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveCustomTemplates(templates: PromptTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

function buildBuiltInTemplates(domain: string, companyName: string): PromptTemplate[] {
  return [
    {
      id: 'five-c-diagnostic',
      title: '5C Diagnostic',
      description: 'Comprehensive Climate, Competition, Customers, Company & Culture analysis with strategic roadmap.',
      icon: 'brain',
      mode: 'deep-research',
      builtIn: true,
      prompt: `Complete the 5C diagnostic for ${companyName}, located at ${domain}. This is all in the context of a marketing engagement between ${companyName} and GLIDE®. I want to impress them with my thoughtful, consultative, knowledge of their world and their needs. But more importantly, I want to help them become successful.\n\nMake sure that when you write it, you're not derogatory toward their team. As I'm going to share this document with the client, so it should always be constructive, forward-looking, and exciting, but still authoritative and still willing to say the hard things, just not in a way that makes people feel upset.\n\nThe FIVE C's are:\n\n1. **Climate** — The macro environment: industry trends, regulatory landscape, economic forces, technological shifts, and market dynamics affecting ${companyName}.\n\n2. **Competition** — Identify 3-5 key competitors and analyze their positioning, strengths, digital presence, messaging, and where ${companyName} can differentiate.\n\n3. **Customers** — Who are ${companyName}'s ideal customers? What are their pain points, buying journey, content preferences, and how well does the current website serve them?\n\n4. **Company** — ${companyName}'s brand positioning, value proposition, technology stack, content strategy, SEO health, site performance, and digital maturity.\n\n5. **Culture** — The brand voice, tone, visual identity, team positioning, and how well the digital presence reflects the company's mission and values.\n\nConclude with a strategic roadmap that ties all 5 C's together into actionable next steps.`,
    },
    {
      id: 'observations-insights',
      title: 'Observations & Insights',
      description: 'SPARKS framework analysis: Scan, Patterns, Actions, Roadmap, Keys, and Star.',
      icon: 'lightbulb',
      mode: 'deep-research',
      builtIn: true,
      prompt: `Analyze ${companyName} (${domain}) using the SPARKS framework. For each section, provide specific, actionable observations based on the site data provided.\n\n1. **Scan** — Key observations about the site's current state (design, UX, content, technology, performance)\n2. **Patterns** — Recurring themes, strengths, and weaknesses across the data\n3. **Actions** — Concrete, prioritized recommendations with clear next steps\n4. **Roadmap** — Phased strategic plan (Quick Wins → Short-term → Long-term)\n5. **Keys** — The critical success factors and KPIs to track\n6. **Star** — The North Star vision for what ${companyName}'s digital presence should become\n\nFormat each recommendation as:\n- **Action** — What to do\n- **Why** — Business justification\n- **Impact** — Expected outcome\n\nBe constructive and forward-looking. This will be shared with the client.`,
    },
    {
      id: 'competitor-analysis',
      title: 'Competitor Deep Dive',
      description: 'Research 3-5 competitors with positioning, digital presence, and differentiation opportunities.',
      icon: 'globe',
      mode: 'deep-research',
      builtIn: true,
      prompt: `Perform a comprehensive competitive analysis for ${companyName} (${domain}).\n\n1. Identify the top 3-5 direct competitors\n2. For each competitor, analyze:\n   - Website design and UX quality\n   - Content strategy and messaging\n   - Technology stack\n   - SEO positioning and keyword coverage\n   - Social proof and trust signals\n   - Unique value propositions\n3. Compare ${companyName} against each competitor on these dimensions\n4. Identify clear differentiation opportunities\n5. Recommend specific actions to gain competitive advantage\n\nPresent findings in a clear, visual-friendly format with comparison tables where appropriate.`,
    },
    {
      id: 'content-strategy',
      title: 'Content Strategy Audit',
      description: 'Evaluate content effectiveness, gaps, and recommend a content roadmap.',
      icon: 'book',
      mode: 'deep-research',
      builtIn: true,
      prompt: `Perform a comprehensive content strategy audit for ${companyName} (${domain}).\n\nAnalyze:\n1. **Current Content Inventory** — What types of content exist, their quality, and effectiveness\n2. **Content Gaps** — Missing content types, topics, or audience segments not being served\n3. **SEO Content Opportunities** — Keywords and topics where content could drive organic traffic\n4. **Content Performance** — Which content patterns are working and which aren't\n5. **Messaging & Voice** — How consistent and effective is the brand messaging\n6. **Content Funnel** — How well does content serve each stage of the buyer journey (Awareness → Consideration → Decision)\n7. **Content Roadmap** — Prioritized content creation plan with timeline\n\nProvide specific, actionable recommendations with estimated effort and impact for each.`,
    },
    {
      id: 'quick-executive-summary',
      title: 'Executive Summary',
      description: 'Quick high-level summary of all findings for stakeholder presentations.',
      icon: 'sparkles',
      mode: 'chat',
      builtIn: true,
      prompt: `Create a concise executive summary of all the findings for ${companyName} (${domain}). This should be suitable for a stakeholder presentation.\n\nInclude:\n- Overall digital health score (your assessment)\n- Top 3 strengths\n- Top 3 areas for improvement\n- Quick wins that could be implemented immediately\n- Strategic recommendations for the next 90 days\n\nKeep it under 500 words. Be direct, professional, and constructive.`,
    },
  ];
}

export function PromptLibrary({ domain, companyName, onRunPrompt }: Props) {
  const [customTemplates, setCustomTemplates] = useState<PromptTemplate[]>(getCustomTemplates);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [formMode, setFormMode] = useState<'deep-research' | 'chat'>('chat');

  const builtIn = buildBuiltInTemplates(domain, companyName);
  const allTemplates = [...builtIn, ...customTemplates];

  const handleSaveCustom = () => {
    const template: PromptTemplate = {
      id: editingTemplate?.id || `custom-${Date.now()}`,
      title: formTitle.trim(),
      description: formDescription.trim(),
      prompt: formPrompt.trim()
        .replace(/\{domain\}/g, domain)
        .replace(/\{company\}/g, companyName),
      icon: 'sparkles',
      mode: formMode,
    };
    const updated = editingTemplate
      ? customTemplates.map(t => t.id === editingTemplate.id ? template : t)
      : [...customTemplates, template];
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    setDialogOpen(false);
    resetForm();
  };

  const handleDeleteCustom = (id: string) => {
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
  };

  const startEdit = (template: PromptTemplate) => {
    setEditingTemplate(template);
    setFormTitle(template.title);
    setFormDescription(template.description);
    setFormPrompt(template.prompt);
    setFormMode(template.mode === 'observations' ? 'deep-research' : template.mode);
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingTemplate(null);
    setFormTitle('');
    setFormDescription('');
    setFormPrompt('');
    setFormMode('chat');
  };

  const deepResearchTemplates = allTemplates.filter(t => t.mode === 'deep-research' || t.mode === 'observations');
  const chatTemplates = allTemplates.filter(t => t.mode === 'chat');

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">Prompts</h2>
        <p className="text-sm text-muted-foreground">
          Pre-built research templates and custom prompts. Click any template to run it in Chat.
        </p>
      </div>

      {/* Deep Research templates */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Deep Research</h3>
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Gemini</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Multi-step research tasks powered by Gemini Deep Research. Searches the web, analyzes sources, and produces comprehensive reports. Takes 5-20 minutes.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {deepResearchTemplates.map(template => {
            const Icon = ICON_MAP[template.icon];
            return (
              <button
                key={template.id}
                onClick={() => onRunPrompt(template)}
                className="group text-left rounded-xl border border-border hover:border-primary/40 hover:bg-accent/50 p-4 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-muted p-2 shrink-0 group-hover:bg-primary/10 transition-colors">
                    <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{template.title}</span>
                      {!template.builtIn && (
                        <button
                          onClick={e => { e.stopPropagation(); startEdit(template); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                      )}
                      {!template.builtIn && (
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteCustom(template.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{template.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat templates */}
      {chatTemplates.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Quick Prompts</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Instant chat prompts — get results in seconds using any model.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {chatTemplates.map(template => {
              const Icon = ICON_MAP[template.icon];
              return (
                <button
                  key={template.id}
                  onClick={() => onRunPrompt(template)}
                  className="group text-left rounded-xl border border-border hover:border-primary/40 hover:bg-accent/50 p-4 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-muted p-2 shrink-0 group-hover:bg-primary/10 transition-colors">
                      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{template.title}</span>
                        {!template.builtIn && (
                          <button
                            onClick={e => { e.stopPropagation(); startEdit(template); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                          >
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                        )}
                        {!template.builtIn && (
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteCustom(template.id); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{template.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Add custom template */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => { resetForm(); setDialogOpen(true); }}
        className="gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" />
        Create Custom Prompt
      </Button>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Prompt' : 'Create Custom Prompt'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Title</label>
              <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="My Research Template" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="What this template does..." />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Mode</label>
              <div className="flex gap-2">
                <Button
                  variant={formMode === 'deep-research' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormMode('deep-research')}
                  className="gap-1.5"
                >
                  <Brain className="h-3.5 w-3.5" />
                  Deep Research
                </Button>
                <Button
                  variant={formMode === 'chat' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormMode('chat')}
                  className="gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Quick Chat
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Prompt</label>
              <Textarea
                value={formPrompt}
                onChange={e => setFormPrompt(e.target.value)}
                rows={6}
                placeholder={`Use {domain} and {company} as placeholders.\n\nExample: Analyze {company} ({domain}) for...`}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use <code className="text-[11px] bg-muted px-1 rounded">{'{domain}'}</code> and <code className="text-[11px] bg-muted px-1 rounded">{'{company}'}</code> as placeholders.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCustom} disabled={!formTitle.trim() || !formPrompt.trim()}>
              {editingTemplate ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
