import { chromium } from "@playwright/test";

const rawBase = process.env.BASE_URL || "http://127.0.0.1:5175/tis";
const baseURL = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;
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

const createAssessmentFixture = async (page) => {
  return page.evaluate(async () => {
    const basePath = new URL(document.baseURI).pathname.replace(/\/$/, "");
    const api = await import(`${basePath}/src/db/api.js`);
    const { createId } = await import(`${basePath}/src/utils/uuid.js`);

    const propertyId = createId();
    const assessmentId = createId();

    await api.createProperty({
      id: propertyId,
      property_name: `Assessment Smoke ${Date.now().toString().slice(-6)}`,
      management_group: "",
      street_address: "250 Assessment Way",
      city: "Orlando",
      state: "FL",
      zip: "32828",
      exterior_condition: "good",
      maintenance_signals: "attention_needed",
      overall_feel: "medium",
      property_class: "",
      class_guess: "",
      units_est: 24,
      source_url: "",
      seed_notes: ""
    });

    await api.saveAssessment({
      id: assessmentId,
      property_id: propertyId,
      scout_mode: "quick",
      scout_type: "Quick Scout",
      confidence_level: "medium",
      problem_score: 2,
      access_score: 1,
      leverage_score: 1,
      momentum_score: 1,
      partner_potential: "medium",
      follow_up_priority: "medium",
      on_site_office_visible: true,
      leasing_activity_visible: true,
      maintenance_presence_visible: false,
      decision_maker_known: true,
      contact_name: "Taylor Manager",
      contact_email: "taylor@example.com",
      general_notes: "Smoke fixture",
      pricing_v1: {
        service_type: "dryer_vent_cleaning",
        grouped_scope: "grouped_same_building",
        occupancy_state: "occupied",
        service_access_type: "roof_required",
        condition_level: "moderate",
        coordination_burden: "moderate",
        travel_context: "standard_local",
        units_requested_now: 8,
        total_possible_units: 24,
        technical_issue_flags: ["roof_access_required", "blockage_suspected"],
        dryer_vent: {
          vent_run_length_band: "long",
          maintenance_assisted_access: "yes",
          layout_consistency: "standardized",
          roof_type: "shingle"
        }
      }
    });

    return { propertyId, assessmentId };
  });
};

const run = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);

  await gotoRoute(page, "/");
  const fixture = await createAssessmentFixture(page);

  await safe("Pricing v1 payload persists through assessment save/load", async () => {
    const roundTrip = await page.evaluate(async (assessmentId) => {
      const basePath = new URL(document.baseURI).pathname.replace(/\/$/, "");
      const api = await import(`${basePath}/src/db/api.js`);
      const assessment = await api.getAssessment(assessmentId);
      return assessment?.pricing_v1 || null;
    }, fixture.assessmentId);

    if (!roundTrip) throw new Error("Missing pricing_v1 payload.");
    if (roundTrip.service_type !== "dryer_vent_cleaning") {
      throw new Error(`Unexpected service_type: ${roundTrip.service_type}`);
    }
    if (roundTrip.service_access_type !== "roof_required") {
      throw new Error(`Unexpected service_access_type: ${roundTrip.service_access_type}`);
    }
    if (!roundTrip.technical_issue_flags?.includes("blockage_suspected")) {
      throw new Error("Technical issue flags did not round-trip.");
    }
    if (roundTrip.dryer_vent?.vent_run_length_band !== "long") {
      throw new Error("Dryer vent pricing fields did not round-trip.");
    }
  });

  await safe("Assessment form shows Access explanation and hook builder", async () => {
    await gotoRoute(page, `/assessments/${fixture.assessmentId}`);
    await page.locator(".page-title", { hasText: "Quick Scout" }).waitFor({ state: "visible" });
    await page.locator("text=Sales Access Path (0–2)").waitFor({ state: "visible" });
    await page.locator("text=This score is commercial access, not service access.").waitFor({
      state: "visible"
    });
    await page.locator("text=Hook Builder (Observation → Impact → Ask)").waitFor({
      state: "visible"
    });
    await page.locator("button", { hasText: "Auto Fill" }).waitFor({ state: "visible" });
    await page.locator(".field", { hasText: "Observation" }).locator("textarea").waitFor({
      state: "visible"
    });
    await page.locator(".field", { hasText: "Impact" }).locator("textarea").waitFor({
      state: "visible"
    });
    await page.locator(".field", { hasText: "Ask" }).locator("textarea").waitFor({ state: "visible" });
    await page.locator("button", { hasText: "Delete Report" }).waitFor({ state: "visible" });
  });

  await safe("Property history lets a rep delete a report", async () => {
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.locator(".page-title", { hasText: "Assessment Smoke" }).waitFor({ state: "visible" });
    await page.locator("button", { hasText: "Open Report" }).waitFor({ state: "visible" });
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("button", { hasText: "Delete Report" }).last().click();
    await page.locator("text=No assessments yet.").waitFor({ state: "visible" });
  });

  await browser.close();

  const failed = results.filter((item) => !item.ok);
  if (failed.length) {
    console.log(`\nFailures: ${failed.length}`);
    failed.forEach((item) => console.log(`- ${item.name}: ${item.detail}`));
    process.exitCode = 1;
  } else {
    console.log("\nAll assessment workflow smoke checks passed.");
  }
};

run().catch((error) => {
  console.error("Assessment workflow smoke test failed to run:", error);
  process.exitCode = 1;
});
