import DOMPurify from 'dompurify';

/**
 * Sanitizes a string input to prevent XSS.
 * Removes all HTML tags and unsafe attributes.
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  // ALLOWED_TAGS: [] removes all HTML, making it plain text
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
};

/**
 * RFC 5322 compliant email validation.
 */
export const validateEmail = (email) => {
  if (!email) return false;
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
};

/**
 * Validates US Phone format (XXX) XXX-XXXX
 */
export const validatePhone = (phone) => {
  if (!phone) return false;
  // Checks for (123) 456-7890 format specifically
  const re = /^\(\d{3}\) \d{3}-\d{4}$/;
  return re.test(phone);
};

/**
 * Formats a raw string into (XXX) XXX-XXXX
 */
export const formatPhoneNumber = (value) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, '');
  const phoneNumberLength = phoneNumber.length;
  
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

/**
 * Checks if a submission is happening too fast (Client-side rate limit)
 * SAFE GUARDED against "The operation is insecure" errors in iframes
 * @param {string} formId - Unique identifier for the form
 * @param {number} limitMs - Time in ms to wait between submissions
 */
export const checkRateLimit = (formId, limitMs = 5000) => {
    try {
        const key = `last_submit_${formId}`;
        const lastSubmission = localStorage.getItem(key);
        const now = Date.now();
        
        if (lastSubmission && (now - parseInt(lastSubmission)) < limitMs) {
            return false;
        }
        
        localStorage.setItem(key, now.toString());
        return true;
    } catch (e) {
        // If localStorage is blocked (e.g. security settings or iframe), allow the submission
        // We don't want to block valid users just because of browser privacy settings
        console.warn('Rate limiting disabled due to storage restrictions:', e);
        return true;
    }
};