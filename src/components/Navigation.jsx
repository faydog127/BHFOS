
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Phone, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { brandAssets } from '@/lib/brandAssets';
import BrandImage from '@/components/BrandImage';
import brandConfigJson from '@/config/brand.config.json';

const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';
  const tenantId = import.meta.env.VITE_TENANT_ID || 'tvg';
  const tenantBrand = brandConfigJson[tenantId] || brandConfigJson.tvg || brandConfigJson.default || {};
  const phone = tenantBrand.contact_phone || '321-360-9704';

  // Handle scroll effect for transparent to solid header transition
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Services', path: '/services' },
    { name: 'About Us', path: '/about' },
    { name: 'Blog', path: '/blog' },
    { name: 'Service Areas', path: '/service-areas/melbourne' },
    { name: 'Contact', path: '/contact' },
  ];

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled || !isHome 
          ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/50 py-2" 
          : "bg-transparent py-4"
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          
          {/* Logo Section */}
          <Link to="/" className="flex items-center gap-2 group">
            <div
              className={cn(
                "h-12 md:h-14 w-auto relative transition-transform duration-300 group-hover:scale-105",
                // Until we have a transparent logo, make the white JPG background feel intentional on dark headers
                !isScrolled && isHome && "bg-white/95 rounded-md px-2 py-1 shadow-sm"
              )}
            >
              <BrandImage 
                src={brandAssets.logo.main} 
                alt="The Vent Guys Logo" 
                priority={true}
                className="h-full w-auto object-contain"
                animate={false} // Don't animate nav logo on every render
                fallback={<span className={cn("font-bold text-xl whitespace-nowrap", isScrolled || !isHome ? "text-slate-900" : "text-white")}>The Vent Guys</span>}
              />
            </div>
            {/* Optional Text Logo for Accessibility or Style (only visible if logo loads or as reinforcement) */}
            <span className={cn(
              "font-bold text-xl hidden xl:block",
              isScrolled || !isHome ? "text-slate-900" : "text-white drop-shadow-md"
            )}>
              The Vent Guys
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-blue-500",
                  isScrolled || !isHome ? "text-slate-700" : "text-white/90 hover:text-white"
                )}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <a 
              href={`tel:${phone.replace(/[^\d+]/g, '')}`} 
              className={cn(
                "flex items-center gap-2 text-sm font-semibold",
                isScrolled || !isHome ? "text-slate-900" : "text-white"
              )}
            >
              <Phone className="w-4 h-4" />
              {phone}
            </a>
            <Button 
              size="sm" 
              className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20"
              asChild
            >
              <Link to="/booking">
                <CalendarClock className="w-4 h-4 mr-2" />
                Book Now
              </Link>
            </Button>
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className={isScrolled || !isHome ? "text-slate-900" : "text-white"}>
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <div className="flex flex-col gap-8 mt-8">
                  <div className="h-14 w-auto mx-auto">
                     <BrandImage 
                       src={brandAssets.logo.main} 
                       alt="Menu Logo" 
                       className="h-full w-auto" 
                       fallback={<span className="font-bold text-xl text-slate-900">The Vent Guys</span>}
                     />
                  </div>
                  <nav className="flex flex-col gap-4">
                    <Link to="/" className="text-lg font-medium hover:text-blue-600 transition-colors">Home</Link>
                    {navLinks.map((link) => (
                      <Link
                        key={link.path}
                        to={link.path}
                        className="text-lg font-medium hover:text-blue-600 transition-colors"
                      >
                        {link.name}
                      </Link>
                    ))}
                    <Link to="/partners" className="text-lg font-medium hover:text-blue-600 transition-colors text-blue-600">Partner Program</Link>
                  </nav>
                  <div className="flex flex-col gap-4 mt-auto">
                    <Button size="lg" className="w-full bg-orange-500 hover:bg-orange-600" asChild>
                      <Link to="/booking">Book Online</Link>
                    </Button>
                    <Button variant="outline" size="lg" className="w-full" asChild>
                      <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>Call {phone}</a>
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navigation;
