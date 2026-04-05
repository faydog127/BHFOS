# Speed Mode Copy Layer Spec

## 1. Purpose

This document defines how `Speed Mode v1` turns the resolver contract into rendered rep-facing copy.

It exists to prevent three failure modes:

- truthful status, but weak or inconsistent language
- good pricing posture, but poor close behavior
- UI teams rewriting copy logic inside components

The copy layer sits after:

1. status resolution
2. strategy resolution
3. overlay application

The copy layer does **not** decide truth.
It expresses truth in a usable field format.

## 2. Copy Stack

The copy stack is fixed:

1. `status`
2. `action command`
3. `risk warning`
4. `pricing posture`
5. `pricing strategy`
6. `close asks`
7. `follow-up text`
8. `proof captions`

This order must not be rearranged in Speed Mode.

## 3. Core Doctrine

Speed Mode copy must optimize for:

- forward motion
- controlled certainty
- fast field use
- direct closes

It must not optimize for:

- polished prose for its own sake
- long explanations
- legalistic hedging
- “smart sounding” filler

## 4. Input Sources

The copy layer consumes the resolver response from:

[speed-mode-resolver-json-contract.md](c:/BHFOS/TIS/speed-mode-resolver-json-contract.md)

At minimum it should read:

- `resolution.status_key`
- `resolution.status_label`
- `action.action_command`
- `action.risk_warning`
- `action.price_posture`
- `pricing.strategy_key`
- `pricing.anchor_structure`
- `pricing.entry_option_structure`
- `pricing.close_path`
- `close.primary_close_ask_key`
- `close.backup_close_ask_key`
- `overlays.applied_forced_phrases`
- `overlays.applied_warning_messages`
- `proof.priority_order`
- normalized `input`

## 5. Required Rendered Copy Outputs

Speed Mode must render these copy surfaces:

1. Status label
2. Action command
3. Risk warning
4. Price posture label
5. Strategy label
6. Talk track
7. Primary close ask
8. Backup close ask
9. Follow-up text
10. Proof captions

Optional rendered copy surfaces:

- pricing structure summary
- warning flag banner list
- controlled mode handoff explainer

## 6. Copy Generation Order

The copy layer should build output in this order:

1. load base copy by `status_key`
2. apply strategy modifier by `strategy_key`
3. apply required close ask by `close ask key`
4. inject forced phrases
5. append or render warning flags
6. generate proof captions
7. validate final output lengths and restrictions

Implementation rule:

- strategy may sharpen the money language
- strategy may never weaken the status

## 7. Style Rules

All Speed Mode copy obeys these rules.

### 7.1 Tone

- direct
- credible
- non-hyped
- field-usable
- action-oriented

### 7.2 Sentence Rules

- prefer short sentences
- avoid compound sentences unless needed for clarity
- avoid abstract phrasing
- prefer active voice

### 7.3 Banned Language

Do not use:

- `let me know`
- `just checking in`
- `if you're interested`
- `I think maybe`
- `probably not a big deal`
- `we can maybe figure it out`
- `this should totally solve it`

### 7.4 Certainty Rules

- never imply final scope unless status allows it
- never imply confirmed count when count is banded only
- never imply partial-scope resolution when entry option is suppressed

### 7.5 Jargon Rules

- no unnecessary jargon
- use trade language only when it improves clarity
- default to plain business language

## 8. Length Rules

### 8.1 Action Command

- 1 sentence
- target: 8-18 words

### 8.2 Risk Warning

- 1 sentence
- target: 8-18 words

### 8.3 Talk Track

- 3 parts:
  - observation
  - implication
  - next move
- target: 50-90 words total
- hard cap: 110 words

### 8.4 Close Asks

- 1 sentence each
- target: 10-22 words

### 8.5 Follow-up Text

- 1-3 sentences
- target: 30-75 words
- hard cap: 95 words

### 8.6 Proof Captions

- target: 2-8 words
- hard cap: 10 words

## 9. Workflow-Specific Tokens

The copy layer may receive optional display tokens from the workflow context.

Allowed optional tokens:

- `property_name`
- `scope_noun`
- `site_noun`

Examples:

- `scope_noun = terminations`
- `site_noun = property`

Rules:

- if not present, use generic wording:
  - `scope`
  - `site`
- tokens are display-only
- tokens must not change status or strategy

## 10. Base Copy by Status

Each status defines the base frame before strategy modifiers are applied.

---

## 10A. `do_not_price_secure_access`

### Base Action Command

`Do not give pricing. Secure access and verify scope first.`

### Base Risk Warning

`Scope is too uncertain for any reliable number.`

### Base Talk Track

`What I’m seeing is not enough to put a responsible number on this yet. Pricing it now would be guesswork and that does not help either side. The right next step is to verify access, confirm scope, and get the right person involved before we talk pricing.`

### Base Follow-up Text

`Thanks for the time today. Based on limited field visibility, I do not want to put pricing on this until scope is verified. The next step is confirming access and the right review path so I can give you something reliable.`

---

## 10B. `range_only_qualify`

### Base Action Command

`Use soft range language only and qualify the next step.`

### Base Risk Warning

`Use range language only. Do not imply confirmed scope.`

### Base Talk Track

`What I’m seeing is enough to justify a pricing conversation, but not enough to frame this as fully confirmed. That means the number should stay soft while we qualify scope, access, and the approval path. The right next step is to use a range to test interest and move this toward a cleaner next step.`

### Base Follow-up Text

`Thanks for the time today. Based on limited field visibility, this is still a range-only situation until scope is confirmed. The next move is to qualify access, approval, or walkthrough timing so we can advance it properly.`

---

## 10C. `present_range_book_walkthrough`

### Base Action Command

`Use a budgetary range to move toward a walkthrough.`

### Base Risk Warning

`Do not imply final scope is fully confirmed.`

### Base Talk Track

`What I’m seeing is enough to frame a real budgetary range and move the conversation forward. That creates a useful pricing posture, but it still does not mean final scope is locked. The right next step is to use the range to create momentum and get the walkthrough booked so the number can tighten.`

### Base Follow-up Text

`Thanks for the time today. Based on what I saw, there is enough here to frame a budgetary range and keep this moving. The next step is locking in a walkthrough so scope can be confirmed and the pricing can be tightened.`

---

## 10D. `deliver_estimate_ask_approval`

### Base Action Command

`Deliver estimate posture and ask for the approval path.`

### Base Risk Warning

`New scope details can still affect final margin if facts change.`

### Base Talk Track

`What I’m seeing supports an estimate-ready posture instead of a purely exploratory range. That means we can move the conversation toward written pricing and approval instead of staying in discovery mode. The right next step is to deliver the estimate cleanly, confirm the approval path, and keep the process from stalling.`

### Base Follow-up Text

`Thanks for the time today. Based on what I saw, this is ready for estimate-level follow-up rather than a loose exploratory range. The next step is confirming the approval path and getting the right people included so this can move without delay.`

---

## 10E. `escalate_internal`

### Base Action Command

`Route internally before pricing and confirm the review path now.`

### Base Risk Warning

`Hazard, access, or complexity makes field pricing unsafe.`

### Base Talk Track

`What I’m seeing points to a condition that should not be priced casually in the field. The issue is not just uncertainty, it is that hazard, access, or complexity can distort scope and margin if we force an answer too early. The right next step is to secure the proof, confirm the stakeholders, and route this for proper internal review before pricing.`

### Base Follow-up Text

`Thanks for the time today. Based on what I saw, this needs internal review before pricing is put against it. The next step is confirming the right contact and routing path so the review can happen properly.`

## 11. Pricing Strategy Modifiers

After base status copy is loaded, apply one strategy modifier.

---

## 11A. `no_pricing_strategy`

### Purpose

Keep the conversation on access, review, or verification.

### Modifier Behavior

- do not introduce money-forward language
- keep next move focused on verification

### Talk Track Modifier

Replace or sharpen implication with:

`A number here would be guesswork, not a responsible estimate.`

### Follow-up Modifier

Add:

`I would rather verify this properly than give you an unreliable number.`

---

## 11B. `urgency_safety`

### Purpose

Sharpen the implication around risk, safety, or operational downside.

### Modifier Behavior

- increase urgency
- do not cross into fear theater
- keep language tied to visible evidence

### Talk Track Modifier

Use implication fragment:

`That can leave ongoing risk, service disruption, or safety exposure in place if it sits.`

### Follow-up Modifier

Add one sentence:

`Because the visible condition suggests real risk, this should be reviewed or addressed promptly rather than left open-ended.`

---

## 11C. `bundle_portfolio`

### Purpose

Frame the opportunity as repeatable, scalable, or broader than a one-off fix.

### Modifier Behavior

- only apply when repeatable scope is credible
- do not fake scale

### Talk Track Modifier

Use implication fragment:

`This looks like the kind of scope that often makes more sense as a repeatable plan than a one-off reaction.`

### Follow-up Modifier

Add one sentence:

`If the first section performs the way it should, this can be structured more broadly without reinventing the process each time.`

---

## 11D. `anchor_high_phased`

### Purpose

Lead with full-scope value while preserving a valid phase path.

### Modifier Behavior

- frame full scope first
- phase second
- never let the phase sound like the full fix

### Talk Track Modifier

Use next-move fragment:

`The best path is to frame the full scope first and phase execution only if that helps approval move faster.`

### Follow-up Modifier

Add one sentence:

`We can frame the full scope first and, if needed, break execution into a valid first phase without losing sight of the larger issue.`

---

## 11E. `test_close_small_section`

### Purpose

Reduce buyer resistance with a limited first move.

### Modifier Behavior

- present the smaller step as validation, not as a disguised full solution

### Talk Track Modifier

Use next-move fragment:

`If it helps reduce friction, we can start with a smaller first section and use that to validate the larger path.`

### Follow-up Modifier

Add one sentence:

`If the easiest first move is a smaller section, we can structure it that way without pretending it resolves the full site.`

## 12. Close Ask Library

These are locked strings by close ask key.

### 12.1 `secure_access_primary`

`Can we get access to verify the actual scope so I can give you something reliable instead of guessing?`

### 12.2 `secure_access_backup`

`Who would need to approve a walkthrough or access check on your end?`

### 12.3 `range_only_primary`

`Based on limited visibility, I can keep this in a soft range, but the right next step is qualifying it properly. Can we set that up?`

### 12.4 `range_only_backup`

`Would it make more sense to confirm access first or identify who signs off on the next step?`

### 12.5 `book_walkthrough_primary`

`Based on what I’m seeing, the next move is to lock in a walkthrough so we can firm this up and keep the process moving.`

### 12.6 `book_walkthrough_backup`

`Would later this week or early next week work better for getting that walkthrough done?`

### 12.7 `approval_primary`

`If this scope looks aligned with what you need, what is the approval path on your side so we can keep it moving?`

### 12.8 `approval_backup`

`Is there anyone else who should be included before I send this over for review?`

### 12.9 `escalate_primary`

`This one needs internal review before I put pricing against it. Can I confirm the right contact and next step so we get this turned properly?`

### 12.10 `escalate_backup`

`Who should receive the review package once we’ve assessed the full complexity?`

## 13. Forced Phrase Injection Rules

The copy layer must append or embed forced phrases from overlays.

### 13.1 Injection Priority

Inject in this order:

1. access verification phrase
2. limited visibility phrase
3. range-only-until-confirmed phrase
4. full-scope review phrase

### 13.2 Allowed Injection Locations

Forced phrases may be inserted into:

- talk track implication
- talk track next move
- follow-up second sentence

Forced phrases may not be inserted into:

- status label
- action command
- close ask

### 13.3 Forced Phrase Deduplication

- if a required phrase meaning is already present, do not duplicate it word-for-word
- preserve the rule intent even if the exact wording is lightly adapted

## 14. Warning Flag Rendering Rules

Warning flags are rendered separately from the main talk track.

### 14.1 Render Location

- show as warning chips or short banner lines
- do not bury them inside follow-up text

### 14.2 Warning Tone

- cautionary
- short
- not dramatic

### 14.3 Maximum Warning Count

- display up to 3 warning flags in Speed Mode
- if more exist, prioritize by resolver order

## 15. Talk Track Construction Rule

The talk track must render in this exact structure:

1. Observation sentence
2. Implication sentence
3. Next-move sentence

### 15.1 Talk Track Template

`What I’m seeing is [observation]. [Implication]. [Next move].`

### 15.2 Observation Source

Observation should be derived from:

- `visible_condition`
- `access`
- `property_type`
- proof context if available

### 15.3 Observation Mapping

Use this base observation map:

- `low`
  - `a lighter visible condition that still justifies attention`
- `moderate`
  - `a visible condition that suggests real maintenance scope`
- `heavy`
  - `a heavier visible condition that likely runs beyond a surface issue`
- `hazardous`
  - `a visible condition that points to elevated risk or corrective scope`
- `unknown`
  - `limited visibility that does not support strong field certainty yet`

### 15.4 Access Modifier

Append access nuance when useful:

- `easy`
  - no modifier needed
- `mixed`
  - `with uneven access conditions across the site`
- `difficult`
  - `with difficult access affecting how this would be executed`
- `unknown`
  - `with access still needing verification`

## 16. Follow-Up Text Construction Rule

Every follow-up text should have:

1. thanks / recap
2. status-matched summary
3. next-step ask

### 16.1 Template

`Thanks for the time today. Based on what I saw, [status-matched summary]. The next step is [action or ask].`

### 16.2 Follow-Up Rules

- never end with `let me know`
- always end with a next-step ask or scheduling prompt
- do not exceed 3 sentences
- if `decision_maker_present = no`, bias the last sentence toward stakeholder identification

## 17. Proof Caption Rules

Proof captions should be operational, not decorative.

### 17.1 Caption Map

- `hazard_photo`
  - `Hazard visible`
- `blocked_termination_photo`
  - `Blocked termination`
- `access_limitation_photo`
  - `Access constraint`
- `repeated_condition_photo`
  - `Repeated condition`
- `count_or_scale_photo`
  - `Scale indicator`
- `rep_observation_tag`
  - `Field note`

### 17.2 Proof Subtitle Rule

If subtitles are rendered, use:

- `Supports urgency`
- `Supports access verification`
- `Supports scale`
- `Supports repeatable scope`

Subtitles should be derived from strategy and status, not chosen freely.

## 18. Copy Validation Rules

Before rendering final copy, validate:

1. no banned phrases
2. no contradiction with `copy_policy`
3. no final-price language when blocked
4. no partial-scope implication when entry option is suppressed
5. close ask exists
6. follow-up ends with a live next step

If validation fails:

- fall back to base status copy
- preserve forced phrases
- preserve close ask mapping

## 19. Rep Edit Rules

Speed Mode allows rep copy editing with limits.

Allowed:

- edit talk track
- edit follow-up text
- edit proof ordering

Not allowed:

- edit status
- edit strategy
- remove required phrases without replacement meaning
- remove mandatory risk posture

Implementation recommendation:

- edits should start from generated copy
- system should always be able to regenerate the base version

## 20. Example Output Bundle

### Input Conditions

- status: `present_range_book_walkthrough`
- strategy: `anchor_high_phased`
- forced phrases:
  - `range only until scope is confirmed`
- warning:
  - `range should account for uneven access conditions`

### Example Action Command

`Use a budgetary range to move toward a walkthrough.`

### Example Risk Warning

`Do not imply final scope is fully confirmed.`

### Example Talk Track

`What I’m seeing is a visible condition that suggests real maintenance scope, with uneven access conditions across the site. That is enough to frame a budgetary number, but it is still range only until scope is confirmed. The right next step is to frame the full scope first, then use a walkthrough to tighten the number and keep the process moving.`

### Example Primary Close Ask

`Based on what I’m seeing, the next move is to lock in a walkthrough so we can firm this up and keep the process moving.`

### Example Follow-Up Text

`Thanks for the time today. Based on what I saw, there is enough here to frame a budgetary range, but it remains range only until scope is confirmed. The next step is locking in a walkthrough so we can tighten scope and move this forward properly.`

## 21. Locked Decisions

These are locked for v1:

- copy is status-led
- strategy modifies copy, not truth
- close asks are keyed to status only
- forced phrases are mandatory
- follow-up text must be action-oriented
- proof captions are operational, not decorative

## 22. What Comes Next

The next build-facing artifact should be the `Speed Mode Wireframe Spec`.

That spec should define:

- exact screen zones
- desktop and mobile order
- card placement
- copy button placement
- proof placement
- handoff placement
