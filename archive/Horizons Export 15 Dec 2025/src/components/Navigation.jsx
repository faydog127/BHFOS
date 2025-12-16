
import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Menu, X, Phone, Wrench, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  const toggleMenu = () => setIsOpen(!isOpen);

  const mainNavItems = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    { name: 'Partners', path: '/partners' },
    { name: 'About', path: '/about' },
    { name: 'Contact', path: '/contact' },
    { name: 'Blog', path: '/blog' },
    { name: 'FAQ', path: '/faq' },
  ];

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          
          {/* Logo Section */}
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <Wrench className="h-6 w-6 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xl text-blue-900 leading-none">The Vent Guys</span>
                <span className="text-[10px] text-blue-600 font-medium tracking-wider uppercase">We Clear What Others Miss</span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {mainNavItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) => cn(
                  "text-sm font-medium transition-colors duration-200 border-b-2 border-transparent py-1",
                  isActive 
                    ? "text-blue-600 border-blue-600" 
                    : "text-gray-600 hover:text-blue-600 hover:border-blue-200"
                )}
              >
                {item.name}
              </NavLink>
            ))}
          </div>

          {/* CTA & User Section */}
          <div className="hidden md:flex items-center space-x-4">
            <a 
              href="tel:321-360-9704" 
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors font-medium text-sm"
            >
              <Phone className="h-4 w-4" />
              (321) 360-9704
            </a>

            {user ? (
               <Button asChild variant="outline" size="sm" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                 <Link to="/crm/dashboard" className="flex items-center gap-2">
                   <User className="h-4 w-4" />
                   CRM Dashboard
                 </Link>
               </Button>
            ) : (
                <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-blue-200 transition-all">
                  <Link to="/booking">Book Online</Link>
                </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={toggleMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-blue-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={cn("md:hidden border-t", isOpen ? "block" : "hidden")}>
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-50">
          {mainNavItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) => cn(
                "block px-3 py-2 rounded-md text-base font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:text-blue-600 hover:bg-white"
              )}
            >
              {item.name}
            </NavLink>
          ))}
          
          <div className="pt-4 mt-4 border-t border-gray-200">
             <a 
              href="tel:321-360-9704"
              className="flex items-center justify-center gap-2 w-full px-4 py-2 text-base font-medium text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-md"
            >
              <Phone className="h-4 w-4" />
              Call (321) 360-9704
            </a>
            
            <div className="mt-3 px-2 space-y-2">
                {user ? (
                   <Button asChild className="w-full justify-center" variant="outline">
                     <Link to="/crm/dashboard" onClick={() => setIsOpen(false)}>
                       Go to CRM Dashboard
                     </Link>
                   </Button>
                ) : (
                   <Button asChild className="w-full justify-center bg-blue-600 hover:bg-blue-700">
                     <Link to="/booking" onClick={() => setIsOpen(false)}>
                       Book Online Now
                     </Link>
                   </Button>
                )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
