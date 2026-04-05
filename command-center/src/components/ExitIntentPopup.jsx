import React, { useState, useEffect } from 'react';
import { X, Phone, Calendar, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export default function ExitIntentPopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if already shown this session
    if (sessionStorage.getItem('exit-intent-shown')) {
      return;
    }

    const handleMouseLeave = (e) => {
      // Only trigger when mouse leaves from the top of the page
      if (e.clientY <= 0 && !sessionStorage.getItem('exit-intent-shown')) {
        setIsOpen(true);
        sessionStorage.setItem('exit-intent-shown', 'true');
      }
    };

    // Add delay before enabling to avoid false triggers
    const timer = setTimeout(() => {
      document.addEventListener('mouseleave', handleMouseLeave);
    }, 3000);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-4 border-red-600">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="relative bg-gradient-to-br from-red-600 via-red-500 to-orange-600 text-white p-8 md:p-10"
        >
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition-all"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="text-center">
            {/* Animated Warning Icon */}
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                repeatType: "reverse"
              }}
              className="inline-block mb-4"
            >
              <div className="w-20 h-20 mx-auto bg-white/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-12 h-12 text-yellow-300" />
              </div>
            </motion.div>

            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Wait! Don't Risk Your Family's Safety
            </h2>
            <p className="text-xl mb-2 leading-relaxed">
              Dirty ducts can harbor <strong className="text-yellow-300">mold, allergens, and fire hazards</strong>.
            </p>
            <p className="text-2xl font-bold mb-6 text-yellow-300">
              Get a FREE Air Check before you go.
            </p>

            {/* Key Benefits */}
            <div className="grid grid-cols-3 gap-4 mb-8 text-center">
              {[
                { icon: '✓', text: 'No Obligation' },
                { icon: '⏱️', text: '15-Min Visit' },
                { icon: '📸', text: 'Photo Proof' }
              ].map((item, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                  <div className="text-2xl mb-1">{item.icon}</div>
                  <div className="text-xs font-semibold">{item.text}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="tel:3213609704" className="inline-flex">
                <Button size="lg" className="bg-white text-red-600 hover:bg-gray-100 font-bold w-full sm:w-auto h-14 px-8 shadow-xl hover:shadow-2xl transition-all hover:scale-105">
                  <Phone className="mr-2" /> Call Now: (321) 360-9704
                </Button>
              </a>
              <Link to="/booking" onClick={() => setIsOpen(false)}>
                <Button size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white/20 w-full sm:w-auto h-14 px-8 font-bold">
                  <Calendar className="mr-2" /> Book Free Check
                </Button>
              </Link>
            </div>

            <p className="text-sm text-white/90 mt-6">
              <strong>487+ families</strong> trusted us this year. You're in good hands.
            </p>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}