// Utility for Google Analytics 4 events
export const trackEvent = (eventName, params = {}) => {
  if (window.gtag) {
    window.gtag('event', eventName, params);
  } else {
    console.log(`[GA4 Dev] Event: ${eventName}`, params);
  }
};

export const trackCallClick = (placement, label) => {
  trackEvent('call_click', {
    placement,
    label: label || window.location.pathname
  });
};

export const trackBookClick = (placement, label) => {
  trackEvent('book_click', {
    placement,
    label: label || window.location.pathname
  });
};

export const trackOfferClick = (offerName) => {
  trackEvent('offer_click', {
    offer_name: offerName
  });
};

export const trackNewsletterSignup = () => {
  trackEvent('newsletter_signup', {
    location: 'footer'
  });
};

export const trackLeadSubmission = (leadData) => {
  trackEvent('generate_lead', {
    currency: 'USD',
    value: leadData.pqi || 0,
    lead_id: leadData.id,
    source: leadData.source || 'web'
  });
};