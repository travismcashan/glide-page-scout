import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Convert Avoma transcript format to our sentence format
function parseTranscript(tData: any): { text: string; speakerName: string; speakerId: number; start: number; end: number }[] {
  const speakers = new Map<number, string>();
  for (const s of (tData.speakers || [])) {
    speakers.set(s.id, s.name || s.email || `Speaker ${s.id}`);
  }

  const sentences: any[] = [];
  for (const seg of (tData.transcript || [])) {
    const speakerName = speakers.get(seg.speaker_id) || `Speaker ${seg.speaker_id}`;
    const timestamps = seg.timestamps || [];
    sentences.push({
      text: seg.transcript || '',
      speakerName,
      speakerId: seg.speaker_id,
      start: timestamps[0] || 0,
      end: timestamps[timestamps.length - 1] || 0,
    });
  }
  return sentences;
}

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

    const body = await req.json();
    const { action } = body;

    // === On-demand full transcript fetch for a single meeting ===
    if (action === 'transcript') {
      const { transcriptionUuid } = body;
      if (!transcriptionUuid) {
        return new Response(JSON.stringify({ success: false, error: 'transcriptionUuid is required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[avoma] Fetching full transcript: ${transcriptionUuid}`);
      const tRes = await fetch(`https://api.avoma.com/v1/transcriptions/${transcriptionUuid}/`, {
        headers: { 'Authorization': `Bearer ${AVOMA_API_KEY}` },
      });

      if (!tRes.ok) {
        const errText = await tRes.text();
        console.error(`[avoma] Transcript API error [${tRes.status}]: ${errText}`);
        return new Response(JSON.stringify({ success: false, error: `Avoma API error [${tRes.status}]` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tData = await tRes.json();
      console.log(`[avoma] Transcript raw keys: ${Object.keys(tData).join(', ')}, transcript segments: ${(tData.transcript || []).length}, speakers: ${(tData.speakers || []).length}`);
      const sentences = parseTranscript(tData);

      return new Response(JSON.stringify({ success: true, sentences, totalSentences: sentences.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === Default: meeting list lookup with preview transcripts ===
    const { domain } = body;
    if (!domain) {
      return new Response(JSON.stringify({ success: false, error: 'domain is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const domainLower = domain.toLowerCase();
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const fromDate = sixMonthsAgo.toISOString();
    const toDate = now.toISOString();

    console.log(`[avoma] Searching meetings for domain: ${domainLower}, from: ${fromDate}, to: ${toDate}`);

    const url = `https://api.avoma.com/v1/meetings/?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}&page_size=100&is_internal=false`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AVOMA_API_KEY}`, 'Content-Type': 'application/json' },
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

    const matchedMeetings: any[] = [];
    const extractMeeting = (meeting: any) => ({
      uuid: meeting.uuid,
      subject: meeting.subject,
      startAt: meeting.start_at,
      endAt: meeting.end_at,
      duration: meeting.duration,
      state: meeting.state,
      isCall: meeting.is_call,
      organizerEmail: meeting.organizer_email,
      attendees: (meeting.attendees || []).map((a: any) => ({ email: a.email, name: a.name })),
      purpose: meeting.purpose?.label || null,
      outcome: meeting.outcome?.label || null,
      transcriptReady: meeting.transcript_ready || false,
      notesReady: meeting.notes_ready || false,
      transcriptionUuid: meeting.transcription_uuid || null,
      recordingUuid: meeting.recording_uuid || null,
    });

    for (const meeting of results) {
      const match = (meeting.attendees || []).some((a: any) =>
        a.email && a.email.toLowerCase().endsWith(`@${domainLower}`)
      );
      if (match) matchedMeetings.push(extractMeeting(meeting));
    }

    // Paginate up to 5 more pages
    let nextUrl = data.next || null;
    let pageCount = 1;
    while (nextUrl && pageCount < 5) {
      pageCount++;
      try {
        const pageRes = await fetch(nextUrl, {
          headers: { 'Authorization': `Bearer ${AVOMA_API_KEY}`, 'Content-Type': 'application/json' },
        });
        if (!pageRes.ok) { await pageRes.text(); break; }
        const pageData = await pageRes.json();
        for (const meeting of (pageData.results || [])) {
          const match = (meeting.attendees || []).some((a: any) =>
            a.email && a.email.toLowerCase().endsWith(`@${domainLower}`)
          );
          if (match) matchedMeetings.push(extractMeeting(meeting));
        }
        nextUrl = pageData.next || null;
      } catch { break; }
    }

    console.log(`[avoma] Found ${matchedMeetings.length} meetings matching @${domainLower}`);

    // Enrich top 10 with PREVIEW transcripts (50 segments) and insights
    const enriched = [];
    for (const meeting of matchedMeetings.slice(0, 10)) {
      let transcript = null;
      let insights = null;

      if (meeting.transcriptReady && meeting.transcriptionUuid) {
        try {
          const tRes = await fetch(`https://api.avoma.com/v1/transcriptions/${meeting.transcriptionUuid}/`, {
            headers: { 'Authorization': `Bearer ${AVOMA_API_KEY}` },
          });
          if (tRes.ok) {
            const tData = await tRes.json();
            const allSentences = parseTranscript(tData);
            console.log(`[avoma] Meeting ${meeting.uuid}: parsed ${allSentences.length} transcript segments`);
            transcript = {
              sentences: allSentences.slice(0, 50),
              totalSentences: allSentences.length,
              truncated: allSentences.length > 50,
            };
          } else {
            const errText = await tRes.text();
            console.error(`[avoma] Transcript fetch error for ${meeting.transcriptionUuid}: ${tRes.status}`);
          }
        } catch (e) {
          console.error(`[avoma] Transcript fetch exception: ${e.message}`);
        }
      }

      if (meeting.notesReady) {
        try {
          const iRes = await fetch(`https://api.avoma.com/v1/meetings/${meeting.uuid}/insights/`, {
            headers: { 'Authorization': `Bearer ${AVOMA_API_KEY}` },
          });
          if (iRes.ok) {
            const iData = await iRes.json();
            insights = {
              aiNotes: (iData.ai_notes || []).map((n: any) => ({ text: n.text, noteType: n.note_type })),
              keywords: iData.keywords?.popular?.slice(0, 20) || [],
              speakers: iData.speakers || [],
            };
          } else { await iRes.text(); }
        } catch { /* skip */ }
      }

      enriched.push({ ...meeting, transcript, insights });
    }

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
