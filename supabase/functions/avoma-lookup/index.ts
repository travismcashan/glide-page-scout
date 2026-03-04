import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AVOMA_API_KEY = Deno.env.get('AVOMA_API_KEY');
    if (!AVOMA_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'AVOMA_API_KEY not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { domain } = await req.json();
    if (!domain) {
      return new Response(JSON.stringify({ success: false, error: 'domain is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const domainLower = domain.toLowerCase();

    // Fetch meetings from the last 6 months
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const fromDate = sixMonthsAgo.toISOString();
    const toDate = now.toISOString();

    console.log(`[avoma] Searching meetings for domain: ${domainLower}, from: ${fromDate}, to: ${toDate}`);

    // Fetch first page of external meetings
    const url = `https://api.avoma.com/v1/meetings/?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}&page_size=100&is_internal=false`;

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${AVOMA_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[avoma] API error [${res.status}]: ${errText}`);
      return new Response(JSON.stringify({ success: false, error: `Avoma API error [${res.status}]: ${errText.substring(0, 500)}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const results = data.results || [];
    console.log(`[avoma] First page returned ${results.length} meetings, total count: ${data.count}`);

    // Filter: any attendee email ends with @domain
    const matchedMeetings: any[] = [];
    for (const meeting of results) {
      const attendees = meeting.attendees || [];
      const match = attendees.some((a: any) =>
        a.email && a.email.toLowerCase().endsWith(`@${domainLower}`)
      );
      if (match) {
        matchedMeetings.push({
          uuid: meeting.uuid,
          subject: meeting.subject,
          startAt: meeting.start_at,
          endAt: meeting.end_at,
          duration: meeting.duration,
          state: meeting.state,
          isCall: meeting.is_call,
          organizerEmail: meeting.organizer_email,
          attendees: attendees.map((a: any) => ({
            email: a.email,
            name: a.name,
          })),
          purpose: meeting.purpose?.label || null,
          outcome: meeting.outcome?.label || null,
          transcriptReady: meeting.transcript_ready || false,
          notesReady: meeting.notes_ready || false,
          transcriptionUuid: meeting.transcription_uuid || null,
          recordingUuid: meeting.recording_uuid || null,
        });
      }
    }

    console.log(`[avoma] Found ${matchedMeetings.length} meetings matching @${domainLower}`);

    // Paginate to find more matches (up to 5 more pages)
    let nextUrl = data.next || null;
    let pageCount = 1;
    const maxPages = 5;

    while (nextUrl && pageCount < maxPages) {
      pageCount++;
      try {
        const pageRes = await fetch(nextUrl, {
          headers: {
            'Authorization': `Bearer ${AVOMA_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });
        if (!pageRes.ok) {
          await pageRes.text();
          break;
        }
        const pageData = await pageRes.json();
        for (const meeting of (pageData.results || [])) {
          const attendees = meeting.attendees || [];
          const match = attendees.some((a: any) =>
            a.email && a.email.toLowerCase().endsWith(`@${domainLower}`)
          );
          if (match) {
            matchedMeetings.push({
              uuid: meeting.uuid,
              subject: meeting.subject,
              startAt: meeting.start_at,
              endAt: meeting.end_at,
              duration: meeting.duration,
              state: meeting.state,
              isCall: meeting.is_call,
              organizerEmail: meeting.organizer_email,
              attendees: attendees.map((a: any) => ({
                email: a.email,
                name: a.name,
              })),
              purpose: meeting.purpose?.label || null,
              outcome: meeting.outcome?.label || null,
              transcriptReady: meeting.transcript_ready || false,
              notesReady: meeting.notes_ready || false,
              transcriptionUuid: meeting.transcription_uuid || null,
              recordingUuid: meeting.recording_uuid || null,
            });
          }
        }
        nextUrl = pageData.next || null;
      } catch {
        break;
      }
    }

    // Fetch transcripts and insights for top 10 matches only (to avoid timeout)
    const enriched = [];
    for (const meeting of matchedMeetings.slice(0, 10)) {
      let transcript = null;
      let insights = null;

      // Fetch transcript
      if (meeting.transcriptReady && meeting.transcriptionUuid) {
        try {
          const tRes = await fetch(`https://api.avoma.com/v1/transcriptions/${meeting.transcriptionUuid}/`, {
            headers: { 'Authorization': `Bearer ${AVOMA_API_KEY}` },
          });
          if (tRes.ok) {
            const tData = await tRes.json();
            transcript = {
              sentences: (tData.sentences || []).map((s: any) => ({
                text: s.text,
                speakerName: s.speaker_name,
                start: s.start,
                end: s.end,
              })),
              totalSentences: (tData.sentences || []).length,
            };
          } else { await tRes.text(); }
        } catch { /* skip */ }
      }

      // Fetch insights
      if (meeting.notesReady) {
        try {
          const iRes = await fetch(`https://api.avoma.com/v1/meetings/${meeting.uuid}/insights/`, {
            headers: { 'Authorization': `Bearer ${AVOMA_API_KEY}` },
          });
          if (iRes.ok) {
            const iData = await iRes.json();
            insights = {
              aiNotes: (iData.ai_notes || []).map((n: any) => ({
                text: n.text,
                noteType: n.note_type,
              })),
              keywords: iData.keywords?.popular?.slice(0, 20) || [],
              speakers: iData.speakers || [],
            };
          } else { await iRes.text(); }
        } catch { /* skip */ }
      }

      enriched.push({ ...meeting, transcript, insights });
    }

    // Return remaining meetings without enrichment
    for (const meeting of matchedMeetings.slice(10)) {
      enriched.push({ ...meeting, transcript: null, insights: null });
    }

    return new Response(JSON.stringify({
      success: true,
      domain: domainLower,
      totalMatches: matchedMeetings.length,
      meetings: enriched,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[avoma] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
