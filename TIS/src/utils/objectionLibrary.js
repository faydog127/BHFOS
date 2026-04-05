const OBJECTION_LIBRARY = {
  partial_scope: {
    category: "Scope",
    if_they_say: "Can we just do a few buildings or units?",
    what_they_mean: "They want to reduce immediate spend without rejecting you outright.",
    respond_with: {
      safety:
        "We can stage it, but with blocked or restricted terminations showing up like this, it usually needs to be handled more broadly to actually solve the issue.",
      repeat_service:
        "We can break it up, but when buildup is this consistent, it usually keeps turning into repeat calls elsewhere.",
      process_gap:
        "We can start smaller, but the pattern suggests the underlying issue may still stay in place unless it’s addressed more systematically.",
      watch: "We can stage it, but I’d want to confirm scope so the smaller section doesn’t misrepresent the issue."
    },
    your_goal: {
      safety: "Protect full-scope positioning.",
      repeat_service: "Shift from isolated work to broader maintenance logic.",
      process_gap: "Keep them from defaulting to patchwork.",
      watch: "Avoid under-scoping before confirmation."
    },
    best_next_move: {
      safety: "Offer phased scheduling, not reduced scope.",
      repeat_service: "Position a property-wide plan with staged timing.",
      process_gap: "Offer a baseline walkthrough to confirm scope.",
      watch: "Confirm scope before quoting."
    }
  },
  price_high: {
    category: "Budget",
    if_they_say: "That seems high.",
    what_they_mean: "They need justification, not necessarily a lower number.",
    respond_with: {
      safety:
        "A lot of that comes from the number of terminations and the fact that this is beyond routine buildup in multiple areas.",
      repeat_service:
        "The range reflects the total number of terminations and that the issue looks spread across the property, not isolated.",
      process_gap:
        "Most of the cost is in getting ahead of repeated patchwork and handling the scope correctly the first time.",
      watch: "Once we confirm count and access, I can tighten the range and keep it accurate.",
      low_confidence:
        "Totally fair. Once we confirm count and access, I can tighten the range and keep it accurate."
    },
    your_goal: {
      safety: "Tie price to scope and condition.",
      repeat_service: "Re-anchor price to size and repeat pattern.",
      process_gap: "Frame price as corrective value.",
      watch: "Defer firm pricing until scope is confirmed."
    },
    best_next_move: {
      safety: "Repoint to assumptions and scope drivers.",
      repeat_service: "Confirm termination count and access.",
      process_gap: "Offer a phased plan after walkthrough.",
      watch: "Schedule a walkthrough."
    }
  },
  already_have_vendor: {
    category: "Process",
    if_they_say: "We already have a vendor.",
    what_they_mean: "They don’t want extra work unless the current setup is clearly weak.",
    respond_with: {
      safety: "Got it. Are they handling this on a schedule, or more once issues show up?",
      repeat_service:
        "Understood. Is that helping reduce repeat dryer or vent-related calls, or is it still coming back?",
      process_gap:
        "Got it. Is their work part of a property-wide plan, or more case-by-case when something comes up?",
      watch: "Understood. Is their work scheduled, or handled when issues arise?"
    },
    your_goal: {
      safety: "Expose whether the current system is reactive.",
      repeat_service: "Make performance the issue, not loyalty.",
      process_gap: "Surface process weakness without attacking.",
      watch: "Learn how service is handled today."
    },
    best_next_move: {
      safety: "Offer documentation they can compare.",
      repeat_service: "Offer a baseline assessment.",
      process_gap: "Offer a schedule recommendation.",
      watch: "Gather workflow details."
    }
  },
  need_to_think: {
    category: "Timing",
    if_they_say: "I need to think about it.",
    what_they_mean: "They want a way to review internally without committing on-site.",
    respond_with: {
      default:
        "Of course. Would it help if I sent over a simple quote and vendor packet so you have something concrete to review?"
    },
    your_goal: {
      default: "Advance to documented follow-up."
    },
    best_next_move: {
      default: "Send quote range + vendor packet."
    }
  },
  send_me_something: {
    category: "Process",
    if_they_say: "Send me something.",
    what_they_mean: "They need a leave-behind or something to forward.",
    respond_with: {
      default:
        "Absolutely. I can send a quote range and our vendor package over right now so you have it while this is still fresh."
    },
    your_goal: {
      default: "Move immediately to quote/package delivery."
    },
    best_next_move: {
      default: "Send quote + vendor packet."
    }
  },
  not_urgent: {
    category: "Timing",
    if_they_say: "It’s not urgent.",
    what_they_mean: "They don’t feel enough pressure to act yet.",
    respond_with: {
      safety:
        "I understand. My concern is that once terminations are getting restricted like this, it usually doesn’t stay isolated.",
      repeat_service:
        "Totally fair. The reason I’m bringing it up is that this type of buildup usually keeps showing back up as repeated service calls.",
      process_gap:
        "Understood. This may not be urgent today, but the current pattern usually keeps maintenance stuck in reaction mode.",
      watch: "Understood. A walkthrough now keeps options open when timing is better."
    },
    your_goal: {
      safety: "Raise urgency without sounding dramatic.",
      repeat_service: "Shift from urgency to cost of delay.",
      process_gap: "Frame in operational terms.",
      watch: "Keep a path open without pressure."
    },
    best_next_move: {
      safety: "Offer walkthrough scheduling.",
      repeat_service: "Offer a maintenance schedule option.",
      process_gap: "Offer a baseline inspection.",
      watch: "Schedule a follow-up."
    }
  },
  just_quote_a_few: {
    category: "Scope",
    if_they_say: "Just quote me a few units.",
    what_they_mean: "They want a low anchor without committing to full scope.",
    respond_with: {
      safety:
        "I can give a limited quote, but I’d want to be clear that with the conditions we saw, that probably won’t represent the real scope.",
      repeat_service:
        "I can price a smaller section, but with buildup this widespread, it usually doesn’t stay contained to that section.",
      process_gap:
        "I can quote a subset, but it’s hard to make that represent the full pattern without confirming the rest.",
      watch: "I can, but it would be a placeholder until we confirm the full scope."
    },
    your_goal: {
      safety: "Protect against misleading low-scope quoting.",
      repeat_service: "Keep broader pattern visible.",
      process_gap: "Avoid anchoring to incomplete scope.",
      watch: "Set expectations for a follow-up scope check."
    },
    best_next_move: {
      safety: "Offer phased scope with clear assumptions.",
      repeat_service: "Offer a building-level plan.",
      process_gap: "Confirm the rest of the scope.",
      watch: "Walkthrough before final pricing."
    }
  },
  regional_has_to_approve: {
    category: "Process",
    if_they_say: "Regional would have to approve this.",
    what_they_mean: "They need a clean, forwardable package to send up.",
    respond_with: {
      default:
        "That makes sense. I can send a clean quote and vendor packet you can forward, and keep the scope clear for review."
    },
    your_goal: {
      default: "Support internal forwarding and reduce friction."
    },
    best_next_move: {
      default: "Generate a forwardable packet."
    }
  }
};

const DEFAULT_ORDER = ["partial_scope", "price_high", "send_me_something"];
const REGIONAL_ORDER = ["already_have_vendor", "regional_has_to_approve", "send_me_something"];
const LOW_CONFIDENCE_ORDER = ["need_to_think", "send_me_something", "partial_scope"];

const replaceTokens = (template, context) =>
  template.replace(/\{(\w+)\}/g, (_, token) => context[token] ?? "");

const pickAngleText = (entry, angle, quoteReadiness) => {
  if (!entry) return "";
  if (typeof entry === "string") return entry;
  if (quoteReadiness === "Walkthrough required" && entry.low_confidence) {
    return entry.low_confidence;
  }
  return entry[angle] || entry.default || entry.watch || "";
};

const buildCard = (type, angle, quoteReadiness, context = {}) => {
  const entry = OBJECTION_LIBRARY[type];
  if (!entry) return null;
  const ifTheySay = entry.if_they_say;
  const respondWith = pickAngleText(entry.respond_with, angle, quoteReadiness);
  const yourGoal = pickAngleText(entry.your_goal, angle, quoteReadiness);
  const whatTheyMean = pickAngleText(entry.what_they_mean, angle, quoteReadiness);
  const bestNextMove = pickAngleText(entry.best_next_move, angle, quoteReadiness);
  return {
    type,
    objection_type: entry.category,
    if_they_say: ifTheySay,
    what_they_mean: whatTheyMean,
    respond_with: replaceTokens(respondWith, context),
    your_goal: replaceTokens(yourGoal, context),
    best_next_move: replaceTokens(bestNextMove, context)
  };
};

export const getObjectionCards = ({
  angle,
  quoteReadiness,
  recommendedApproach,
  regionalDetected,
  context = {}
}) => {
  let types = [...DEFAULT_ORDER];

  if (quoteReadiness === "Walkthrough required") {
    types = [...LOW_CONFIDENCE_ORDER];
  }

  if (regionalDetected) {
    types = [...REGIONAL_ORDER];
  }

  if (recommendedApproach && recommendedApproach.toLowerCase().includes("full")) {
    if (!types.includes("partial_scope")) {
      types = ["partial_scope", ...types.filter((item) => item !== "partial_scope")];
      types = types.slice(0, 3);
    }
  }

  return types
    .map((type) => buildCard(type, angle, quoteReadiness, context))
    .filter(Boolean)
    .slice(0, 3);
};
