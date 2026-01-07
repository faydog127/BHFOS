export const SERVICE_CATALOG = [
  { 
    id: 'free_air_check',
    name: "Free Air Check", 
    description: "Visual inspection of accessible vents and returns.",
    price: 0, 
    type: 'assessment',
    category: 'audit'
  },
  { 
    id: 'air_audit',
    name: "In-Home Air Audit", 
    description: "Laser particle count, humidity mapping, and digital report.",
    price: 149, 
    type: 'assessment',
    category: 'audit',
    upgrades_from: ['free_air_check']
  },
  { 
    id: 'duct_cleaning_base',
    name: "Primary HVAC System Cleaning", 
    description: "Negative air cleaning for 1 system (up to 12 vents).",
    price: 299, 
    type: 'service',
    category: 'duct',
    pricing_model: 'per_vent' // Added flag
  },
  { 
    id: 'dryer_vent_cleaning',
    name: "Dryer Vent Cleaning", 
    description: "Rotary brush cleaning from exterior termination ($50/vent).",
    price: 50, 
    type: 'service',
    category: 'dryer',
    pricing_model: 'per_vent' // Added flag
  },
  { 
    id: 'sanitizer',
    name: "Antimicrobial Fogging", 
    description: "System-wide sanitization treatment.",
    price: 49, 
    type: 'addon',
    category: 'chemical'
  },
  { 
    id: 'coil_cleaning',
    name: "Coil Cleaning", 
    description: "Chemical cleaning of evaporator coils.",
    price: 149, 
    type: 'addon',
    category: 'hvac_maintenance'
  }
];

export const getServiceById = (id) => SERVICE_CATALOG.find(s => s.id === id);

export const getPotentialUpgrades = (currentServiceIds) => {
  return SERVICE_CATALOG.filter(service => 
    service.upgrades_from && 
    service.upgrades_from.some(fromId => currentServiceIds.includes(fromId))
  );
};