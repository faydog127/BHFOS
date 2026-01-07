import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Twitter, Linkedin, Mail, Phone, MapPin } from 'lucide-react';
import { brandAssets, brandTagline } from '@/lib/brandAssets';
import BrandImage from '@/components/BrandImage';
import brandConfigJson from '@/config/brand.config.json';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const tenantId = import.meta.env.VITE_TENANT_ID || 'tvg';
  const tenantBrand = brandConfigJson[tenantId] || brandConfigJson.tvg || brandConfigJson.default || {};
  const phone = tenantBrand.contact_phone || '321-360-9704';
  const email = tenantBrand.contact_email || 'info@vent-guys.com';
  const social = tenantBrand.social || {};

  return (
    <footer className="bg-slate-900 text-slate-300 pt-16 pb-8 border-t border-slate-800">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          
          {/* Brand Column */}
          <div className="space-y-6">
            <Link to="/" className="block">
              <div className="h-16 w-auto relative inline-flex bg-white/95 rounded-md px-2 py-1 shadow-sm">
                 <BrandImage 
                   src={brandAssets.logo.main} 
                   alt="The Vent Guys Footer Logo" 
                   className="h-16 w-auto object-contain object-left"
                   animate={false}
                   fallback={<span className="font-bold text-2xl text-white">The Vent Guys</span>}
                 />
              </div>
            </Link>
            <p className="text-sm leading-relaxed text-slate-400">
              {brandTagline || "We Clear What Others Miss."} <br/>
              Professional air duct cleaning, dryer vent services, and indoor air quality solutions for residential and commercial properties.
            </p>
            <div className="flex items-center gap-4">
              {social.facebook && <a href={social.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors"><Facebook className="w-5 h-5" /></a>}
              {social.instagram && <a href={social.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors"><Instagram className="w-5 h-5" /></a>}
              {social.twitter && <a href={social.twitter} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors"><Twitter className="w-5 h-5" /></a>}
              {social.linkedin && <a href={social.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors"><Linkedin className="w-5 h-5" /></a>}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <span className="block text-white font-semibold mb-6">Services</span>
            <ul className="space-y-3 text-sm">
              <li><Link to="/services" className="hover:text-blue-400 transition-colors">Air Duct Cleaning</Link></li>
              <li><Link to="/services" className="hover:text-blue-400 transition-colors">Dryer Vent Cleaning</Link></li>
              <li><Link to="/services" className="hover:text-blue-400 transition-colors">HVAC Sanitization</Link></li>
              <li><Link to="/services" className="hover:text-blue-400 transition-colors">Commercial Services</Link></li>
              <li><Link to="/blog/free-air-check" className="hover:text-blue-400 transition-colors">Free Air Check</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <span className="block text-white font-semibold mb-6">Company</span>
            <ul className="space-y-3 text-sm">
              <li><Link to="/about" className="hover:text-blue-400 transition-colors">About Us</Link></li>
              <li><Link to="/blog" className="hover:text-blue-400 transition-colors">Latest News</Link></li>
              <li><Link to="/partners" className="hover:text-blue-400 transition-colors">Partner Program</Link></li>
              <li><Link to="/gallery" className="hover:text-blue-400 transition-colors">Project Gallery</Link></li>
              <li><Link to="/contact" className="hover:text-blue-400 transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <span className="block text-white font-semibold mb-6">Contact Us</span>
            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-orange-500 shrink-0" />
                <span>Space Coast, FL<br/>Serving Brevard & Volusia</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-orange-500 shrink-0" />
                <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="hover:text-white transition-colors">{phone}</a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-orange-500 shrink-0" />
                <a href={`mailto:${email}`} className="hover:text-white transition-colors">{email}</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 mt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
          <p>© {currentYear} The Vent Guys. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
            <Link to="/login" className="hover:text-slate-300 transition-colors">Employee Login</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
