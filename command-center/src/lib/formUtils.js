const normalizePhoneDigits = (value) => {
  const digits = String(value || '').replace(/[^\d]/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits.slice(0, 10);
};

export const formatPhoneNumber = (value) => {
  if (!value) return value;
  const phoneNumber = normalizePhoneDigits(value);
  const phoneNumberLength = phoneNumber.length;
  
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  // This will format the number as (XXX) XXX-XXXX and will also handle the case where user enters more than 10 digits by slicing.
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone) => {
  return Boolean(phone) && normalizePhoneDigits(phone).length === 10;
};
