import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Save, Clock, DollarSign, Users, Layers, Settings2, PlusCircle, Loader2, CalendarDays, FileText, Trash2 } from 'lucide-react';
import { EstimateTaskRow, type EstimateTask } from './EstimateTaskRow';
import { EstimateVariablesTab } from './EstimateVariablesTab';
import { recalculateAllTasks, fetchFormulas, calculatePhaseTimeline, countRoles, type TaskFormula, type EstimateVariables } from '@/lib/estimateFormulas';
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

export function EstimateBuilderCard({ sessionId, domain, pageTags, contentTypesData, formsData, wappalyzerData, templateTiers }: Props) {
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [tasks, setTasks] = useState<EstimateTask[]>([]);
  const [formulas, setFormulas] = useState<TaskFormula[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('variables');

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
    if (wappalyzerData?.technologies) {
      const integrationCats = ['marketing-automation', 'analytics', 'crm', 'email', 'payment-processors'];
      const integrations = wappalyzerData.technologies.filter((t: any) =>
        t.categories?.some((c: any) => integrationCats.includes(c.slug))
      );
      defaults.third_party_integrations = integrations.length || 2;
    }
    return defaults;
  }, [pageTags, contentTypesData, formsData, wappalyzerData]);

  useEffect(() => { loadEstimate(); }, [sessionId]);

  async function loadEstimate() {
    setLoading(true);
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
        .insert({ ...variables, session_id: sessionId, status: 'draft' })
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
            is_selected: task.default_included,
            display_order: index + 1,
            roles: task.roles,
            variable_label: task.variable_label || null,
            variable_qty: task.default_variable_qty || null,
          };
        });

        await supabase.from('estimate_tasks').insert(estimateTasks);
      }

      setEstimate({ ...variables, id: newEstimate.id, status: 'draft' } as Estimate);
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
    setTasks(tasks.map((t) => {
      if (t.id !== taskId) return t;
      // For variable tasks, hours_per_person is the base, qty modifies it
      const hpp = t.hours_per_person ?? t.hours;
      const roleCount = countRoles(t.roles);
      // Variable qty replaces hours_per_person (like the XLSX: variable IS the hours input)
      return { ...t, variable_qty: qty, hours_per_person: hpp, hours: Math.round(hpp * roleCount * 100) / 100 };
    }));
  };

  const handleVariablesChange = (variables: EstimateVariables) => {
    if (!estimate) return;
    const updated = { ...estimate, ...variables };
    setEstimate(updated);
    // Auto-recalculate tasks when variables change
    const updatedTasks = recalculateAllTasks(tasks, updated, formulas);
    setTasks(updatedTasks as EstimateTask[]);
  };

  const handleSave = async () => {
    if (!estimate) return;
    setSaving(true);
    try {
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
        })
        .eq('id', estimate.id);
      if (estimateError) throw estimateError;

      for (const task of tasks) {
        await supabase
          .from('estimate_tasks')
          .update({
            is_selected: task.is_selected, hours: task.hours,
            hours_per_person: task.hours_per_person, variable_qty: task.variable_qty,
          })
          .eq('id', task.id);
      }
      toast.success('Estimate saved!');
    } catch (error: any) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

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

    return { totalHours, totalCost, byRole, byPhase, selectedCount: selectedTasks.length, lowWeeks, highWeeks };
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
      const roleList = (t.roles || t.team_role_abbreviation || 'Other').split(',').map(r => r.trim()).filter(Boolean);
      roleList.forEach(role => {
        if (!groups[role]) groups[role] = [];
        // Avoid duplicates
        if (!groups[role].find(existing => existing.id === t.id)) {
          groups[role].push(t);
        }
      });
    });
    return groups;
  }, [tasks]);

  const phaseTimeline = useMemo(() => calculatePhaseTimeline(totals.byPhase), [totals.byPhase]);

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
          <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
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
                  <CalendarDays className="h-3 w-3" /> Work Weeks
                </span>
                <span className="text-sm font-medium">{totals.lowWeeks} – {totals.highWeeks}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Project Budget
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
                {Object.entries(totals.byRole)
                  .sort((a, b) => b[1].hours - a[1].hours)
                  .map(([role, data]) => (
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
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="variables" className="gap-1.5 text-xs">
                <Settings2 className="h-3.5 w-3.5" />Variables
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs">All Tasks</TabsTrigger>
              <TabsTrigger value="phase" className="text-xs">By Phase</TabsTrigger>
              <TabsTrigger value="role" className="text-xs">By Role</TabsTrigger>
              <TabsTrigger value="timeline" className="gap-1.5 text-xs">
                <CalendarDays className="h-3.5 w-3.5" />Timeline
              </TabsTrigger>
              <TabsTrigger value="sow" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" />SOW View
              </TabsTrigger>
            </TabsList>

            <TabsContent value="variables">
              <EstimateVariablesTab variables={estimate} onChange={handleVariablesChange} />
            </TabsContent>

            <TabsContent value="all">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">All Tasks</CardTitle>
                  <CardDescription>Toggle tasks on/off and adjust hours per person</CardDescription>
                </CardHeader>
                <CardContent>
                  {tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No master tasks configured yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {tasks.map((task) => (
                        <EstimateTaskRow
                          key={task.id}
                          task={task}
                          onToggle={handleTaskToggle}
                          onHoursChange={handleHoursChange}
                          onHoursPerPersonChange={handleHoursPerPersonChange}
                          onVariableQtyChange={handleVariableQtyChange}
                        />
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
                    {Object.entries(groupedByPhase).map(([phase, phaseTasks]) => {
                      const phaseHours = phaseTasks.filter(t => t.is_selected).reduce((s, t) => s + Number(t.hours), 0);
                      return (
                        <div key={phase}>
                          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            {phase}
                            <Badge variant="secondary" className="text-[10px]">{phaseHours.toFixed(1)}h</Badge>
                            <Badge variant="outline" className="text-[10px]">{phaseTasks.filter(t => t.is_selected).length}/{phaseTasks.length}</Badge>
                          </h3>
                          <div className="space-y-1.5">
                            {phaseTasks.map((task) => (
                              <EstimateTaskRow
                                key={task.id}
                                task={task}
                                onToggle={handleTaskToggle}
                                onHoursChange={handleHoursChange}
                                onHoursPerPersonChange={handleHoursPerPersonChange}
                                onVariableQtyChange={handleVariableQtyChange}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
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
                    {Object.entries(groupedByRole).map(([role, roleTasks]) => {
                      const roleHours = roleTasks.filter(t => t.is_selected).reduce((s, t) => s + Number(t.hours_per_person ?? t.hours), 0);
                      return (
                        <div key={role}>
                          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            {role}
                            <Badge variant="secondary" className="text-[10px]">{roleHours.toFixed(1)}h</Badge>
                          </h3>
                          <div className="space-y-1.5">
                            {roleTasks.map((task) => (
                              <EstimateTaskRow key={task.id} task={task} onToggle={handleTaskToggle} onHoursChange={handleHoursChange} onHoursPerPersonChange={handleHoursPerPersonChange} onVariableQtyChange={handleVariableQtyChange} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
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
          </Tabs>
        </div>
      </div>
    </div>
  );
}
