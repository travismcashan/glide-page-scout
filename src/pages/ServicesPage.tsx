import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PILLARS } from "@/data/offerings";
import { useServiceOfferings } from "@/hooks/useServiceOfferings";
import AppHeader from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search } from "lucide-react";

const PILLAR_BADGE: Record<string, string> = {
  IS: "bg-pillar-is-light text-pillar-is-foreground border-pillar-is/30",
  FB: "bg-pillar-fb-light text-pillar-fb-foreground border-pillar-fb/30",
  GO: "bg-pillar-go-light text-pillar-go-foreground border-pillar-go/30",
  TS: "bg-pillar-ts-light text-pillar-ts-foreground border-pillar-ts/30",
};

const PILLAR_DOT: Record<string, string> = {
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

export default function ServicesPage() {
  const { offerings, loading } = useServiceOfferings();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [pillarFilter, setPillarFilter] = useState<string | null>(null);

  const filteredOfferings = offerings.filter((o) => {
    if (o.phaseOf) return false; // hide phase variants
    const matchesPillar = !pillarFilter || o.pillar === pillarFilter;
    const matchesSearch =
      !search ||
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      String(o.sku).includes(search);
    return matchesPillar && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Services</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Service catalog — click any row to view or edit service details.
          </p>
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
              onClick={() => setPillarFilter(null)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                !pillarFilter
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              All
            </button>
            {PILLARS.map((p) => (
              <button
                key={p.code}
                onClick={() => setPillarFilter(pillarFilter === p.code ? null : p.code)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  pillarFilter === p.code
                    ? `${PILLAR_BADGE[p.code]} border-current`
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${PILLAR_DOT[p.code]}`} />
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
                  <TableHead className="w-16">SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-36">Pillar</TableHead>
                  <TableHead className="w-32">Billing</TableHead>
                  <TableHead className="w-48">Price</TableHead>
                  <TableHead className="w-24 text-center">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOfferings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground text-sm">
                      No services found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOfferings.map((o) => {
                    const pillarMeta = PILLARS.find((p) => p.code === o.pillar);
                    let priceDisplay = "—";
                    if (o.minRetainer != null || o.maxRetainer != null) {
                      priceDisplay = priceRange(o.minRetainer, o.maxRetainer, "/mo");
                    } else if (o.minFixed != null || o.maxFixed != null) {
                      priceDisplay = priceRange(o.minFixed, o.maxFixed);
                    } else if (o.minHourly != null || o.maxHourly != null) {
                      priceDisplay = `${priceRange(o.minHourly, o.maxHourly)} hrs @ ${formatCurrency(o.hourlyRateExternal ?? 150)}/hr`;
                    }

                    return (
                      <TableRow
                        key={o.sku}
                        className="hover:bg-muted/30 cursor-pointer"
                        onClick={() => o.id && navigate(`/services/${o.id}`)}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground">{o.sku}</TableCell>
                        <TableCell className="font-medium">{o.name}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${PILLAR_BADGE[o.pillar]}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${PILLAR_DOT[o.pillar]}`} />
                            {pillarMeta?.name ?? o.pillar}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {o.billingType ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">{priceDisplay}</TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {o.defaultDuration} mo
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
