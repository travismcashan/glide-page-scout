import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Save, Clock, DollarSign, Users, Layers, Settings2, PlusCircle, Loader2, CalendarDays, FileText, Trash2, ChevronDown, ChevronRight, PanelRightClose, PanelRightOpen, Code, Brain, RefreshCw } from 'lucide-react';
import { EstimateTaskRow, type EstimateTask } from './EstimateTaskRow';
import { EstimateTaskTable } from './EstimateTaskTable';

import { recalculateAllTasks, calculateBaseModel, fetchFormulas, calculatePhaseTimeline, countRoles, calculateTaskFromXlsx, deriveProjectSize, deriveProjectComplexity, type TaskFormula, type EstimateVariables } from '@/lib/estimateFormulas';
import type { TechTierCounts } from '@/components/TechAnalysisCard';
import { MetaStat, MetaStatDivider } from '@/components/MetaStat';
import type { PageTagsMap } from '@/lib/pageTags';
import type { ContentTypesData } from '@/components/content-types/types';
import { TemplatesCard } from '@/components/TemplatesCard';
import { ContentTypesCard } from '@/components/ContentTypesCard';
import { TechAnalysisCard } from '@/components/TechAnalysisCard';
import { FormsCard } from '@/components/FormsCard';
import { RedesignEstimateCard } from '@/components/RedesignEstimateCard';
import { SectionCard } from '@/components/SectionCard';
import { EstimateVariablesTab } from './EstimateVariablesTab';
import { useSectionCollapse } from '@/hooks/use-section-collapse';


type NavItem = { label: string; url?: string | null; children?: NavItem[] };

interface Props {
  sessionId: string;
  domain: string;
  pageTags: PageTagsMap | null;
  contentTypesData: ContentTypesData | null;
  formsData: any;
  wappalyzerData: any;
  templateTiers: any;
  formsTiers: any;
  navStructure: { primary?: NavItem[]; secondary?: NavItem[]; footer?: NavItem[] } | null;
  techAnalysisData: any;
  integrationTimestamps?: Record<string, string>;
  integrationDurations?: Record<string, number>;
  onRerunIntegration?: (key: string, dbColumn: string) => void;
  isIntegrationLoading?: (key: string) => boolean;
  onTemplatesRerunRequest?: (rerunFn: () => void) => void;
}

interface Estimate extends EstimateVariables {
  id: string;
  status: string | null;
  template_tier?: string | null;
  page_tier?: string | null;
  content_tier?: string | null;
  tech_tier?: string | null;
  forms_tier?: string | null;
  pm_percentage?: number | null;
  qa_percentage?: number | null;
}

export function EstimateBuilderCard({ sessionId, domain, pageTags, contentTypesData, formsData, wappalyzerData, templateTiers, formsTiers, navStructure, techAnalysisData, integrationTimestamps = {}, integrationDurations = {}, onRerunIntegration, isIntegrationLoading, onTemplatesRerunRequest }: Props) {
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [tasks, setTasks] = useState<EstimateTask[]>([]);
  const [formulas, setFormulas] = useState<TaskFormula[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('variables');
  const [roleCollapsed, setRoleCollapsed] = useState(false);
  const [phaseCollapsed, setPhaseCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const { isSectionCollapsed, toggleSection } = useSectionCollapse(sessionId);

  const handleTechTierChange = useCallback((counts: TechTierCounts) => {
    if (!estimate || tasks.length === 0 || !initialLoadDone) return;
    const weightedScore = (counts.plugins ?? 0) * 1 + (counts.thirdParty ?? 0) * 2 + (counts.specialSetup ?? 0) * 4;
    const updated = { ...estimate, third_party_integrations: counts.totalIncluded || 2, complexity_score: weightedScore };
    const derived = {
      ...updated,
      project_size: deriveProjectSize(updated),
      project_complexity: deriveProjectComplexity(updated),
    };
    setEstimate(derived as Estimate);
    const updatedTasks = recalculateAllTasks(tasks, derived, formulas);
    setTasks(updatedTasks as EstimateTask[]);
  }, [estimate, tasks, formulas, initialLoadDone]);

  const handleFormTierChange = useCallback((tierCounts: { s: number; m: number; l: number; total: number }) => {
    if (!estimate || tasks.length === 0 || !initialLoadDone) return;
    const updated = { ...estimate, form_count_s: tierCounts.s, form_count_m: tierCounts.m, form_count_l: tierCounts.l, form_count: tierCounts.total };
    const derived = {
      ...updated,
      project_size: deriveProjectSize(updated),
      project_complexity: deriveProjectComplexity(updated),
    };
    setEstimate(derived as Estimate);
    const updatedTasks = recalculateAllTasks(tasks, derived, formulas);
    setTasks(updatedTasks as EstimateTask[]);
  }, [estimate, tasks, formulas, initialLoadDone]);

  const crawlDefaults = useMemo((): Partial<EstimateVariables> => {
    const defaults: Partial<EstimateVariables> = {};
    if (pageTags) {
      const totalPages = Object.keys(pageTags).length;
      defaults.content_pages = totalPages;
      defaults.pages_for_integration = totalPages;
      if (templateTiers) {
        const designTemplates = Object.values(pageTags).filter(t => (t.baseType as string) !== 'toolkit');
        const count = designTemplates.length;
        const bestTier = count <= 8 ? 'S' : count <= 15 ? 'M' : 'L';
        const tierLayouts = templateTiers[bestTier];
        if (Array.isArray(tierLayouts) && tierLayouts.length > 0) {
          defaults.design_layouts = tierLayouts.length;
        } else {
          const baseTypes = new Set(Object.values(pageTags).map(t => t.baseType || 'Page'));
          defaults.design_layouts = Math.max(baseTypes.size, 3);
        }
      } else {
        const baseTypes = new Set(Object.values(pageTags).map(t => t.baseType || 'Page'));
        defaults.design_layouts = Math.max(baseTypes.size, 3);
      }
      if (contentTypesData?.summary) {
        const cptCount = contentTypesData.summary.filter(s => s.baseType === 'CPT').length;
        defaults.custom_posts = cptCount;
      }
    }
    if (formsData?.forms) {
      defaults.form_count = Array.isArray(formsData.forms) ? formsData.forms.length : 0;
    }
    // Tech analysis tier-based count is now handled via onTechTierChange callback
    // Fall back to Wappalyzer categories if no tech analysis
    if (!techAnalysisData?.analysis?.scope && wappalyzerData?.technologies) {
      const integrationCats = ['marketing-automation', 'analytics', 'crm', 'email', 'payment-processors'];
      const integrations = wappalyzerData.technologies.filter((t: any) =>
        t.categories?.some((c: any) => integrationCats.includes(c.slug))
      );
      defaults.third_party_integrations = integrations.length || 2;
    }
    return defaults;
  }, [pageTags, contentTypesData, formsData, wappalyzerData, techAnalysisData]);

  useEffect(() => { loadEstimate(); }, [sessionId]);

  async function loadEstimate() {
    setLoading(true);
    setInitialLoadDone(false);

    const formulasData = await fetchFormulas();
    setFormulas(formulasData);

    const { data: existing } = await supabase
      .from('project_estimates')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      const est = existing[0] as any;
      setEstimate(est);
      const { data: taskData } = await supabase
        .from('estimate_tasks')
        .select('*')
        .eq('estimate_id', est.id)
        .order('display_order');
      const loadedTasks = (taskData || []) as EstimateTask[];
      // Recalculate formula-driven tasks on load to ensure consistency
      const recalced = recalculateAllTasks(loadedTasks, est, formulasData);
      setTasks(recalced as EstimateTask[]);
    }

    setLoading(false);
    // Allow a tick for state to settle before enabling recalculation from card callbacks
    setTimeout(() => setInitialLoadDone(true), 500);
  }

  async function createEstimate() {
    setCreating(true);
    try {
      const [tasksRes, phasesRes, rolesRes] = await Promise.all([
        supabase.from('master_tasks').select('*').order('display_order'),
        supabase.from('project_phases').select('*').order('display_order'),
        supabase.from('team_roles').select('*').order('display_order'),
      ]);

      const masterTasks = tasksRes.data || [];
      const phases = phasesRes.data || [];
      const roles = rolesRes.data || [];

      // Build abbreviation→rate lookup
      const roleRateMap: Record<string, number> = {};
      roles.forEach((r: any) => { roleRateMap[r.abbreviation] = r.hourly_rate; });

      const variables: EstimateVariables = {
        name: `${domain} Redesign`,
        client_name: domain,
        description: null,
        project_size: 'Medium',
        project_complexity: 'Standard',
        user_personas: 2,
        content_pages: crawlDefaults.content_pages ?? 10,
        design_layouts: crawlDefaults.design_layouts ?? 5,
        form_count: crawlDefaults.form_count ?? 2,
        form_count_s: 0,
        form_count_m: 0,
        form_count_l: 0,
        integration_count: 1,
        paid_discovery: 'scope_only',
        pages_for_integration: crawlDefaults.pages_for_integration ?? 20,
        custom_posts: crawlDefaults.custom_posts ?? 2,
        bulk_import_amount: '<500',
        site_builder_acf: true,
        third_party_integrations: crawlDefaults.third_party_integrations ?? 2,
        post_launch_services: 0,
        complexity_score: 0,
      };

      const { data: newEstimate, error: estError } = await supabase
        .from('project_estimates')
        .insert({ ...variables, session_id: sessionId, status: 'draft', template_tier: 'M', page_tier: 'M', content_tier: 'M', tech_tier: 'M', forms_tier: 'M' })
        .select()
        .single();

      if (estError) throw estError;

      if (masterTasks.length > 0) {
        const estimateTasks = masterTasks.map((task: any, index: number) => {
          const phase = phases.find((p: any) => p.id === task.phase_id);
          // For multi-role tasks, compute a blended rate
          const taskRoles = task.roles || '';
          const roleAbbrs = taskRoles.split(',').map((r: string) => r.trim()).filter(Boolean);
          const avgRate = roleAbbrs.length > 0
            ? roleAbbrs.reduce((sum: number, abbr: string) => sum + (roleRateMap[abbr] || 150), 0) / roleAbbrs.length
            : 150;

          return {
            estimate_id: newEstimate.id,
            master_task_id: task.id,
            task_name: task.name,
            phase_name: phase?.name || null,
            team_role_name: roleAbbrs.join(', ') || null,
            team_role_abbreviation: roleAbbrs.join(', ') || null,
            hours: task.default_hours,
            hours_per_person: task.hours_per_person,
            hourly_rate: avgRate,
            is_selected: task.is_required ? true : task.default_included,
            is_required: task.is_required ?? false,
            display_order: index + 1,
            roles: task.roles,
            variable_label: task.variable_label || null,
            variable_qty: task.default_variable_qty || null,
          };
        });

        await supabase.from('estimate_tasks').insert(estimateTasks);
      }

      setEstimate({ ...variables, id: newEstimate.id, status: 'draft', template_tier: 'M', page_tier: 'M', content_tier: 'M', tech_tier: 'M', forms_tier: 'M' } as Estimate);
      const { data: taskData } = await supabase
        .from('estimate_tasks')
        .select('*')
        .eq('estimate_id', newEstimate.id)
        .order('display_order');
      setTasks((taskData || []) as EstimateTask[]);
      toast.success('Estimate created with crawl data pre-filled!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create estimate');
    } finally {
      setCreating(false);
    }
  }

  const handleTaskToggle = (taskId: string, checked: boolean) => {
    setTasks(tasks.map((t) => {
      if (t.id !== taskId) return t;
      if (t.is_required) return t; // Never toggle required tasks
      return { ...t, is_selected: checked };
    }));
  };

  const handleHoursChange = (taskId: string, hours: number) => {
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, hours, hours_per_person: hours } : t)));
  };

  const handleHoursPerPersonChange = (taskId: string, hpp: number) => {
    setTasks(tasks.map((t) => {
      if (t.id !== taskId) return t;
      const roleCount = countRoles(t.roles);
      const total = Math.round(hpp * roleCount * 100) / 100;
      return { ...t, hours_per_person: hpp, hours: total };
    }));
  };

  const handleVariableQtyChange = (taskId: string, qty: number) => {
    if (!estimate) return;
    setTasks(tasks.map((t) => {
      if (t.id !== taskId) return t;
      const result = calculateTaskFromXlsx(t.task_name, t.hours_per_person ?? t.hours, t.roles, qty, estimate);
      return { ...t, variable_qty: qty, hours_per_person: result.hpp, hours: result.total };
    }));
  };

  const handleVariablesChange = useCallback((variables: EstimateVariables) => {
    if (!estimate || tasks.length === 0 || !initialLoadDone) return;
    // Auto-derive project size and complexity from variables
    const derived = {
      ...variables,
      project_size: deriveProjectSize(variables),
      project_complexity: deriveProjectComplexity(variables),
    };
    const updated = { ...estimate, ...derived };
    setEstimate(updated);
    // Auto-recalculate tasks when variables change
    const updatedTasks = recalculateAllTasks(tasks, updated, formulas);
    setTasks(updatedTasks as EstimateTask[]);
  }, [estimate, tasks, formulas, initialLoadDone]);

  // Auto-save: debounced persistence — only saves changed tasks
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const isFirstRender = useRef(true);
  const lastSavedEstimateRef = useRef<string>('');
  const lastSavedTasksRef = useRef<string>('');

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // Snapshot initial state so we can diff later
      if (estimate) lastSavedEstimateRef.current = JSON.stringify(estimate);
      if (tasks.length) lastSavedTasksRef.current = JSON.stringify(tasks.map(t => ({ id: t.id, is_selected: t.is_selected, hours: t.hours, hours_per_person: t.hours_per_person, variable_qty: t.variable_qty })));
      return;
    }
    if (!estimate || tasks.length === 0 || !initialLoadDone) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        // Check if estimate variables changed
        const estSnapshot = JSON.stringify(estimate);
        if (estSnapshot !== lastSavedEstimateRef.current) {
          const { error: estimateError } = await supabase
            .from('project_estimates')
            .update({
              name: estimate.name, client_name: estimate.client_name, description: estimate.description,
              project_size: estimate.project_size, project_complexity: estimate.project_complexity,
              user_personas: estimate.user_personas, content_pages: estimate.content_pages,
              design_layouts: estimate.design_layouts, form_count: estimate.form_count,
              integration_count: estimate.integration_count, paid_discovery: estimate.paid_discovery,
              pages_for_integration: estimate.pages_for_integration, custom_posts: estimate.custom_posts,
              bulk_import_amount: estimate.bulk_import_amount, site_builder_acf: estimate.site_builder_acf,
              third_party_integrations: estimate.third_party_integrations, post_launch_services: estimate.post_launch_services,
              form_count_s: estimate.form_count_s, form_count_m: estimate.form_count_m, form_count_l: estimate.form_count_l,
              complexity_score: estimate.complexity_score,
              template_tier: estimate.template_tier, page_tier: estimate.page_tier,
              content_tier: estimate.content_tier, tech_tier: estimate.tech_tier, forms_tier: estimate.forms_tier,
            })
            .eq('id', estimate.id);
          if (estimateError) throw estimateError;
          lastSavedEstimateRef.current = estSnapshot;
        }

        // Diff tasks — only save changed ones, in parallel
        const currentTaskMap = new Map(tasks.map(t => [t.id, { is_selected: t.is_selected, hours: t.hours, hours_per_person: t.hours_per_person, variable_qty: t.variable_qty }]));
        const prevMap = new Map<string, any>();
        try {
          const prev = JSON.parse(lastSavedTasksRef.current || '[]') as any[];
          prev.forEach((t: any) => prevMap.set(t.id, t));
        } catch {}

        const changedTasks = tasks.filter(t => {
          const prev = prevMap.get(t.id);
          if (!prev) return true;
          return prev.is_selected !== t.is_selected || prev.hours !== t.hours || prev.hours_per_person !== t.hours_per_person || prev.variable_qty !== t.variable_qty;
        });

        if (changedTasks.length > 0) {
          await Promise.all(changedTasks.map(task =>
            supabase.from('estimate_tasks').update({
              is_selected: task.is_selected, hours: task.hours,
              hours_per_person: task.hours_per_person, variable_qty: task.variable_qty,
            }).eq('id', task.id)
          ));
          lastSavedTasksRef.current = JSON.stringify(tasks.map(t => ({ id: t.id, is_selected: t.is_selected, hours: t.hours, hours_per_person: t.hours_per_person, variable_qty: t.variable_qty })));
        }

        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        toast.error('Failed to auto-save');
        setSaveStatus('idle');
      }
    }, 800);

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [estimate, tasks, initialLoadDone]);

  const handleDelete = async () => {
    if (!estimate || !confirm('Delete this estimate? This cannot be undone.')) return;
    try {
      await supabase.from('estimate_tasks').delete().eq('estimate_id', estimate.id);
      await supabase.from('project_estimates').delete().eq('id', estimate.id);
      setEstimate(null);
      setTasks([]);
      toast.success('Estimate deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const totals = useMemo(() => {
    const selectedTasks = tasks.filter((t) => t.is_selected);
    const totalHours = selectedTasks.reduce((sum, t) => sum + Number(t.hours), 0);
    const totalCost = selectedTasks.reduce((sum, t) => sum + Number(t.hours) * Number(t.hourly_rate), 0);

    const byRole: Record<string, { hours: number; cost: number }> = {};
    selectedTasks.forEach((t) => {
      // Distribute hours across roles
      const roleList = (t.roles || t.team_role_abbreviation || 'Other').split(',').map(r => r.trim()).filter(Boolean);
      const hpp = Number(t.hours_per_person ?? t.hours);
      roleList.forEach(role => {
        if (!byRole[role]) byRole[role] = { hours: 0, cost: 0 };
        byRole[role].hours += hpp;
        byRole[role].cost += hpp * Number(t.hourly_rate);
      });
    });

    const byPhase: Record<string, { hours: number; cost: number }> = {};
    selectedTasks.forEach((t) => {
      const phase = t.phase_name || 'Other';
      if (!byPhase[phase]) byPhase[phase] = { hours: 0, cost: 0 };
      byPhase[phase].hours += Number(t.hours);
      byPhase[phase].cost += Number(t.hours) * Number(t.hourly_rate);
    });

    const lowWeeks = Math.round((totalHours / 40) * 10) / 10;
    const highWeeks = Math.round((totalHours / 30) * 10) / 10;

    const uniqueRoles = Object.keys(byRole).length || 1;

    return { totalHours, totalCost, byRole, byPhase, selectedCount: selectedTasks.length, lowWeeks, highWeeks, uniqueRoles };
  }, [tasks]);

  const groupedByPhase = useMemo(() => {
    const groups: Record<string, EstimateTask[]> = {};
    tasks.forEach((t) => {
      const phase = t.phase_name || 'Other';
      if (!groups[phase]) groups[phase] = [];
      groups[phase].push(t);
    });
    return groups;
  }, [tasks]);


  const phaseTimeline = useMemo(() => calculatePhaseTimeline(totals.byPhase), [totals.byPhase]);

  const baseModel = useMemo(() => {
    if (!estimate || tasks.length === 0) return null;
    return calculateBaseModel(tasks, estimate, formulas);
  }, [estimate, tasks, formulas]);

  const sowTasks = useMemo(() => tasks.filter(t => t.is_selected), [tasks]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!estimate) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-foreground">No Estimate Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Create a project estimate pre-filled with data from this crawl — page counts, forms detected, integrations, and more.
            </p>
          </div>
          <Button onClick={createEstimate} disabled={creating} size="lg">
            {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlusCircle className="h-4 w-4 mr-2" />}
            {creating ? 'Creating…' : 'Create Estimate'}
          </Button>
        </CardContent>
      </Card>
    );
  }

/** Convert total hours to estimated calendar duration based on real-world team throughput.
 *  Calibrated: 300hrs ≈ 12–16 wks, 600hrs ≈ 16–24 wks.
 *  Throughput scales: smaller projects ~20 hrs/wk, larger ~30 hrs/wk. */
function getProjectDuration(totalHours: number): string {
  if (totalHours <= 0) return '0 wks';
  const throughput = 15 + 5 * Math.log2(Math.max(totalHours, 100) / 100);
  const calWeeks = Math.round(totalHours / throughput);
  return `~${Math.max(1, calWeeks)} wks`;
}

  const rerunButton = (key: string, dbColumn: string) => {
    if (!onRerunIntegration) return null;
    const loading = isIntegrationLoading?.(key) ?? false;
    return (
      <div className="flex items-center gap-1">
        {integrationTimestamps[key] && !loading && (
          <span className="text-[10px] text-muted-foreground tabular-nums" title={`Last run: ${format(new Date(integrationTimestamps[key]), 'MMM d, yyyy h:mm a')}`}>
            {format(new Date(integrationTimestamps[key]), 'MMM d, h:mm a')}
          </span>
        )}
        {integrationDurations[key] != null && !loading && (
          <span className="text-[10px] text-muted-foreground tabular-nums">({integrationDurations[key]}s)</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={loading}
          onClick={() => onRerunIntegration(key, dbColumn)}
          title="Run again"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Summary bar — full width at top */}
        <div className="flex items-center gap-4 px-4 bg-muted/80 rounded-lg mb-4 sticky top-[60px] z-30 backdrop-blur-sm border border-border/50 h-[84px] [&_.meta-value]:text-4xl">
          <MetaStat value={formatCurrency(Math.round(totals.totalCost / 100) * 100)} label="Project Budget" />
          <MetaStatDivider />
          <MetaStat value={getProjectDuration(totals.totalHours)} label="Est. Duration" />
          <MetaStatDivider />
          <MetaStat value={Math.round(totals.totalHours / 10) * 10} label="Total Hours" />
          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)} className="shrink-0">
              {sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className={`grid grid-cols-1 ${sidebarOpen ? 'lg:grid-cols-4' : ''} gap-6`}>
          {/* Main Content */}
          <div className={sidebarOpen ? 'lg:col-span-3' : ''}>
            {/* Sub-tabs + Save/Delete — left column only */}
            <div className="flex items-center justify-between mb-4">
              <TabsList className="flex-wrap h-auto gap-1">
                <TabsTrigger value="variables" className="gap-1.5 text-xs">
                  <Settings2 className="h-3.5 w-3.5" />Scope
                </TabsTrigger>
                <TabsTrigger value="all" className="text-xs">All Tasks</TabsTrigger>
                <TabsTrigger value="timeline" className="gap-1.5 text-xs">
                  <CalendarDays className="h-3.5 w-3.5" />Timeline
                </TabsTrigger>
                <TabsTrigger value="sow" className="gap-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5" />SOW View
                </TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                {saveStatus === 'saving' && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Saving…</span>
                )}
                {saveStatus === 'saved' && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Save className="h-3 w-3" />Saved</span>
                )}
                <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <TabsContent value="variables">
              <div className="space-y-6">
                <EstimateVariablesTab variables={estimate} onChange={handleVariablesChange} baseModel={baseModel} />

                {pageTags && (
                  <SectionCard
                    sectionId="est-templates"
                    persistedCollapsed={isSectionCollapsed('est-templates')}
                    onCollapseChange={toggleSection}
                    title="Template Analysis"
                    icon={<Layers className="h-5 w-5 text-foreground" />}
                    headerExtra={rerunButton('templates', 'template_tiers')}
                  >
                    <TemplatesCard
                      pageTags={pageTags}
                      navStructure={navStructure}
                      domain={domain}
                      savedTiers={templateTiers}
                      savedActiveTier={estimate.template_tier}
                      mode="estimate"
                      onRerunRequest={onTemplatesRerunRequest}
                      onActiveTierChange={(tier) => { setEstimate(prev => prev ? { ...prev, template_tier: tier } : prev); supabase.from('project_estimates').update({ template_tier: tier }).eq('id', estimate.id).then(); }}
                      onTiersChange={(tiers) => {
                        // Save tiers to DB
                        supabase.from('crawl_sessions').update({ template_tiers: tiers as any }).eq('id', sessionId).then();
                        const nonToolkitCount = (tiers.L || []).length;
                        const bestTier = nonToolkitCount <= 8 ? 'S' : nonToolkitCount <= 18 ? 'M' : 'L';
                        const tierLayouts = tiers[bestTier];
                        if (Array.isArray(tierLayouts) && tierLayouts.length > 0) {
                          handleVariablesChange({ ...estimate, design_layouts: tierLayouts.length });
                        }
                      }}
                      onSelectionChange={(count) => {
                        if (estimate && count !== estimate.design_layouts) {
                          handleVariablesChange({ ...estimate, design_layouts: count });
                        }
                      }}
                    />
                  </SectionCard>
                )}

                {pageTags && (
                  <SectionCard
                    sectionId="est-content-audit"
                    persistedCollapsed={isSectionCollapsed('est-content-audit')}
                    onCollapseChange={toggleSection}
                    title="Page Analysis"
                    icon={<Layers className="h-5 w-5 text-foreground" />}
                  >
                    <RedesignEstimateCard
                      pageTags={pageTags}
                      contentTypesData={contentTypesData}
                      navStructure={navStructure}
                      mode="estimate"
                      savedTier={estimate.page_tier}
                      onTierChange={(tier) => { setEstimate(prev => prev ? { ...prev, page_tier: tier } : prev); supabase.from('project_estimates').update({ page_tier: tier }).eq('id', estimate.id).then(); }}
                      onSelectionChange={(count) => {
                        if (estimate && count !== estimate.pages_for_integration) {
                          handleVariablesChange({ ...estimate, pages_for_integration: count });
                        }
                      }}
                    />
                  </SectionCard>
                )}

                {contentTypesData && (
                  <SectionCard
                    sectionId="est-content-types"
                    persistedCollapsed={isSectionCollapsed('est-content-types')}
                    onCollapseChange={toggleSection}
                    title="Bulk Content (Posts & CPTs)"
                    icon={<Layers className="h-5 w-5 text-foreground" />}
                    headerExtra={rerunButton('content-types', 'content_types_data')}
                  >
                    <ContentTypesCard
                      data={contentTypesData}
                      navStructure={navStructure}
                      pageTags={pageTags}
                      mode="estimate"
                      savedTier={estimate.content_tier}
                      onActiveTierChange={(tier) => { setEstimate(prev => prev ? { ...prev, content_tier: tier } : prev); supabase.from('project_estimates').update({ content_tier: tier }).eq('id', estimate.id).then(); }}
                      onTierChange={(tier, includedTypes, totalUrls) => {
                        if (estimate) {
                          const bulkAmount = tier === 'S' ? 'none' : totalUrls < 500 ? '<500' : totalUrls < 1000 ? '500-1000' : totalUrls < 5000 ? '1000-5000' : '>5000';
                          handleVariablesChange({ ...estimate, custom_posts: includedTypes, bulk_import_amount: bulkAmount });
                        }
                      }}
                    />
                  </SectionCard>
                )}

                {techAnalysisData && (
                  <SectionCard
                    sectionId="est-tech-analysis"
                    persistedCollapsed={isSectionCollapsed('est-tech-analysis')}
                    onCollapseChange={toggleSection}
                    title="Third-Party Application (TPA) Analysis"
                    icon={<Brain className="h-5 w-5 text-foreground" />}
                    headerExtra={rerunButton('tech-analysis', 'tech_analysis_data')}
                  >
                    <TechAnalysisCard data={techAnalysisData} isLoading={false} mode="estimate" onTierChange={handleTechTierChange} savedTier={estimate.tech_tier} onActiveTierChange={(tier) => { setEstimate(prev => prev ? { ...prev, tech_tier: tier } : prev); supabase.from('project_estimates').update({ tech_tier: tier }).eq('id', estimate.id).then(); }} />
                  </SectionCard>
                )}

                {formsData && (
                  <SectionCard
                    sectionId="est-forms"
                    persistedCollapsed={isSectionCollapsed('est-forms')}
                    onCollapseChange={toggleSection}
                    title="Forms Analysis"
                    icon={<FileText className="h-5 w-5 text-foreground" />}
                    headerExtra={rerunButton('forms', 'forms_data')}
                  >
                    <FormsCard data={formsData} domain={domain} mode="estimate" savedTiers={formsTiers} onTiersChange={(tiers) => { supabase.from('crawl_sessions').update({ forms_tiers: tiers } as any).eq('id', sessionId).then(); }} onFormTierChange={handleFormTierChange} savedActiveTier={estimate.forms_tier} onActiveTierChange={(tier) => { setEstimate(prev => prev ? { ...prev, forms_tier: tier } : prev); supabase.from('project_estimates').update({ forms_tier: tier }).eq('id', estimate.id).then(); }} />
                  </SectionCard>
                )}

                {/* Derived Values Summary */}
                {estimate && (
                  <Card className="border-dashed">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-muted-foreground">Derived from Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        <li className="flex justify-between">
                          <span>Design Layouts</span>
                          <span className="font-medium text-foreground">{estimate.design_layouts ?? 5} <span className="text-muted-foreground font-normal">— from Template Analysis</span></span>
                        </li>
                        <li className="flex justify-between">
                          <span>Pages for Integration</span>
                          <span className="font-medium text-foreground">{estimate.pages_for_integration ?? 20} <span className="text-muted-foreground font-normal">— from Page Analysis</span></span>
                        </li>
                        <li className="flex justify-between">
                          <span>Custom Post Types</span>
                          <span className="font-medium text-foreground">{estimate.custom_posts ?? 2} <span className="text-muted-foreground font-normal">— from Bulk Content</span></span>
                        </li>
                        {((estimate.form_count_s ?? 0) > 0 || (estimate.form_count_m ?? 0) > 0 || (estimate.form_count_l ?? 0) > 0) ? (
                          <li className="flex justify-between">
                            <span>Form Integration Hours</span>
                            <span className="font-medium text-foreground">
                              {(((estimate.form_count_s ?? 0) * 0.25) + ((estimate.form_count_m ?? 0) * 0.5) + ((estimate.form_count_l ?? 0) * 1.5)).toFixed(1)}h
                              <span className="text-muted-foreground font-normal"> — {estimate.form_count_s ?? 0}S × 0.25 + {estimate.form_count_m ?? 0}M × 0.5 + {estimate.form_count_l ?? 0}L × 1.5</span>
                            </span>
                          </li>
                        ) : (
                          <li className="flex justify-between">
                            <span>Forms</span>
                            <span className="font-medium text-foreground">{estimate.form_count ?? 2} <span className="text-muted-foreground font-normal">— flat count</span></span>
                          </li>
                        )}
                        <li className="flex justify-between">
                          <span>Bulk Import Tier</span>
                          <span className="font-medium text-foreground">{estimate.bulk_import_amount ?? '<500'} <span className="text-muted-foreground font-normal">— from Bulk Content URLs</span></span>
                        </li>
                        <li className="flex justify-between">
                          <span>Project Size</span>
                          <span className="font-medium text-foreground">{estimate.project_size ?? 'Medium'} <span className="text-muted-foreground font-normal">— {estimate.pages_for_integration ?? 20} pages + {estimate.design_layouts ?? 5} layouts + {estimate.custom_posts ?? 2} CPTs</span></span>
                        </li>
                        <li className="flex justify-between">
                          <span>Project Complexity</span>
                          <span className="font-medium text-foreground">{estimate.project_complexity ?? 'Simple'} <span className="text-muted-foreground font-normal">— score: {estimate.complexity_score ?? 0} from TPA weighted tiers</span></span>
                        </li>
                        <li className="flex justify-between">
                          <span>301 Redirects</span>
                          <span className="font-medium text-foreground">{Math.max((estimate.pages_for_integration ?? 20) * 0.1, 2).toFixed(1)}h <span className="text-muted-foreground font-normal">— {estimate.pages_for_integration ?? 20} pages × 0.1</span></span>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="all">
              <EstimateTaskTable
                tasks={tasks}
                onToggle={handleTaskToggle}
                onHoursChange={handleHoursChange}
                onHoursPerPersonChange={handleHoursPerPersonChange}
                onVariableQtyChange={handleVariableQtyChange}
              />
            </TabsContent>

            <TabsContent value="timeline">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" /> Phase Timeline
                  </CardTitle>
                  <CardDescription>Estimated work days and weeks per phase</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Phase</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead className="text-right">Days (low)</TableHead>
                        <TableHead className="text-right">Days (high)</TableHead>
                        <TableHead className="text-right">Weeks (low)</TableHead>
                        <TableHead className="text-right">Weeks (high)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {phaseTimeline.map(row => (
                        <TableRow key={row.phase}>
                          <TableCell className="font-medium text-sm">{row.phase}</TableCell>
                          <TableCell className="text-right text-sm">{row.hours.toFixed(1)}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{row.lowDays.toFixed(1)}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{row.highDays.toFixed(1)}</TableCell>
                          <TableCell className="text-right text-sm">{row.lowWeeks.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-sm">{row.highWeeks.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold border-t-2">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{totals.totalHours.toFixed(1)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{(totals.totalHours / 8).toFixed(1)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{(totals.totalHours / 6).toFixed(1)}</TableCell>
                        <TableCell className="text-right">{totals.lowWeeks.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{totals.highWeeks.toFixed(1)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sow">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Statement of Work
                  </CardTitle>
                  <CardDescription>Selected tasks only — client-ready view</CardDescription>
                </CardHeader>
                <CardContent>
                  {Object.entries(groupedByPhase).map(([phase, phaseTasks]) => {
                    const selectedInPhase = phaseTasks.filter(t => t.is_selected);
                    if (selectedInPhase.length === 0) return null;
                    const phaseTotal = selectedInPhase.reduce((s, t) => s + Number(t.hours), 0);
                    return (
                      <div key={phase} className="mb-6 last:mb-0">
                        <div className="flex items-center justify-between mb-2 pb-1 border-b">
                          <h3 className="text-sm font-semibold">{phase}</h3>
                          <span className="text-xs font-medium text-muted-foreground">{phaseTotal.toFixed(1)} hrs</span>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="h-8 text-xs">Task</TableHead>
                              <TableHead className="h-8 text-xs">Role(s)</TableHead>
                              <TableHead className="h-8 text-xs text-right">Hrs/Person</TableHead>
                              <TableHead className="h-8 text-xs text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedInPhase.map(task => (
                              <TableRow key={task.id}>
                                <TableCell className="text-sm py-1.5">{task.task_name}</TableCell>
                                <TableCell className="text-xs text-muted-foreground py-1.5">{task.roles || task.team_role_abbreviation}</TableCell>
                                <TableCell className="text-sm text-right py-1.5">{Number(task.hours_per_person ?? task.hours).toFixed(1)}</TableCell>
                                <TableCell className="text-sm text-right font-medium py-1.5">{Number(task.hours).toFixed(1)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })}
                  <div className="flex justify-between items-center pt-4 border-t mt-4">
                    <span className="font-semibold">Project Total</span>
                    <div className="text-right">
                      <div className="font-bold text-lg">{totals.totalHours.toFixed(0)} hours</div>
                      <div className="text-sm text-muted-foreground">{formatCurrency(totals.totalCost)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>

          {/* Right Sidebar */}
          {sidebarOpen && (
            <div className="lg:col-span-1 space-y-4">
              {Object.keys(totals.byRole).length > 0 && (
                <Card>
                  <CardHeader className="pb-2 cursor-pointer" onClick={() => setRoleCollapsed(!roleCollapsed)}>
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      {roleCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      <Users className="h-3.5 w-3.5" /> By Role
                    </CardTitle>
                  </CardHeader>
                  {!roleCollapsed && (
                    <CardContent className="space-y-1.5">
                      {Object.entries(totals.byRole)
                        .sort((a, b) => b[1].hours - a[1].hours)
                        .map(([role, data]) => (
                          <div key={role} className="flex items-center justify-between text-xs">
                            <span>{role}</span>
                            <span className="text-muted-foreground">{data.hours.toFixed(1)}h</span>
                          </div>
                        ))}
                    </CardContent>
                  )}
                </Card>
              )}

              {Object.keys(totals.byPhase).length > 0 && (
                <Card>
                  <CardHeader className="pb-2 cursor-pointer" onClick={() => setPhaseCollapsed(!phaseCollapsed)}>
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      {phaseCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      <Layers className="h-3.5 w-3.5" /> By Phase
                    </CardTitle>
                  </CardHeader>
                  {!phaseCollapsed && (
                    <CardContent className="space-y-1.5">
                      {Object.entries(totals.byPhase).map(([phase, data]) => (
                        <div key={phase} className="flex items-center justify-between text-xs">
                          <span>{phase}</span>
                          <span className="text-muted-foreground">{data.hours.toFixed(1)}h</span>
                        </div>
                      ))}
                    </CardContent>
                  )}
                </Card>
              )}
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}
