import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, Clock, DollarSign, Users, Layers, Settings2, RefreshCw, PlusCircle, Loader2 } from 'lucide-react';
import { EstimateTaskRow, type EstimateTask } from './EstimateTaskRow';
import { EstimateVariablesTab } from './EstimateVariablesTab';
import { recalculateAllTasks, fetchFormulas, type TaskFormula, type EstimateVariables } from '@/lib/estimateFormulas';
import type { PageTagsMap } from '@/lib/pageTags';
import type { ContentTypesData } from '@/components/content-types/types';

interface Props {
  sessionId: string;
  domain: string;
  pageTags: PageTagsMap | null;
  contentTypesData: ContentTypesData | null;
  formsData: any;
  wappalyzerData: any;
  templateTiers: any;
}

interface Estimate extends EstimateVariables {
  id: string;
  status: string | null;
}

export function EstimateBuilderCard({ sessionId, domain, pageTags, contentTypesData, formsData, wappalyzerData }: Props) {
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [tasks, setTasks] = useState<EstimateTask[]>([]);
  const [formulas, setFormulas] = useState<TaskFormula[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('variables');

  // Pre-fill variables from crawl data
  const crawlDefaults = useMemo((): Partial<EstimateVariables> => {
    const defaults: Partial<EstimateVariables> = {};
    
    if (pageTags) {
      const totalPages = Object.keys(pageTags).length;
      defaults.content_pages = totalPages;
      defaults.pages_for_integration = totalPages;
      
      // Count design layouts from unique base types
      const baseTypes = new Set(Object.values(pageTags).map(t => t.baseType || 'Page'));
      defaults.design_layouts = Math.max(baseTypes.size, 3);
      
      // Count custom posts from content types
      if (contentTypesData?.summary) {
        const cptCount = contentTypesData.summary.filter(s => s.baseType === 'CPT').length;
        defaults.custom_posts = cptCount;
      }
    }
    
    if (formsData?.forms) {
      defaults.form_count = Array.isArray(formsData.forms) ? formsData.forms.length : 0;
    }
    
    // Count integrations from wappalyzer
    if (wappalyzerData?.technologies) {
      const integrationCats = ['marketing-automation', 'analytics', 'crm', 'email', 'payment-processors'];
      const integrations = wappalyzerData.technologies.filter((t: any) =>
        t.categories?.some((c: any) => integrationCats.includes(c.slug))
      );
      defaults.third_party_integrations = integrations.length || 2;
    }
    
    return defaults;
  }, [pageTags, contentTypesData, formsData, wappalyzerData]);

  useEffect(() => {
    loadEstimate();
  }, [sessionId]);

  async function loadEstimate() {
    setLoading(true);
    
    // Check for existing estimate for this session
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
      
      setTasks((taskData || []) as EstimateTask[]);
    }

    const formulasData = await fetchFormulas();
    setFormulas(formulasData);
    setLoading(false);
  }

  async function createEstimate() {
    setCreating(true);
    try {
      // Fetch master tasks, phases, and roles
      const [tasksRes, phasesRes, rolesRes] = await Promise.all([
        supabase.from('master_tasks').select('*').order('display_order'),
        supabase.from('project_phases').select('*').order('display_order'),
        supabase.from('team_roles').select('*').order('display_order'),
      ]);

      const masterTasks = tasksRes.data || [];
      const phases = phasesRes.data || [];
      const roles = rolesRes.data || [];

      const variables: EstimateVariables = {
        name: `${domain} Redesign`,
        client_name: domain,
        description: null,
        project_size: 'Medium',
        project_complexity: 'Standard',
        user_personas: 3,
        content_pages: crawlDefaults.content_pages ?? 10,
        design_layouts: crawlDefaults.design_layouts ?? 5,
        form_count: crawlDefaults.form_count ?? 2,
        integration_count: 1,
        paid_discovery: 'scope_only',
        pages_for_integration: crawlDefaults.pages_for_integration ?? 20,
        custom_posts: crawlDefaults.custom_posts ?? 2,
        bulk_import_amount: '<500',
        site_builder_acf: true,
        third_party_integrations: crawlDefaults.third_party_integrations ?? 2,
        post_launch_services: 0,
      };

      const { data: newEstimate, error: estError } = await supabase
        .from('project_estimates')
        .insert({
          ...variables,
          session_id: sessionId,
          status: 'draft',
        })
        .select()
        .single();

      if (estError) throw estError;

      // Create tasks from master tasks
      if (masterTasks.length > 0) {
        const estimateTasks = masterTasks.map((task: any, index: number) => {
          const phase = phases.find((p: any) => p.id === task.phase_id);
          const role = roles.find((r: any) => r.id === task.team_role_id);
          return {
            estimate_id: newEstimate.id,
            master_task_id: task.id,
            task_name: task.name,
            phase_name: phase?.name || null,
            team_role_name: role?.name || null,
            team_role_abbreviation: role?.abbreviation || null,
            hours: task.default_hours,
            hourly_rate: role?.hourly_rate || 0,
            is_selected: task.default_included,
            display_order: index + 1,
          };
        });

        await supabase.from('estimate_tasks').insert(estimateTasks);
      }

      setEstimate({ ...variables, id: newEstimate.id, status: 'draft' } as Estimate);
      
      // Reload tasks
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
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, is_selected: checked } : t)));
  };

  const handleHoursChange = (taskId: string, hours: number) => {
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, hours } : t)));
  };

  const handleVariablesChange = (variables: EstimateVariables) => {
    if (estimate) setEstimate({ ...estimate, ...variables });
  };

  const handleRecalculate = useCallback(() => {
    if (!estimate) return;
    const updatedTasks = recalculateAllTasks(tasks, estimate, formulas);
    setTasks(updatedTasks as EstimateTask[]);
    toast.success('Task hours recalculated based on variables');
  }, [estimate, tasks, formulas]);

  const handleSave = async () => {
    if (!estimate) return;
    setSaving(true);
    try {
      const { error: estimateError } = await supabase
        .from('project_estimates')
        .update({
          name: estimate.name,
          client_name: estimate.client_name,
          description: estimate.description,
          project_size: estimate.project_size,
          project_complexity: estimate.project_complexity,
          user_personas: estimate.user_personas,
          content_pages: estimate.content_pages,
          design_layouts: estimate.design_layouts,
          form_count: estimate.form_count,
          integration_count: estimate.integration_count,
          paid_discovery: estimate.paid_discovery,
          pages_for_integration: estimate.pages_for_integration,
          custom_posts: estimate.custom_posts,
          bulk_import_amount: estimate.bulk_import_amount,
          site_builder_acf: estimate.site_builder_acf,
          third_party_integrations: estimate.third_party_integrations,
          post_launch_services: estimate.post_launch_services,
        })
        .eq('id', estimate.id);

      if (estimateError) throw estimateError;

      for (const task of tasks) {
        await supabase
          .from('estimate_tasks')
          .update({ is_selected: task.is_selected, hours: task.hours })
          .eq('id', task.id);
      }

      toast.success('Estimate saved!');
    } catch (error: any) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const totals = useMemo(() => {
    const selectedTasks = tasks.filter((t) => t.is_selected);
    const totalHours = selectedTasks.reduce((sum, t) => sum + Number(t.hours), 0);
    const totalCost = selectedTasks.reduce((sum, t) => sum + Number(t.hours) * Number(t.hourly_rate), 0);

    const byRole: Record<string, { hours: number; cost: number }> = {};
    selectedTasks.forEach((t) => {
      const role = t.team_role_abbreviation || 'Other';
      if (!byRole[role]) byRole[role] = { hours: 0, cost: 0 };
      byRole[role].hours += Number(t.hours);
      byRole[role].cost += Number(t.hours) * Number(t.hourly_rate);
    });

    const byPhase: Record<string, { hours: number; cost: number }> = {};
    selectedTasks.forEach((t) => {
      const phase = t.phase_name || 'Other';
      if (!byPhase[phase]) byPhase[phase] = { hours: 0, cost: 0 };
      byPhase[phase].hours += Number(t.hours);
      byPhase[phase].cost += Number(t.hours) * Number(t.hourly_rate);
    });

    return { totalHours, totalCost, byRole, byPhase, selectedCount: selectedTasks.length };
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

  const groupedByRole = useMemo(() => {
    const groups: Record<string, EstimateTask[]> = {};
    tasks.forEach((t) => {
      const role = t.team_role_abbreviation || 'Other';
      if (!groups[role]) groups[role] = [];
      groups[role].push(t);
    });
    return groups;
  }, [tasks]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No estimate yet — show create button
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Input
              value={estimate.name}
              onChange={(e) => setEstimate({ ...estimate, name: e.target.value })}
              className="text-lg font-semibold border-none px-0 h-auto focus-visible:ring-0 bg-transparent"
            />
            <Badge variant="outline" className="shrink-0">{estimate.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {estimate.client_name || domain} • {estimate.project_size} • {estimate.project_complexity}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRecalculate} disabled={tasks.length === 0}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Recalculate
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-3.5 w-3.5 mr-1.5" />{saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Summary Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Selected Tasks</span>
                <span className="text-sm font-medium">{totals.selectedCount} / {tasks.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Total Hours
                </span>
                <span className="text-sm font-medium">{totals.totalHours.toFixed(0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Total Cost
                </span>
                <span className="font-bold text-base">{formatCurrency(totals.totalCost)}</span>
              </div>
            </CardContent>
          </Card>

          {Object.keys(totals.byRole).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> By Role
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {Object.entries(totals.byRole).map(([role, data]) => (
                  <div key={role} className="flex items-center justify-between text-xs">
                    <span>{role}</span>
                    <span className="text-muted-foreground">{data.hours.toFixed(1)}h</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {Object.keys(totals.byPhase).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> By Phase
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {Object.entries(totals.byPhase).map(([phase, data]) => (
                  <div key={phase} className="flex items-center justify-between text-xs">
                    <span>{phase}</span>
                    <span className="text-muted-foreground">{data.hours.toFixed(1)}h</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content with Tabs */}
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="variables" className="gap-1.5 text-xs">
                <Settings2 className="h-3.5 w-3.5" />Variables
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs">All Tasks</TabsTrigger>
              <TabsTrigger value="phase" className="text-xs">By Phase</TabsTrigger>
              <TabsTrigger value="role" className="text-xs">By Role</TabsTrigger>
            </TabsList>

            <TabsContent value="variables">
              <EstimateVariablesTab variables={estimate} onChange={handleVariablesChange} />
            </TabsContent>

            <TabsContent value="all">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">All Tasks</CardTitle>
                  <CardDescription>Toggle tasks on/off and adjust hours</CardDescription>
                </CardHeader>
                <CardContent>
                  {tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No master tasks configured yet. Add tasks in the admin area first.</p>
                  ) : (
                    <div className="space-y-2">
                      {tasks.map((task) => (
                        <EstimateTaskRow key={task.id} task={task} onToggle={handleTaskToggle} onHoursChange={handleHoursChange} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="phase">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Tasks by Phase</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {Object.entries(groupedByPhase).map(([phase, phaseTasks]) => (
                      <div key={phase}>
                        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          {phase}
                          <Badge variant="secondary" className="text-[10px]">{phaseTasks.filter((t) => t.is_selected).length} selected</Badge>
                        </h3>
                        <div className="space-y-2">
                          {phaseTasks.map((task) => (
                            <EstimateTaskRow key={task.id} task={task} onToggle={handleTaskToggle} onHoursChange={handleHoursChange} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="role">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Tasks by Role</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {Object.entries(groupedByRole).map(([role, roleTasks]) => (
                      <div key={role}>
                        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          {role}
                          <Badge variant="secondary" className="text-[10px]">{roleTasks.filter((t) => t.is_selected).length} selected</Badge>
                        </h3>
                        <div className="space-y-2">
                          {roleTasks.map((task) => (
                            <EstimateTaskRow key={task.id} task={task} onToggle={handleTaskToggle} onHoursChange={handleHoursChange} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
