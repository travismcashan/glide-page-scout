/**
 * Shared helper for auto-vectorizing communication data into the RAG pipeline.
 * After sync functions write emails/meetings/messages to local tables,
 * they call this to format and ingest the content so it's searchable via Chat.
 */

/**
 * Find the primary (most recent done) crawl session for a company.
 * RAG documents are scoped by session_id which maps to crawl_sessions.id.
 */
export async function findPrimarySession(
  sb: any,
  companyId: string,
): Promise<string | null> {
  const { data } = await sb
    .from("crawl_sessions")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(1);

  return data?.[0]?.id || null;
}

/**
 * Ingest an array of text documents into the RAG pipeline.
 * Non-blocking — logs errors but doesn't throw.
 */
export async function ragAutoIngest(
  sessionId: string,
  documents: { name: string; content: string; source_type: string; source_key: string }[],
  supabaseUrl: string,
  anonKey: string,
): Promise<number> {
  if (documents.length === 0) return 0;

  // Filter out docs with too little content
  const valid = documents.filter(d => d.content && d.content.length >= 50);
  if (valid.length === 0) return 0;

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/rag-ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
        documents: valid.map(d => ({
          name: d.name,
          content: d.content,
          source_type: d.source_type,
          source_key: d.source_key,
          skip_dedup: false,
        })),
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => `HTTP ${resp.status}`);
      console.error(`[rag-auto-ingest] Failed: ${resp.status} ${errText.slice(0, 200)}`);
      return 0;
    }

    const result = await resp.json();
    const ingested = result.results?.filter((r: any) => r.status === "ready").length || 0;
    console.log(`[rag-auto-ingest] Ingested ${ingested}/${valid.length} documents for session ${sessionId}`);
    return ingested;
  } catch (e: any) {
    console.error(`[rag-auto-ingest] Error: ${e?.message || "unknown"}`);
    return 0;
  }
}

/** Format email records into a single RAG document */
export function formatEmailsForRag(
  emails: { subject: string; sender: string; recipient: string; date: string | null; body: string; snippet: string }[],
  companyName: string,
): { name: string; content: string; source_type: string; source_key: string } | null {
  if (emails.length === 0) return null;

  const lines = emails.map(e => {
    const date = e.date ? new Date(e.date).toLocaleString() : "Unknown date";
    const subject = e.subject || "No subject";
    const body = (e.body || e.snippet || "").substring(0, 3000);
    return `## ${subject}\n**From:** ${e.sender}\n**To:** ${e.recipient}\n**Date:** ${date}\n\n${body}`;
  });

  return {
    name: `Gmail: ${companyName} emails (${emails.length})`,
    content: lines.join("\n\n---\n\n"),
    source_type: "communication",
    source_key: `gmail:${companyName}:${new Date().toISOString()}`,
  };
}

/** Format meeting records into a single RAG document */
export function formatMeetingsForRag(
  meetings: { title: string | null; date: string | null; attendees: any[]; summary: string | null; transcript: string | null }[],
  companyName: string,
): { name: string; content: string; source_type: string; source_key: string } | null {
  if (meetings.length === 0) return null;

  const lines = meetings.map(m => {
    const date = m.date ? new Date(m.date).toLocaleString() : "Unknown date";
    const title = m.title || "Untitled meeting";
    const attendeeList = (m.attendees || []).map((a: any) => a.name || a.email || "Unknown").join(", ");
    const content = m.transcript || m.summary || "No transcript available";
    return `## ${title}\n**Date:** ${date}\n**Attendees:** ${attendeeList}\n\n${content.substring(0, 8000)}`;
  });

  return {
    name: `Avoma: ${companyName} meetings (${meetings.length})`,
    content: lines.join("\n\n---\n\n"),
    source_type: "communication",
    source_key: `avoma:${companyName}:${new Date().toISOString()}`,
  };
}

/** Format Slack message records into a single RAG document */
export function formatMessagesForRag(
  messages: { channel_name: string | null; author: string | null; text: string | null; created_at: string | null }[],
  companyName: string,
): { name: string; content: string; source_type: string; source_key: string } | null {
  if (messages.length === 0) return null;

  const lines = messages.map(m => {
    const date = m.created_at ? new Date(m.created_at).toLocaleString() : "";
    const channel = m.channel_name || "unknown";
    const author = m.author || "unknown";
    return `[${date}] #${channel} @${author}: ${m.text || ""}`;
  });

  return {
    name: `Slack: ${companyName} messages (${messages.length})`,
    content: lines.join("\n\n"),
    source_type: "communication",
    source_key: `slack:${companyName}:${new Date().toISOString()}`,
  };
}
