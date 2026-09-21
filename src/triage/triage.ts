/**
 * Ticket triage: one model round trip, then ordinary code decides what happens.
 *
 * The split is deliberate. Jev answers four questions about the ticket; every
 * routing rule, cutoff and precedence decision below is plain TypeScript you
 * can read, test and change without touching the model.
 */

import type { TypeSafeClient } from "@typesafe-ai/sdk";
import { TRIAGE_QUESTIONS, THRESHOLDS, type Category } from "./questions.ts";

export type Route = "queue" | "human_review";

export type TriageResult = {
  /** The queue this ticket belongs to, or null when too ambiguous to route. */
  category: Category | null;
  /** Jev's confidence in the selected category, 0–1. */
  categoryConfidence: number;
  /** Probability the ticket needs a reply within the hour, 0–1. */
  urgency: number;
  /** Expected impact score, 0–3, possibly fractional. */
  severity: number;
  /** Probability the body contains payment details, 0–1. */
  paymentDetailsRisk: number;
  /** Where the ticket goes. */
  route: Route;
  /** True when the body must be redacted before an agent sees it. */
  redactionRequired: boolean;
  /** Priority derived from urgency and severity together. */
  priority: "P0" | "P1" | "P2" | "P3";
  /** Plain-language account of why this outcome was chosen. */
  reasons: string[];
  /** Observability: which model answered, and what it cost. */
  model: string;
  usage: { input_tokens: number; output_tokens: number };
};

export type Ticket = {
  subject?: string;
  body: string;
  /** Anything else worth giving the model: plan, tenure, prior tickets. */
  context?: Record<string, string | number | boolean | null>;
};

/**
 * Structured state beats a concatenated string: the model sees which part is
 * the subject and which is customer metadata, and we avoid prompt-shaped
 * string building.
 */
function toState(ticket: Ticket) {
  return {
    subject: ticket.subject ?? null,
    body: ticket.body,
    ...(ticket.context ? { context: ticket.context } : {}),
  };
}

/** Urgency and severity combine into a priority; neither alone is enough. */
function toPriority(urgent: boolean, severity: number): TriageResult["priority"] {
  if (urgent && severity >= THRESHOLDS.SEVERITY_ESCALATE_AT) return "P0";
  if (urgent) return "P1";
  if (severity >= THRESHOLDS.SEVERITY_ESCALATE_AT) return "P2";
  return "P3";
}

export async function triageTicket(
  client: TypeSafeClient,
  ticket: Ticket,
): Promise<TriageResult> {
  const { answers, model, usage } = await client.systemOne({
    state: toState(ticket),
    questions: TRIAGE_QUESTIONS,
  });

  const categoryConfidence = answers.category.confidence;
  const urgency = answers.urgency.noul;
  const severity = answers.severity.score;
  const paymentDetailsRisk = answers.containsPaymentDetails.noul;

  const confident = categoryConfidence >= THRESHOLDS.MIN_CATEGORY_CONFIDENCE;
  const urgent = urgency >= THRESHOLDS.URGENT_AT;
  const redactionRequired = paymentDetailsRisk >= THRESHOLDS.REDACT_PAYMENT_AT;

  const reasons: string[] = [];
  reasons.push(
    confident
      ? `Routed to ${answers.category.choice} (confidence ${categoryConfidence.toFixed(2)}).`
      : `Category unclear: best guess ${answers.category.choice} at ${categoryConfidence.toFixed(2)}, below the ${THRESHOLDS.MIN_CATEGORY_CONFIDENCE} bar.`,
  );
  if (urgent) reasons.push(`Time-critical (${urgency.toFixed(2)}).`);
  if (severity >= THRESHOLDS.SEVERITY_ESCALATE_AT) {
    reasons.push(`Major impact (severity ${severity.toFixed(2)} of 3).`);
  }
  if (redactionRequired) {
    reasons.push(
      `Possible payment details (${paymentDetailsRisk.toFixed(2)}); body withheld pending redaction.`,
    );
  }

  return {
    category: confident ? (answers.category.choice as Category) : null,
    categoryConfidence,
    urgency,
    severity,
    paymentDetailsRisk,
    route: confident ? "queue" : "human_review",
    redactionRequired,
    priority: toPriority(urgent, severity),
    reasons,
    model,
    usage,
  };
}
