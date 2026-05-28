import {
  EntitlementItem,
  LookupEntitlementsRequest,
  RequestContextType,
  SpiceDBEntitlementsClient,
  SimpleLoggingClient,
} from "@frontegg/e10s-client";

const config = {
  engineEndpoint: "localhost:50051",
  engineToken: "spicedb",
};

type LookupTest = {
  name: string;
  request: LookupEntitlementsRequest;
  expectedKeys: string[];
};

const lookupTests: LookupTest[] = [
  {
    name: "Tenant feature grants",
    request: {
      subject: {
        tenantId: "demo-tenant",
      },
      criteria: {
        type: RequestContextType.Feature,
      },
    },
    expectedKeys: ["basic"],
  },
  {
    name: "Tim inherited tenant grants plus direct user grants",
    request: {
      subject: {
        tenantId: "demo-tenant",
        userId: "Tim",
      },
      criteria: {
        type: RequestContextType.Feature,
      },
    },
    expectedKeys: ["basic", "premium"],
  },
  {
    name: "Unknown user receives no feature grants",
    request: {
      subject: {
        tenantId: "demo-tenant",
        userId: "Unknown",
      },
      criteria: {
        type: RequestContextType.Feature,
      },
    },
    expectedKeys: [],
  },
];

function createClient() {
  const loggingClient = new SimpleLoggingClient();
  return new SpiceDBEntitlementsClient(config, loggingClient, false, {
    defaultFallback: false,
  });
}

function sortedKeys(entitlements: EntitlementItem[]): string[] {
  return entitlements.map((entitlement) => entitlement.key).sort();
}

function keysMatch(actual: string[], expected: string[]): boolean {
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function subjectLabel(request: LookupEntitlementsRequest): string {
  const { tenantId, userId } = request.subject;
  return userId ? `tenant:${tenantId}, user:${userId}` : `tenant:${tenantId}`;
}

function printEntitlements(entitlements: EntitlementItem[]) {
  if (entitlements.length === 0) {
    console.log("  No entitlements returned");
    return;
  }

  for (const entitlement of entitlements) {
    console.log(
      `  - ${entitlement.type}:${entitlement.key} (${entitlement.permissionship ?? "UNKNOWN"})`,
    );
  }
}

async function main() {
  console.log("\nLookup Entitlements Demo\n");
  console.log("=".repeat(60));
  console.log(`SpiceDB Endpoint: ${config.engineEndpoint}`);
  console.log("=".repeat(60));

  const client = createClient();
  const rows: Array<{ label: string; ok: boolean; detail: string }> = [];

  for (const test of lookupTests) {
    console.log(`\nRunning: ${test.name}`);
    console.log(`Subject: ${subjectLabel(test.request)}`);

    try {
      const response = await client.lookupEntitlements(test.request);
      const actualKeys = sortedKeys(response.entitlements);
      const expectedKeys = [...test.expectedKeys].sort();
      const ok = keysMatch(actualKeys, expectedKeys);

      printEntitlements(response.entitlements);
      console.log(`Total Returned: ${response.totalReturned}`);
      if (response.cursor) {
        console.log(`Next Cursor: ${response.cursor}`);
      }

      rows.push({
        label: test.name,
        ok,
        detail: ok
          ? actualKeys.join(", ")
          : `expected ${expectedKeys.join(", ")}, got ${actualKeys.join(", ")}`,
      });
    } catch (error) {
      rows.push({
        label: test.name,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Summary");
  console.log("=".repeat(60));

  for (const row of rows) {
    const status = row.ok ? "PASS" : "FAIL";
    console.log(` ${status} ${row.label.padEnd(46)} ${row.detail}`);
  }

  const passed = rows.filter((row) => row.ok).length;
  console.log(`\n${passed}/${rows.length} passed`);

  if (passed !== rows.length) {
    process.exitCode = 1;
  }
}

main();
