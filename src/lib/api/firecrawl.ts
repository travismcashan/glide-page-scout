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
