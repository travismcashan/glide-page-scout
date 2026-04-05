import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatterns, type PatternType, type PatternStatus } from '@/hooks/usePatterns';
import { BrandLoader } from '@/components/BrandLoader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Layers, Search, Plus, TrendingUp, BarChart3 } from 'lucide-react';
import { PATTERN_TYPE_COLORS, INDUSTRY_COLORS, PATTERN_STATUS_COLORS } from '@/config/badge-styles';

const INDUSTRY_OPTIONS = [
  { value: 'all', label: 'All Industries' },
  { value: 'saas', label: 'SaaS' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'legal', label: 'Legal' },
  { value: 'home_services', label: 'Home Services' },
  { value: 'cross_industry', label: 'Cross-Industry' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'education', label: 'Education' },
  { value: 'financial_services', label: 'Financial Services' },
  { value: 'ecommerce', label: 'E-Commerce' },
  { value: 'professional_services', label: 'Professional Services' },
] as const;

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'conversion', label: 'Conversion' },
  { value: 'layout', label: 'Layout' },
  { value: 'content', label: 'Content' },
  { value: 'navigation', label: 'Navigation' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'seo', label: 'SEO' },
  { value: 'accessibility', label: 'Accessibility' },
] as const;

const BLOCK_OPTIONS = [
  { value: 'all', label: 'All Blocks' },
  { value: 'hero', label: 'Hero' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'cta', label: 'CTA' },
  { value: 'form', label: 'Form' },
  { value: 'navigation', label: 'Navigation' },
  { value: 'testimonial', label: 'Testimonial' },
  { value: 'product_page', label: 'Product Page' },
  { value: 'services', label: 'Services' },
  { value: 'about', label: 'About' },
  { value: 'case_study', label: 'Case Study' },
] as const;

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'validated', label: 'Validated' },
  { value: 'draft', label: 'Draft' },
  { value: 'deprecated', label: 'Deprecated' },
] as const;

function formatIndustry(industry: string): string {
  return industry
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function confidenceColor(score: number): string {
  if (score >= 0.8) return 'bg-emerald-500';
  if (score >= 0.6) return 'bg-blue-500';
  if (score >= 0.4) return 'bg-amber-500';
  return 'bg-red-500';
}

export default function PatternLibraryPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [blockFilter, setBlockFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { patterns, allPatterns, loading } = usePatterns({
    industry: industryFilter !== 'all' ? industryFilter : undefined,
    pattern_type: typeFilter !== 'all' ? typeFilter as PatternType : undefined,
    block_type: blockFilter !== 'all' ? blockFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter as PatternStatus : undefined,
    search: search || undefined,
  });

  // Stats
  const stats = useMemo(() => {
    const all = allPatterns;
    return {
      total: all.length,
      validated: all.filter((p) => p.status === 'validated').length,
      avgConfidence: all.length > 0
        ? Math.round((all.reduce((sum, p) => sum + Number(p.confidence_score), 0) / all.length) * 100)
        : 0,
      industries: new Set(all.map((p) => p.industry)).size,
    };
  }, [allPatterns]);

  if (loading) {
    return (
      <main className="px-4 sm:px-6 py-6">
        <div className="flex items-center justify-center py-20">
          <BrandLoader size={48} />
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Layers className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Pattern Library</h1>
        <Badge variant="secondary" className="text-xs tabular-nums">{allPatterns.length}</Badge>

        {/* Quick stats */}
        <div className="hidden sm:flex items-center gap-3 ml-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {stats.validated} validated
          </span>
          <span className="inline-flex items-center gap-1">
            <BarChart3 className="h-3 w-3" />
            {stats.avgConfidence}% avg confidence
          </span>
        </div>

        <div className="flex-1" />
        <Button size="sm" onClick={() => navigate('/patterns/new')}>
          <Plus className="h-4 w-4 mr-1" />
          New Pattern
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patterns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={industryFilter} onValueChange={setIndustryFilter}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={blockFilter} onValueChange={setBlockFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BLOCK_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Pattern cards */}
      {patterns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Layers className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">
            {allPatterns.length === 0
              ? 'No patterns yet. Create your first one.'
              : 'No patterns match your filters.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {patterns.map((pattern) => (
            <Card
              key={pattern.id}
              className="px-5 py-4 cursor-pointer hover:bg-accent/40 transition-colors group"
              onClick={() => navigate(`/patterns/${pattern.id}`)}
            >
              {/* Title */}
              <h3 className="font-semibold text-sm mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                {pattern.title}
              </h3>

              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${INDUSTRY_COLORS[pattern.industry] ?? ''}`}>
                  {formatIndustry(pattern.industry)}
                </Badge>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PATTERN_TYPE_COLORS[pattern.pattern_type] ?? ''}`}>
                  {pattern.pattern_type}
                </Badge>
                {pattern.block_type && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {pattern.block_type.replace(/_/g, ' ')}
                  </Badge>
                )}
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PATTERN_STATUS_COLORS[pattern.status] ?? ''}`}>
                  {pattern.status}
                </Badge>
              </div>

              {/* Description preview */}
              <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2 mb-3">
                {pattern.description}
              </p>

              {/* Confidence bar + stats */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${confidenceColor(Number(pattern.confidence_score))}`}
                      style={{ width: `${Number(pattern.confidence_score) * 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                    {Math.round(Number(pattern.confidence_score) * 100)}%
                  </span>
                </div>
                {pattern.application_count > 0 && (
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {pattern.application_count} app{pattern.application_count !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
