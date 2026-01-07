import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Facebook, Instagram, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { trackNewsletterSignup } from '@/lib/tracking';
import { supabase } from '@/lib/customSupabaseClient';

const Footer = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    try {
        trackNewsletterSignup();
        // Write to leads table
        const { error } = await supabase.from('leads').insert([{
            email: email,
            service: 'Newsletter',
            status: 'New',
            source_kind: 'footer_signup',
            message: 'Newsletter Subscription Request',
            consent_marketing: true
        }]);

        if (error) throw error;

        setSubmitted(true);
        toast({
            title: "Subscribed!",
            description: "Thanks for joining our clean air community.",
        });
    } catch (err) {
        console.error(err);
        toast({
            title: "Error",
            description: "Could not subscribe. Please try again later.",
            variant: "destructive"
        });
    } finally {
        setLoading(false);
    }
  };

  return (
    <footer className="bg-slate-900 text-slate-300 py-12 md:py-16 border-t-8 border-blue-600">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <Link to="/" className="inline-block">
              {/* Replace with white version of logo if available, using placeholder text for now if not */}
              <span className="text-2xl font-bold text-white font-oswald">THE VENT GUYS</span>
            </Link>
            <p className="text-sm leading-relaxed">
              NADCA Certified professionals providing cleaner air and safer homes across Brevard County. Photo-verified results, no hidden fees.
            </p>
            <div className="flex space-x-4">
              <a href="https://facebook.com/theventguys" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-500 transition-colors">
                <Facebook size={20} />
              </a>
              <a href="https://instagram.com/theventguys" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-500 transition-colors">
                <Instagram size={20} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/services" className="hover:text-blue-400 transition-colors">Our Services</Link></li>
              <li><Link to="/booking" className="hover:text-blue-400 transition-colors">Book Now</Link></li>
              <li><Link to="/about" className="hover:text-blue-400 transition-colors">About Us</Link></li>
              <li><Link to="/blog" className="hover:text-blue-400 transition-colors">Blog</Link></li>
              <li><Link to="/faq" className="hover:text-blue-400 transition-colors">FAQ</Link></li>
              <li><Link to="/contact" className="hover:text-blue-400 transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Contact Us */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Contact Us</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center space-x-2">
                <Phone size={16} className="text-blue-500" />
                <a href="tel:3213609704" className="hover:text-blue-400 transition-colors">(321) 360-9704</a>
              </li>
              <li className="flex items-center space-x-2">
                <Mail size={16} className="text-blue-500" />
                <a href="mailto:info@theventguys.com" className="hover:text-blue-400 transition-colors">info@theventguys.com</a>
              </li>
              <li className="flex items-start space-x-2">
                <MapPin size={16} className="text-blue-500 mt-1" />
                <span>Serving Brevard County, FL</span>
              </li>
            </ul>
          </div>

          {/* Newsletter / Trust */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Stay Clean & Safe</h3>
            <p className="text-sm">Get tips on indoor air quality, fire prevention, and exclusive offers.</p>
            
            {submitted ? (
                <div className="flex items-center gap-2 text-green-400 bg-green-900/20 p-3 rounded border border-green-900">
                    <Check size={18} />
                    <span>You're subscribed!</span>
                </div>
            ) : (
                <form onSubmit={handleNewsletterSubmit} className="flex gap-2 mt-4">
                  <Input
                    type="email"
                    placeholder="Your email"
                    className="flex-grow bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500"
                    aria-label="Email for newsletter"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Subscribe'}
                  </Button>
                </form>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-4 mt-6 opacity-80">
              <img
                src="https://horizons-cdn.hostinger.com/4261d516-4b17-442c-85b4-1d2769a22a04/f4b1326b89f7e33e3c403875e9f7442a.png"
                alt="NADCA Certified Member Seal"
                className="h-14 w-auto"
              />
              <img
                src="https://horizons-cdn.hostinger.com/4261d516-4b17-442c-85b4-1d2769a22a04/66cfd791bc41361d9e6457d872f80a87.png"
                alt="Clean Air Standard Award"
                className="h-20 w-auto"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-10 pt-8 text-center text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} The Vent Guys. All rights reserved.</p>
          <p className="mt-2">
            <Link to="/privacy" className="hover:text-blue-400 transition-colors">Privacy Policy</Link>
            <span className="mx-2">|</span>
            <Link to="/terms-of-service" className="hover:text-blue-400 transition-colors">Terms of Service</Link>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;