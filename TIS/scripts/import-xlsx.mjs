import { chromium } from "@playwright/test";
import path from "path";

const baseURL = "http://127.0.0.1:5175/tis";
const filePath = "c:\\Users\\ol_ma\\Downloads\\concord_seed_ready_import_workbook_FILLED.xlsx";

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(20000);

  await page.goto(`${baseURL}/#/data`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".app-title");
  await page.locator(".page-title", { hasText: "Data Tools" }).waitFor({ state: "visible" });

  const input = page.locator("input[type=file]").first();
  await input.setInputFiles(filePath);

  // Wait for success banner or error
  const success = page.locator(".success-banner");
  const error = page.locator(".field-error");

  await Promise.race([
    success.waitFor({ state: "visible" }),
    error.waitFor({ state: "visible" })
  ]);

  let result = "";
  if (await success.isVisible()) {
    result = await success.innerText();
  } else if (await error.isVisible()) {
    result = await error.innerText();
  }

  console.log(result || "Import finished, but no summary text found.");
  await browser.close();
};

run().catch((error) => {
  console.error("Import failed:", error);
  process.exitCode = 1;
});
