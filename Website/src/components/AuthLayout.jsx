import React from 'react';
import { motion } from 'framer-motion';

const AuthLayout = ({ children }) => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {children}
        </div>
        <div className="mt-6 text-center text-sm text-slate-500">
          &copy; {new Date().getFullYear()} Hostinger Horizons. All rights reserved.
        </div>
      </motion.div>
    </div>
  );
};

export default AuthLayout;