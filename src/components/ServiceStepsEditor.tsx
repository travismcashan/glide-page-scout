import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ChevronDown, GripVertical, Zap, RotateCw } from "lucide-react";
import { toast } from "sonner";

interface StepRow {
  id?: string;
  code: string;
  name: string;
  step_type: "phase" | "cycle";
  frequency: string | null;
  sort_order: number;
  is_onramp: boolean;
  _isNew?: boolean;
  _deleted?: boolean;
}

interface ServiceStepsEditorProps {
  serviceId: string;
}

export default function ServiceStepsEditor({ serviceId }: ServiceStepsEditorProps) {
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetchSteps = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("service_steps" as any)
        .select("id, code, name, step_type, frequency, sort_order, is_onramp")
        .eq("service_id", serviceId)
        .order("sort_order", { ascending: true });

      if (!error && data) {
        setSteps(
          (data as any[]).map((s) => ({
            id: s.id,
            code: s.code,
            name: s.name,
            step_type: s.step_type,
            frequency: s.frequency,
            sort_order: s.sort_order,
            is_onramp: s.is_onramp,
          }))
        );
      }
      setLoading(false);
    };
    if (serviceId) fetchSteps();
  }, [serviceId]);

  const addStep = () => {
    const maxOrder = steps
      .filter((s) => !s._deleted)
      .reduce((m, s) => Math.max(m, s.sort_order), 0);
    setSteps((prev) => [
      ...prev,
      {
        code: "",
        name: "",
        step_type: "phase",
        frequency: null,
        sort_order: maxOrder + 1,
        is_onramp: false,
        _isNew: true,
      },
    ]);
  };

  const updateStep = (idx: number, field: string, value: any) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  };

  const removeStep = (idx: number) => {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s;
        return { ...s, _deleted: true };
      })
    );
  };

  const saveSteps = async () => {
    setSaving(true);

    const toDelete = steps.filter((s) => s._deleted && s.id);
    for (const s of toDelete) {
      await supabase.from("service_steps" as any).delete().eq("id", s.id);
    }

    const toSave = steps.filter((s) => !s._deleted);
    for (let i = 0; i < toSave.length; i++) {
      const s = toSave[i];
      const row = {
        service_id: serviceId,
        code: s.code || `STEP-${i + 1}`,
        name: s.name || "Untitled Step",
        step_type: s.step_type,
        frequency: s.step_type === "cycle" ? (s.frequency || "monthly") : null,
        sort_order: i + 1,
        is_onramp: s.is_onramp,
      };

      if (s.id && !s._isNew) {
        await supabase.from("service_steps" as any).update(row as any).eq("id", s.id);
      } else {
        await supabase.from("service_steps" as any).insert(row as any);
      }
    }

    toast.success("Steps saved");
    setSaving(false);

    const { data } = await supabase
      .from("service_steps" as any)
      .select("id, code, name, step_type, frequency, sort_order, is_onramp")
      .eq("service_id", serviceId)
      .order("sort_order", { ascending: true });

    if (data) {
      setSteps(
        (data as any[]).map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          step_type: s.step_type,
          frequency: s.frequency,
          sort_order: s.sort_order,
          is_onramp: s.is_onramp,
        }))
      );
    }
  };

  const visibleSteps = steps.filter((s) => !s._deleted);
  const phaseCount = visibleSteps.filter((s) => s.step_type === "phase").length;
  const cycleCount = visibleSteps.filter((s) => s.step_type === "cycle").length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Phases & Cycles
            </span>
            {visibleSteps.length > 0 && (
              <span className="text-xs text-muted-foreground">
                ({phaseCount} phase{phaseCount !== 1 ? "s" : ""}
                {cycleCount > 0
                  ? `, ${cycleCount} cycle${cycleCount !== 1 ? "s" : ""}`
                  : ""}
                )
              </span>
            )}
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {loading ? (
          <p className="text-xs text-muted-foreground px-1">Loading steps…</p>
        ) : (
          <>
            {visibleSteps.length === 0 && (
              <p className="text-xs text-muted-foreground px-1">
                No phases or cycles defined yet.
              </p>
            )}
            {visibleSteps.map((step, visIdx) => {
              const realIdx = steps.indexOf(step);
              return (
                <div
                  key={step.id || `new-${visIdx}`}
                  className="flex items-start gap-2 rounded-md border border-border bg-muted/20 p-2"
                >
                  <GripVertical className="mt-2 h-4 w-4 shrink-0 text-muted-foreground/40" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={step.step_type === "phase" ? "default" : "secondary"}
                        className="shrink-0 text-[10px] px-1.5"
                      >
                        {step.step_type === "phase" ? (
                          <>
                            <Zap className="mr-0.5 h-2.5 w-2.5" />Phase
                          </>
                        ) : (
                          <>
                            <RotateCw className="mr-0.5 h-2.5 w-2.5" />Cycle
                          </>
                        )}
                      </Badge>
                      <Input
                        value={step.code}
                        onChange={(e) => updateStep(realIdx, "code", e.target.value)}
                        placeholder="PH-STRATEGY"
                        className="h-7 w-36 text-xs font-mono"
                      />
                      <Input
                        value={step.name}
                        onChange={(e) => updateStep(realIdx, "name", e.target.value)}
                        placeholder="Strategy & Planning"
                        className="h-7 flex-1 text-xs"
                      />
                      <button
                        onClick={() => removeStep(realIdx)}
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 pl-1">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] text-muted-foreground">Type</Label>
                        <Select
                          value={step.step_type}
                          onValueChange={(v) => updateStep(realIdx, "step_type", v)}
                        >
                          <SelectTrigger className="h-6 w-20 text-[10px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="phase">Phase</SelectItem>
                            <SelectItem value="cycle">Cycle</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {step.step_type === "cycle" && (
                        <div className="flex items-center gap-1.5">
                          <Label className="text-[10px] text-muted-foreground">
                            Frequency
                          </Label>
                          <Select
                            value={step.frequency || "monthly"}
                            onValueChange={(v) => updateStep(realIdx, "frequency", v)}
                          >
                            <SelectTrigger className="h-6 w-24 text-[10px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={step.is_onramp}
                          onCheckedChange={(v) => updateStep(realIdx, "is_onramp", v)}
                          className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
                        />
                        <Label className="text-[10px] text-muted-foreground">
                          On-ramp
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between pt-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={addStep}
              >
                <Plus className="h-3 w-3" /> Add Step
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={saveSteps}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Steps"}
              </Button>
            </div>
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
