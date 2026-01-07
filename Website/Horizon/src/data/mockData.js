/**
 * @typedef {Object} MockLead
 * @property {string} id
 * @property {string} name
 * @property {string} company
 * @property {string} phone
 * @property {number} score
 * @property {string} heat
 * @property {string} bestTime
 * @property {string} roleTag
 * @property {string} personaVariant - Used to lookup replies
 * @property {string} address - For property inspection
 */

/**
 * Mock data for leads.
 * @type {MockLead[]}
 */
export const mockLeads = [
  {
    id: 'lead-1',
    name: 'Alice Johnson',
    company: 'Brevard Property Management',
    phone: '555-0101',
    score: 85,
    heat: 'HOT',
    bestTime: 'Morning',
    roleTag: 'Decision Maker',
    personaVariant: 'DM_HIRING',
    address: '123 Ocean Breeze Blvd, Melbourne, FL 32901'
  },
  {
    id: 'lead-2',
    name: 'Bob Williams',
    company: 'Sunshine Condos HOA',
    phone: '555-0102',
    score: 70,
    heat: 'WARM',
    bestTime: 'Afternoon',
    roleTag: 'Influencer',
    personaVariant: 'GATEKEEPER_PERMITS',
    address: '456 Palm Way, Cocoa Beach, FL 32931'
  },
  {
    id: 'lead-3',
    name: 'Charlie Brown',
    company: 'Coastal Resorts Inc.',
    phone: '555-0103',
    score: 92,
    heat: 'HOT',
    bestTime: 'Anytime',
    roleTag: 'Executive',
    personaVariant: 'EXEC_COMPLIANCE',
    address: '789 Surfside Dr, Indialantic, FL 32903'
  },
  {
    id: 'lead-4',
    name: 'Diana Prince',
    company: 'Global Tech Facilities',
    phone: '555-0104',
    score: 60,
    heat: 'COLD',
    bestTime: 'Late Afternoon',
    roleTag: 'Researcher',
    personaVariant: 'RESEARCHER_BUDGET',
    address: '101 Innovation Way, Viera, FL 32940'
  },
];

/**
 * Mock Company Intelligence keyed by Lead ID.
 * Provides deep insights for the active caller.
 */
export const mockCompanyIntel = {
  'lead-1': {
    painSignals: [
      "Recent negative reviews mentioning 'moldy smell'",
      "Permit pulled for HVAC repair last month",
      "Active expansion: hired 2 new facility managers"
    ],
    aiInsight: "Alice is likely under pressure to resolve tenant complaints before lease renewals next month. She values speed over price.",
    recommendedApproach: "Lead with the 'Same-Day Certification' benefit. Mention you can help clear the air quality complaints permanently.",
    gatekeeperIntel: "Receptionist 'Sarah' is very protective. Mention you are returning Alice's call regarding the 'compliance report'."
  },
  'lead-2': {
    painSignals: [
      "Budget committee meeting minutes mention 'deferred maintenance'",
      "Old building (1985) with original ductwork likely"
    ],
    aiInsight: "Bob is an influencer, not the check signer. He needs ammunition to convince the board. Focus on liability reduction.",
    recommendedApproach: "Educate on the fire safety risks of lint buildup in shared laundry vents. Offer a free visual inspection as a 'no-risk' first step.",
    gatekeeperIntel: "Direct line usually goes to voicemail. Best to call between 2-4 PM."
  },
  'lead-3': {
    painSignals: [
      "Corporate mandate for 'Green Building' certification",
      "High energy bills reported in quarterly earnings"
    ],
    aiInsight: "Charlie is focused on ROI and ESG goals. He doesn't care about 'cleaning', he cares about 'efficiency' and 'compliance'.",
    recommendedApproach: "Pitch the 'Energy Savings Audit'. Show how cleaner coils and ducts reduce HVAC load by up to 25%.",
    gatekeeperIntel: "Executive Assistant 'James' handles his calendar. Ask for a 5-minute slot to 'review energy audit results'."
  },
  'lead-4': {
    painSignals: [
      "Searching for 'commercial duct cleaning pricing' on website",
      "Downloaded 'Vendor Packet'"
    ],
    aiInsight: "Diana is gathering quotes for a future project. She is price-sensitive but values transparency.",
    recommendedApproach: "Be upfront about pricing models. offer the 'Budgetary Quote' without needing a site visit first.",
    gatekeeperIntel: "N/A - Direct line."
  }
};

/**
 * Mock Next Best Reply keyed by Persona/Variant.
 * This allows the UI to dynamic swap the suggested opening based on who is being called.
 */
export const mockNextBestReply = {
  // Decision Maker Variants
  "DM_HIRING": "Hi [Lead Name], this is [Your Name] with The Vent Guys. I saw your firm is expanding its property portfolio. Often, new acquisitions come with hidden 'deferred maintenance' like mold or allergens in the ducts. We help property managers clear those liability risks before tenants move in. Do you have 2 minutes to discuss your turnover checklist?",
  "DM_PERMITS": "Hi [Lead Name], [Your Name] here. I noticed a recent mechanical permit pulled for [Company Name]. Usually, when major HVAC work is done, the existing ductwork is left contaminated. We partner with owners to sanitize the full system so your new unit runs efficiently from day one. Have you thought about the air distribution side yet?",
  "DM_IAQ": "Alice, this is [Your Name]. I'm calling specifically about the tenant complaints regarding air quality at your property. We have a same-day diagnostic service that identifies if the issue is humidity, mold, or just dirty ducts. Can I send a tech out tomorrow to give you a definitive answer?",
  "DM_REVIEWS": "Hi [Lead Name], I saw a few recent reviews for your property mentioning 'stale air' or 'odors'. As a property manager, I know that hurts retention. The Vent Guys can perform a deodorizing fog treatment that eliminates those complaints immediately. Would you be open to a demo?",

  // Gatekeeper Variants
  "GATEKEEPER_HIRING": "Hi, I'm looking for the person managing the new property acquisitions. I have a vendor compliance packet regarding HVAC sanitization that I need to get to the right desk. Would that be [Lead Name]?",
  "GATEKEEPER_PERMITS": "Good morning. I'm following up on a permit filing for the HVAC repairs at [Company Name]. I have some safety compliance data for the board. Is [Lead Name] available, or should I leave a message with their assistant?",
  "GATEKEEPER_IAQ": "Hi, I'm returning a call regarding an air quality report for the building. It's somewhat urgent regarding tenant satisfaction. Is [Lead Name] in today?",
  "GATEKEEPER_REVIEWS": "Hello, I'm calling to help address some recent maintenance feedback seen online for the property. I have a solution that [Lead Name] will want to see before the next board meeting. Can you connect me?",
  
  // Fallback
  "DEFAULT": "Hi [Lead Name], I'm calling about the air quality report for your property. When would be a good time to discuss your free air check results?"
};

/**
 * Mock Anticipatory Replies (Objection Handling).
 * Generic list that can be filtered or prioritized.
 */
export const mockAnticipatoryReplies = [
  {
    label: 'Not interested / Happy with current vendor',
    ifTheySay: "We already have a guy for that.",
    youSay: "That's great—having a vendor is half the battle. Most of our best partners use us as a 'Second Opinion' for complex issues like mold remediation or laundry exhaust certification that general cleaners can't handle. Would you be open to a free 'audit' of your current vendor's work next time they finish a job, just to ensure you're getting what you pay for?"
  },
  {
    label: 'Too expensive / No budget',
    ifTheySay: "We don't have budget for this right now.",
    youSay: "I completely understand. Budgets are tight. However, dirty ducts are actively costing you money on your energy bill every month—often more than the cost of the cleaning itself. If I could show you a calculation on how this service pays for itself in energy savings within 8 months, would you be willing to look at a proposal?"
  },
  {
    label: 'Send me an email',
    ifTheySay: "Just email me some info.",
    youSay: "I'd be happy to. To make sure I don't clutter your inbox with irrelevant PDFs, what is the one biggest headache you have right now regarding your building's maintenance? I'll send you a solution specific to that."
  },
  {
    label: 'How did you get my number?',
    ifTheySay: "Who is this? How did you get this number?",
    youSay: "I'm calling from The Vent Guys here in Brevard County. We track public permit filings for HVAC replacements, which often indicate a need for system sanitization. I'm reaching out to ensure the new system isn't being compromised by old, contaminated ductwork."
  },
];