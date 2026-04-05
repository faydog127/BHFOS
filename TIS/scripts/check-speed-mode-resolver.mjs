import { composeSpeedModeCopy } from "../src/utils/speedModeCopy.js";
import {
  SPEED_MODE_PRICE_POSTURE_LABELS,
  resolveSpeedMode
} from "../src/utils/speedModeResolver.js";

const cases = [
  {
    name: "Do not price on low confidence plus unknown access",
    input: {
      property_type: "high-rise",
      scope_band: "100+",
      access: "unknown",
      confidence: "low",
      visible_condition: "unknown"
    },
    expectStatus: "do_not_price_secure_access"
  },
  {
    name: "Present range on medium confidence standard site",
    input: {
      property_type: "garden-style",
      scope_band: "26-50",
      access: "mixed",
      confidence: "medium",
      visible_condition: "moderate"
    },
    expectStatus: "present_range_book_walkthrough"
  },
  {
    name: "Escalate internally on hazardous difficult commercial site",
    input: {
      property_type: "single-site commercial",
      scope_band: "11-25",
      access: "difficult",
      confidence: "medium",
      visible_condition: "hazardous"
    },
    expectStatus: "escalate_internal"
  },
  {
    name: "Deliver estimate on high-confidence small garden site",
    input: {
      property_type: "garden-style",
      scope_band: "11-25",
      access: "easy",
      confidence: "high",
      visible_condition: "moderate"
    },
    expectStatus: "deliver_estimate_ask_approval"
  }
];

let failed = 0;

for (const testCase of cases) {
  const result = resolveSpeedMode(testCase.input);
  if (!result.valid) {
    failed += 1;
    console.error(`[FAIL] ${testCase.name}: resolver returned validation errors`, result.errors);
    continue;
  }

  if (result.resolution.status_key !== testCase.expectStatus) {
    failed += 1;
    console.error(
      `[FAIL] ${testCase.name}: expected ${testCase.expectStatus}, got ${result.resolution.status_key}`
    );
    continue;
  }

  const copy = composeSpeedModeCopy(result, {
    pricePostureLabel: SPEED_MODE_PRICE_POSTURE_LABELS[result.action.price_posture]
  });

  if (!copy.talkTrack || !copy.followUpText || !copy.primaryCloseAsk) {
    failed += 1;
    console.error(`[FAIL] ${testCase.name}: copy payload missing expected fields`);
    continue;
  }

  console.log(
    `[PASS] ${testCase.name}: ${result.resolution.status_key} / ${result.pricing.strategy_key}`
  );
}

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log("\nSpeed Mode resolver checks passed.");
}
