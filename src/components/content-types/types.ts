export type BaseType = 'Page' | 'Post' | 'CPT' | 'Archive' | 'Search';

export type ClassifiedUrl = {
  url: string;
  contentType: string;
  confidence: 'high' | 'medium' | 'low';
  source: string;
  baseType?: BaseType;
  template?: string;
  cptName?: string;
};

export type ContentTypeSummary = {
  type: string;
  count: number;
  urls: string[];
  totalUrls: number;
  confidence: { high: number; medium: number; low: number };
  baseType?: BaseType;
  cptName?: string;
};

export type ContentTypesData = {
  summary: ContentTypeSummary[];
  classified?: ClassifiedUrl[];
  stats: {
    total: number;
    bySource: Record<string, number>;
    uniqueTypes: number;
    ambiguousScanned: number;
  };
};

export function rebuildSummary(classified: ClassifiedUrl[]): ContentTypeSummary[] {
  const typeCounts: Record<string, { count: number; urls: string[]; confidence: Record<string, number>; baseType?: BaseType; cptName?: string }> = {};
  for (const c of classified) {
    if (!typeCounts[c.contentType]) {
      typeCounts[c.contentType] = { count: 0, urls: [], confidence: { high: 0, medium: 0, low: 0 }, baseType: c.baseType, cptName: c.cptName };
    }
    typeCounts[c.contentType].count++;
    typeCounts[c.contentType].urls.push(c.url);
    typeCounts[c.contentType].confidence[c.confidence]++;
  }
  return Object.entries(typeCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([type, data]) => ({
      type,
      count: data.count,
      urls: data.urls,
      totalUrls: data.urls.length,
      confidence: data.confidence as { high: number; medium: number; low: number },
      baseType: data.baseType,
      cptName: data.cptName,
    }));
}
