import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/** Strip XML tags and normalize whitespace */
function stripXml(xml: string): string {
  // Extract text from w:t elements specifically for better accuracy
  const textParts: string[] = [];
  // Match paragraph boundaries for line breaks
  const paragraphs = xml.split(/<\/w:p>/gi);
  for (const para of paragraphs) {
    const texts: string[] = [];
    const regex = /<w:t[^>]*>([^<]*)<\/w:t>/gi;
    let match;
    while ((match = regex.exec(para)) !== null) {
      texts.push(match[1]);
    }
    if (texts.length > 0) {
      textParts.push(texts.join(''));
    }
  }
  return textParts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Extract text from DOCX (ZIP of XML) without AI */
async function extractDocxText(base64Data: string): Promise<string> {
  const binary = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  const zip = await JSZip.loadAsync(binary);
  const docXml = zip.file('word/document.xml');
  if (!docXml) {
    throw new Error('Invalid DOCX: missing word/document.xml');
  }
  const xml = await docXml.async('string');
  return stripXml(xml);
}

/** Check if MIME type is a DOCX variant */
function isDocx(mimeType: string): boolean {
  return mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || mimeType === 'application/msword'
    || mimeType.includes('wordprocessingml');
}

/** Check if MIME type is a spreadsheet */
function isSpreadsheet(mimeType: string): boolean {
  return mimeType.includes('spreadsheetml') || mimeType.includes('ms-excel');
}

/** Extract text from XLSX */
async function extractXlsxText(base64Data: string): Promise<string> {
  const binary = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  const zip = await JSZip.loadAsync(binary);

  // Load shared strings
  const sharedStringsFile = zip.file('xl/sharedStrings.xml');
  const sharedStrings: string[] = [];
  if (sharedStringsFile) {
    const ssXml = await sharedStringsFile.async('string');
    const regex = /<t[^>]*>([^<]*)<\/t>/gi;
    let match;
    while ((match = regex.exec(ssXml)) !== null) {
      sharedStrings.push(match[1]);
    }
  }

  // Process each sheet
  const lines: string[] = [];
  let sheetIndex = 1;
  while (true) {
    const sheetFile = zip.file(`xl/worksheets/sheet${sheetIndex}.xml`);
    if (!sheetFile) break;
    if (sheetIndex > 1) lines.push(`\n--- Sheet ${sheetIndex} ---\n`);

    const sheetXml = await sheetFile.async('string');
    const rows = sheetXml.split(/<\/row>/gi);
    for (const row of rows) {
      const cells: string[] = [];
      const cellRegex = /<c\s[^>]*?(?:t="s"[^>]*)?>.*?<v>(\d+)<\/v>|<c\s[^>]*?>.*?<v>([^<]*)<\/v>/gi;
      const typeCheck = /<c\s[^>]*?t="s"[^>]*?>.*?<v>(\d+)<\/v>/gi;

      // Simple approach: find all <v> values
      const vRegex = /<c\s([^>]*)><v>([^<]*)<\/v>/gi;
      let m;
      while ((m = vRegex.exec(row)) !== null) {
        const attrs = m[1];
        const val = m[2];
        if (attrs.includes('t="s"') && sharedStrings[parseInt(val)]) {
          cells.push(sharedStrings[parseInt(val)]);
        } else {
          cells.push(val);
        }
      }
      if (cells.length > 0) {
        lines.push(cells.join('\t'));
      }
    }
    sheetIndex++;
  }
  return lines.join('\n').trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileBase64, fileName, mimeType } = await req.json();

    if (!fileBase64 || !mimeType) {
      return new Response(
        JSON.stringify({ error: 'fileBase64 and mimeType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let extractedText = '';

    // ── DOCX: extract text directly from XML (no AI needed) ──
    if (isDocx(mimeType)) {
      console.log(`[parse-upload] Extracting DOCX text from ${fileName}`);
      extractedText = await extractDocxText(fileBase64);
    }
    // ── XLSX: extract text from sheets ──
    else if (isSpreadsheet(mimeType)) {
      console.log(`[parse-upload] Extracting XLSX text from ${fileName}`);
      extractedText = await extractXlsxText(fileBase64);
    }
    // ── Plain text types: decode directly ──
    else if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/xml') {
      console.log(`[parse-upload] Decoding text from ${fileName}`);
      extractedText = atob(fileBase64);
    }
    // ── PDF / Images: use AI multimodal extraction ──
    else {
      const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
      if (!GEMINI_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const dataUri = `data:${mimeType};base64,${fileBase64}`;

      console.log(`[parse-upload] Using AI for ${mimeType}: ${fileName}`);

      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GEMINI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: 'You are a document text extractor. Extract ALL text content from the provided document, preserving structure (headings, lists, tables, paragraphs). Output the text in clean markdown format. Do not summarize or omit anything. If the document contains tables, render them as markdown tables.',
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Extract all text content from this document (${fileName || 'document'}). Output the full text in markdown format, preserving structure.`,
                },
                {
                  type: 'image_url',
                  image_url: { url: dataUri },
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('AI gateway error:', response.status, errText);
        return new Response(
          JSON.stringify({ error: `Failed to parse document (${response.status})` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      extractedText = data.choices?.[0]?.message?.content || '';
    }

    console.log(`[parse-upload] Extracted ${extractedText.length} chars from ${fileName}`);

    return new Response(
      JSON.stringify({ text: extractedText, fileName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('parse-upload error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});