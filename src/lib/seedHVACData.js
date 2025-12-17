import { supabase } from '@/lib/customSupabaseClient';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generates realistic HVAC and Mechanical contractor prospect data
 * for Central Florida counties (Orange, Volusia, Seminole, Brevard)
 */

const COUNTIES = ['Orange', 'Volusia', 'Seminole', 'Brevard'];

const CITIES_BY_COUNTY = {
  Orange: ['Orlando', 'Winter Park', 'Apopka', 'Maitland', 'Ocoee', 'Winter Garden'],
  Volusia: ['Daytona Beach', 'Deltona', 'Ormond Beach', 'DeLand', 'Port Orange'],
  Seminole: ['Sanford', 'Altamonte Springs', 'Lake Mary', 'Longwood', 'Oviedo'],
  Brevard: ['Melbourne', 'Titusville', 'Cocoa', 'Rockledge', 'Palm Bay', 'Merritt Island']
};

const SERVICE_TYPES = ['HVAC', 'Mechanical'];

const BUSINESS_NAME_PATTERNS = [
  '{city} Air Conditioning & Heating',
  '{city} HVAC Services',
  'Precision Climate Control of {city}',
  '{city} Mechanical Systems',
  'Elite HVAC Solutions - {city}',
  '{county} County Cooling & Heating',
  '{city} Comfort Systems',
  'Advanced Air {city}',
  '{city} Commercial HVAC',
  'ProTemp {city}',
  '{city} Industrial HVAC',
  'Cool Breeze {city}',
  '{county} Mechanical Contractors',
  '{city} Climate Experts',
  'Reliable HVAC {city}'
];

const FIRST_NAMES = [
  'Michael', 'David', 'Robert', 'James', 'John', 'William', 'Richard', 'Thomas',
  'Jennifer', 'Lisa', 'Sandra', 'Maria', 'Jessica', 'Sarah', 'Karen', 'Nancy',
  'Chris', 'Brian', 'Mark', 'Steve', 'Kevin', 'Daniel', 'Paul', 'Jason'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White'
];

/**
 * Scoring rubric for prospect quality (1-100):
 * - Base score: 40-70 (random realistic range)
 * - +10 if in high-value county (Orange, Seminole)
 * - +5 if service_type is 'Mechanical' (larger commercial focus)
 * - +10 if has email
 * - -5 if created more than 60 days ago
 */
function calculateProspectScore(data) {
  let score = Math.floor(Math.random() * 31) + 40; // Base: 40-70

  if (['Orange', 'Seminole'].includes(data.county)) {
    score += 10;
  }

  if (data.service_type === 'Mechanical') {
    score += 5;
  }

  if (data.email) {
    score += 10;
  }

  const daysSinceCreation = Math.floor((Date.now() - new Date(data.created_at).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceCreation > 60) {
    score -= 5;
  }

  return Math.min(Math.max(score, 1), 100);
}

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generatePhoneNumber() {
  const areaCode = getRandomElement(['407', '321', '386', '689']); // Central FL area codes
  const exchange = Math.floor(Math.random() * 900) + 100;
  const subscriber = Math.floor(Math.random() * 9000) + 1000;
  return `${areaCode}-${exchange}-${subscriber}`;
}

function generateEmail(firstName, lastName, businessName) {
  const hasEmail = Math.random() > 0.2; // 80% have email
  if (!hasEmail) return null;

  const domain = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 15);
  
  const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
  
  return `${username}@${domain}.com`;
}

function generateCreatedDate() {
  const daysAgo = Math.floor(Math.random() * 180); // 0-180 days ago
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

function generateLastContactDate(createdAt) {
  const hasBeenContacted = Math.random() > 0.7; // 30% have been contacted
  if (!hasBeenContacted) return null;

  const createdDate = new Date(createdAt);
  const daysSinceCreation = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const contactDaysAgo = Math.floor(Math.random() * Math.min(daysSinceCreation, 90));
  const contactDate = new Date();
  contactDate.setDate(contactDate.getDate() - contactDaysAgo);
  
  return contactDate.toISOString();
}

function generateBusinessName(county, city) {
  const pattern = getRandomElement(BUSINESS_NAME_PATTERNS);
  return pattern
    .replace('{county}', county)
    .replace('{city}', city);
}

/**
 * Generates a single prospect record
 */
function generateProspectRecord() {
  const county = getRandomElement(COUNTIES);
  const city = getRandomElement(CITIES_BY_COUNTY[county]);
  const serviceType = getRandomElement(SERVICE_TYPES);
  const firstName = getRandomElement(FIRST_NAMES);
  const lastName = getRandomElement(LAST_NAMES);
  const businessName = generateBusinessName(county, city);
  const createdAt = generateCreatedDate();
  
  const baseData = {
    id: uuidv4(),
    business_name: businessName,
    contact_name: `${firstName} ${lastName}`,
    phone: generatePhoneNumber(),
    email: generateEmail(firstName, lastName, businessName),
    city: city,
    county: county,
    service_type: serviceType,
    persona: 'hvac_partner',
    source: 'fl_hvac_import',
    status: 'new',
    created_at: createdAt,
    last_contact_at: generateLastContactDate(createdAt),
    notes: `${serviceType} contractor in ${county} County. Generated for prospecting.`
  };

  return {
    ...baseData,
    score: calculateProspectScore(baseData)
  };
}

/**
 * Main function to seed the database with HVAC prospect data
 * @param {number} count - Number of records to generate (default: 25)
 * @returns {Promise<{ success: boolean, inserted: number, error?: string }>}
 */
export async function seedDatabase(count = 25) {
  try {
    console.log(`[seedHVACData] Generating ${count} HVAC prospect records...`);
    
    const prospects = [];
    for (let i = 0; i < count; i++) {
      prospects.push(generateProspectRecord());
    }

    console.log('[seedHVACData] Inserting records into partner_prospects table...');
    
    const { data, error } = await supabase
      .from('partner_prospects')
      .insert(prospects)
      .select();

    if (error) {
      console.error('[seedHVACData] Insert error:', error);
      return { success: false, inserted: 0, error: error.message };
    }

    console.log(`[seedHVACData] Successfully inserted ${data.length} records`);
    
    return { 
      success: true, 
      inserted: data.length,
      breakdown: {
        byCounty: prospects.reduce((acc, p) => {
          acc[p.county] = (acc[p.county] || 0) + 1;
          return acc;
        }, {}),
        byServiceType: prospects.reduce((acc, p) => {
          acc[p.service_type] = (acc[p.service_type] || 0) + 1;
          return acc;
        }, {}),
        avgScore: Math.round(prospects.reduce((sum, p) => sum + p.score, 0) / prospects.length)
      }
    };

  } catch (error) {
    console.error('[seedHVACData] Unexpected error:', error);
    return { success: false, inserted: 0, error: error.message };
  }
}

/**
 * Clears all HVAC prospect data from the database
 * Use with caution - this deletes all records with source='fl_hvac_import'
 * @returns {Promise<{ success: boolean, deleted: number, error?: string }>}
 */
export async function clearHVACProspects() {
  try {
    console.log('[seedHVACData] Clearing HVAC prospect data...');
    
    const { data, error } = await supabase
      .from('partner_prospects')
      .delete()
      .eq('source', 'fl_hvac_import')
      .select();

    if (error) {
      console.error('[seedHVACData] Delete error:', error);
      return { success: false, deleted: 0, error: error.message };
    }

    console.log(`[seedHVACData] Successfully deleted ${data?.length || 0} records`);
    
    return { success: true, deleted: data?.length || 0 };

  } catch (error) {
    console.error('[seedHVACData] Unexpected error:', error);
    return { success: false, deleted: 0, error: error.message };
  }
}

// Export individual record generator for testing
export { generateProspectRecord };