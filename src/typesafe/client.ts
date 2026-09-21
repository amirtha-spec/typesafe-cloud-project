/**
 * Client construction, kept in one place so every call site shares the same
 * configuration and the same failure behaviour.
 */

import { TypeSafeClient, type Fetch } from "@typesafe-ai/sdk";

export type ClientOptions = {
  /** Overrides TYPESAFE_API_KEY. */
  apiKey?: string;
  /** Overrides TYPESAFE_BASE_URL; point at a local mock to run offline. */
  baseURL?: string;
  /** Injected transport, used by tests to run without a network. */
  fetch?: Fetch;
};

/**
 * Build a client.
 *
 * The SDK reads TYPESAFE_API_KEY, TYPESAFE_BASE_URL and TYPESAFE_DEFAULT_MODEL
 * from the environment on its own, so the happy path passes no options at all.
 * It throws if the key is missing; we let that surface rather than falling back
 * to a half-configured client.
 */
export function createClient(options: ClientOptions = {}): TypeSafeClient {
  return new TypeSafeClient({
    ...options,
    // One retry beyond the SDK default: triage sits in a request path, so we
    // would rather fail fast to the human queue than stall a support agent.
    timeout: 8_000,
    retry: { maxRetries: 2 },
  });
}

/** True when a key is present, so callers can degrade instead of throwing. */
export function isConfigured(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY?.trim());
}
