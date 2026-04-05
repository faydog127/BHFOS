import React from 'react';
import { Phone } from 'lucide-react';
import { motion } from 'framer-motion';

const FloatingCallButton = () => {
  return (
    <motion.a
      href="tel:321-555-0123"
      className="fixed bottom-6 right-6 z-50 bg-[#b52025] text-white p-4 rounded-full shadow-lg flex items-center justify-center hover:bg-[#831618] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#b52025] transition-all duration-300"
      aria-label="Call Now"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.5 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      <Phone className="h-6 w-6" />
    </motion.a>
  );
};

export default FloatingCallButton;