import { SpiceDBEntitlementsClient, SimpleLoggingClient } from "@frontegg/e10s-client";

export const config = {
  engineEndpoint: "localhost:50051",
  engineToken: "spicedb",
};

export function createClient() {
  const loggingClient = new SimpleLoggingClient();
  return new SpiceDBEntitlementsClient(config, loggingClient, false, {
    defaultFallback: false,
  });
}

export function printHeader(title: string) {
  console.log(`\n${title}\n`);
  console.log("━".repeat(60));
  console.log(`  SpiceDB: ${config.engineEndpoint}`);
  console.log("━".repeat(60));
}

export function printSummary(
  title: string,
  rows: Array<{ label: string; ok: boolean; detail: string }>,
) {
  console.log("\n" + "━".repeat(60));
  console.log(title);
  console.log("━".repeat(60));

  for (const row of rows) {
    const icon = row.ok ? "✅" : "❌";
    console.log(` ${icon} ${row.label.padEnd(42)} ${row.detail}`);
  }

  const passed = rows.filter((row) => row.ok).length;
  console.log(`\n${passed}/${rows.length} passed`);
}
