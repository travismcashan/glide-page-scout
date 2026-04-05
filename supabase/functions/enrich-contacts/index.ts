import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const APOLLO_KEY = Deno.env.get("APOLLO_API_KEY");
    if (!APOLLO_KEY) throw new Error("APOLLO_API_KEY not set");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { contactIds, limit: maxContacts = 25 } = await req.json().catch(() => ({}));

    // Find contacts that need enrichment
    let query = supabase
      .from("contacts")
      .select("id, email, first_name, last_name, company_id")
      .is("apollo_person_id", null)
      .not("email", "is", null)
      .order("created_at", { ascending: false })
      .limit(maxContacts);

    if (contactIds?.length) {
      query = supabase
        .from("contacts")
        .select("id, email, first_name, last_name, company_id")
        .in("id", contactIds);
    }

    const { data: contacts } = await query;
    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, enriched: 0, message: "No contacts need enrichment" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[enrich-contacts] Enriching ${contacts.length} contacts via Apollo`);

    let enriched = 0;
    let skipped = 0;

    for (const contact of contacts) {
      if (!contact.email) { skipped++; continue; }

      try {
        const res = await fetch("https://api.apollo.io/v1/people/match", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_KEY },
          body: JSON.stringify({
            email: contact.email,
            first_name: contact.first_name || undefined,
            last_name: contact.last_name || undefined,
            reveal_personal_emails: false,
          }),
        });

        if (!res.ok) {
          if (res.status === 429) {
            console.log("[enrich-contacts] Rate limited, stopping");
            break;
          }
          skipped++;
          continue;
        }

        const data = await res.json();
        const person = data.person;

        if (person) {
          const updates: any = {
            apollo_person_id: person.id,
            photo_url: person.photo_url || contact.photo_url || null,
            title: person.title || contact.title || null,
            seniority: person.seniority || null,
            linkedin_url: person.linkedin_url || null,
            department: person.departments?.[0] || null,
            enrichment_data: {
              ...(typeof contact.enrichment_data === 'object' ? contact.enrichment_data : {}),
              // Store the ENTIRE raw Apollo person object — every field they return
              apollo: {
                ...person,
                enriched_at: new Date().toISOString(),
              },
            },
            updated_at: new Date().toISOString(),
          };

          await supabase.from("contacts").update(updates).eq("id", contact.id);

          // Also update contact_photos cache
          if (person.photo_url || person.name || person.title) {
            await supabase.from("contact_photos").upsert({
              email: contact.email,
              photo_url: person.photo_url || null,
              name: person.name || null,
              title: person.title || null,
              hubspot_contact_id: null,
              updated_at: new Date().toISOString(),
            }, { onConflict: "email" });
          }

          enriched++;
        } else {
          // Mark as attempted so we don't retry
          await supabase.from("contacts").update({
            apollo_person_id: "not_found",
            updated_at: new Date().toISOString(),
          }).eq("id", contact.id);
          skipped++;
        }

        // Rate limit: ~5 req/sec
        await new Promise(r => setTimeout(r, 200));
      } catch (e) {
        console.error(`[enrich-contacts] Error for ${contact.email}: ${e.message}`);
        skipped++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, enriched, skipped, total: contacts.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
