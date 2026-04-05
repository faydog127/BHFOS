const ZIP_ZONE_MAP = {
  // Zone 1 – South Brevard (BRV-S)
  "32907": { zone: "BRV-S", coverage_type: "active" },
  "32908": { zone: "BRV-S", coverage_type: "active" },
  "32905": { zone: "BRV-S", coverage_type: "active" },
  "32904": { zone: "BRV-S", coverage_type: "active" },
  "32909": { zone: "BRV-S", coverage_type: "prospect" },
  // Zone 2 – Central Brevard (BRV-C)
  "32901": { zone: "BRV-C", coverage_type: "active" },
  "32935": { zone: "BRV-C", coverage_type: "active" },
  "32940": { zone: "BRV-C", coverage_type: "active" },
  "32934": { zone: "BRV-C", coverage_type: "active" },
  "32903": { zone: "BRV-C", coverage_type: "prospect" },
  "32937": { zone: "BRV-C", coverage_type: "prospect" },
  // Zone 3 – North Brevard (BRV-N)
  "32780": { zone: "BRV-N", coverage_type: "active" },
  "32796": { zone: "BRV-N", coverage_type: "active" },
  "32926": { zone: "BRV-N", coverage_type: "active" },
  "32927": { zone: "BRV-N", coverage_type: "active" },
  "32953": { zone: "BRV-N", coverage_type: "active" },
  "32952": { zone: "BRV-N", coverage_type: "active" },
  "32920": { zone: "BRV-N", coverage_type: "active" },
  // Zone 4 – Volusia South (VOL-S)
  "32127": { zone: "VOL-S", coverage_type: "active" },
  "32129": { zone: "VOL-S", coverage_type: "active" },
  "32168": { zone: "VOL-S", coverage_type: "active" },
  "32128": { zone: "VOL-S", coverage_type: "active" },
  "32169": { zone: "VOL-S", coverage_type: "prospect" },
  // Zone 5 – Volusia Central (VOL-C)
  "32725": { zone: "VOL-C", coverage_type: "active" },
  "32738": { zone: "VOL-C", coverage_type: "active" },
  "32763": { zone: "VOL-C", coverage_type: "active" },
  "32713": { zone: "VOL-C", coverage_type: "active" },
  // Zone 6 – North Orlando Corridor (ORL-N)
  "32746": { zone: "ORL-N", coverage_type: "active" },
  "32771": { zone: "ORL-N", coverage_type: "active" },
  "32773": { zone: "ORL-N", coverage_type: "active" },
  "32701": { zone: "ORL-N", coverage_type: "active" },
  "32714": { zone: "ORL-N", coverage_type: "active" },
  "32750": { zone: "ORL-N", coverage_type: "active" },
  // Zone 7 – East Orlando (ORL-E)
  "32828": { zone: "ORL-E", coverage_type: "active" },
  "32826": { zone: "ORL-E", coverage_type: "active" },
  "32817": { zone: "ORL-E", coverage_type: "active" },
  "32825": { zone: "ORL-E", coverage_type: "active" },
  "32820": { zone: "ORL-E", coverage_type: "prospect" },
  // Zone 8 – Southeast Orlando (ORL-SE)
  "32822": { zone: "ORL-SE", coverage_type: "active" },
  "32824": { zone: "ORL-SE", coverage_type: "active" },
  "32827": { zone: "ORL-SE", coverage_type: "active" },
  "32832": { zone: "ORL-SE", coverage_type: "active" },
  // Zone 9 – South Orlando / Kissimmee (ORL-S)
  "32837": { zone: "ORL-S", coverage_type: "active" },
  "32821": { zone: "ORL-S", coverage_type: "active" },
  "34741": { zone: "ORL-S", coverage_type: "active" },
  "34743": { zone: "ORL-S", coverage_type: "active" },
  "34744": { zone: "ORL-S", coverage_type: "active" },
  "34746": { zone: "ORL-S", coverage_type: "active" },
  // Zone 10 – West / Southwest Orlando (ORL-W)
  "32819": { zone: "ORL-W", coverage_type: "active" },
  "32839": { zone: "ORL-W", coverage_type: "active" },
  "32835": { zone: "ORL-W", coverage_type: "active" },
  "32836": { zone: "ORL-W", coverage_type: "active" }
};

export const ZONE_LABELS = {
  "BRV-S": "Zone 1 – South Brevard (BRV-S)",
  "BRV-C": "Zone 2 – Central Brevard (BRV-C)",
  "BRV-N": "Zone 3 – North Brevard (BRV-N)",
  "VOL-S": "Zone 4 – Volusia South (VOL-S)",
  "VOL-C": "Zone 5 – Volusia Central (VOL-C)",
  "ORL-N": "Zone 6 – North Orlando (ORL-N)",
  "ORL-E": "Zone 7 – East Orlando (ORL-E)",
  "ORL-SE": "Zone 8 – Southeast Orlando (ORL-SE)",
  "ORL-S": "Zone 9 – South Orlando (ORL-S)",
  "ORL-W": "Zone 10 – West Orlando (ORL-W)"
};

export const ZONE_ORDER = [
  "BRV-S",
  "BRV-C",
  "BRV-N",
  "VOL-S",
  "VOL-C",
  "ORL-N",
  "ORL-E",
  "ORL-SE",
  "ORL-S",
  "ORL-W"
];

export function normalizeZip(zip) {
  const match = String(zip || "").match(/(\d{5})/);
  return match ? match[1] : "";
}

export function resolveZoneForZip(zip) {
  const normalized = normalizeZip(zip);
  if (!normalized) {
    return { in_ao: false, zone: "", coverage_type: "" };
  }
  const entry = ZIP_ZONE_MAP[normalized];
  if (!entry) {
    return { in_ao: false, zone: "", coverage_type: "" };
  }
  return { in_ao: true, zone: entry.zone, coverage_type: entry.coverage_type };
}
