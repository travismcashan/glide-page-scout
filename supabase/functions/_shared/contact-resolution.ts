/**
 * Contact Resolution Layer
 * Shared identity resolution for all contact sync functions.
 * Matching cascade: hubspot_contact_id → apollo_person_id → email → create new.
 * Merge strategy: never overwrite with null, priority Apollo > HubSpot > existing > Harvest > Freshdesk.
 */

// ── Types ──

export interface ContactCandidate {
  user_id: string;
  company_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  hubspot_contact_id?: string | null;
  apollo_person_id?: string | null;
  linkedin_url?: string | null;
  photo_url?: string | null;
  seniority?: string | null;
  department?: string | null;
  lead_status?: string | null;
  lifecycle_stage?: string | null;
  hubspot_owner_id?: string | null;
  enrichment_data?: Record<string, any>;
  /** Source hint for merge priority — determines which fields win on conflict */
  source?: "apollo" | "hubspot" | "harvest" | "freshdesk";
}

export type ContactMatchType = "hubspot_id" | "apollo_id" | "email" | "created";

export interface ResolvedContact {
  contactId: string;
  created: boolean;
  matchType: ContactMatchType;
  fieldsUpdated: number;
}

// ── Name Normalization ──

export function normalizeContactName(name: string | null | undefined): string | null {
  if (!name) return null;
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .trim() || null;
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.toLowerCase().trim();
  if (!trimmed || !trimmed.includes("@")) return null;
  return trimmed;
}

// ── Resolution Logging ──

interface ResolutionLog {
  step: ContactMatchType;
  matched: boolean;
  contactId?: string;
  detail?: string;
}

function logResolution(candidateLabel: string, steps: ResolutionLog[]): void {
  const matched = steps.find((s) => s.matched);
  if (matched) {
    console.log(
      `[contact-resolution] "${candidateLabel}" → matched by ${matched.step} (id: ${matched.contactId})` +
        (matched.detail ? ` — ${matched.detail}` : "")
    );
  } else {
    console.log(`[contact-resolution] "${candidateLabel}" → no match, created new contact`);
  }
  for (const s of steps) {
    if (!s.matched) {
      console.log(`[contact-resolution]   ✗ ${s.step}${s.detail ? ` — ${s.detail}` : ""}`);
    }
  }
}

function candidateLabel(c: ContactCandidate): string {
  const parts = [c.first_name, c.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  if (c.email) return c.email;
  return "(unnamed)";
}

// ── Merge Logic ──

/** Mergeable scalar fields on the contacts table */
const SCALAR_FIELDS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "title",
  "department",
  "linkedin_url",
  "photo_url",
  "seniority",
  "lead_status",
  "lifecycle_stage",
  "hubspot_owner_id",
] as const;

/** External ID fields — always merge (never overwrite existing) */
const EXTERNAL_ID_FIELDS = [
  "hubspot_contact_id",
  "apollo_person_id",
] as const;

/**
 * Source priority for field conflicts.
 * Higher number = higher priority. Apollo data wins over HubSpot, etc.
 */
const SOURCE_PRIORITY: Record<string, number> = {
  apollo: 4,
  hubspot: 3,
  existing: 2,
  harvest: 1,
  freshdesk: 0,
};

/**
 * Merge candidate fields into existing record.
 * Rules:
 * - Never overwrite with null/empty
 * - External IDs: only fill if existing is empty
 * - Scalar fields: overwrite if candidate source has higher priority than "existing"
 * - enrichment_data: deep merge (add keys, never remove)
 * - company_id: keep existing unless null
 */
function mergeContactFields(
  existing: Record<string, any>,
  candidate: ContactCandidate
): { updates: Record<string, any>; fieldsUpdated: number } {
  const updates: Record<string, any> = {};
  let fieldsUpdated = 0;
  const sourcePriority = SOURCE_PRIORITY[candidate.source || "existing"] ?? 2;
  const existingPriority = SOURCE_PRIORITY["existing"];

  // External IDs — only fill empty slots, never overwrite
  for (const field of EXTERNAL_ID_FIELDS) {
    const candidateValue = candidate[field];
    if (candidateValue && !existing[field]) {
      updates[field] = candidateValue;
      fieldsUpdated++;
    }
  }

  // Scalar fields — upgrade if candidate has value and higher priority
  for (const field of SCALAR_FIELDS) {
    const candidateValue = (candidate as any)[field];
    if (!candidateValue) continue; // Never write null/empty

    const existingValue = existing[field];
    if (!existingValue) {
      // Fill empty field regardless of priority
      updates[field] = candidateValue;
      fieldsUpdated++;
    } else if (sourcePriority > existingPriority && candidateValue !== existingValue) {
      // Higher-priority source overwrites
      updates[field] = candidateValue;
      fieldsUpdated++;
    }
  }

  // company_id — keep existing unless null
  if (candidate.company_id && !existing.company_id) {
    updates.company_id = candidate.company_id;
    fieldsUpdated++;
  }

  // enrichment_data — deep merge (add keys, never remove)
  if (candidate.enrichment_data && Object.keys(candidate.enrichment_data).length > 0) {
    const existingEnrichment = existing.enrichment_data || {};
    const merged = { ...existingEnrichment, ...candidate.enrichment_data };
    // Only update if something actually changed
    if (JSON.stringify(merged) !== JSON.stringify(existingEnrichment)) {
      updates.enrichment_data = merged;
      fieldsUpdated++;
    }
  }

  return { updates, fieldsUpdated };
}

// ── Main Resolution Function ──

const CONTACT_SELECT =
  "id, first_name, last_name, email, phone, title, department, linkedin_url, photo_url, seniority, lead_status, lifecycle_stage, hubspot_owner_id, hubspot_contact_id, apollo_person_id, company_id, enrichment_data";

export async function resolveContact(
  supabase: any,
  candidate: ContactCandidate
): Promise<ResolvedContact> {
  const normalizedEmail = normalizeEmail(candidate.email);
  const steps: ResolutionLog[] = [];

  // ── Step 1: Look up by hubspot_contact_id ──
  if (candidate.hubspot_contact_id) {
    const { data: byHubspot } = await supabase
      .from("contacts")
      .select(CONTACT_SELECT)
      .eq("hubspot_contact_id", candidate.hubspot_contact_id)
      .maybeSingle();

    if (byHubspot) {
      steps.push({ step: "hubspot_id", matched: true, contactId: byHubspot.id });
      logResolution(candidateLabel(candidate), steps);
      const { updates, fieldsUpdated } = mergeContactFields(byHubspot, candidate);
      if (fieldsUpdated > 0) {
        updates.updated_at = new Date().toISOString();
        await supabase.from("contacts").update(updates).eq("id", byHubspot.id);
      }
      return { contactId: byHubspot.id, created: false, matchType: "hubspot_id", fieldsUpdated };
    }
    steps.push({ step: "hubspot_id", matched: false, detail: `id=${candidate.hubspot_contact_id}` });
  } else {
    steps.push({ step: "hubspot_id", matched: false, detail: "no candidate ID" });
  }

  // ── Step 2: Look up by apollo_person_id ──
  if (candidate.apollo_person_id && candidate.apollo_person_id !== "not_found") {
    const { data: byApollo } = await supabase
      .from("contacts")
      .select(CONTACT_SELECT)
      .eq("apollo_person_id", candidate.apollo_person_id)
      .maybeSingle();

    if (byApollo) {
      steps.push({ step: "apollo_id", matched: true, contactId: byApollo.id });
      logResolution(candidateLabel(candidate), steps);
      const { updates, fieldsUpdated } = mergeContactFields(byApollo, candidate);
      if (fieldsUpdated > 0) {
        updates.updated_at = new Date().toISOString();
        await supabase.from("contacts").update(updates).eq("id", byApollo.id);
      }
      return { contactId: byApollo.id, created: false, matchType: "apollo_id", fieldsUpdated };
    }
    steps.push({ step: "apollo_id", matched: false, detail: `id=${candidate.apollo_person_id}` });
  } else {
    steps.push({ step: "apollo_id", matched: false, detail: candidate.apollo_person_id === "not_found" ? "marked not_found" : "no candidate ID" });
  }

  // ── Step 3: Look up by email (global, not scoped to company) ──
  if (normalizedEmail) {
    const { data: byEmail } = await supabase
      .from("contacts")
      .select(CONTACT_SELECT)
      .eq("email", normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (byEmail) {
      steps.push({ step: "email", matched: true, contactId: byEmail.id, detail: normalizedEmail });
      logResolution(candidateLabel(candidate), steps);
      const { updates, fieldsUpdated } = mergeContactFields(byEmail, candidate);
      if (fieldsUpdated > 0) {
        updates.updated_at = new Date().toISOString();
        await supabase.from("contacts").update(updates).eq("id", byEmail.id);
      }
      return { contactId: byEmail.id, created: false, matchType: "email", fieldsUpdated };
    }
    steps.push({ step: "email", matched: false, detail: normalizedEmail });
  } else {
    steps.push({ step: "email", matched: false, detail: "no candidate email" });
  }

  // ── Step 4: Create new contact ──
  const insertRow: Record<string, any> = {
    user_id: candidate.user_id,
    company_id: candidate.company_id || null,
    first_name: normalizeContactName(candidate.first_name),
    last_name: normalizeContactName(candidate.last_name),
    email: normalizedEmail,
    phone: candidate.phone || null,
    title: candidate.title || null,
    department: candidate.department || null,
    linkedin_url: candidate.linkedin_url || null,
    photo_url: candidate.photo_url || null,
    seniority: candidate.seniority || null,
    lead_status: candidate.lead_status || null,
    lifecycle_stage: candidate.lifecycle_stage || null,
    hubspot_owner_id: candidate.hubspot_owner_id || null,
    hubspot_contact_id: candidate.hubspot_contact_id || null,
    apollo_person_id: candidate.apollo_person_id || null,
    enrichment_data: candidate.enrichment_data || {},
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await supabase
    .from("contacts")
    .insert(insertRow)
    .select("id")
    .single();

  if (error) {
    // Handle race condition: unique index violation on email means another sync just created it
    if (error.code === "23505" && normalizedEmail) {
      console.log(`[contact-resolution] Unique constraint race on "${normalizedEmail}" — retrying as update`);
      const { data: raceMatch } = await supabase
        .from("contacts")
        .select(CONTACT_SELECT)
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (raceMatch) {
        const { updates, fieldsUpdated } = mergeContactFields(raceMatch, candidate);
        if (fieldsUpdated > 0) {
          updates.updated_at = new Date().toISOString();
          await supabase.from("contacts").update(updates).eq("id", raceMatch.id);
        }
        return { contactId: raceMatch.id, created: false, matchType: "email", fieldsUpdated };
      }
    }
    throw new Error(`Failed to create contact "${candidateLabel(candidate)}": ${JSON.stringify(error)}`);
  }

  steps.push({ step: "created", matched: false });
  logResolution(candidateLabel(candidate), steps);

  return { contactId: created.id, created: true, matchType: "created", fieldsUpdated: 0 };
}
