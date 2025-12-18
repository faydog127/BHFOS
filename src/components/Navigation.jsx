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
  const phoneDisplay = tenantBrand.contact_phone || '321-360-9704';
  const phoneDial = phoneDisplay.replace(/[^\d+]/g, '');

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
        // Strong brand bar: always solid navy (no transparent overlay).
        "bg-slate-950/95 backdrop-blur-md shadow-lg shadow-slate-950/20 border-b border-slate-800/60 py-3"
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">

          {/* Logo Section */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="h-10 md:h-12 w-auto relative transition-transform duration-300 group-hover:scale-105">
              <BrandImage
                src={brandAssets.logo.white || brandAssets.logo.main}
                alt={tenantBrand.name || 'The Vent Guys'}
                priority={true}
                className="h-full w-auto object-contain"
                animate={false} // Don't animate nav logo on every render
                fallback={<span className="font-bold text-xl whitespace-nowrap text-white">{tenantBrand.name || 'The Vent Guys'}</span>}
              />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "text-sm font-medium transition-colors",
                  "text-white/85 hover:text-orange-300"
                )}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href={`tel:${phoneDial}`}
              className="flex items-center gap-2 text-sm font-semibold text-white hover:text-orange-300 transition-colors"
            >
              <Phone className="w-4 h-4" />
              {phoneDisplay}
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
                <Button variant="ghost" size="icon" className="text-white">
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
                      fallback={<span className="font-bold text-xl text-slate-900">{tenantBrand.name || 'The Vent Guys'}</span>}
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
                      <a href={`tel:${phoneDial}`}>Call {phoneDisplay}</a>
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