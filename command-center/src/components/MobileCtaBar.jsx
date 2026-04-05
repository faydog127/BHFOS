import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackCallClick, trackBookClick } from '@/lib/tracking';

const MobileCtaBar = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsVisible(true); 
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-3 md:hidden flex gap-3 items-center justify-between safe-area-bottom">
      <Button 
        variant="outline" 
        className="flex-1 h-12 text-base font-semibold border-blue-600 text-blue-700 hover:bg-blue-50"
        asChild
        onClick={() => trackCallClick('sticky_bar_mobile')}
      >
        <a href="tel:3213609704">
          <Phone className="w-4 h-4 mr-2" />
          Call Now
        </a>
      </Button>
      <Button 
        className="flex-1 h-12 text-base font-semibold shadow-lg bg-blue-700 hover:bg-blue-800"
        asChild
        onClick={() => trackBookClick('sticky_bar_mobile')}
      >
        <Link to="/booking">
          <Calendar className="w-4 h-4 mr-2" />
          Book Online
        </Link>
      </Button>
    </div>
  );
};

export default MobileCtaBar;