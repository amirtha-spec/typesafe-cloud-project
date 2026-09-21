/**
 * Minimal TypeSafe AI (Jev) example.
 *
 * Jev is a "System One" model: instead of free-form text, you give it some
 * state plus typed questions, and it returns typed answers with calibrated
 * probabilities.
 *
 * Run with: npm run example
 *
 * The API key is read from the TYPESAFE_API_KEY environment variable by the
 * SDK itself. It is never hardcoded here and never committed.
 */
import { choice, noul, TypeSafeClient } from "@typesafe-ai/sdk";

if (!process.env.TYPESAFE_API_KEY) {
  console.error(
    "TYPESAFE_API_KEY is not set.\n" +
      "Local: copy .env.example to .env and fill it in, then run with `node --env-file=.env`.\n" +
      "Cloud session: add it to the cloud environment's Environment variables.\n" +
      "See README.md for the exact steps.",
  );
  process.exit(1);
}

// Reads TYPESAFE_API_KEY from the environment; defaults to model "jev-latest".
const client = new TypeSafeClient();

const ticket = "I was charged twice for my September invoice. Please fix this ASAP.";

const response = await client.systemOne({
  state: { ticket },
  questions: {
    category: choice("What is this support ticket about?", {
      billing: "Charges, invoices, refunds, or payment methods.",
      technical: "Bugs, outages, or something not working.",
      other: null,
    }),
    urgent: noul("Does this ticket need a same-day response?"),
  },
});

const { category, urgent } = response.answers;

console.log(`model:      ${response.model}`);
console.log(`category:   ${category.choice} (confidence ${category.confidence.toFixed(2)})`);
console.log(`urgent:     ${(urgent.noul * 100).toFixed(1)}% likely`);
console.log(`tokens:     ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`);

// `category.choice` is typed as "billing" | "technical" | "other", so this
// switch is exhaustive at compile time.
switch (category.choice) {
  case "billing":
    console.log("-> route to the billing queue");
    break;
  case "technical":
    console.log("-> route to the engineering on-call");
    break;
  case "other":
    console.log("-> route to general support");
    break;
}
