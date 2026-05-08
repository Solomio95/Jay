const DEFAULT_BASE_URL = "http://localhost:3000";

const baseUrl = normalizeBaseUrl(process.env.ERP_BASE_URL ?? DEFAULT_BASE_URL);

const accounts = {
  admin: {
    label: "Admin",
    email: process.env.ERP_ADMIN_EMAIL ?? "admin@bentop.com",
    password: process.env.ERP_ADMIN_PASSWORD ?? "admin123",
  },
  promoter: {
    label: "Promoter",
    email: process.env.ERP_PROMOTER_EMAIL ?? "promoter@bentop.com",
    password: process.env.ERP_PROMOTER_PASSWORD ?? "promoter123",
  },
  supervisor: {
    label: "Supervisor",
    email: process.env.ERP_SUPERVISOR_EMAIL ?? "supervisor@bentop.com",
    password: process.env.ERP_SUPERVISOR_PASSWORD ?? "supervisor123",
  },
  viewer: {
    label: "Viewer",
    email: process.env.ERP_VIEWER_EMAIL ?? "viewer@bentop.com",
    password: process.env.ERP_VIEWER_PASSWORD ?? "staff123",
  },
};

const results = [];

class BrowserSession {
  cookies = new Map();

  async request(path, options = {}) {
    const headers = new Headers(options.headers ?? {});
    if (this.cookies.size > 0) {
      headers.set(
        "cookie",
        Array.from(this.cookies.entries())
          .map(([name, value]) => `${name}=${value}`)
          .join("; "),
      );
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      redirect: options.redirect ?? "manual",
    });
    this.storeCookies(response);
    return response;
  }

  storeCookies(response) {
    const headers = response.headers;
    const setCookie =
      typeof headers.getSetCookie === "function"
        ? headers.getSetCookie()
        : splitSetCookie(headers.get("set-cookie"));

    for (const header of setCookie) {
      const [pair] = header.split(";");
      const index = pair.indexOf("=");
      if (index <= 0) continue;
      this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }
}

async function main() {
  await check("server responds", async () => {
    const response = await fetch(`${baseUrl}/login`, { redirect: "manual" });
    assertStatus(response, [200]);
  });

  await check("protected pages redirect when logged out", async () => {
    const response = await fetch(`${baseUrl}/promoter/sales`, { redirect: "manual" });
    assertStatus(response, [302, 307, 308]);
    const location = response.headers.get("location") ?? "";
    assert(location.includes("/login"), `expected redirect to /login, got ${location}`);
  });

  const admin = await login("admin", accounts.admin);
  const promoter = await login("promoter", accounts.promoter);
  const supervisor = await login("supervisor", accounts.supervisor);
  const viewer = await login("viewer", accounts.viewer);

  await smokeApi(admin, "admin catalog APIs", [
    "/api/v1/categories",
    "/api/v1/products",
    "/api/v1/variants",
    "/api/v1/locations",
    "/api/v1/stock-levels?pageSize=5",
    "/api/v1/orders",
    "/api/v1/customers",
    "/api/v1/reports/sales",
    "/api/v1/reports/inventory",
    "/api/v1/reports/promoter",
  ]);

  await smokeApi(admin, "admin consignment APIs", [
    "/api/v1/consignment/partners",
    "/api/v1/consignment/shipments",
    "/api/v1/reports/consignment",
  ]);

  await smokeApi(admin, "admin purchase APIs", [
    "/api/v1/suppliers",
    "/api/v1/purchase-orders",
  ]);

  await smokeCsv(admin, "admin export CSVs", [
    "/api/v1/exports/stock",
    "/api/v1/exports/products",
    "/api/v1/exports/consignment-invoices",
    "/api/v1/exports/payments",
    "/api/v1/exports/reports/inventory",
    "/api/v1/exports/reports/sales",
    "/api/v1/exports/reports/consignment",
    "/api/v1/exports/reports/promoter",
    "/api/v1/imports/templates/product-variants",
    "/api/v1/imports/templates/opening-stock",
  ]);

  await check("admin import validation API accepts CSV text", async () => {
    const response = await admin.request("/api/v1/imports/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "product-variants",
        csv: "productName,skuPrefix,categoryName,sku,size,color,baseCostMyr,sellingPriceMyr\nTest,TST,Test,TST-S,S,Black,10,29.9",
      }),
    });
    assertStatus(response, [200]);
    const json = await response.json();
    assert(json.data?.validRows === 1, "expected one valid import row");
  });

  await check("admin import apply dry-run does not require confirmation", async () => {
    const response = await admin.request("/api/v1/imports/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "locations",
        dryRun: true,
        csv: "name,type,address,contactPerson,contactPhone\nDry Run Location,WAREHOUSE,,,",
      }),
    });
    assertStatus(response, [200]);
    const json = await response.json();
    assert(json.data?.dryRun === true, "expected dry-run response");
    assert(json.data?.validation?.validRows === 1, "expected one valid dry-run row");
  });

  await smokeApi(promoter, "promoter APIs", [
    "/api/v1/promoter/context",
    "/api/v1/promoter/stock",
    "/api/v1/promoter/sales?limit=5",
    `/api/v1/promoter/leaderboard?month=${currentMonth()}`,
    "/api/v1/transfers",
  ]);

  await smokeApi(supervisor, "supervisor operational APIs", [
    "/api/v1/transfers",
    "/api/v1/stock-levels?pageSize=5",
  ]);

  await smokeApi(viewer, "viewer report APIs", [
    "/api/v1/reports/sales",
    "/api/v1/reports/inventory",
    "/api/v1/reports/consignment",
    "/api/v1/reports/promoter",
  ]);

  await check("viewer cannot create products", async () => {
    const response = await viewer.request("/api/v1/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assertStatus(response, [403]);
  });

  await check("viewer cannot create purchase orders", async () => {
    const response = await viewer.request("/api/v1/purchase-orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assertStatus(response, [403]);
  });

  await check("promoter cannot use global reports", async () => {
    const response = await promoter.request("/api/v1/reports/sales");
    assertStatus(response, [403]);
  });

  await check("promoter cannot validate imports", async () => {
    const response = await promoter.request("/api/v1/imports/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "locations",
        csv: "name,type,address,contactPerson,contactPhone\nBlocked Location,WAREHOUSE,,,",
      }),
    });
    assertStatus(response, [403]);
  });

  await smokePages(admin, "admin pages", [
    "/",
    "/inventory",
    "/inventory/products",
    "/inventory/stock",
    "/inventory/locations",
    "/sales",
    "/sales/orders",
    "/sales/reports",
    "/promoter/reports",
    "/consignment",
    "/consignment/stock",
    "/consignment/partners",
    "/consignment/reports",
    "/consignment/invoices",
    "/consignment/invoices?dueState=outstanding",
    "/consignment/collections",
    "/purchases",
    "/purchases/suppliers",
    "/purchases/orders",
    "/settings",
  ]);

  await smokeFirstConsignmentInvoicePrintPage(admin);
  await smokeFirstConsignmentPartnerStatementPage(admin);

  await smokePages(promoter, "promoter pages", [
    "/promoter/sales",
    "/promoter/sales/new",
    "/promoter/returns",
    "/promoter/stock",
    "/promoter/transfers",
    "/promoter/leaderboard",
  ]);

  await check("admin is blocked from promoter-only context API", async () => {
    const response = await admin.request("/api/v1/promoter/context");
    assertStatus(response, [403]);
  });

  report();
}

async function login(name, account) {
  const session = new BrowserSession();

  await check(`${account.label} login`, async () => {
    const csrfResponse = await session.request("/api/auth/csrf");
    assertStatus(csrfResponse, [200]);
    const csrfJson = await csrfResponse.json();
    assert(csrfJson.csrfToken, "missing CSRF token");

    const body = new URLSearchParams({
      email: account.email,
      password: account.password,
      csrfToken: csrfJson.csrfToken,
      callbackUrl: `${baseUrl}/`,
      redirect: "false",
    });

    const response = await session.request("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    assertStatus(response, [200, 302, 303, 307]);
    const json = response.status === 200 ? await response.json().catch(() => ({})) : {};
    assert(!json.error, json.error ?? "credentials login failed");
    assert(session.cookies.size > 0, "login did not set session cookies");

    const sessionResponse = await session.request("/api/auth/session");
    assertStatus(sessionResponse, [200]);
    const sessionJson = await sessionResponse.json();
    assert(
      sessionJson.user?.email === account.email,
      `expected logged-in user ${account.email}, got ${sessionJson.user?.email ?? "none"}`,
    );
  });

  session.name = name;
  return session;
}

async function smokeApi(session, groupName, paths) {
  for (const path of paths) {
    await check(`${groupName}: GET ${path}`, async () => {
      const response = await session.request(path);
      assertStatus(response, [200]);
      const contentType = response.headers.get("content-type") ?? "";
      assert(contentType.includes("application/json"), `expected JSON, got ${contentType}`);
      const json = await response.json();
      assert("data" in json || "pagination" in json, "response has no data payload");
    });
  }
}

async function smokeCsv(session, groupName, paths) {
  for (const path of paths) {
    await check(`${groupName}: GET ${path}`, async () => {
      const response = await session.request(path);
      assertStatus(response, [200]);
      const contentType = response.headers.get("content-type") ?? "";
      assert(contentType.includes("text/csv"), `expected CSV, got ${contentType}`);
      const text = await response.text();
      assert(text.includes(","), "CSV response does not look like tabular data");
    });
  }
}

async function smokePages(session, groupName, paths) {
  for (const path of paths) {
    await check(`${groupName}: ${path}`, async () => {
      const response = await session.request(path);
      assertStatus(response, [200]);
      const html = await response.text();
      assert(!html.includes("Runtime Error"), "Next.js runtime error overlay detected");
      assert(!html.includes("Hydration failed"), "hydration error overlay detected");
      assert(!html.includes("This site can't be reached"), "browser error text detected");
    });
  }
}

async function smokeFirstConsignmentInvoicePrintPage(session) {
  await check("admin consignment invoice print page", async () => {
    const response = await session.request("/consignment/invoices");
    assertStatus(response, [200]);
    const html = await response.text();
    const match = html.match(/\/consignment\/invoices\/([^"/]+)\/print/);
    if (!match) {
      return;
    }

    const printResponse = await session.request(`/consignment/invoices/${match[1]}/print`);
    assertStatus(printResponse, [200]);
    const printHtml = await printResponse.text();
    assert(printHtml.includes("Consignment Invoice"), "print page did not render invoice document");
    assert(!printHtml.includes("Runtime Error"), "Next.js runtime error overlay detected");
    assert(!printHtml.includes("Hydration failed"), "hydration error overlay detected");
  });
}

async function smokeFirstConsignmentPartnerStatementPage(session) {
  await check("admin consignment partner statement page", async () => {
    const response = await session.request("/consignment/partners");
    assertStatus(response, [200]);
    const html = await response.text();
    const match = html.match(/\/consignment\/partners\/([^"/]+)\/statement/);
    if (!match) {
      return;
    }

    const statementResponse = await session.request(`/consignment/partners/${match[1]}/statement`);
    assertStatus(statementResponse, [200]);
    const statementHtml = await statementResponse.text();
    assert(statementHtml.includes("Statement"), "partner statement page did not render");
    assert(!statementHtml.includes("Runtime Error"), "Next.js runtime error overlay detected");
    assert(!statementHtml.includes("Hydration failed"), "hydration error overlay detected");
  });
}

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, status: "PASS" });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: "FAIL", message: error.message });
    console.error(`FAIL ${name}`);
    console.error(`     ${error.message}`);
  }
}

function assertStatus(response, allowed) {
  assert(
    allowed.includes(response.status),
    `expected HTTP ${allowed.join(" or ")}, got ${response.status}`,
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function splitSetCookie(value) {
  if (!value) return [];
  return value.split(/,(?=\s*[^;,=\s]+=[^;,]+)/g).map((part) => part.trim());
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function report() {
  const failed = results.filter((result) => result.status === "FAIL");
  const passed = results.length - failed.length;
  console.log("");
  console.log(`ERP smoke test result: ${passed}/${results.length} passed`);

  if (failed.length > 0) {
    console.log("");
    console.log("Failures:");
    for (const failure of failed) {
      console.log(`- ${failure.name}: ${failure.message}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
