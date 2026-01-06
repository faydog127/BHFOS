
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Menu, X, Phone, ArrowRight, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { brandAssets } from '@/lib/brandAssets';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import BrandImage from '@/components/BrandImage';
import { tenantPath } from '@/lib/tenantUtils';

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { user } = useSupabaseAuth();
  
  // Extract tenantId from URL params if present, otherwise default to 'tvg'
  const { tenantId = 'tvg' } = useParams();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => setIsOpen(false), [location.pathname]);

  const navLinks = [
    { name: 'Services', path: '/services' },
    { name: 'About', path: '/about' },
    { name: 'Blog', path: '/blog' },
    { name: 'Contact', path: '/contact' },
    { name: 'Partners', path: '/partners' },
  ];

  const isTransparent = location.pathname === '/' && !scrolled;

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
        isTransparent
          ? "bg-transparent border-transparent py-4"
          : "bg-white/95 backdrop-blur-md border-slate-200 py-2 shadow-sm"
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group flex-shrink-0">
             <div
               className="relative transition-transform duration-300 group-hover:scale-105"
               style={{
                 width: 'clamp(150px, 20vw, 195px)',
                 height: 'auto',
                 aspectRatio: '3 / 1',
                 maxHeight: '60px'
               }}
             >
               <BrandImage
                 src={isTransparent ? brandAssets.logo.white : brandAssets.logo.main}
                 alt="The Vent Guys"
                 priority
                 width={180}
                 height={60}
                 className="h-full w-full object-contain"
                 animate={false}
                 fallbackSrc={brandAssets.logo.main}
               />
             </div>
           </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <div className="flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path} // Public links usually stay absolute, but could be tenantPath(link.path, tenantId) if we wanted branded public pages
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-orange-500",
                    isTransparent ? "text-slate-200" : "text-slate-700",
                    location.pathname === link.path &&
                      (isTransparent ? "text-white font-semibold" : "text-orange-600 font-semibold")
                  )}
                >
                  {link.name}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-4 pl-6 border-l border-slate-200/20">
              <a
                href="tel:321-555-0123"
                className={cn(
                  "flex items-center gap-2 text-sm font-semibold transition-colors",
                  isTransparent ? "text-white hover:text-orange-400" : "text-slate-900 hover:text-orange-600"
                )}
              >
                <Phone className="w-4 h-4" />
                <span>(321) 555-0123</span>
              </a>

              {user ? (
                <Button
                  variant={isTransparent ? "secondary" : "default"}
                  size="sm"
                  asChild
                  className={cn(
                    isTransparent ? "bg-white text-slate-900 hover:bg-slate-100" : "bg-orange-500 hover:bg-orange-600 text-white"
                  )}
                >
                  <Link to={tenantPath('/crm', tenantId)}>
                    <UserCircle className="w-4 h-4 mr-2" />
                    Dashboard
                  </Link>
                </Button>
              ) : (
                <Button
                  variant={isTransparent ? "secondary" : "default"}
                  size="sm"
                  asChild
                  className={cn(
                    isTransparent ? "bg-white text-slate-900 hover:bg-slate-100" : "bg-orange-500 hover:bg-orange-600 text-white"
                  )}
                >
                  <Link to="/booking">
                    Book Now
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              "md:hidden p-2 rounded-lg transition-colors",
              isTransparent ? "text-white hover:bg-white/10" : "text-slate-900 hover:bg-slate-100"
            )}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          "md:hidden absolute top-full left-0 right-0 bg-white border-b border-slate-200 shadow-xl transition-all duration-300 origin-top",
          isOpen ? "opacity-100 scale-y-100 visible" : "opacity-0 scale-y-0 invisible"
        )}
      >
        <div className="container mx-auto px-4 py-6 flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={cn(
                "text-lg font-medium py-2 border-b border-slate-50 hover:text-orange-500 transition-colors",
                location.pathname === link.path ? "text-orange-600" : "text-slate-700"
              )}
            >
              {link.name}
            </Link>
          ))}
          <div className="pt-4 flex flex-col gap-4">
            <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white" size="lg" asChild>
              <Link to="/booking">Book Now</Link>
            </Button>
            {user && (
              <Button variant="outline" className="w-full" size="lg" asChild>
                <Link to={tenantPath('/crm', tenantId)}>Dashboard</Link>
              </Button>
            )}
            <a
              href="tel:321-555-0123"
              className="flex items-center justify-center gap-2 text-slate-600 font-semibold py-2"
            >
              <Phone className="w-5 h-5" />
              call (321) 555-0123
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
