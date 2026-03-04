/**
 * Default framework documents that are pre-loaded as attachments
 * for Gemini Deep Research. The text is fetched lazily on first load.
 */

export type DefaultDoc = { name: string; url: string };

export const DEFAULT_RESEARCH_DOCS: DefaultDoc[] = [
  {
    name: 'CIRT Framework & Trust Spiral (V4).pdf',
    url: '/docs/cirt-framework.pdf',
  },
  {
    name: '5C Diagnostic Manual.pdf',
    url: '/docs/5c-diagnostic.pdf',
  },
];

/**
 * Fetches a PDF from public/ and extracts rough text content.
 * For PDFs we can't parse in-browser easily, so we store pre-extracted text.
 * This function fetches the raw file and returns a text representation.
 */
export async function loadDefaultDocs(): Promise<{ name: string; content: string }[]> {
  const results: { name: string; content: string }[] = [];

  for (const doc of DEFAULT_RESEARCH_DOCS) {
    try {
      const res = await fetch(doc.url);
      if (!res.ok) continue;
      // For PDF files, we can't parse in-browser easily.
      // We'll use the pre-extracted text stored alongside.
      const textUrl = doc.url.replace('.pdf', '.txt');
      const textRes = await fetch(textUrl);
      if (textRes.ok) {
        const content = await textRes.text();
        results.push({ name: doc.name, content });
      }
    } catch {
      // Skip failed loads silently
    }
  }

  return results;
}
