import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractOrchestration } from "../_shared/orchestration.ts";

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

function extractMeeting(meeting: any) {
  return {
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
  };
}

function tryMatch(meeting: any, domainLower: string, companyHint: string): string | null {
  // Check attendee emails for domain match
  const emailMatch = (meeting.attendees || []).some((a: any) =>
    a.email && a.email.toLowerCase().endsWith(`@${domainLower}`)
  );
  if (emailMatch) return 'email_domain';

  // Check organizer email for domain match
  if (meeting.organizer_email && meeting.organizer_email.toLowerCase().endsWith(`@${domainLower}`)) {
    return 'organizer_email';
  }

  if (companyHint.length >= 3) {
    const nameMatch = (meeting.attendees || []).some((a: any) =>
      a.name && a.name.toLowerCase().includes(companyHint)
    );
    if (nameMatch) return 'attendee_name';

    if (meeting.subject && meeting.subject.toLowerCase().includes(companyHint)) {
      return 'subject';
    }
  }

  return null;
}

async function enrichMeetings(meetings: any[], matchReasons: Map<string, string>, AVOMA_API_KEY: string) {
  const toEnrich = meetings.slice(0, 10);
  const enrichedResults = await Promise.all(toEnrich.map(async (meeting) => {
    let transcript = null;
    let insights = null;

    const [tResult, iResult] = await Promise.allSettled([
      meeting.transcriptReady && meeting.transcriptionUuid
        ? fetch(`https://api.avoma.com/v1/transcriptions/${meeting.transcriptionUuid}/`, {
            headers: { 'Authorization': `Bearer ${AVOMA_API_KEY}` },
          }).then(async (r) => {
            if (!r.ok) { await r.text(); return null; }
            return r.json();
          }).catch(() => null)
        : Promise.resolve(null),
      meeting.notesReady
        ? fetch(`https://api.avoma.com/v1/meetings/${meeting.uuid}/insights/`, {
            headers: { 'Authorization': `Bearer ${AVOMA_API_KEY}` },
          }).then(async (r) => {
            if (!r.ok) { await r.text(); return null; }
            return r.json();
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

    const tData = tResult.status === 'fulfilled' ? tResult.value : null;
    if (tData) {
      const allSentences = parseTranscript(tData);
      console.log(`[avoma] Meeting ${meeting.uuid}: parsed ${allSentences.length} transcript segments`);
      transcript = {
        sentences: allSentences.slice(0, 50),
        totalSentences: allSentences.length,
        truncated: allSentences.length > 50,
      };
    }

    const iData = iResult.status === 'fulfilled' ? iResult.value : null;
    if (iData) {
      insights = {
        aiNotes: (iData.ai_notes || []).map((n: any) => ({ text: n.text, noteType: n.note_type })),
        keywords: iData.keywords?.popular?.slice(0, 20) || [],
        speakers: iData.speakers || [],
      };
    }

    return { ...meeting, transcript, insights, matchReason: matchReasons.get(meeting.uuid) || 'unknown' };
  }));

  return [
    ...enrichedResults,
    ...meetings.slice(10).map(m => ({ ...m, transcript: null, insights: null, matchReason: matchReasons.get(m.uuid) || 'unknown' })),
  ];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AVOMA_API_KEY = Deno.env.get('AVOMA_API_KEY');
    if (!AVOMA_API_KEY) {
      if (orch) await orch.markFailed('AVOMA_API_KEY not configured');
      return new Response(JSON.stringify({ success: false, error: 'AVOMA_API_KEY not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const orch = extractOrchestration(body);
    if (orch) await orch.markRunning();
    const { action, lookbackDays, stream } = body;

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
      const sentences = parseTranscript(tData);

      return new Response(JSON.stringify({ success: true, sentences, totalSentences: sentences.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === Default: meeting list lookup ===
    const { domain, contactEmails } = body;
    if (!domain) {
      if (orch) await orch.markFailed('domain is required');
      return new Response(JSON.stringify({ success: false, error: 'domain is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let domainLower = domain.toLowerCase().trim();
    domainLower = domainLower.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    domainLower = domainLower.replace(/^www\./, '');
    const companyHint = domainLower.split('.')[0];

    const now = new Date();
    const lookbackDate = new Date(now);
    const daysBack = (typeof lookbackDays === 'number' && lookbackDays > 0) ? lookbackDays : 365;
    lookbackDate.setDate(lookbackDate.getDate() - daysBack);
    const fromDate = lookbackDate.toISOString();
    const toDate = now.toISOString();

    // Build contact email list from: explicit input, HubSpot contacts, Apollo team data
    const emailsToSearch: string[] = [];
    if (contactEmails && Array.isArray(contactEmails)) {
      for (const e of contactEmails) {
        if (typeof e === 'string' && e.includes('@')) emailsToSearch.push(e.toLowerCase().trim());
      }
    }

    // Auto-discover contact emails from DB if running in orchestrated mode
    const sessionId = body._session_id;
    if (sessionId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const sb = createClient(supabaseUrl, serviceKey);

        const { data: sessionData } = await sb.from('crawl_sessions')
          .select('hubspot_data, apollo_team_data, apollo_data')
          .eq('id', sessionId)
          .single();

        if (sessionData) {
          // Extract HubSpot contact emails
          const hContacts = sessionData.hubspot_data?.contacts || [];
          for (const c of hContacts) {
            if (c.email) emailsToSearch.push(c.email.toLowerCase().trim());
          }
          // HubSpot deal associated contacts
          const hDeals = sessionData.hubspot_data?.deals || [];
          for (const d of hDeals) {
            if (d.contact_email) emailsToSearch.push(d.contact_email.toLowerCase().trim());
          }

          // Extract Apollo team member emails
          const aTeam = sessionData.apollo_team_data?.people || sessionData.apollo_team_data?.contacts || [];
          for (const p of aTeam) {
            if (p.email) emailsToSearch.push(p.email.toLowerCase().trim());
          }

          // Apollo single enrichment email
          if (sessionData.apollo_data?.email) {
            emailsToSearch.push(sessionData.apollo_data.email.toLowerCase().trim());
          }
        }
      } catch (err) {
        console.warn(`[avoma] Failed to fetch contact emails from DB: ${err.message}`);
      }
    }

    // Deduplicate and filter out own org emails (GLIDE team)
    const uniqueEmails = [...new Set(emailsToSearch)].filter(e =>
      e.endsWith(`@${domainLower}`) || // Keep emails matching the target domain
      (!e.endsWith('@glidedesign.com') && !e.endsWith('@gmail.com')) // Keep non-GLIDE, non-generic
    );
    // Ensure we at least try domain-based matching
    const domainEmails = uniqueEmails.filter(e => e.endsWith(`@${domainLower}`));

    console.log(`[avoma] Searching meetings for domain: ${domainLower} (company hint: "${companyHint}"), discovered ${uniqueEmails.length} contact emails: [${uniqueEmails.slice(0, 10).join(', ')}], from: ${fromDate}, to: ${toDate}`);

    // Strategy: If we have contact emails, use attendee_emails filter for a targeted query.
    // Then also do an is_internal=false scan to catch meetings matched by name/subject.
    let baseParams = `from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}&page_size=100`;

    // TARGETED QUERY: use attendee_emails filter if we have contact emails
    let targetedResults: any[] = [];
    if (uniqueEmails.length > 0) {
      const attendeeParam = uniqueEmails.join(',');
      const targetedUrl = `https://api.avoma.com/v1/meetings/?${baseParams}&attendee_emails=${encodeURIComponent(attendeeParam)}`;
      console.log(`[avoma] Targeted query with ${uniqueEmails.length} contact emails: ${attendeeParam.substring(0, 200)}`);

      const tRes = await fetch(targetedUrl, {
        headers: { 'Authorization': `Bearer ${AVOMA_API_KEY}`, 'Content-Type': 'application/json' },
      });

      if (tRes.ok) {
        const tData = await tRes.json();
        targetedResults = tData.results || [];
        console.log(`[avoma] Targeted query: ${targetedResults.length} meetings on first page, total: ${tData.count || 0}`);

        // Paginate through all targeted results
        let tNext = tData.next || null;
        let tPage = 1;
        while (tNext && tPage < 20) {
          tPage++;
          try {
            const pRes = await fetch(tNext, {
              headers: { 'Authorization': `Bearer ${AVOMA_API_KEY}`, 'Content-Type': 'application/json' },
            });
            if (!pRes.ok) break;
            const pData = await pRes.json();
            targetedResults.push(...(pData.results || []));
            tNext = pData.next || null;
          } catch { break; }
        }
        console.log(`[avoma] Targeted query total after pagination: ${targetedResults.length} meetings`);
      } else {
        const errText = await tRes.text();
        console.warn(`[avoma] Targeted query failed [${tRes.status}]: ${errText.substring(0, 200)}`);
      }
    }

    // BROAD SCAN: is_internal=false to catch name/subject matches
    // Skip if targeted query found enough results (saves API calls against 60 req/min limit)
    const skipBroadScan = targetedResults.length >= 5;
    if (skipBroadScan) {
      console.log(`[avoma] Skipping broad scan (${targetedResults.length} targeted matches sufficient)`);
    }
    const apiUrl = `https://api.avoma.com/v1/meetings/?${baseParams}&is_internal=false`;
    const res = skipBroadScan ? null : await fetch(apiUrl, {
      headers: { 'Authorization': `Bearer ${AVOMA_API_KEY}`, 'Content-Type': 'application/json' },
    });

    if (res && !res.ok) {
      // If broad scan fails but targeted worked, use targeted results
      if (targetedResults.length > 0) {
        console.warn(`[avoma] Broad scan failed, using targeted results only`);
      } else {
        const errText = await res.text();
        console.error(`[avoma] API error [${res.status}]: ${errText}`);
        return new Response(JSON.stringify({ success: false, error: `Avoma API error [${res.status}]: ${errText.substring(0, 500)}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const data = (res && res.ok) ? await res.json() : { results: [], count: 0, next: null };
    const firstResults = data.results || [];
    const totalCount = data.count || 0;
    if (!skipBroadScan) console.log(`[avoma] Broad scan first page: ${firstResults.length} meetings, total external: ${totalCount}`);

    const matchedMeetings: any[] = [];
    const matchedUuids = new Set<string>();
    const matchReasons = new Map<string, string>();

    function addMatch(meeting: any, reason: string) {
      if (matchedUuids.has(meeting.uuid)) return;
      matchedUuids.add(meeting.uuid);
      matchReasons.set(meeting.uuid, reason);
      matchedMeetings.push(extractMeeting(meeting));
    }

    // First: add all targeted results (these are high-confidence matches via attendee_emails filter)
    for (const meeting of targetedResults) {
      addMatch(meeting, 'attendee_email');
    }
    if (targetedResults.length > 0) {
      console.log(`[avoma] Added ${matchedMeetings.length} meetings from targeted attendee_emails query`);
    }

    // Then: scan broad results for additional name/subject matches
    for (const meeting of firstResults) {
      const reason = tryMatch(meeting, domainLower, companyHint);
      if (reason) addMatch(meeting, reason);
    }

    // === STREAMING mode: send SSE progress events ===
    if (stream) {
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          const send = (event: string, data: any) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };

          try {
          // Send initial progress
          send('progress', {
            page: 1,
            meetingsScanned: firstResults.length,
            totalMeetings: totalCount,
            matchesFound: matchedMeetings.length,
            phase: 'scanning',
          });

          // Paginate through ALL external meetings (no aggressive early termination)
          let nextUrl = data.next || null;
          let pageCount = 1;
          let consecutiveEmpty = 0;
          let meetingsScanned = firstResults.length;

          while (nextUrl && pageCount < 80) {
            pageCount++;
            try {
              const pageRes = await fetch(nextUrl, {
                headers: { 'Authorization': `Bearer ${AVOMA_API_KEY}`, 'Content-Type': 'application/json' },
              });
              if (!pageRes.ok) { await pageRes.text(); break; }
              const pageData = await pageRes.json();
              const beforeCount = matchedMeetings.length;
              const pageResults = pageData.results || [];
              meetingsScanned += pageResults.length;

              for (const meeting of pageResults) {
                const reason = tryMatch(meeting, domainLower, companyHint);
                if (reason) addMatch(meeting, reason);
              }
              consecutiveEmpty = matchedMeetings.length > beforeCount ? 0 : consecutiveEmpty + 1;
              nextUrl = pageData.next || null;

              // Send progress update every page
              send('progress', {
                page: pageCount,
                meetingsScanned,
                totalMeetings: totalCount,
                matchesFound: matchedMeetings.length,
                phase: 'scanning',
              });
            } catch { break; }
          }

          console.log(`[avoma] Scanned ${pageCount} pages, early-stop empty streak: ${consecutiveEmpty}`);

          // Send enriching phase
          send('progress', {
            page: pageCount,
            meetingsScanned,
            totalMeetings: totalCount,
            matchesFound: matchedMeetings.length,
            phase: 'enriching',
          });

          // Sort
          const reasonOrder: Record<string, number> = { attendee_email: 0, email_domain: 1, organizer_email: 1, attendee_name: 2, subject: 3 };
          matchedMeetings.sort((a, b) =>
            (reasonOrder[matchReasons.get(a.uuid) || 'subject'] || 9) -
            (reasonOrder[matchReasons.get(b.uuid) || 'subject'] || 9)
          );

          const attendeeEmailCount = matchedMeetings.filter(m => matchReasons.get(m.uuid) === 'attendee_email').length;
          const emailCount = matchedMeetings.filter(m => matchReasons.get(m.uuid) === 'email_domain' || matchReasons.get(m.uuid) === 'organizer_email').length;
          const nameCount = matchedMeetings.filter(m => matchReasons.get(m.uuid) === 'attendee_name').length;
          const subjectCount = matchedMeetings.filter(m => matchReasons.get(m.uuid) === 'subject').length;
          console.log(`[avoma] Found ${matchedMeetings.length} meetings matching "${domainLower}" (attendee_filter: ${attendeeEmailCount}, email_scan: ${emailCount}, name: ${nameCount}, subject: ${subjectCount})`);

          // Enrich
          const enriched = await enrichMeetings(matchedMeetings, matchReasons, AVOMA_API_KEY);

          // Send final result
          send('result', {
            success: true,
            domain: domainLower,
            totalMatches: matchedMeetings.length,
            meetings: enriched,
            matchBreakdown: { attendeeEmail: attendeeEmailCount, emailDomain: emailCount, attendeeName: nameCount, subject: subjectCount },
          });
          } catch (streamErr) {
            console.error('[avoma] Stream error:', streamErr);
            send('result', {
              success: false,
              error: streamErr.message || 'Stream processing failed',
              domain: domainLower,
              totalMatches: 0,
              meetings: [],
            });
          }

          controller.close();
        },
      });

      return new Response(readableStream, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      });
    }

    // === NON-STREAMING mode (backward compat) ===
    let nextUrl = data.next || null;
    let pageCount = 1;
    let consecutiveEmpty = 0;
    while (nextUrl && pageCount < 40) {
      const emptyLimit = matchedMeetings.length >= 10 ? 3 : 10;
      if (consecutiveEmpty >= emptyLimit) break;
      pageCount++;
      try {
        const pageRes = await fetch(nextUrl, {
          headers: { 'Authorization': `Bearer ${AVOMA_API_KEY}`, 'Content-Type': 'application/json' },
        });
        if (!pageRes.ok) { await pageRes.text(); break; }
        const pageData = await pageRes.json();
        const beforeCount = matchedMeetings.length;
        for (const meeting of (pageData.results || [])) {
          const reason = tryMatch(meeting, domainLower, companyHint);
          if (reason) addMatch(meeting, reason);
        }
        consecutiveEmpty = matchedMeetings.length > beforeCount ? 0 : consecutiveEmpty + 1;
        nextUrl = pageData.next || null;
      } catch { break; }
    }
    console.log(`[avoma] Scanned ${pageCount} pages, early-stop empty streak: ${consecutiveEmpty}`);

    const reasonOrder: Record<string, number> = { attendee_email: 0, email_domain: 1, organizer_email: 1, attendee_name: 2, subject: 3 };
    matchedMeetings.sort((a, b) =>
      (reasonOrder[matchReasons.get(a.uuid) || 'subject'] || 9) -
      (reasonOrder[matchReasons.get(b.uuid) || 'subject'] || 9)
    );

    const attendeeEmailCount = matchedMeetings.filter(m => matchReasons.get(m.uuid) === 'attendee_email').length;
    const emailCount = matchedMeetings.filter(m => matchReasons.get(m.uuid) === 'email_domain' || matchReasons.get(m.uuid) === 'organizer_email').length;
    const nameCount = matchedMeetings.filter(m => matchReasons.get(m.uuid) === 'attendee_name').length;
    const subjectCount = matchedMeetings.filter(m => matchReasons.get(m.uuid) === 'subject').length;
    console.log(`[avoma] Found ${matchedMeetings.length} meetings matching "${domainLower}" (attendee_filter: ${attendeeEmailCount}, email_scan: ${emailCount}, name: ${nameCount}, subject: ${subjectCount})`);

    const enriched = await enrichMeetings(matchedMeetings, matchReasons, AVOMA_API_KEY);

    const result = {
      success: true,
      domain: domainLower,
      totalMatches: matchedMeetings.length,
      meetings: enriched,
      matchBreakdown: { attendeeEmail: attendeeEmailCount, emailDomain: emailCount, attendeeName: nameCount, subject: subjectCount },
    };

    if (orch) await orch.markDone(result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[avoma] Error:', error);
    const errMsg = error.message || 'Avoma lookup failed';
    if (orch) await orch.markFailed(errMsg);
    return new Response(JSON.stringify({ success: false, error: errMsg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
