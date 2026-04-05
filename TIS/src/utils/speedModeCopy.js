const STATUS_COPY = {
  do_not_price_secure_access: {
    action_command: "Do not give pricing. Secure access and verify scope first.",
    risk_warning: "Scope is too uncertain for any reliable number.",
    implication: "A number here would be guesswork, not a responsible estimate.",
    next_move:
      "The right next step is to verify access, confirm scope, and get the right person involved before you talk pricing.",
    follow_up_summary: "I do not want to put pricing on this until scope is verified."
  },
  range_only_qualify: {
    action_command: "Use soft range language only and qualify the next step.",
    risk_warning: "Use range language only. Do not imply confirmed scope.",
    implication:
      "That supports a pricing conversation, but only in range language while scope and access are still being qualified.",
    next_move:
      "The right next step is to use a soft range to test interest and move this toward a cleaner approval or walkthrough step.",
    follow_up_summary: "this is still a range-only situation until scope is confirmed."
  },
  present_range_book_walkthrough: {
    action_command: "Use a budgetary range to move toward a walkthrough.",
    risk_warning: "Do not imply final scope is fully confirmed.",
    implication:
      "That is enough to frame a real budgetary range and move the conversation forward, but it still does not mean final scope is locked.",
    next_move:
      "The right next step is to use the range to create momentum and get the walkthrough booked so the number can tighten.",
    follow_up_summary: "there is enough here to frame a budgetary range and keep this moving."
  },
  deliver_estimate_ask_approval: {
    action_command: "Deliver estimate posture and ask for the approval path.",
    risk_warning: "New scope details can still affect final margin if facts change.",
    implication:
      "That supports an estimate-ready posture instead of a purely exploratory range.",
    next_move:
      "The right next step is to deliver the estimate cleanly, confirm the approval path, and keep the process from stalling.",
    follow_up_summary: "this is ready for estimate-level follow-up rather than a loose exploratory range."
  },
  escalate_internal: {
    action_command: "Route internally before pricing and confirm the review path now.",
    risk_warning: "Hazard, access, or complexity makes field pricing unsafe.",
    implication:
      "That points to hazard, access, or complexity that should not be priced casually in the field.",
    next_move:
      "The right next step is to secure the proof, confirm the stakeholders, and route this for proper internal review before pricing.",
    follow_up_summary: "this needs internal review before pricing is put against it."
  }
};

const STRATEGY_MODIFIERS = {
  no_pricing_strategy: {
    implication: "A number here would be guesswork, not a responsible estimate.",
    follow_up_clause: "I would rather verify this properly than give you an unreliable number"
  },
  urgency_safety: {
    implication:
      "That can leave ongoing risk, service disruption, or safety exposure in place if it sits.",
    follow_up_clause:
      "Because the visible condition suggests real risk, this should be reviewed or addressed promptly rather than left open-ended"
  },
  bundle_portfolio: {
    implication:
      "This looks like the kind of scope that often makes more sense as a repeatable plan than a one-off reaction.",
    follow_up_clause:
      "If the first section performs the way it should, this can be structured more broadly without reinventing the process each time"
  },
  anchor_high_phased: {
    next_move:
      "The best path is to frame the full scope first and phase execution only if that helps approval move faster.",
    follow_up_clause:
      "We can frame the full scope first and, if needed, break execution into a valid first phase without losing sight of the larger issue"
  },
  test_close_small_section: {
    next_move:
      "If it helps reduce friction, you can start with a smaller first section and use that to validate the larger path.",
    follow_up_clause:
      "If the easiest first move is a smaller section, it can be structured that way without pretending it resolves the full site"
  }
};

export const SPEED_MODE_CLOSE_ASK_COPY = {
  secure_access_primary:
    "Can we get access to verify the actual scope so I can give you something reliable instead of guessing?",
  secure_access_backup:
    "Who would need to approve a walkthrough or access check on your end?",
  range_only_primary:
    "Based on limited visibility, I can keep this in a soft range, but the right next step is qualifying it properly. Can we set that up?",
  range_only_backup:
    "Would it make more sense to confirm access first or identify who signs off on the next step?",
  book_walkthrough_primary:
    "Based on what I’m seeing, the next move is to lock in a walkthrough so you can firm this up and keep the process moving.",
  book_walkthrough_backup:
    "Would later this week or early next week work better for getting that walkthrough done?",
  approval_primary:
    "If this scope looks aligned with what you need, what is the approval path on your side so you can keep it moving?",
  approval_backup:
    "Is there anyone else who should be included before you send this over for review?",
  escalate_primary:
    "This one needs internal review before you put pricing against it. Can you confirm the right contact and next step so it gets turned properly?",
  escalate_backup:
    "Who should receive the review package once the full complexity has been assessed?"
};

export const SPEED_MODE_PROOF_CAPTIONS = {
  hazard_photo: "Hazard visible",
  blocked_termination_photo: "Blocked termination",
  access_limitation_photo: "Access constraint",
  repeated_condition_photo: "Repeated condition",
  count_or_scale_photo: "Scale indicator",
  rep_observation_tag: "Field note"
};

function trimClause(value) {
  return String(value || "")
    .trim()
    .replace(/[.]+$/, "");
}

function ensureSentence(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function buildObservation(input) {
  const observationMap = {
    low: "a lighter visible condition that still justifies attention",
    moderate: "a visible condition that suggests real maintenance scope",
    heavy: "a heavier visible condition that likely runs beyond a surface issue",
    hazardous: "a visible condition that points to elevated risk or corrective scope",
    unknown: "limited visibility that does not support strong field certainty yet"
  };
  const accessMap = {
    mixed: "with uneven access conditions across the site",
    difficult: "with difficult access affecting how this would be executed",
    unknown: "with access still needing verification"
  };

  const base = observationMap[input?.visible_condition] || observationMap.unknown;
  const accessModifier = accessMap[input?.access] ? ` ${accessMap[input.access]}` : "";
  return `${base}${accessModifier}`;
}

function appendPhrase(sentence, phrase) {
  const safeSentence = trimClause(sentence);
  const safePhrase = trimClause(phrase);
  if (!safeSentence) return safePhrase;
  if (safeSentence.toLowerCase().includes(safePhrase.toLowerCase())) return safeSentence;
  return `${safeSentence} ${safePhrase}`;
}

function sanitizeCopy(value) {
  return String(value || "")
    .replace(/\blet me know\b/gi, "use the next step below")
    .replace(/\bjust checking in\b/gi, "following up")
    .replace(/\bif you're interested\b/gi, "if that path works")
    .replace(/\bI think maybe\b/gi, "I want to be direct")
    .replace(/\bprobably not a big deal\b/gi, "worth reviewing")
    .replace(/\bwe can maybe figure it out\b/gi, "we can verify it properly")
    .replace(/\bthis should totally solve it\b/gi, "this should be framed against the full scope");
}

export function composeSpeedModeCopy(resolverOutput, context = {}) {
  if (!resolverOutput?.valid) {
    return {
      actionCommand: "",
      riskWarning: "",
      talkTrack: "",
      followUpText: "",
      primaryCloseAsk: "",
      backupCloseAsk: "",
      proofCaptionMap: { ...SPEED_MODE_PROOF_CAPTIONS }
    };
  }

  const { input, resolution, action, pricing, close, overlays } = resolverOutput;
  const base = STATUS_COPY[resolution.status_key] || STATUS_COPY.range_only_qualify;
  const modifier = STRATEGY_MODIFIERS[pricing.strategy_key] || {};

  let implication = modifier.implication || base.implication;
  let nextMove = modifier.next_move || base.next_move;
  const forcedPhrases = overlays?.applied_forced_phrases || [];

  for (const phrase of forcedPhrases) {
    if (phrase === "subject to access verification") {
      nextMove = appendPhrase(nextMove, "This remains subject to access verification");
    } else if (phrase === "based on limited field visibility") {
      implication = appendPhrase(implication, "This is based on limited field visibility");
    } else if (phrase === "range only until scope is confirmed") {
      implication = appendPhrase(implication, "It remains range only until scope is confirmed");
    } else if (phrase === "this may require full-scope review before pricing") {
      nextMove = appendPhrase(nextMove, "This may require full-scope review before pricing");
    }
  }

  const talkTrack = sanitizeCopy(
    [
      ensureSentence(`What I'm seeing is ${buildObservation(input)}`),
      ensureSentence(implication),
      ensureSentence(nextMove)
    ]
      .filter(Boolean)
      .join(" ")
  );

  const primaryCloseAsk = SPEED_MODE_CLOSE_ASK_COPY[close.primary_close_ask_key] || "";
  const backupCloseAsk = SPEED_MODE_CLOSE_ASK_COPY[close.backup_close_ask_key] || "";
  const followUpAsk =
    input.decision_maker_present === "no" || input.decision_maker_present == null
      ? backupCloseAsk
      : primaryCloseAsk;
  const modifierClause = trimClause(modifier.follow_up_clause);
  const followUpDetail = [trimClause(base.follow_up_summary), modifierClause].filter(Boolean).join(" ");
  const followUpText = sanitizeCopy(
    [
      "Thanks for the time today.",
      ensureSentence(`Based on what I saw, ${followUpDetail}`),
      ensureSentence(followUpAsk)
    ]
      .filter(Boolean)
      .join(" ")
  );

  return {
    statusLabel: resolution.status_label,
    actionCommand: action.action_command || base.action_command,
    riskWarning: action.risk_warning || base.risk_warning,
    pricePostureLabel: context.pricePostureLabel || "",
    strategyLabel: pricing.strategy_label || "",
    talkTrack,
    followUpText,
    primaryCloseAsk,
    backupCloseAsk,
    proofCaptionMap: { ...SPEED_MODE_PROOF_CAPTIONS }
  };
}
