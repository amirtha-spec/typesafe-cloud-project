/**
 * Minimal example showing the strict compiler settings doing real work.
 * Run `npm run typecheck` to verify.
 */

export interface CloudResource {
  readonly id: string;
  readonly name: string;
  readonly region: string;
  readonly tags?: Readonly<Record<string, string>>;
}

export type ResourceState = "pending" | "running" | "stopped";

export function describe(resource: CloudResource, state: ResourceState): string {
  switch (state) {
    case "pending":
      return `${resource.name} (${resource.id}) is starting up in ${resource.region}`;
    case "running":
      return `${resource.name} (${resource.id}) is running in ${resource.region}`;
    case "stopped":
      return `${resource.name} (${resource.id}) is stopped in ${resource.region}`;
  }
}

/**
 * `noUncheckedIndexedAccess` makes the return type `CloudResource | undefined`,
 * so callers are forced to handle the missing case.
 */
export function first(resources: readonly CloudResource[]): CloudResource | undefined {
  return resources[0];
}

const resources: CloudResource[] = [
  { id: "res-001", name: "api-server", region: "us-east-1", tags: { env: "prod" } },
  { id: "res-002", name: "worker", region: "eu-west-1" },
];

const head = first(resources);
console.log(head ? describe(head, "running") : "no resources");
