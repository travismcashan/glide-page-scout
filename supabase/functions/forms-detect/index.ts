const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// Known third-party form platform signatures
const PLATFORM_SIGNATURES: Record<string, { patterns: RegExp[]; label: string }> = {
  hubspot: {
    patterns: [/hs-form/i, /hbspt\.forms/i, /hsforms\.net/i, /hs_form_key/i, /class="hs-form/i],
    label: 'HubSpot',
  },
  gravityforms: {
    patterns: [/gform_wrapper/i, /gform_body/i, /gfield/i, /gravity-form/i, /class="gform/i],
    label: 'Gravity Forms',
  },
  typeform: {
    patterns: [/typeform\.com/i, /data-tf-/i, /tf-v1-/i],
    label: 'Typeform',
  },
  wpforms: {
    patterns: [/wpforms-form/i, /wpforms-container/i, /class="wpforms/i],
    label: 'WPForms',
  },
  contactform7: {
    patterns: [/wpcf7-form/i, /wpcf7/i, /class="wpcf7/i],
    label: 'Contact Form 7',
  },
  formidable: {
    patterns: [/frm_form/i, /formidable/i, /class="frm_/i],
    label: 'Formidable Forms',
  },
  ninja: {
    patterns: [/nf-form-cont/i, /ninja-forms/i, /class="nf-/i],
    label: 'Ninja Forms',
  },
  pardot: {
    patterns: [/pardot\.com/i, /pi\.pardot/i, /pardotform/i],
    label: 'Pardot',
  },
  marketo: {
    patterns: [/mktoForm/i, /marketo/i, /mktForm/i],
    label: 'Marketo',
  },
  mailchimp: {
    patterns: [/mc-embedded/i, /mailchimp/i, /list-manage\.com/i],
    label: 'Mailchimp',
  },
  activecampaign: {
    patterns: [/activecampaign\.com/i, /_form_\d+/i, /ac-form/i],
    label: 'ActiveCampaign',
  },
  jotform: {
    patterns: [/jotform\.com/i, /jotform/i],
    label: 'Jotform',
  },
  calendly: {
    patterns: [/calendly\.com/i, /calendly-inline/i],
    label: 'Calendly',
  },
  intercom: {
    patterns: [/intercom/i, /intercom-container/i],
    label: 'Intercom',
  },
};

// URL patterns likely to contain forms
const FORM_URL_PATTERNS = [
  /contact/i, /get-in-touch/i, /reach-out/i,
  /lets-talk/i,
  /apply/i, /application/i, /register/i, /signup/i, /sign-up/i,
  /request/i, /quote/i, /demo/i, /trial/i, /get-started/i,
  /subscribe/i, /newsletter/i,
  /feedback/i, /survey/i,
  /login/i, /signin/i, /sign-in/i,
  /careers/i, /jobs/i, /join/i,
  /support/i, /help/i, /ticket/i,
  /booking/i, /appointment/i, /schedule/i,
  /donate/i, /contribute/i,
  /checkout/i, /order/i, /buy/i,
];

function getPathname(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function getPathDepth(url: string): number {
  return getPathname(url).split('/').filter(Boolean).length;
}

function isHighPrioritySiteUrl(url: string): boolean {
  const pathname = getPathname(url);
  if (pathname === '/' || pathname === '') return true;
  if (/^\/(blog|author|category|tag)(\/|$)/i.test(pathname)) return false;
  return getPathDepth(url) <= 1;
}

interface FormData {
  id: string;
  action: string;
  method: string;
  fieldCount: number;
  fieldTypes: string[];
  fieldNames: string[];
  hasFileUpload: boolean;
  hasCaptcha: boolean;
  hasHoneypot: boolean;
  platform: string | null;
  htmlSnippet: string;
}

interface PageForms {
  url: string;
  forms: FormData[];
}

function extractFormsFromHtml(html: string, url: string): FormData[] {
  const forms: FormData[] = [];
  // Simple regex-based form extraction (edge functions don't have DOMParser)
  const formRegex = /<form[\s\S]*?<\/form>/gi;
  let match;
  let idx = 0;

  while ((match = formRegex.exec(html)) !== null) {
    const formHtml = match[0];
    idx++;

    // Extract action
    const actionMatch = formHtml.match(/action=["']([^"']*?)["']/i);
    const action = actionMatch?.[1] || '';

    // Extract method
    const methodMatch = formHtml.match(/method=["']([^"']*?)["']/i);
    const method = (methodMatch?.[1] || 'GET').toUpperCase();

    // Extract input fields
    const inputRegex = /<(?:input|select|textarea)[\s\S]*?(?:\/>|>)/gi;
    const fieldTypes: string[] = [];
    const fieldNames: string[] = [];
    let inputMatch;
    while ((inputMatch = inputRegex.exec(formHtml)) !== null) {
      const inp = inputMatch[0];
      const typeMatch = inp.match(/type=["']([^"']*?)["']/i);
      const nameMatch = inp.match(/name=["']([^"']*?)["']/i);
      const t = typeMatch?.[1]?.toLowerCase() || (inp.startsWith('<select') ? 'select' : inp.startsWith('<textarea') ? 'textarea' : 'text');
      if (t !== 'hidden' && t !== 'submit') {
        fieldTypes.push(t);
      }
      if (nameMatch?.[1]) fieldNames.push(nameMatch[1]);
    }

    // Detect file upload
    const hasFileUpload = /type=["']file["']/i.test(formHtml);

    // Detect CAPTCHA
    const hasCaptcha = /captcha|recaptcha|g-recaptcha|h-captcha|hcaptcha|turnstile/i.test(formHtml) || /captcha|recaptcha|g-recaptcha|h-captcha|hcaptcha|turnstile/i.test(html);

    // Detect honeypot
    const hasHoneypot = /honeypot|hp-field|display:\s*none.*?<input/i.test(formHtml);

    // Detect platform
    let platform: string | null = null;
    for (const [, sig] of Object.entries(PLATFORM_SIGNATURES)) {
      if (sig.patterns.some(p => p.test(formHtml) || p.test(html))) {
        platform = sig.label;
        break;
      }
    }

    // Create a fingerprint snippet (first 500 chars of cleaned form)
    const snippet = formHtml.replace(/\s+/g, ' ').slice(0, 500);

    forms.push({
      id: `${url}-form-${idx}`,
      action,
      method,
      fieldCount: fieldTypes.length,
      fieldTypes,
      fieldNames,
      hasFileUpload,
      hasCaptcha,
      hasHoneypot,
      platform,
      htmlSnippet: snippet,
    });
  }

  // Also detect iframe embeds (Typeform, Calendly, etc.)
  const iframeRegex = /<iframe[\s\S]*?(?:\/>|<\/iframe>)/gi;
  while ((match = iframeRegex.exec(html)) !== null) {
    const iframe = match[0];
    let platform: string | null = null;
    for (const [, sig] of Object.entries(PLATFORM_SIGNATURES)) {
      if (sig.patterns.some(p => p.test(iframe))) {
        platform = sig.label;
        break;
      }
    }
    if (platform) {
      idx++;
      const srcMatch = iframe.match(/src=["']([^"']*?)["']/i);
      forms.push({
        id: `${url}-embed-${idx}`,
        action: srcMatch?.[1] || '',
        method: 'EMBED',
        fieldCount: 0,
        fieldTypes: [],
        fieldNames: [],
        hasFileUpload: false,
        hasCaptcha: false,
        hasHoneypot: false,
        platform,
        htmlSnippet: iframe.replace(/\s+/g, ' ').slice(0, 500),
      });
    }
  }

  return forms;
}

// Create a simple fingerprint for deduplication
function formFingerprint(form: FormData): string {
  const parts = [
    form.platform || 'native',
    form.fieldCount.toString(),
    form.fieldTypes.sort().join(','),
    form.method,
  ];
  return parts.join('|');
}

async function scrapePageHtml(url: string, firecrawlKey: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['html'],
        onlyMainContent: false, // Need full page for forms in headers/footers
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const data = await response.json();
    return data?.data?.html || data?.html || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls, domain } = await req.json();

    if (!urls?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'URLs list is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiKey = Deno.env.get('LOVABLE_API_KEY');

    console.log(`[forms-detect] Analyzing ${urls.length} URLs for ${domain}`);

    // Step 1: Prioritize URLs - form-likely pages first, then sample others
    const allUrls = urls as string[];
    const formLikelyUrls = allUrls.filter(u => FORM_URL_PATTERNS.some(p => p.test(u)));
    const otherUrls = allUrls.filter(u => !FORM_URL_PATTERNS.some(p => p.test(u)));

    // Always include homepage + form-likely + shallow top-level site pages + sample of others (max 30 total)
    const homepage = allUrls.find(u => {
      try { return new URL(u).pathname === '/' || new URL(u).pathname === ''; } catch { return false; }
    });
    const prioritizedUrls = new Set<string>();
    if (homepage) prioritizedUrls.add(homepage);
    for (const u of formLikelyUrls) prioritizedUrls.add(u);

    const highPriorityOtherUrls = otherUrls
      .filter(isHighPrioritySiteUrl)
      .sort((a, b) => getPathDepth(a) - getPathDepth(b));

    for (const u of highPriorityOtherUrls) {
      if (prioritizedUrls.size >= 30) break;
      prioritizedUrls.add(u);
    }

    // Add random sample of the remaining URLs to detect global/embed forms
    const remainingOtherUrls = otherUrls.filter(u => !highPriorityOtherUrls.includes(u));
    const sampleSize = Math.min(Math.max(0, 30 - prioritizedUrls.size), 10, remainingOtherUrls.length);
    const shuffled = [...remainingOtherUrls].sort(() => Math.random() - 0.5);
    for (let i = 0; i < sampleSize; i++) prioritizedUrls.add(shuffled[i]);

    const urlsToScrape = Array.from(prioritizedUrls).slice(0, 30);
    console.log(`[forms-detect] Scraping ${urlsToScrape.length} pages (${formLikelyUrls.length} form-likely, ${highPriorityOtherUrls.length} high-priority, ${sampleSize} sampled)`);

    // Step 2: Scrape pages in parallel batches
    const pageFormsList: PageForms[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < urlsToScrape.length; i += BATCH_SIZE) {
      const batch = urlsToScrape.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (url) => {
          const html = await scrapePageHtml(url, firecrawlKey);
          if (!html) return null;
          const forms = extractFormsFromHtml(html, url);
          return { url, forms };
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value && r.value.forms.length > 0) {
          pageFormsList.push(r.value);
        }
      }
    }

    console.log(`[forms-detect] Found forms on ${pageFormsList.length} pages`);

    // Step 3: Fingerprint and identify globals
    const fingerprintMap: Record<string, { form: FormData; pages: string[] }> = {};
    for (const pf of pageFormsList) {
      for (const form of pf.forms) {
        const fp = formFingerprint(form);
        if (!fingerprintMap[fp]) {
          fingerprintMap[fp] = { form, pages: [] };
        }
        fingerprintMap[fp].pages.push(pf.url);
      }
    }

    const totalPagesScraped = urlsToScrape.length;
    const GLOBAL_THRESHOLD = Math.max(3, Math.floor(totalPagesScraped * 0.4));

    const uniqueForms = Object.entries(fingerprintMap).map(([fingerprint, { form, pages }]) => ({
      fingerprint,
      ...form,
      pages,
      pageCount: pages.length,
      isGlobal: pages.length >= GLOBAL_THRESHOLD,
    }));

    // Step 4: AI classification of form purposes
    let classifiedForms = uniqueForms.map(f => ({ ...f, formType: 'Unknown', description: '' }));

    if (aiKey && uniqueForms.length > 0) {
      try {
        const formsForAi = uniqueForms.map((f, i) => ({
          index: i,
          fieldNames: f.fieldNames.slice(0, 20),
          fieldTypes: f.fieldTypes.slice(0, 20),
          fieldCount: f.fieldCount,
          action: f.action,
          method: f.method,
          platform: f.platform,
          isGlobal: f.isGlobal,
          pageCount: f.pageCount,
          samplePage: f.pages[0],
        }));

        const response = await fetch(AI_GATEWAY_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${aiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              {
                role: 'system',
                content: `You are a web forms analyst. Classify each form by its purpose and provide a brief description. Be specific — don't just say "contact form" if the fields suggest it's a "quote request form" or "demo booking form".`,
              },
              {
                role: 'user',
                content: `Classify these ${formsForAi.length} forms found on ${domain}:\n\n${JSON.stringify(formsForAi, null, 2)}`,
              },
            ],
            tools: [
              {
                type: 'function',
                function: {
                  name: 'classify_forms',
                  description: 'Classify each form by purpose',
                  parameters: {
                    type: 'object',
                    properties: {
                      forms: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            index: { type: 'number', description: 'Form index from input' },
                            formType: {
                              type: 'string',
                              description: 'Form type category',
                              enum: ['Contact', 'Quote Request', 'Demo/Trial', 'Newsletter', 'Login/Auth', 'Search', 'Registration', 'Application', 'Feedback/Survey', 'Booking/Scheduling', 'Donation', 'Checkout/Order', 'Support/Ticket', 'File Upload', 'Multi-Step Wizard', 'CTA/Lead Capture', 'Comments', 'Other'],
                            },
                            description: { type: 'string', description: 'Brief 1-sentence description of the form purpose' },
                          },
                          required: ['index', 'formType', 'description'],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ['forms'],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: 'function', function: { name: 'classify_forms' } },
          }),
        });

        if (response.ok) {
          const aiData = await response.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            if (parsed.forms) {
              for (const cf of parsed.forms) {
                if (cf.index >= 0 && cf.index < classifiedForms.length) {
                  classifiedForms[cf.index].formType = cf.formType || 'Unknown';
                  classifiedForms[cf.index].description = cf.description || '';
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('[forms-detect] AI classification error:', e);
        // Continue without classification
      }
    }

    // Step 5: Build summary
    const platforms: Record<string, number> = {};
    const formTypes: Record<string, number> = {};
    let globalCount = 0;

    for (const f of classifiedForms) {
      const p = f.platform || 'Native';
      platforms[p] = (platforms[p] || 0) + 1;
      formTypes[f.formType] = (formTypes[f.formType] || 0) + 1;
      if (f.isGlobal) globalCount++;
    }

    const result = {
      forms: classifiedForms.map(f => ({
        fingerprint: f.fingerprint,
        formType: f.formType,
        description: f.description,
        platform: f.platform,
        isGlobal: f.isGlobal,
        pages: f.pages,
        pageCount: f.pageCount,
        fieldCount: f.fieldCount,
        fieldTypes: f.fieldTypes,
        fieldNames: f.fieldNames,
        hasFileUpload: f.hasFileUpload,
        hasCaptcha: f.hasCaptcha,
        method: f.method,
        action: f.action,
      })),
      summary: {
        totalFormsFound: pageFormsList.reduce((sum, pf) => sum + pf.forms.length, 0),
        uniqueForms: classifiedForms.length,
        globalForms: globalCount,
        pagesWithForms: pageFormsList.length,
        pagesScraped: totalPagesScraped,
        platforms,
        formTypes,
      },
    };

    console.log(`[forms-detect] Done — ${result.summary.uniqueForms} unique forms (${globalCount} global), ${Object.keys(platforms).length} platforms`);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in forms-detect:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to detect forms' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
