/**
 * Simulates an AI Brand Detection Engine.
 * In a real backend environment, this would use Puppeteer/Cheerio to scrape the target URL.
 * Due to browser CORS restrictions, we simulate the detection logic here.
 */

export const detectBrandFromUrl = async (url) => {
  return new Promise((resolve) => {
    // Simulate network delay for realism
    setTimeout(() => {
      const cleanUrl = url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      const nameGuess = cleanUrl.split('.')[0];
      const capitalizedName = nameGuess.charAt(0).toUpperCase() + nameGuess.slice(1);

      // Deterministic generation based on input to feel "real"
      const isTech = cleanUrl.includes('tech') || cleanUrl.includes('io') || cleanUrl.includes('soft');
      
      resolve({
        company_name: capitalizedName + (isTech ? ' Technologies' : ' Solutions'),
        description: `Premier provider of ${isTech ? 'cloud-native software' : 'integrated services'} for the ${isTech ? 'technology' : 'modern'} sector.`,
        logo_url: `https://ui-avatars.com/api/?name=${nameGuess}&background=0f172a&color=fbbf24&size=200&font-size=0.33&length=2`, // Fallback generation
        primary_color: isTech ? '#3b82f6' : '#0f172a',
        secondary_color: isTech ? '#1e40af' : '#fbbf24',
        industry: isTech ? 'Technology' : 'Professional Services',
        poc_email: `contact@${cleanUrl}`,
        confidence: {
          name: 0.95,
          logo: 0.80,
          colors: 0.85,
          meta: 0.90
        }
      });
    }, 1500);
  });
};

export const validateUrl = (str) => {
  try {
    new URL(str);
    return true;
  } catch (_) {
    return false;
  }
};