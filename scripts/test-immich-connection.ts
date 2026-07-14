/**
 * Immich Server Connection Test — TypeScript Version
 *
 * Usage:
 *   npx tsx scripts/test-immich-connection.ts [--url <base_url>] [--api-key <key>]
 *
 * Defaults:
 *   url     = http://192.168.137.1:2284
 *   api-key = VITE_IMMICH_API_KEY from environment
 *
 * Exit code 0 = all tests passed, 1 = at least one failure.
 */

const DEFAULT_URL = "http://192.168.137.1:2284";

interface TestResult {
  label: string;
  endpoint: string;
  status: "pass" | "fail" | "skip";
  httpStatus?: number;
  body?: unknown;
  error?: string;
}

function parseArgs(): { baseUrl: string; apiKey: string } {
  const args = process.argv.slice(2);
  let baseUrl = DEFAULT_URL;
  let apiKey = process.env.VITE_IMMICH_API_KEY || "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) {
      baseUrl = args[++i];
    } else if (args[i] === "--api-key" && args[i + 1]) {
      apiKey = args[++i];
    }
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

async function testEndpoint(
  label: string,
  url: string,
  apiKey?: string,
): Promise<TestResult> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const contentType = response.headers.get("content-type") || "";
      let body: unknown = null;
      if (contentType.includes("application/json")) {
        body = await response.json();
      } else {
        body = await response.text();
      }
      return {
        label,
        endpoint: url,
        status: "pass",
        httpStatus: response.status,
        body,
      };
    }

    if ((response.status === 401 || response.status === 403) && !apiKey) {
      return {
        label,
        endpoint: url,
        status: "skip",
        httpStatus: response.status,
        error: "No API key provided",
      };
    }

    return {
      label,
      endpoint: url,
      status: "fail",
      httpStatus: response.status,
      error: response.statusText,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { label, endpoint: url, status: "fail", error: message };
  }
}

function printResult(result: TestResult): void {
  const icons = { pass: "✅", fail: "❌", skip: "⏭️ " } as const;
  const icon = icons[result.status];
  const statusText = result.httpStatus ? `HTTP ${result.httpStatus}` : "N/A";

  console.log(`  ${icon} [${result.label}] ${statusText}`);

  if (result.status === "pass" && result.body) {
    const bodyStr =
      typeof result.body === "string"
        ? result.body.slice(0, 200)
        : JSON.stringify(result.body, null, 2)
            .split("\n")
            .slice(0, 6)
            .join("\n");
    console.log(`     ${bodyStr}`);
  }

  if (result.error) {
    console.log(`     → ${result.error}`);
  }
}

async function main() {
  const { baseUrl, apiKey } = parseArgs();

  console.log("");
  console.log("═══════════════════════════════════════════════");
  console.log("  Immich Connection Test (TypeScript)");
  console.log(`  Target: ${baseUrl}`);
  console.log(`  API Key: ${apiKey ? "***" + apiKey.slice(-4) : "(not set)"}`);
  console.log("═══════════════════════════════════════════════");
  console.log("");

  const tests: TestResult[] = [];

  // Test 1: Ping (no auth)
  tests.push(await testEndpoint("Ping", `${baseUrl}/api/server/ping`));

  // Test 2: Version (no auth)
  tests.push(await testEndpoint("Version", `${baseUrl}/api/server/version`));

  // Test 3: About (authenticated)
  tests.push(
    await testEndpoint(
      "About",
      `${baseUrl}/api/server/about`,
      apiKey || undefined,
    ),
  );

  // Test 4: Albums (authenticated)
  tests.push(
    await testEndpoint("Albums", `${baseUrl}/api/albums`, apiKey || undefined),
  );

  for (const result of tests) {
    printResult(result);
  }

  const passed = tests.filter((t) => t.status === "pass").length;
  const failed = tests.filter((t) => t.status === "fail").length;
  const skipped = tests.filter((t) => t.status === "skip").length;

  console.log("");
  console.log("───────────────────────────────────────────────");
  console.log(
    `  Passed: ${passed}  |  Failed: ${failed}  |  Skipped: ${skipped}`,
  );
  console.log("───────────────────────────────────────────────");

  if (failed > 0) {
    console.log("");
    console.log("Tips:");
    console.log(`  • Ensure the Immich server is running at ${baseUrl}`);
    console.log(
      "  • Generate an API key: Immich Web UI → User Settings → API Keys",
    );
    console.log(
      `  • Re-run: npx tsx scripts/test-immich-connection.ts --url ${baseUrl} --api-key YOUR_KEY`,
    );
    process.exit(1);
  }

  process.exit(0);
}

main();
