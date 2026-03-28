import { supabase } from '@/integrations/supabase/client';

type FirecrawlResponse<T = any> = {
  success: boolean;
  error?: string;
  data?: T;
  links?: string[];
};

export const firecrawlApi = {
  async map(url: string, options?: { search?: string; limit?: number; includeSubdomains?: boolean }): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('firecrawl-map', {
      body: { url, options },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  async scrape(url: string, options?: { formats?: string[]; onlyMainContent?: boolean }): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
      body: { url, options },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const screenshotApi = {
  async getUrl(url: string): Promise<{ success: boolean; screenshotUrl?: string; error?: string }> {
    const { data, error } = await supabase.functions.invoke('thum-screenshot', {
      body: { url },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const aiApi = {
  async generateOutline(content: string, pageTitle?: string, pageUrl?: string): Promise<{ success: boolean; outline?: string; error?: string }> {
    const { data, error } = await supabase.functions.invoke('ai-outline', {
      body: { content, pageTitle, pageUrl },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  async recommendPages(url: string, discoveredUrls: string[], mode: 'screenshots' | 'content' = 'screenshots'): Promise<{ success: boolean; recommendations?: { url: string; reason: string }[]; error?: string }> {
    const { data, error } = await supabase.functions.invoke('recommend-pages', {
      body: { url, discoveredUrls, mode },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const gtmetrixApi = {
  async runTest(url: string): Promise<{
    success: boolean;
    testId?: string;
    grade?: string;
    scores?: {
      performance: number;
      structure: number;
      lcp: number;
      tbt: number;
      cls: number;
      fcp: number;
      tti: number;
      speed_index: number;
    };
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('gtmetrix-test', {
      body: { url },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const builtwithApi = {
  async lookup(domain: string): Promise<{
    success: boolean;
    technologies?: { name: string; category: string; description?: string; link?: string }[];
    grouped?: Record<string, { name: string; description?: string; link?: string }[]>;
    totalCount?: number;
    credits?: { available?: string | null; used?: string | null; remaining?: string | null } | null;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('builtwith-lookup', {
      body: { domain },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const semrushApi = {
  async domainOverview(domain: string): Promise<{
    success: boolean;
    overview?: Record<string, string>[];
    organicKeywords?: Record<string, string>[];
    backlinks?: Record<string, string> | null;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('semrush-domain', {
      body: { domain },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const pagespeedApi = {
  async analyze(url: string): Promise<{
    success: boolean;
    mobile?: any;
    desktop?: any;
    finalUrl?: string;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('pagespeed-insights', {
      body: { url },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const wappalyzerApi = {
  async lookup(url: string): Promise<{
    success: boolean;
    technologies?: any[];
    grouped?: Record<string, any[]>;
    totalCount?: number;
    social?: string[] | null;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('wappalyzer-lookup', {
      body: { url },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const detectzestackApi = {
  async lookup(domain: string): Promise<{
    success: boolean;
    technologies?: any[];
    grouped?: Record<string, any[]>;
    totalCount?: number;
    scanDepth?: string | null;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('detectzestack-lookup', {
      body: { domain },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const websiteCarbonApi = {
  async check(url: string): Promise<{
    success: boolean;
    green?: boolean;
    bytes?: number;
    cleanerThan?: number;
    statistics?: any;
    rating?: string;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('website-carbon', {
      body: { url },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const cruxApi = {
  async lookup(origin: string): Promise<{
    success: boolean;
    overall?: any;
    phone?: any;
    desktop?: any;
    collectionPeriod?: any;
    noData?: boolean;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('crux-lookup', {
      body: { origin },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const waveApi = {
  async scan(url: string): Promise<{
    success: boolean;
    pageTitle?: string;
    waveUrl?: string;
    creditsRemaining?: number | null;
    summary?: { errors: number; alerts: number; features: number; structure: number; aria: number; contrast: number };
    items?: any;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('wave-lookup', {
      body: { url },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const observatoryApi = {
  async scan(host: string): Promise<{
    success: boolean;
    grade?: string;
    score?: number;
    scannedAt?: string;
    detailsUrl?: string;
    tests?: any;
    rawHeaders?: Record<string, string> | null;
    cspRaw?: string | null;
    cspDirectives?: Record<string, string[]> | null;
    cookies?: any[] | null;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('observatory-scan', {
      body: { host },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const oceanApi = {
  async enrich(domain: string): Promise<{
    success: boolean;
    domain?: string;
    companyName?: string;
    countries?: string[];
    primaryCountry?: string;
    companySize?: string;
    industries?: string[];
    industryCategories?: string[];
    linkedinIndustry?: string;
    technologies?: string[];
    yearFounded?: number | null;
    revenue?: string | null;
    linkedinUrl?: string | null;
    description?: string | null;
    ecommercePlatform?: string | null;
    websiteTraffic?: any;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('ocean-enrich', {
      body: { domain },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const ssllabsApi = {
  async start(host: string): Promise<{
    success: boolean;
    status?: string;
    host?: string;
    grade?: string;
    endpoints?: any[];
    certs?: any[];
    testTime?: number;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('ssllabs-scan', {
      body: { host, action: 'start' },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
  async poll(host: string): Promise<{
    success: boolean;
    status?: string;
    host?: string;
    grade?: string;
    endpoints?: any[];
    certs?: any[];
    testTime?: number;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('ssllabs-scan', {
      body: { host, action: 'poll' },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const httpstatusApi = {
  async check(url: string): Promise<{
    success: boolean;
    requestUrl?: string;
    finalUrl?: string;
    finalStatusCode?: number;
    redirectCount?: number;
    hops?: any[];
    metadata?: any;
    parsedUrl?: any;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('httpstatus-check', {
      body: { url },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const linkCheckerApi = {
  async check(
    urls: string[],
    onProgress?: (checked: number, total: number) => void,
    onPartialResults?: (results: { url: string; statusCode: number; redirectUrl: string | null; responseTimeMs: number; error: string | null }[]) => void,
    signal?: AbortSignal,
  ): Promise<{
    success: boolean;
    stopped?: boolean;
    summary?: { total: number; ok: number; redirects: number; clientErrors: number; serverErrors: number; failures: number };
    results?: { url: string; statusCode: number; redirectUrl: string | null; responseTimeMs: number; error: string | null }[];
    error?: string;
  }> {
    const BATCH_SIZE = 25;
    const allResults: any[] = [];

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      if (signal?.aborted) {
        return buildResult(allResults, true);
      }
      const batch = urls.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase.functions.invoke('link-checker', {
        body: { urls: batch },
      });
      if (signal?.aborted) {
        if (data?.results) allResults.push(...data.results);
        return buildResult(allResults, true);
      }
      if (error) return { success: false, error: error.message };
      if (!data?.success) return data;
      allResults.push(...(data.results || []));
      onProgress?.(Math.min(i + BATCH_SIZE, urls.length), urls.length);
      onPartialResults?.([...allResults]);
    }

    return buildResult(allResults, false);
  },
};

function buildResult(allResults: any[], stopped: boolean) {
  const summary = {
    total: allResults.length,
    ok: allResults.filter((r: any) => r.statusCode >= 200 && r.statusCode < 300).length,
    redirects: allResults.filter((r: any) => r.statusCode >= 300 && r.statusCode < 400).length,
    clientErrors: allResults.filter((r: any) => r.statusCode >= 400 && r.statusCode < 500).length,
    serverErrors: allResults.filter((r: any) => r.statusCode >= 500).length,
    failures: allResults.filter((r: any) => r.statusCode === 0).length,
  };
  return { success: true, stopped, summary, results: allResults };
}

export const w3cApi = {
  async validate(url: string): Promise<{
    success: boolean;
    html?: any;
    css?: any;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('w3c-validate', {
      body: { url },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const schemaApi = {
  async validate(url: string): Promise<{
    success: boolean;
    summary?: any;
    jsonLd?: any[];
    microdata?: any[];
    rdfa?: any[];
    errors?: any[];
    warnings?: any[];
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('schema-validate', {
      body: { url },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const yellowlabApi = {
  async start(url: string): Promise<{
    success: boolean;
    status?: string;
    runId?: string;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('yellowlab-scan', {
      body: { url },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
  async poll(runId: string): Promise<{
    success: boolean;
    status?: string;
    runId?: string;
    globalScore?: number | null;
    categories?: Record<string, { score: number; label: string }>;
    position?: number | null;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('yellowlab-scan', {
      body: { action: 'poll', runId },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const deepResearchApi = {
  async start(prompt: string, crawlContext?: string, documents?: { name: string; content: string }[]): Promise<{
    success: boolean;
    interactionId?: string;
    state?: string;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('deep-research', {
      body: { action: 'start', prompt, crawlContext, documents },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  async poll(interactionId: string): Promise<{
    success: boolean;
    state?: string;
    report?: string;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('deep-research', {
      body: { action: 'poll', interactionId },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const readableApi = {
  async score(url: string): Promise<{
    success: boolean;
    readabilityScore?: number | null;
    gradeLevel?: number | string | null;
    rating?: string | null;
    fleschKincaid?: number | null;
    fleschReadingEase?: number | null;
    gunningFog?: number | null;
    colemanLiau?: number | null;
    ari?: number | null;
    smog?: number | null;
    daleChall?: number | null;
    spacheScore?: number | null;
    linsearWrite?: number | null;
    wordCount?: number | null;
    sentenceCount?: number | null;
    syllableCount?: number | null;
    avgWordsPerSentence?: number | null;
    avgSyllablesPerWord?: number | null;
    keywordDensity?: any;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('readable-score', {
      body: { url },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const avomaApi = {
  async lookup(domain: string, lookbackDays?: number): Promise<{
    success: boolean;
    domain?: string;
    totalMatches?: number;
    meetings?: any[];
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('avoma-lookup', {
      body: { domain, lookbackDays },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  async lookupStreaming(
    domain: string,
    lookbackDays: number | undefined,
    onProgress: (progress: { page: number; meetingsScanned: number; totalMeetings: number; matchesFound: number; phase: string }) => void,
  ): Promise<{ success: boolean; domain?: string; totalMatches?: number; meetings?: any[]; matchBreakdown?: any; error?: string }> {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const url = `https://${projectId}.supabase.co/functions/v1/avoma-lookup`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey,
      },
      body: JSON.stringify({ domain, lookbackDays, stream: true }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${text.substring(0, 200)}` };
    }

    const reader = res.body?.getReader();
    if (!reader) return { success: false, error: 'No response body' };

    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult: any = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // keep incomplete line

      let eventType = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (eventType === 'progress') {
              onProgress(data);
            } else if (eventType === 'result') {
              finalResult = data;
            }
          } catch { /* skip malformed */ }
        }
      }
    }

    return finalResult || { success: false, error: 'No result received' };
  },
};

export const apolloApi = {
  async teamSearch(domain: string): Promise<any> {
    const { data, error } = await supabase.functions.invoke('apollo-team-search', {
      body: { domain },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
  async enrich(email: string, firstName?: string, lastName?: string, domain?: string): Promise<{
    success: boolean;
    found?: boolean;
    name?: string;
    firstName?: string;
    lastName?: string;
    title?: string;
    headline?: string;
    linkedinUrl?: string;
    photoUrl?: string;
    email?: string;
    emailStatus?: string;
    phone?: string;
    city?: string;
    state?: string;
    country?: string;
    organizationName?: string;
    organizationDomain?: string;
    organizationIndustry?: string;
    organizationSize?: number;
    organizationLinkedin?: string;
    organizationLogo?: string;
    seniority?: string;
    departments?: string[];
    employmentHistory?: { title: string; organizationName: string; startDate?: string; endDate?: string; current?: boolean }[];
    error?: string;
    errorCode?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('apollo-enrich', {
      body: { email, firstName, lastName, domain },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const navExtractApi = {
  async extract(url: string): Promise<{ success: boolean; items?: any[]; totalLinks?: number; error?: string }> {
    const { data, error } = await supabase.functions.invoke('nav-extract', {
      body: { url },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const sitemapApi = {
  async parse(baseUrl: string): Promise<{
    success: boolean;
    found?: boolean;
    urls?: string[];
    groups?: { sitemapUrl: string; label: string; urls: string[] }[];
    contentTypeHints?: { label: string; urls: string[]; sitemapUrl: string }[];
    stats?: { totalUrls: number; sitemapsFound: number; contentTypeHintsCount: number };
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('sitemap-parse', {
      body: { baseUrl },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const contentTypesApi = {
  async classifyPhased(
    urls: string[],
    baseUrl: string,
    sitemapHints?: { label: string; urls: string[] }[],
    onProgress?: (phase: string, detail: string) => void,
  ): Promise<{ success: boolean; summary?: any[]; classified?: any[]; stats?: any; error?: string }> {
    try {
      // Phase 1: Grouping (instant)
      onProgress?.('group', 'Grouping URLs by directory structure…');
      const { data: groupData, error: groupErr } = await supabase.functions.invoke('content-types', {
        body: { phase: 'group', urls, baseUrl },
      });
      if (groupErr || !groupData?.success) {
        return { success: false, error: groupErr?.message || groupData?.error || 'Grouping failed' };
      }

      // Phase 2: HTML sampling
      onProgress?.('sample', `Sampling HTML signals from ${groupData.groupCount} groups…`);
      const { data: sampleData, error: sampleErr } = await supabase.functions.invoke('content-types', {
        body: { phase: 'sample', urls, baseUrl, dirGroups: groupData.dirGroups },
      });
      if (sampleErr || !sampleData?.success) {
        return { success: false, error: sampleErr?.message || sampleData?.error || 'HTML sampling failed' };
      }

      // Phase 3: AI classification
      onProgress?.('classify', `AI classifying ${groupData.groupCount} content groups…`);
      const { data: classifyData, error: classifyErr } = await supabase.functions.invoke('content-types', {
        body: {
          phase: 'classify',
          urls,
          baseUrl,
          dirGroups: groupData.dirGroups,
          htmlSignals: sampleData.htmlSignals,
          sitemapHints,
        },
      });
      if (classifyErr || !classifyData?.success) {
        return { success: false, error: classifyErr?.message || classifyData?.error || 'AI classification failed' };
      }

      onProgress?.('done', 'Classification complete');
      return classifyData;
    } catch (e: any) {
      return { success: false, error: e?.message || 'Content type classification failed' };
    }
  },
};

export const autoTagPagesApi = {
  BATCH_SIZE: 150,

  async classifyBatch(urls: string[], domain: string, homepageContent?: string, navStructure?: any, knownIndustry?: string): Promise<{
    success: boolean;
    industry?: string;
    industryConfidence?: string;
    pages?: { url: string; template: string; baseType?: string; cptName?: string }[];
    presetTemplates?: string[];
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('auto-tag-pages', {
      body: { urls, domain, homepageContent, navStructure, knownIndustry },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  /** Legacy single-call method kept for compatibility */
  async classify(urls: string[], domain: string, homepageContent?: string, navStructure?: any): Promise<{
    success: boolean;
    industry?: string;
    industryConfidence?: string;
    pages?: { url: string; template: string; baseType?: string; cptName?: string }[];
    presetTemplates?: string[];
    error?: string;
  }> {
    return this.classifyBatch(urls, domain, homepageContent, navStructure);
  },
};

export const formsDetectApi = {
  async detect(urls: string[], domain: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const { data, error } = await supabase.functions.invoke('forms-detect', {
      body: { urls, domain },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const techAnalysisApi = {
  async analyze(builtwithData: any, detectzestackData: any, wappalyzerData: any, domain: string): Promise<{
    success: boolean;
    analysis?: any;
    techCount?: number;
    sourceCount?: number;
    sources?: string[];
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('tech-analysis', {
      body: { builtwithData, detectzestackData, wappalyzerData, domain },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const hubspotApi = {
  async lookup(domain: string): Promise<{
    success: boolean;
    domain?: string;
    companies?: any[];
    contacts?: any[];
    deals?: any[];
    stats?: { companiesCount: number; contactsCount: number; dealsCount: number };
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('hubspot-lookup', {
      body: { domain },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const ga4Api = {
  async lookup(domain: string, propertyId?: string): Promise<any> {
    const { data, error } = await supabase.functions.invoke('ga4-lookup', {
      body: { domain, ...(propertyId ? { propertyId } : {}) },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};

export const searchConsoleApi = {
  async lookup(domain: string, siteUrl?: string): Promise<any> {
    const { data, error } = await supabase.functions.invoke('search-console-lookup', {
      body: { domain, ...(siteUrl ? { siteUrl } : {}) },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};
