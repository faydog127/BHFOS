import { chromium } from "@playwright/test";

const rawBase = process.env.BASE_URL || "http://127.0.0.1:5175/tis";
const baseURL = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;
const expectedHost = new URL(baseURL).host;
const results = [];

const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  const status = ok ? "PASS" : "FAIL";
  const suffix = detail ? ` - ${detail}` : "";
  console.log(`[${status}] ${name}${suffix}`);
};

const safe = async (name, fn) => {
  try {
    const detail = await fn();
    record(name, true, detail || "");
  } catch (error) {
    record(name, false, error?.message || String(error));
  }
};

const waitForApp = async (page) => {
  await page.waitForSelector(".app-title", { timeout: 10000 });
};

const gotoRoute = async (page, route) => {
  const normalized = route.startsWith("/") ? route : `/${route}`;
  await page.goto(`${baseURL}/#${normalized}`, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
};

const createEstimateFixture = async (page) => {
  return page.evaluate(async () => {
    const basePath = new URL(document.baseURI).pathname.replace(/\/$/, "");
    const api = await import(`${basePath}/src/db/api.js`);
    const { createId } = await import(`${basePath}/src/utils/uuid.js`);

    const propertyId = createId();
    const assessmentId = createId();
    const now = new Date().toISOString();
    const photoDataUri =
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="100%" height="100%" fill="#173861"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="28" fill="#ffffff">Proof</text></svg>'
      );

    await api.createProperty({
      id: propertyId,
      property_name: `Estimate Smoke ${Date.now().toString().slice(-6)}`,
      management_group: "",
      street_address: "100 Smoke Test Ln",
      city: "Orlando",
      state: "FL",
      zip: "32828",
      exterior_condition: "good",
      maintenance_signals: "attention_needed",
      overall_feel: "medium",
      property_class: "",
      class_guess: "",
      units_est: 48,
      source_url: "",
      seed_notes: ""
    });

    await api.saveAssessment({
      id: assessmentId,
      property_id: propertyId,
      scout_mode: "quick",
      scout_type: "Quick Scout",
      building_height: "3",
      termination_type: "sidewall",
      access_constraints: "minor",
      access_difficulty: "moderate",
      confidence_level: "medium",
      decision_maker_known: true,
      decision_maker_contacted: false,
      contact_name: "Pat Manager",
      contact_email: "pat@example.com",
      contact_phone: "555-0100",
      hook: "Blocked vents and maintenance drag.",
      hazard_severity: 2,
      hazard_prevalence: 1,
      hazard_maintenance_gap: 1,
      hazard_engagement_path: 1,
      general_notes: "Smoke fixture"
    });

    await api.insertPhotos([
      {
        id: createId(),
        assessment_id: assessmentId,
        timestamp: now,
        tag: "blocked_termination",
        note: "Primary proof photo",
        original_filename: "proof-1.svg",
        stored_filename: "proof-1.svg",
        storage_uri: photoDataUri
      },
      {
        id: createId(),
        assessment_id: assessmentId,
        timestamp: new Date(Date.now() + 1000).toISOString(),
        tag: "lint_buildup",
        note: "Secondary proof photo",
        original_filename: "proof-2.svg",
        stored_filename: "proof-2.svg",
        storage_uri: photoDataUri
      }
    ]);

    return { propertyId, assessmentId };
  });
};

const run = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(20000);

  await safe("Home shows environment banner and backup export", async () => {
    await gotoRoute(page, "/");
    await page.locator(".env-badge", { hasText: "LOCAL DEV" }).waitFor({ state: "visible" });
    await page.locator(".host-label", { hasText: expectedHost }).waitFor({ state: "visible" });
    await page.locator("button", { hasText: "Export Backup" }).waitFor({ state: "visible" });
  });

  const fixture = await createEstimateFixture(page);

  await safe("Estimate page shows Speed Mode field cockpit", async () => {
    await gotoRoute(page, `/assessments/${fixture.assessmentId}/estimate`);
    await page.locator(".page-title", { hasText: "Estimate & Proposal" }).waitFor({ state: "visible" });
    await page.locator("text=Field Close System").waitFor({ state: "visible" });
    await page.locator("button", { hasText: "Speed Mode" }).waitFor({ state: "visible" });
    await page.locator("text=Action Command").waitFor({ state: "visible" });
    await page.locator("text=Talk Track").first().waitFor({ state: "visible" });
    await page.locator("button", { hasText: "Copy Talk Track" }).waitFor({ state: "visible" });
    await page.locator("button", { hasText: "Copy Primary Close" }).waitFor({ state: "visible" });
    await page.locator("button", { hasText: "Copy Follow-Up" }).waitFor({ state: "visible" });
    await page.locator("button", { hasText: "Reset to Generated" }).waitFor({ state: "visible" });
    const estimateInputsVisible = await page.locator("text=Estimate Inputs").isVisible().catch(() => false);
    if (estimateInputsVisible) {
      throw new Error("Legacy estimate inputs are still visible in Speed Mode");
    }
    const debugVisible = await page.locator("text=Resolver Debug").isVisible().catch(() => false);
    if (debugVisible) {
      throw new Error("Resolver debug surface is still visible");
    }
  });

  await safe("Estimate page exposes proof-photo selection", async () => {
    await page.locator("text=Proof").first().waitFor({ state: "visible" });
    await page.locator("button", { hasText: "Proof: Blocked Termination" }).waitFor({ state: "visible" });
    await page.locator("button", { hasText: "Proof: Lint Buildup" }).waitFor({ state: "visible" });
  });

  await safe("Proposal builder mode restores delivery tools", async () => {
    await page.getByRole("button", { name: "Proposal Builder", exact: true }).click();
    await page.locator(".builder-handoff-card .card-title", { hasText: "Speed Mode Handoff" }).waitFor({ state: "visible" });
    await page.locator("button", { hasText: "Refresh from Speed Mode" }).waitFor({ state: "visible" });
    await page.locator("button", { hasText: "Copy All Delivery" }).waitFor({ state: "visible" });
    const placeholderVisible = await page.locator("button", { hasText: "Generate Quote" }).isVisible();
    if (placeholderVisible) {
      throw new Error("Legacy placeholder quote button is still visible");
    }
  });

  await safe("Proposal builder exposes budgetary pricing guide preview", async () => {
    await page.locator("text=Budgetary Pricing Guide").waitFor({ state: "visible" });
    await page.locator("button", { hasText: "Copy Guide Summary" }).waitFor({ state: "visible" });
    await page.locator("button", { hasText: "Download HTML" }).first().waitFor({ state: "visible" });
    await page.locator("iframe.budgetary-guide-frame").waitFor({ state: "visible" });
  });

  await browser.close();

  const failed = results.filter((item) => !item.ok);
  if (failed.length) {
    console.log(`\nFailures: ${failed.length}`);
    failed.forEach((item) => console.log(`- ${item.name}: ${item.detail}`));
    process.exitCode = 1;
  } else {
    console.log("\nAll estimate proposal smoke checks passed.");
  }
};

run().catch((error) => {
  console.error("Estimate proposal smoke test failed to run:", error);
  process.exitCode = 1;
});
