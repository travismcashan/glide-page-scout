/**
 * Pipeline Configuration — Single Source of Truth (Server)
 * All HubSpot pipeline IDs, stage IDs, labels, outcomes, and lead statuses.
 * Used by hubspot-deals-sync, hubspot-pipeline, and any other edge functions.
 */

// ── Types ──

export interface PipelineStage {
  id: string;
  label: string;
  closed?: boolean;
  outcome?: "won" | "lost" | "archived";
}

export interface PipelineDefinition {
  label: string;
  stages: PipelineStage[];
}

export interface LeadStatus {
  id: string;
  label: string;
}

// ── Pipeline Definitions ──

export const PIPELINES: Record<string, PipelineDefinition> = {
  "33bc2a42-c57c-4180-b0e6-77b3d6c7f69f": {
    label: "GLIDE Projects Pipeline",
    stages: [
      { id: "753958", label: "Follow-Up / Scheduling" },
      { id: "132302", label: "Discovery Call" },
      { id: "132303", label: "Needs Analysis" },
      { id: "132304", label: "Proposal Due" },
      { id: "132305", label: "Open Deal" },
      { id: "30306367", label: "Closed: In Contract", closed: true, outcome: "won" },
      { id: "132306", label: "Closed: Won!", closed: true, outcome: "won" },
      { id: "1ffb1ec7-1fad-4241-bb0e-88d0a85dcdab", label: "Closed: Drip", closed: true, outcome: "archived" },
      { id: "5f36c04a-b283-484c-b50e-032fbeda332d", label: "Closed: Unresponsive", closed: true, outcome: "archived" },
      { id: "3053691", label: "Closed: Unqualified", closed: true, outcome: "archived" },
      { id: "132307", label: "Closed: Lost", closed: true, outcome: "lost" },
    ],
  },
  "29735570": {
    label: "GLIDE Services Pipeline",
    stages: [
      { id: "67943339", label: "Follow-Up / Scheduling" },
      { id: "67943340", label: "First-Time Appointment" },
      { id: "67918443", label: "Eval / Audit / Prep" },
      { id: "67943342", label: "Needs Analysis Scheduled" },
      { id: "67943343", label: "Proposal Due" },
      { id: "67958172", label: "Open Deal" },
      { id: "67958173", label: "Closed: In Contract", closed: true, outcome: "won" },
      { id: "67943344", label: "Closed: Won!", closed: true, outcome: "won" },
      { id: "67958174", label: "Closed: Drip", closed: true, outcome: "archived" },
      { id: "67958175", label: "Closed: Unresponsive", closed: true, outcome: "archived" },
      { id: "67958176", label: "Closed: Unqualified", closed: true, outcome: "archived" },
      { id: "67943345", label: "Closed: Lost", closed: true, outcome: "lost" },
    ],
  },
  "758296729": {
    label: "GLIDE RFP Pipeline",
    stages: [
      { id: "1103540129", label: "RFP Identified / Qualification" },
      { id: "1103540130", label: "Intent to Bid" },
      { id: "1103540132", label: "Questions Submitted" },
      { id: "1103540133", label: "Proposal Development" },
      { id: "1103540134", label: "Proposal Submitted" },
      { id: "1269247232", label: "Waiting on Response" },
      { id: "1103540135", label: "Presentation / Finalist" },
      { id: "1103625803", label: "Negotiation & Contracting" },
      { id: "1103625804", label: "Closed: Won", closed: true, outcome: "won" },
      { id: "1103625805", label: "Closed: Lost", closed: true, outcome: "lost" },
      { id: "1113717867", label: "Closed: Drip", closed: true, outcome: "archived" },
      { id: "1103625806", label: "Closed: Declined", closed: true, outcome: "lost" },
    ],
  },
};

export const DEFAULT_PIPELINE = "33bc2a42-c57c-4180-b0e6-77b3d6c7f69f";

export const LEAD_STATUSES: LeadStatus[] = [
  { id: "Inbound", label: "New" },
  { id: "Contacting", label: "Contacted" },
  { id: "Scheduled", label: "Scheduled" },
  { id: "Future Follow-Up", label: "Follow-Up" },
];

// ── Derived Lookups ──

/** Stage ID → human-readable label */
export const stageLabelMap: Record<string, string> = {};

/** Stage ID → semantic outcome for closed stages */
export const stageOutcomeMap: Record<string, "won" | "lost" | "archived"> = {};

for (const p of Object.values(PIPELINES)) {
  for (const s of p.stages) {
    stageLabelMap[s.id] = s.label;
    if (s.closed && s.outcome) stageOutcomeMap[s.id] = s.outcome;
  }
}

/** Pipeline ID → label */
export const pipelineLabelMap: Record<string, string> = {};
for (const [id, p] of Object.entries(PIPELINES)) {
  pipelineLabelMap[id] = p.label;
}

/** List of { id, label } for pipeline selector UIs */
export const pipelineOptions = Object.entries(PIPELINES).map(([id, p]) => ({
  id,
  label: p.label,
}));
