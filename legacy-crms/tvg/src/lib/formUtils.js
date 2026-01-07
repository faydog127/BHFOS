export const formatPhoneNumber = (value) => {
  if (!value) return value;
  // This strips all non-digit characters
  const phoneNumber = value.replace(/[^\d]/g, '');
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
  // Check if the formatted string has the full length of a US phone number
  return phone && phone.replace(/[^\d]/g, '').length === 10;
};