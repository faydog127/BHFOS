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

const getRouteLabel = async (page) => {
  const label = await page.locator(".route-label").innerText();
  return label.replace("Route: ", "").trim();
};

const gotoRoute = async (page, route) => {
  const normalized = route.startsWith("/") ? route : `/${route}`;
  await page.goto(`${baseURL}/#${normalized}`, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
};

const waitForPageTitle = async (page, title) => {
  await page.locator(".page-title", { hasText: title }).waitFor({ state: "visible" });
};

const setSearchValue = async (page, value) => {
  const field = page.locator(".field", { hasText: "Search Properties" });
  await field.locator("input").fill(value);
};

const readSearchValue = async (page) => {
  const field = page.locator(".field", { hasText: "Search Properties" });
  return field.locator("input").inputValue();
};

const createPropertyProgrammatically = async (page, data) => {
  const id = await page.evaluate(async (payload) => {
    const basePath = new URL(document.baseURI).pathname.replace(/\/$/, "");
    const { createProperty } = await import(`${basePath}/src/db/api.js`);
    const { createId } = await import(`${basePath}/src/utils/uuid.js`);
    const newId = createId();
    await createProperty({
      id: newId,
      property_name: payload.property_name,
      management_group: payload.management_group || "",
      street_address: payload.street_address || "",
      city: payload.city || "",
      state: payload.state || "",
      zip: payload.zip || "",
      exterior_condition: payload.exterior_condition,
      maintenance_signals: payload.maintenance_signals,
      overall_feel: payload.overall_feel,
      property_class: "",
      class_guess: "",
      units_est: null,
      source_url: "",
      seed_notes: ""
    });
    return newId;
  }, data);
  return id;
};

const run = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);

  const stamp = Date.now().toString().slice(-6);
  const nameAlpha = `Smoke Alpha ${stamp}`;
  const nameGamma = `Smoke Gamma ${stamp}`;
  const nameBeta = `Smoke Beta ${stamp}`;

  await safe("Home loads cleanly", async () => {
    await gotoRoute(page, "/");
    await waitForPageTitle(page, "Command Center");
    await page.locator(".section-header", { hasText: "Active Zones" }).waitFor({ state: "visible" });
    await page.locator(".section-header", { hasText: "Today Snapshot" }).waitFor({ state: "visible" });
    await page.locator(".section-header", { hasText: "High Opportunity Targets" }).waitFor({ state: "visible" });
    await page.locator("button", { hasText: "Start Scouting" }).waitFor({ state: "visible" });
  });

  await safe("Active Zones can be changed on Home", async () => {
    await page.locator("button.zone-chip", { hasText: "ORL-E" }).click();
    await page.locator("button.zone-chip.is-active", { hasText: "ORL-E" }).waitFor({ state: "visible" });
  });

  await safe("Start Scouting routes to /properties", async () => {
    await page.locator("button", { hasText: "Start Scouting" }).click();
    await waitForPageTitle(page, "Properties");
    const route = await getRouteLabel(page);
    if (route !== "/properties") throw new Error(`Expected /properties, got ${route}`);
  });

  await safe("Seed properties for flow", async () => {
    await createPropertyProgrammatically(page, {
      property_name: nameAlpha,
      street_address: "100 Alpha St",
      city: "Orlando",
      state: "FL",
      zip: "32828",
      exterior_condition: "good",
      maintenance_signals: "well_kept",
      overall_feel: "high"
    });
    await createPropertyProgrammatically(page, {
      property_name: nameGamma,
      street_address: "200 Gamma Ave",
      city: "Orlando",
      state: "FL",
      zip: "32825",
      exterior_condition: "good",
      maintenance_signals: "well_kept",
      overall_feel: "high"
    });
    await createPropertyProgrammatically(page, {
      property_name: nameBeta,
      street_address: "300 Beta Blvd",
      city: "Orlando",
      state: "FL",
      zip: "32819",
      exterior_condition: "good",
      maintenance_signals: "well_kept",
      overall_feel: "high"
    });
  });

  await safe("Active Zones on Properties match Home selection", async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.locator("button.zone-chip.is-active", { hasText: "ORL-E" }).waitFor({ state: "visible" });
  });

  await safe("Properties list respects active zones", async () => {
    await page.locator(`text=${nameAlpha}`).waitFor({ state: "visible" });
    await page.locator(`text=${nameGamma}`).waitFor({ state: "visible" });
    const betaVisible = await page.locator(`text=${nameBeta}`).isVisible();
    if (betaVisible) throw new Error("ORL-W property should be hidden when ORL-E only is active");
  });

  await safe("Search works and persists across detail/back", async () => {
    await setSearchValue(page, "Alpha");
    await page.locator(`text=${nameAlpha}`).waitFor({ state: "visible" });
    const gammaVisible = await page.locator(`text=${nameGamma}`).isVisible();
    if (gammaVisible) throw new Error("Search filter did not narrow list");

    const alphaCard = page.locator(".card", { hasText: nameAlpha });
    await alphaCard.locator("button", { hasText: "View" }).click();
    await page.locator("text=Start a Scout").waitFor({ state: "visible" });

    await page.locator("button", { hasText: "Back" }).click();
    await waitForPageTitle(page, "Properties");
    const value = await readSearchValue(page);
    if (value !== "Alpha") throw new Error(`Search value not persisted, got '${value}'`);
  });

  await safe("Filters do not clear zones/search", async () => {
    const field = page.locator(".field", { hasText: "Coverage" });
    await field.locator("select").selectOption("active");
    const value = await readSearchValue(page);
    if (value !== "Alpha") throw new Error("Search cleared after filter change");
    await page.locator("button.zone-chip.is-active", { hasText: "ORL-E" }).waitFor({ state: "visible" });
  });

  await safe("Property detail supports quick/full/photos", async () => {
    const alphaCard = page.locator(".card", { hasText: nameAlpha });
    await alphaCard.locator("button", { hasText: "View" }).click();
    await page.locator("button", { hasText: "Quick Scout" }).waitFor({ state: "visible" });
    await page.locator("button", { hasText: "Full Audit" }).waitFor({ state: "visible" });

    await page.locator("button", { hasText: "Quick Scout" }).click();
    await page.locator("text=Quick Scout").waitFor({ state: "visible" });
    await page.locator(".section-header", { hasText: "Photos" }).waitFor({ state: "visible" });
    await page.locator("text=Take Photo").waitFor({ state: "visible" });

    await page.locator("button", { hasText: "Back" }).click();
    await page.locator("text=Start a Scout").waitFor({ state: "visible" });
  });

  await safe("Back to list keeps zones/search for loop", async () => {
    await page.locator("button", { hasText: "Back" }).click();
    await waitForPageTitle(page, "Properties");
    const value = await readSearchValue(page);
    if (value !== "Alpha") throw new Error("Search lost on return to list");
  });

  await safe("Data page loads and has required sections", async () => {
    await gotoRoute(page, "/data");
    await waitForPageTitle(page, "Data Tools");
    await page.locator("text=Import / Seed").waitFor({ state: "visible" });
    await page.locator("text=Backup / Restore").waitFor({ state: "visible" });
    await page.locator("text=Classification Coverage").waitFor({ state: "visible" });
  });

  await safe("No admin/data blocks remain on Properties", async () => {
    await gotoRoute(page, "/properties");
    const importVisible = await page.locator("text=Import / Seed").isVisible();
    const backupVisible = await page.locator("text=Backup / Restore").isVisible();
    const coverageVisible = await page.locator("text=Classification Coverage").isVisible();
    if (importVisible || backupVisible || coverageVisible) {
      throw new Error("Admin/data blocks still visible on Properties page");
    }
  });

  await safe("Mobile-width check: no overflow", async () => {
    await gotoRoute(page, "/properties");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (overflow) throw new Error("Horizontal overflow detected");
  });

  await browser.close();

  const failed = results.filter((item) => !item.ok);
  if (failed.length) {
    console.log(`\nFailures: ${failed.length}`);
    failed.forEach((item) => console.log(`- ${item.name}: ${item.detail}`));
  } else {
    console.log("\nAll smoke checks passed.");
  }
};

run().catch((error) => {
  console.error("Smoke test failed to run:", error);
  process.exitCode = 1;
});
