import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPORT_MIMES: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
};

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB limit to stay within memory

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accessToken, fileId, mimeType, fileName } = await req.json();

    if (!accessToken || !fileId) {
      return new Response(JSON.stringify({ error: 'accessToken and fileId are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const isGoogleWorkspaceFile = mimeType?.startsWith('application/vnd.google-apps.');
    let downloadUrl: string;
    let finalMimeType = mimeType;

    if (isGoogleWorkspaceFile) {
      const exportMime = EXPORT_MIMES[mimeType];
      if (!exportMime) {
        return new Response(JSON.stringify({ error: 'Unsupported Google file type' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`;
      finalMimeType = exportMime;
    } else {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    }

    const downloadResponse = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!downloadResponse.ok) {
      const errorText = await downloadResponse.text();
      console.error('Download error:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to download file' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // For text-based content, return as text
    const textTypes = ['text/', 'application/json', 'application/xml', 'application/csv'];
    if (textTypes.some(t => finalMimeType?.startsWith(t) || finalMimeType?.includes(t))) {
      const content = await downloadResponse.text();
      return new Response(JSON.stringify({
        fileName: fileName || fileId,
        mimeType: finalMimeType,
        content,
        isText: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For binary, read as ArrayBuffer and use std library base64
    const fileData = await downloadResponse.arrayBuffer();
    
    if (fileData.byteLength > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ 
        error: `File too large (${Math.round(fileData.byteLength / 1024 / 1024)}MB). Maximum is ${MAX_FILE_SIZE / 1024 / 1024}MB.` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 413,
      });
    }

    const base64Content = base64Encode(new Uint8Array(fileData));

    return new Response(JSON.stringify({
      fileName: fileName || fileId,
      mimeType: finalMimeType,
      content: base64Content,
      isText: false,
      size: fileData.byteLength,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
