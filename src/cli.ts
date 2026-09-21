/**
 * Triage a ticket from the command line.
 *
 *   echo "I was charged twice" | npm run triage
 *   npm run triage -- --subject "Site down" --body "500s on every page"
 *
 * Runs against the real API when TYPESAFE_API_KEY is set. Point
 * TYPESAFE_BASE_URL at the local mock server to run without network access.
 */

import { createClient } from "./typesafe/client.ts";
import { triageTicket, type Ticket } from "./triage/triage.ts";
import { APIError, TypeSafeError } from "@typesafe-ai/sdk";

function parseArgs(argv: string[]): { subject?: string; body?: string } {
  const out: { subject?: string; body?: string } = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--subject") out.subject = argv[++i];
    else if (argv[i] === "--body") out.body = argv[++i];
  }
  return out;
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").trim();
}

function render(result: Awaited<ReturnType<typeof triageTicket>>): string {
  const lines = [
    `route      ${result.route}`,
    `category   ${result.category ?? "(unresolved)"}  confidence ${result.categoryConfidence.toFixed(2)}`,
    `priority   ${result.priority}`,
    `urgency    ${result.urgency.toFixed(2)}`,
    `severity   ${result.severity.toFixed(2)} / 3`,
    `redaction  ${result.redactionRequired ? "REQUIRED" : "not needed"}`,
    "",
    "why:",
    ...result.reasons.map((r) => `  - ${r}`),
    "",
    `model ${result.model}  tokens ${result.usage.input_tokens}in/${result.usage.output_tokens}out`,
  ];
  return lines.join("\n");
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const body = args.body ?? (await readStdin());

  if (!body) {
    console.error("No ticket text. Pass --body \"...\" or pipe text on stdin.");
    return 2;
  }

  const ticket: Ticket = { subject: args.subject, body };

  try {
    const client = createClient();
    const result = await triageTicket(client, ticket);
    console.log(render(result));
    return 0;
  } catch (error) {
    if (error instanceof APIError) {
      console.error(`API error ${error.status}: ${error.message}`);
      if (error.requestId) console.error(`request id: ${error.requestId}`);
      return 1;
    }
    if (error instanceof TypeSafeError) {
      console.error(`Configuration error: ${error.message}`);
      console.error(
        "Set TYPESAFE_API_KEY, or start the mock server and set TYPESAFE_BASE_URL.",
      );
      return 1;
    }
    throw error;
  }
}

process.exitCode = await main();
