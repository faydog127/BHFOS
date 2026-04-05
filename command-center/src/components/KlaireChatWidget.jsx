import React from 'react';

// This component is deprecated. Use ChatWidget.jsx instead.
const KlaireChatWidget = () => {
  if (process.env.NODE_ENV === 'development') {
    console.warn('KlaireChatWidget is deprecated and will be removed. Please use ChatWidget instead.');
  }
  return null; 
};

export default KlaireChatWidget;