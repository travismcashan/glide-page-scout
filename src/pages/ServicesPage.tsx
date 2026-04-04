import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PILLARS } from "@/data/offerings";
import { useServiceOfferings } from "@/hooks/useServiceOfferings";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

const TRACK_BADGE: Record<string, string> = {
  IS: "bg-pillar-is-light text-pillar-is-foreground border-pillar-is/30",
  FB: "bg-pillar-fb-light text-pillar-fb-foreground border-pillar-fb/30",
  GO: "bg-pillar-go-light text-pillar-go-foreground border-pillar-go/30",
  TS: "bg-pillar-ts-light text-pillar-ts-foreground border-pillar-ts/30",
};

const TRACK_DOT: Record<string, string> = {
  IS: "bg-pillar-is",
  FB: "bg-pillar-fb",
  GO: "bg-pillar-go",
  TS: "bg-pillar-ts",
};

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function priceRange(
  minVal: number | null | undefined,
  maxVal: number | null | undefined,
  suffix = ""
): string {
  if (minVal == null && maxVal == null) return "—";
  if (minVal != null && maxVal != null && minVal !== maxVal) {
    return `${formatCurrency(minVal)} – ${formatCurrency(maxVal)}${suffix}`;
  }
  return `${formatCurrency(minVal ?? maxVal)}${suffix}`;
}

type SortKey = "sku" | "name" | "price" | "duration";
type SortDir = "asc" | "desc";

const BILLING_TYPES = ["Fixed", "Retainer", "T&M"];

interface NewServiceForm {
  name: string;
  sku: string;
  pillar: string;
  billingType: string;
  minPrice: string;
  maxPrice: string;
  duration: string;
  roadmapGrade: boolean;
}

const EMPTY_FORM: NewServiceForm = {
  name: "",
  sku: "",
  pillar: "GO",
  billingType: "Retainer",
  minPrice: "",
  maxPrice: "",
  duration: "9",
  roadmapGrade: true,
};

export default function ServicesPage() {
  const { offerings, loading, refetch } = useServiceOfferings();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("sku");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [collapsedTracks, setCollapsedTracks] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<NewServiceForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 text-muted-foreground/50" />;
    return sortDir === "asc"
      ? <ArrowUp className="ml-1 inline h-3.5 w-3.5" />
      : <ArrowDown className="ml-1 inline h-3.5 w-3.5" />;
  };

  const toggleTrack = (code: string) => {
    setCollapsedTracks((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const getPriceNum = (o: any): number | null => {
    if (o.minRetainer != null) return o.minRetainer;
    if (o.minFixed != null) return o.minFixed;
    if (o.minHourly != null) return o.minHourly * (o.hourlyRateExternal ?? 150);
    return null;
  };

  const getPriceDisplay = (o: any): string => {
    if (o.minRetainer != null || o.maxRetainer != null) return priceRange(o.minRetainer, o.maxRetainer, "/mo");
    if (o.minFixed != null || o.maxFixed != null) return priceRange(o.minFixed, o.maxFixed);
    if (o.minHourly != null || o.maxHourly != null) return `${priceRange(o.minHourly, o.maxHourly)} hrs @ ${formatCurrency(o.hourlyRateExternal ?? 150)}/hr`;
    return "—";
  };

  const baseOfferings = (offerings ?? []).filter((o: any) => !o.phaseOf);

  const filtered = baseOfferings.filter((o: any) => {
    const matchesTrack = !trackFilter || o.pillar === trackFilter;
    const matchesSearch =
      !search ||
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      String(o.sku).includes(search);
    return matchesTrack && matchesSearch;
  });

  const sorted = [...filtered].sort((a: any, b: any) => {
    let cmp = 0;
    if (sortKey === "sku") cmp = a.sku - b.sku;
    else if (sortKey === "name") cmp = a.name.localeCompare(b.name);
    else if (sortKey === "price") cmp = (getPriceNum(a) ?? -1) - (getPriceNum(b) ?? -1);
    else if (sortKey === "duration") cmp = a.defaultDuration - b.defaultDuration;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const tracks = PILLARS.filter((p) => !trackFilter || p.code === trackFilter);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.sku || !form.pillar || !form.billingType) {
      toast.error("Name, SKU, track, and billing type are required.");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        sku: parseInt(form.sku),
        name: form.name.trim(),
        pillar: form.pillar,
        default_duration_months: parseInt(form.duration) || 9,
        roadmap_grade: form.roadmapGrade,
        billing_type: form.billingType,
        sort_order: parseInt(form.sku) * 10,
      };
      if (form.billingType === "Fixed") {
        if (form.minPrice) payload.min_fixed = parseFloat(form.minPrice);
        if (form.maxPrice) payload.max_fixed = parseFloat(form.maxPrice);
      } else if (form.billingType === "Retainer") {
        if (form.minPrice) payload.min_retainer = parseFloat(form.minPrice);
        if (form.maxPrice) payload.max_retainer = parseFloat(form.maxPrice);
      } else if (form.billingType === "T&M") {
        if (form.minPrice) payload.min_hourly = parseFloat(form.minPrice);
        if (form.maxPrice) payload.max_hourly = parseFloat(form.maxPrice);
      }
      const { error } = await supabase.from("services" as any).insert(payload);
      if (error) throw error;
      toast.success(`Service "${form.name}" added.`);
      setForm(EMPTY_FORM);
      setAddOpen(false);
      refetch?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add service.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <main className="px-4 sm:px-6 py-6 space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Services</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Service catalog — click any row to view or edit service details.
            </p>
          </div>
          <Button className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Service
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name or SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTrackFilter(null)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                !trackFilter
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              All
            </button>
            {PILLARS.map((p) => (
              <button
                key={p.code}
                onClick={() => setTrackFilter(trackFilter === p.code ? null : p.code)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  trackFilter === p.code
                    ? `${TRACK_BADGE[p.code]} border-current`
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${TRACK_DOT[p.code]}`} />
                {p.code}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Loading services…
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-16 cursor-pointer select-none" onClick={() => toggleSort("sku")}>
                    SKU <SortIcon k="sku" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                    Name <SortIcon k="name" />
                  </TableHead>
                  <TableHead className="w-36">Track</TableHead>
                  <TableHead className="w-32">Billing</TableHead>
                  <TableHead className="w-48 cursor-pointer select-none" onClick={() => toggleSort("price")}>
                    Price <SortIcon k="price" />
                  </TableHead>
                  <TableHead className="w-24 text-center cursor-pointer select-none" onClick={() => toggleSort("duration")}>
                    Duration <SortIcon k="duration" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracks.map((track) => {
                  const trackRows = sorted.filter((o: any) => o.pillar === track.code);
                  if (trackRows.length === 0) return null;
                  const collapsed = collapsedTracks.has(track.code);
                  return (
                    <>
                      {/* Track group header */}
                      <TableRow
                        key={`header-${track.code}`}
                        className="bg-muted/30 cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleTrack(track.code)}
                      >
                        <TableCell colSpan={6} className="py-2.5 font-semibold text-xs tracking-widest uppercase text-muted-foreground">
                          <span className="flex items-center gap-2">
                            {collapsed
                              ? <ChevronRight className="h-3.5 w-3.5" />
                              : <ChevronDown className="h-3.5 w-3.5" />
                            }
                            <span className={`inline-block h-2 w-2 rounded-full ${TRACK_DOT[track.code]}`} />
                            {track.name} — Track {track.code}
                            <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/60">
                              ({trackRows.length})
                            </span>
                          </span>
                        </TableCell>
                      </TableRow>
                      {!collapsed && trackRows.map((o: any) => (
                        <TableRow
                          key={o.sku}
                          className="hover:bg-muted/30 cursor-pointer"
                          onClick={() => o.id && navigate(`/services/${o.id}`)}
                        >
                          <TableCell className="font-mono text-xs text-muted-foreground">{o.sku}</TableCell>
                          <TableCell className="font-medium">{o.name}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${TRACK_BADGE[o.pillar]}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${TRACK_DOT[o.pillar]}`} />
                              {o.pillar}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {o.billingType ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm">{getPriceDisplay(o)}</TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {o.defaultDuration} mo
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  );
                })}
                {sorted.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground text-sm">
                      No services found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {/* Add Service Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Service</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Name *</label>
                <Input
                  placeholder="e.g. Email Marketing"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">SKU *</label>
                <Input
                  type="number"
                  placeholder="e.g. 406"
                  value={form.sku}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Track *</label>
                <Select value={form.pillar} onValueChange={(v) => setForm((f) => ({ ...f, pillar: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PILLARS.map((p) => (
                      <SelectItem key={p.code} value={p.code}>{p.name} ({p.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Billing *</label>
                <Select value={form.billingType} onValueChange={(v) => setForm((f) => ({ ...f, billingType: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_TYPES.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Min Price {form.billingType === "Retainer" ? "(/mo)" : form.billingType === "T&M" ? "(hrs)" : ""}
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 1000"
                  value={form.minPrice}
                  onChange={(e) => setForm((f) => ({ ...f, minPrice: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Max Price {form.billingType === "Retainer" ? "(/mo)" : form.billingType === "T&M" ? "(hrs)" : ""}
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 2000"
                  value={form.maxPrice}
                  onChange={(e) => setForm((f) => ({ ...f, maxPrice: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Default Duration (mo)</label>
                <Input
                  type="number"
                  placeholder="9"
                  value={form.duration}
                  onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.roadmapGrade}
                    onChange={(e) => setForm((f) => ({ ...f, roadmapGrade: e.target.checked }))}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="text-sm text-muted-foreground">Roadmap grade</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setForm(EMPTY_FORM); }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Adding…" : "Add Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
