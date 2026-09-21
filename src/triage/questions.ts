/**
 * The review surface for ticket triage.
 *
 * Everything a human should check lives in this file: the questions Jev is
 * asked, and the thresholds code applies to its answers. Nothing else in the
 * codebase hardcodes a question or a cutoff. If triage behaves oddly, the fix
 * is almost always here, not in the workflow code.
 *
 * Questions are deliberately written as plain, answerable prompts. Each choice
 * label and score level carries a description so Jev is picking between
 * defined outcomes rather than guessing at bare label names.
 */

import { choice, noul, score } from "@typesafe-ai/sdk";

/** Ticket categories we route to. Keep in sync with the `category` criteria. */
export type Category = "billing" | "technical" | "account" | "other";

export const TRIAGE_QUESTIONS = {
  /**
   * Which queue owns this ticket. Jev returns the best label plus per-label
   * probabilities; we take its selection rather than re-deriving one.
   */
  category: choice("Which team should handle this support ticket?", {
    billing:
      "Charges, invoices, refunds, payment methods, pricing, or subscription cost.",
    technical:
      "The product is broken, erroring, slow, or not behaving as documented.",
    account:
      "Login, access, permissions, seats, account settings, or data export.",
    other:
      "Anything else, including sales questions, feedback, and unclear requests.",
  }),

  /**
   * Time pressure, kept separate from severity: a production outage is severe
   * and urgent, a wrong invoice on a closed account may be severe but not.
   */
  urgency: noul("Does this ticket need a reply within one business hour?", {
    true: "The customer is blocked right now, or is losing money or data while they wait.",
    false: "A reply within the normal support window is adequate.",
  }),

  /**
   * Impact rubric. Score questions return an expected value that can land
   * between levels (e.g. 1.6), which is why SEVERITY_ESCALATE_AT is a float.
   */
  severity: score("How much is this problem affecting the customer?", [
    "No real impact: a question, a comment, or a cosmetic nit.",
    "Minor impact: an inconvenience with an easy workaround.",
    "Major impact: an important workflow is broken and there is no good workaround.",
    "Critical impact: the customer cannot use the product at all, or is losing money or data.",
  ]),

  /**
   * Replaces a regex sweep for card numbers. Customers paste payment details
   * in wildly varied shapes ("the one ending 4242", spaced digits, IBANs),
   * which is exactly where pattern matching gets fragile and semantic
   * judgement does not.
   */
  containsPaymentDetails: noul(
    "Does the message contain payment details, such as a card number, bank account, or security code?",
    {
      true: "Any full or partial payment instrument appears in the text.",
      false: "No payment instrument appears; naming a card brand or a last-four alone does not count.",
    },
  ),
} as const;

/**
 * Cutoffs applied in code. These are policy, not model behaviour — tune them
 * against real tickets rather than guessing.
 */
export const THRESHOLDS = {
  /**
   * Below this, the category is treated as unresolved and the ticket goes to a
   * human instead of a queue. This is a genuine ambiguity gate, not a way of
   * picking a label: Jev has already chosen the best one.
   */
  MIN_CATEGORY_CONFIDENCE: 0.6,

  /** At or above this probability, the ticket is flagged as time-critical. */
  URGENT_AT: 0.7,

  /** At or above this expected score, impact is treated as major. */
  SEVERITY_ESCALATE_AT: 2.0,

  /** At or above this probability, the body is withheld pending redaction. */
  REDACT_PAYMENT_AT: 0.5,
} as const;
