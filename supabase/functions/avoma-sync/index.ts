import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveUserId } from "../_shared/resolve-user.ts";
import { startSyncRun, completeSyncRun, failSyncRun } from "../_shared/sync-logger.ts";
import { findPrimarySession, ragAutoIngest, formatMeetingsForRag } from "../_shared/rag-auto-ingest.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function tryMatch(meeting: any, domainLower: string, companyHint: string): boolean {
  const emailMatch = (meeting.attendees || []).some((a: any) =>
    a.email && a.email.toLowerCase().endsWith(`@${domainLower}`)
  );
  if (emailMatch) return true;

  if (meeting.organizer_email && meeting.organizer_email.toLowerCase().endsWith(`@${domainLower}`)) {
    return true;
  }

  if (companyHint.length >= 3) {
    const nameMatch = (meeting.attendees || []).some((a: any) =>
      a.name && a.name.toLowerCase().includes(companyHint)
    );
    if (nameMatch) return true;

    if (meeting.subject && meeting.subject.toLowerCase().includes(companyHint)) {
      return true;
    }
  }

  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let syncRunId = "";
  let syncRunStartedAt = 0;
  let supabase: any;

  try {
    const AVOMA_API_KEY = Deno.env.get("AVOMA_API_KEY");
    if (!AVOMA_API_KEY) throw new Error("AVOMA_API_KEY not configured");

    const SB_URL = Deno.env.get("SUPABASE_URL")!;
    const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    supabase = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

    const body = await req.json();
    const { companyId, domain, contactEmails, lookbackDays = 365 } = body;

    if (!companyId) throw new Error("companyId is required");
    if (!domain) throw new Error("domain is required");

    const userId = await resolveUserId(supabase, req, body.userId);
    const syncRun = await startSyncRun(supabase, "avoma-sync");
    syncRunId = syncRun.id;
    syncRunStartedAt = syncRun.startedAt;

    let domainLower = domain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
    const companyHint = domainLower.split(".")[0];

    const now = new Date();
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - lookbackDays);

    const baseParams = `from_date=${encodeURIComponent(fromDate.toISOString())}&to_date=${encodeURIComponent(now.toISOString())}&page_size=100`;

    // Targeted query with contact emails
    const matchedMeetings: any[] = [];
    const matchedUuids = new Set<string>();

    function addMatch(meeting: any) {
      if (matchedUuids.has(meeting.uuid)) return;
      matchedUuids.add(meeting.uuid);
      matchedMeetings.push(meeting);
    }

    // If we have contact emails, use attendee_emails filter
    const emailsToSearch = (contactEmails || []).filter((e: string) => typeof e === "string" && e.includes("@"));
    if (emailsToSearch.length > 0) {
      const attendeeParam = emailsToSearch.join(",");
      const url = `https://api.avoma.com/v1/meetings/?${baseParams}&attendee_emails=${encodeURIComponent(attendeeParam)}`;
      console.log(`[avoma-sync] Targeted query with ${emailsToSearch.length} emails`);

      let nextUrl: string | null = url;
      let page = 0;
      while (nextUrl && page < 20) {
        page++;
        const res = await fetch(nextUrl, {
          headers: { Authorization: `Bearer ${AVOMA_API_KEY}`, "Content-Type": "application/json" },
        });
        if (!res.ok) break;
        const data = await res.json();
        for (const m of data.results || []) addMatch(m);
        nextUrl = data.next || null;
      }
      console.log(`[avoma-sync] Targeted: ${matchedMeetings.length} meetings`);
    }

    // Broad scan for name/subject matches
    if (matchedMeetings.length < 5) {
      const broadUrl = `https://api.avoma.com/v1/meetings/?${baseParams}&is_internal=false`;
      let nextUrl: string | null = broadUrl;
      let page = 0;
      let consecutiveEmpty = 0;

      while (nextUrl && page < 40) {
        page++;
        try {
          const res = await fetch(nextUrl, {
            headers: { Authorization: `Bearer ${AVOMA_API_KEY}`, "Content-Type": "application/json" },
          });
          if (!res.ok) break;
          const data = await res.json();
          const before = matchedMeetings.length;
          for (const m of data.results || []) {
            if (tryMatch(m, domainLower, companyHint)) addMatch(m);
          }
          consecutiveEmpty = matchedMeetings.length > before ? 0 : consecutiveEmpty + 1;
          if (consecutiveEmpty >= (matchedMeetings.length >= 10 ? 3 : 10)) break;
          nextUrl = data.next || null;
        } catch { break; }
      }
      console.log(`[avoma-sync] Broad scan: ${page} pages, ${matchedMeetings.length} total matches`);
    }

    // Fetch transcripts for top 10 matches
    const toEnrich = matchedMeetings.slice(0, 10);
    for (const meeting of toEnrich) {
      if (meeting.transcript_ready && meeting.transcription_uuid) {
        try {
          const tRes = await fetch(`https://api.avoma.com/v1/transcriptions/${meeting.transcription_uuid}/`, {
            headers: { Authorization: `Bearer ${AVOMA_API_KEY}` },
          });
          if (tRes.ok) {
            const tData = await tRes.json();
            const speakers = new Map<number, string>();
            for (const s of tData.speakers || []) {
              speakers.set(s.id, s.name || s.email || `Speaker ${s.id}`);
            }
            const sentences = (tData.transcript || []).map((seg: any) => ({
              text: seg.transcript || "",
              speaker: speakers.get(seg.speaker_id) || `Speaker ${seg.speaker_id}`,
              start: (seg.timestamps || [])[0] || 0,
            }));
            meeting._transcript_text = sentences.map((s: any) => `${s.speaker}: ${s.text}`).join("\n");
          }
        } catch (e) {
          console.warn(`[avoma-sync] Transcript fetch failed for ${meeting.uuid}: ${e.message}`);
        }
      }
    }

    // Upsert into company_meetings
    const rows = matchedMeetings.map((m) => ({
      company_id: companyId,
      external_id: m.uuid,
      source: "avoma",
      title: m.subject || null,
      date: m.start_at || m.scheduled_at || null,
      duration_minutes: m.duration ? Math.round(m.duration / 60) : null,
      attendees: (m.attendees || []).map((a: any) => ({ email: a.email, name: a.name })),
      summary: m._transcript_text ? m._transcript_text.substring(0, 5000) : null,
      transcript: m._transcript_text || null,
      recording_url: m.recording_uuid ? `https://app.avoma.com/recording/${m.recording_uuid}` : null,
      raw_data: m,
      user_id: userId,
    }));

    let upserted = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await supabase
        .from("company_meetings")
        .upsert(batch, { onConflict: "external_id,source,user_id" });
      if (error) {
        console.error(`[avoma-sync] Upsert error at offset ${i}: ${JSON.stringify(error)}`);
      } else {
        upserted += batch.length;
      }
    }

    console.log(`[avoma-sync] Upserted ${upserted} meetings for company ${companyId}`);

    // Auto-vectorize into RAG pipeline (non-blocking)
    if (upserted > 0) {
      try {
        const sessionId = await findPrimarySession(supabase, companyId);
        if (sessionId) {
          const companyName = domain || companyId;
          const doc = formatMeetingsForRag(rows, companyName);
          if (doc) {
            const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
            await ragAutoIngest(sessionId, [doc], SB_URL, anonKey);
          }
        } else {
          console.log(`[avoma-sync] No crawl session found for company ${companyId}, skipping RAG ingest`);
        }
      } catch (ragErr: any) {
        console.warn(`[avoma-sync] RAG ingest failed (non-blocking): ${ragErr?.message}`);
      }
    }

    await completeSyncRun(supabase, syncRunId, {
      recordsUpserted: upserted,
      metadata: { company_id: companyId, domain, meetings_found: matchedMeetings.length },
    }, syncRunStartedAt);

    return new Response(
      JSON.stringify({ success: true, meetings_synced: upserted, meetings_found: matchedMeetings.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(`[avoma-sync] Fatal: ${e.message}`);
    if (syncRunId && supabase) {
      try { await failSyncRun(supabase, syncRunId, e); } catch {}
    }
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
