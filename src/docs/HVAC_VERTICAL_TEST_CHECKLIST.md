# Manual QA Test Checklist

## Module 1: Chaos Flags
1. Load "Hard Competitor" -> Verify RED banner & Competitor script.
2. Load "Geo Vampire" -> Verify RED banner & Geo script.
3. Load "Ethics Breach" -> Verify RED banner & Ethics script.
4. Load "Financial Black Hole" -> Verify YELLOW/RED banner & Finance script.
5. Load "Abuse Protocol" -> Verify RED banner & Abuse script.

## Module 2: Call Console
1. Load "Clean Partner" -> Verify GREEN banner.
2. Load "At Risk Partner" -> Verify YELLOW banner.
3. Open "Flag Chaos" modal -> Submit flag -> Verify DB update.

## Module 3: Lifecycle
1. Verify "Wake Up" task generation for partners 60-90 days inactive.
2. Verify status transitions (Active -> At Risk -> Dormant).