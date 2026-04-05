import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const DEFAULT_BASE_URL = "http://127.0.0.1:4173/tis";
const APP_TIMEOUT = 20000;
const REMOTE_TIMEOUT = 30000;
const REMOTE_INTERVAL = 1000;

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    process.env[line.slice(0, idx)] = line.slice(idx + 1);
  }
}

loadEnv(path.join(process.cwd(), ".env"));

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
}

const baseURL = (process.env.BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const propertyName = `UAT Offline ${stamp}`;
const initialManagement = `UAT Mgmt ${stamp}`;
const editedManagement = `${initialManagement} Updated`;
const assessmentNotes = `Controlled offline general notes ${stamp}`;
const opportunityNotes = `Controlled offline evidence notes ${stamp}`;
const reportPath = path.join(process.cwd(), "tmp", `controlled-uat-offline-sync-${stamp}.json`);
const screenshotDir = path.join(process.cwd(), "tmp", `controlled-uat-offline-sync-${stamp}`);
const photoOnePath = path.join(process.cwd(), "tmp", "smoke-save.png");
const photoTwoPath = path.join(process.cwd(), "tmp", `controlled-uat-photo-2-${stamp}.png`);

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.mkdirSync(screenshotDir, { recursive: true });

if (!fs.existsSync(photoOnePath)) {
  throw new Error(`Missing fixture image: ${photoOnePath}`);
}
fs.copyFileSync(photoOnePath, photoTwoPath);

const report = {
  startedAt: new Date().toISOString(),
  baseURL,
  propertyName,
  propertyId: null,
  assessmentId: null,
  timestamps: {
    offlineSaveAt: null,
    reconnectAt: null
  },
  syncMode: "unknown",
  photoFailedSeparately: false,
  phases: {},
  remote: {},
  ui: {},
  notes: []
};

function setPhase(name, status, detail = "") {
  report.phases[name] = {
    status,
    detail,
    at: new Date().toISOString()
  };
  const prefix = status === "pass" ? "PASS" : status === "partial" ? "PARTIAL" : "FAIL";
  console.log(`[${prefix}] ${name}${detail ? ` - ${detail}` : ""}`);
}

function normalizeHashPath(url) {
  const value = new URL(url).hash.replace(/^#/, "");
  return value.split("?")[0] || "/";
}

async function waitFor(fn, { timeout = REMOTE_TIMEOUT, interval = REMOTE_INTERVAL, label = "condition" } = {}) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeout) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
  throw new Error(`Timed out waiting for ${label}: ${lastError?.message || "no detail"}`);
}

async function waitForApp(page) {
  await page.waitForSelector(".app-title", { timeout: APP_TIMEOUT });
}

async function waitForTitle(page, title) {
  await page.locator(".page-title", { hasText: title }).waitFor({ state: "visible", timeout: APP_TIMEOUT });
}

async function waitForServiceWorker(page) {
  return page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    try {
      await navigator.serviceWorker.ready;
      return true;
    } catch {
      return false;
    }
  });
}

async function gotoRoute(page, route) {
  await page.goto(`${baseURL}/#${route}`, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
}

async function fillInputField(page, labelText, value) {
  const field = page.locator(".field", { hasText: labelText }).first();
  await field.scrollIntoViewIfNeeded();
  await field.locator("input").fill(value);
}

async function fillTextAreaField(page, labelText, value) {
  const field = page.locator(".field", { hasText: labelText }).first();
  await field.scrollIntoViewIfNeeded();
  await field.locator("textarea").fill(value);
}

async function clickTile(page, labelText, optionText) {
  const field = page.locator(".field", { hasText: labelText }).first();
  await field.scrollIntoViewIfNeeded();
  await field.locator("button.tile", { hasText: optionText }).click();
}

async function remotePropertyRows() {
  const { data, error } = await supabase
    .from("tis_properties")
    .select("*")
    .eq("property_name", propertyName)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function remoteAssessmentRows(propertyId) {
  const { data, error } = await supabase
    .from("tis_assessments")
    .select("*")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function remotePhotoRows(assessmentId) {
  const { data, error } = await supabase
    .from("tis_photos")
    .select("*")
    .eq("assessment_id", assessmentId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function captureToastText(page, title) {
  const toast = page.locator(".toast", {
    has: page.locator(".toast-title", { hasText: title })
  }).last();
  await toast.waitFor({ state: "visible", timeout: APP_TIMEOUT });
  return (await toast.innerText()).replace(/\s+/g, " ").trim();
}

async function tryCaptureToastText(page, title, timeout = 1500) {
  const toast = page.locator(".toast", {
    has: page.locator(".toast-title", { hasText: title })
  }).last();
  try {
    await toast.waitFor({ state: "visible", timeout });
    return (await toast.innerText()).replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

async function takeScreenshot(page, name) {
  const target = path.join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: target, fullPage: true });
  return target;
}

async function run() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 430, height: 932 }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(APP_TIMEOUT);
    report.browserLogs = [];
    page.on("console", (msg) => {
      const entry = `[${msg.type()}] ${msg.text()}`;
      report.browserLogs.push(entry);
      if (["error", "warning"].includes(msg.type())) {
        console.log(`BROWSER ${entry}`);
      }
    });
    page.on("pageerror", (error) => {
      const entry = `[pageerror] ${error?.message || String(error)}`;
      report.browserLogs.push(entry);
      console.log(`BROWSER ${entry}`);
    });

    await gotoRoute(page, "/");
    await waitForTitle(page, "Command Center");
    report.ui.serviceWorkerReady = await waitForServiceWorker(page);
    setPhase("preview_load", "pass", `serviceWorkerReady=${report.ui.serviceWorkerReady}`);

    await gotoRoute(page, "/properties/new");
    await waitForTitle(page, "New Property");

    await fillInputField(page, "Property Name", propertyName);
    await fillInputField(page, "Management Group", initialManagement);
    await fillInputField(page, "Street Address", "100 Controlled UAT Way");
    await fillInputField(page, "City", "Orlando");
    await fillInputField(page, "State", "FL");
    await fillInputField(page, "Zip", "32828");
    await fillInputField(page, "Estimated Units", "17");
    await fillInputField(page, "Source URL", "https://example.com/controlled-uat");
    await fillTextAreaField(page, "Seed Notes", `Created by controlled UAT ${stamp}`);
    await clickTile(page, "Exterior Condition", "Good");
    await clickTile(page, "Maintenance Signals", "Well Kept");
    await clickTile(page, "Operational Feel", "High");

    await page.locator("button.primary", { hasText: "Save Property" }).click();
    await waitFor(() => {
      const pathValue = normalizeHashPath(page.url());
      if (!/^\/properties\/[^/]+$/.test(pathValue)) {
        throw new Error(`Unexpected route after property save: ${pathValue}`);
      }
      return pathValue;
    }, { timeout: APP_TIMEOUT, interval: 250, label: "property detail route" });

    report.propertyId = normalizeHashPath(page.url()).split("/")[2];
    const createdProperty = await waitFor(async () => {
      const rows = await remotePropertyRows();
      if (rows.length !== 1) throw new Error(`Expected 1 property row, found ${rows.length}`);
      if (rows[0].management_group !== initialManagement) {
        throw new Error(`Management group mismatch after create: ${rows[0].management_group}`);
      }
      return rows[0];
    }, { label: "remote property create sync" });
    report.remote.propertyAfterCreate = {
      id: createdProperty.id,
      management_group: createdProperty.management_group,
      units_est: createdProperty.units_est
    };
    setPhase("phase_a_create_property", "pass", `propertyId=${report.propertyId}`);

    await page.locator("button.ghost", { hasText: "Edit Property" }).click();
    await waitForTitle(page, "Edit Property");
    await fillInputField(page, "Management Group", editedManagement);
    await fillInputField(page, "Estimated Units", "19");
    await page.locator("button.primary", { hasText: "Save Changes" }).click();
    await waitForTitle(page, propertyName);
    await waitFor(async () => {
      const rows = await remotePropertyRows();
      if (rows.length !== 1) throw new Error(`Expected 1 property row after edit, found ${rows.length}`);
      if (rows[0].management_group !== editedManagement) {
        throw new Error(`Management group mismatch after edit: ${rows[0].management_group}`);
      }
      if (Number(rows[0].units_est) !== 19) {
        throw new Error(`Units mismatch after edit: ${rows[0].units_est}`);
      }
      return rows[0];
    }, { label: "remote property edit sync" });
    await page.locator(".detail-line", { hasText: `Management: ${editedManagement}` }).waitFor({ state: "visible" });
    await page.locator(".detail-line", { hasText: "Units: 19" }).waitFor({ state: "visible" });
    setPhase("phase_a_edit_property", "pass", "Remote and UI state matched");

    await context.setOffline(true);
    await page.waitForFunction(() => navigator.onLine === false, undefined, { timeout: APP_TIMEOUT });
    await page.locator("button.primary", { hasText: "Quick Scout" }).click();
    await waitFor(() => {
      const pathValue = normalizeHashPath(page.url());
      if (!/^\/assessments\/[^/]+$/.test(pathValue)) {
        throw new Error(`Unexpected assessment route: ${pathValue}`);
      }
      return pathValue;
    }, { timeout: APP_TIMEOUT, interval: 250, label: "assessment route" });

    report.assessmentId = normalizeHashPath(page.url()).split("/")[2];

    await fillTextAreaField(page, "Evidence Notes", opportunityNotes);
    await fillTextAreaField(page, "General Notes", assessmentNotes);
    const uploadInput = page.locator('input[type="file"][multiple]');
    await uploadInput.setInputFiles([photoOnePath, photoTwoPath]);
    await waitFor(async () => {
      const count = await page.locator(".photo-card").count();
      if (count < 2) throw new Error(`Expected at least 2 photo cards, found ${count}`);
      return count;
    }, { timeout: APP_TIMEOUT, interval: 250, label: "photo cards" });

    await page.locator("button.primary", { hasText: "Save Assessment" }).scrollIntoViewIfNeeded();
    await page.locator("button.primary", { hasText: "Save Assessment" }).click();

    report.ui.offlineAssessmentToast = await captureToastText(page, "Assessment saved");
    report.ui.offlinePhotoToast = await tryCaptureToastText(page, "Photo uploads");
    report.timestamps.offlineSaveAt = new Date().toISOString();

    const queuedBadges = page.locator(".photo-status-pill.queued");
    const queuedCount = await waitFor(async () => {
      const count = await queuedBadges.count();
      if (count < 2) throw new Error(`Expected queued photo badges, found ${count}`);
      return count;
    }, { timeout: APP_TIMEOUT, interval: 250, label: "queued photo badges" });
    report.ui.offlineQueuedPhotoCount = queuedCount;
    report.ui.offlineStatusPill = (await page.locator(".status-pill").innerText()).trim();
    setPhase(
      "phase_b_offline_save",
      "pass",
      `queuedPhotoBadges=${queuedCount}; status='${report.ui.offlineStatusPill}'`
    );

    await page.locator("button.ghost", { hasText: "Back" }).click();
    await waitForTitle(page, propertyName);
    const pastAssessmentsSection = page.locator(".section", {
      has: page.locator(".section-header", { hasText: "Past Assessments" })
    });
    await waitFor(async () => {
      const count = await pastAssessmentsSection.locator(".card").count();
      if (count !== 1) throw new Error(`Expected 1 local assessment card, found ${count}`);
      return count;
    }, { timeout: APP_TIMEOUT, interval: 250, label: "offline local assessment history" });
    setPhase("phase_b_local_integrity", "pass", "Assessment card visible while still offline");

    await context.setOffline(false);
    await page.waitForFunction(() => navigator.onLine === true, undefined, { timeout: APP_TIMEOUT });
    report.timestamps.reconnectAt = new Date().toISOString();

    let assessmentRows;
    let photoRows;
    try {
      assessmentRows = await waitFor(async () => {
        const rows = await remoteAssessmentRows(report.propertyId);
        if (rows.length !== 1) throw new Error(`Expected 1 assessment row, found ${rows.length}`);
        const row = rows[0];
        if (row.id !== report.assessmentId) throw new Error(`Unexpected assessment id ${row.id}`);
        if (row.general_notes !== assessmentNotes) {
          throw new Error(`Assessment notes mismatch: ${row.general_notes}`);
        }
        if (row.opportunity_notes !== opportunityNotes) {
          throw new Error(`Opportunity notes mismatch: ${row.opportunity_notes}`);
        }
        return rows;
      }, { label: "automatic assessment sync" });
      photoRows = await waitFor(async () => {
        const rows = await remotePhotoRows(report.assessmentId);
        if (rows.length !== 2) throw new Error(`Expected 2 photo rows, found ${rows.length}`);
        return rows;
      }, { label: "automatic photo sync" });
      report.syncMode = "automatic";
    } catch (error) {
      report.notes.push(`Automatic sync did not complete in time: ${error.message}`);
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForApp(page);
      await waitForTitle(page, propertyName);
      assessmentRows = await waitFor(async () => {
        const rows = await remoteAssessmentRows(report.propertyId);
        if (rows.length !== 1) throw new Error(`Expected 1 assessment row after manual refresh, found ${rows.length}`);
        return rows;
      }, { label: "manual assessment sync" });
      photoRows = await waitFor(async () => {
        const rows = await remotePhotoRows(report.assessmentId);
        if (rows.length !== 2) throw new Error(`Expected 2 photo rows after manual refresh, found ${rows.length}`);
        return rows;
      }, { label: "manual photo sync" });
      report.syncMode = "manual";
    }

    report.remote.propertyFinal = (await remotePropertyRows())[0];
    report.remote.assessmentFinal = assessmentRows[0];
    report.remote.photosAtMetadataSync = photoRows.map((row) => ({
      id: row.id,
      stored_filename: row.stored_filename,
      storage_uri: row.storage_uri
    }));
    setPhase("phase_c_remote_sync", "pass", `syncMode=${report.syncMode}`);

    const assessmentCard = pastAssessmentsSection.locator(".card").first();
    await assessmentCard.click();
    await waitFor(() => {
      const pathValue = normalizeHashPath(page.url());
      if (pathValue !== `/assessments/${report.assessmentId}`) {
        throw new Error(`Expected assessment route /assessments/${report.assessmentId}, got ${pathValue}`);
      }
      return pathValue;
    }, { timeout: APP_TIMEOUT, interval: 250, label: "assessment reopen route" });

    await waitFor(async () => {
      const count = await page.locator(".photo-status-pill.uploaded").count();
      if (count < 2) throw new Error(`Expected 2 uploaded photo badges, found ${count}`);
      return count;
    }, { timeout: REMOTE_TIMEOUT, interval: 500, label: "uploaded photo badges" });
    const failedBadges = await page.locator(".photo-status-pill.failed").count();
    report.photoFailedSeparately = failedBadges > 0;
    report.ui.reconnectedUploadSummary = (
      await page.locator(".photo-upload-summary").innerText()
    ).replace(/\s+/g, " ").trim();
    report.ui.generalNotesValue = await page
      .locator(".field", { hasText: "General Notes" })
      .locator("textarea")
      .inputValue();
    report.ui.evidenceNotesValue = await page
      .locator(".field", { hasText: "Evidence Notes" })
      .locator("textarea")
      .inputValue();
    if (report.ui.generalNotesValue !== assessmentNotes) {
      throw new Error(`General notes were not preserved in UI: ${report.ui.generalNotesValue}`);
    }
    if (report.ui.evidenceNotesValue !== opportunityNotes) {
      throw new Error(`Evidence notes were not preserved in UI: ${report.ui.evidenceNotesValue}`);
    }
    const finalPhotoRows = await waitFor(async () => {
      const rows = await remotePhotoRows(report.assessmentId);
      if (rows.length !== 2) throw new Error(`Expected 2 final photo rows, found ${rows.length}`);
      if (rows.some((row) => !row.storage_uri)) {
        throw new Error("Expected all remote photos to have storage_uri values.");
      }
      const uniqueStored = new Set(rows.map((row) => row.stored_filename));
      if (uniqueStored.size !== rows.length) {
        throw new Error("Expected unique stored_filename values for remote photos.");
      }
      const uniqueUris = new Set(rows.map((row) => row.storage_uri));
      if (uniqueUris.size !== rows.length) {
        throw new Error("Expected unique storage_uri values for remote photos.");
      }
      return rows;
    }, { timeout: REMOTE_TIMEOUT, interval: 500, label: "final remote photo upload sync" });
    report.remote.photosFinal = finalPhotoRows.map((row) => ({
      id: row.id,
      stored_filename: row.stored_filename,
      storage_uri: row.storage_uri
    }));
    setPhase("phase_c_local_sync_clear", "pass", report.ui.reconnectedUploadSummary);

    await page.locator("button.ghost", { hasText: "Back" }).click();
    await waitForTitle(page, propertyName);
    await page.locator("button.ghost", { hasText: "Back" }).click();
    await waitForTitle(page, "Properties");
    const searchField = page.locator(".field", { hasText: "Search Properties" });
    await searchField.locator("input").fill(propertyName);
    const propertyCard = page.locator(".card", { hasText: propertyName }).first();
    await propertyCard.locator(".pill", { hasText: "Sync: Synced" }).waitFor({ state: "visible", timeout: APP_TIMEOUT });
    await propertyCard.locator(".pill", { hasText: "Photos: 2" }).waitFor({ state: "visible", timeout: APP_TIMEOUT });
    await propertyCard.locator("button.secondary", { hasText: "View" }).click();
    await waitForTitle(page, propertyName);
    await page.locator(".detail-line", { hasText: `Management: ${editedManagement}` }).waitFor({ state: "visible" });
    await waitFor(async () => {
      const count = await pastAssessmentsSection.locator(".card").count();
      if (count !== 1) throw new Error(`Expected 1 assessment card after sync, found ${count}`);
      return count;
    }, { timeout: APP_TIMEOUT, interval: 250, label: "post-sync assessment history" });
    setPhase("phase_d_integrity", "pass", "No duplicate property or assessment visible in UI");

    await takeScreenshot(page, "final-property-detail");
    report.completedAt = new Date().toISOString();
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Report written to ${reportPath}`);
  } catch (error) {
    report.completedAt = new Date().toISOString();
    report.error = error?.message || String(error);
    if (browser) {
      try {
        const context = browser.contexts()[0];
        const page = context?.pages?.()[0];
        if (page) {
          report.failureScreenshot = await takeScreenshot(page, "failure");
        }
      } catch {
        // ignore screenshot failures
      }
    }
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.error(`Controlled UAT failed. Report written to ${reportPath}`);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
