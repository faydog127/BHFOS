import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Phone, Calendar, Wind, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Components
import TrustStrip from '@/components/TrustStrip';
import TestimonialCarousel from '@/components/TestimonialCarousel';
import SpecialsSection from '@/components/SpecialsSection';
import FreeAirCheckModal from '@/components/FreeAirCheckModal';
import ExitIntentPopup from '@/components/ExitIntentPopup';

// Brand Assets
import { brandAssets, brandColors } from '@/lib/brandAssets';
import BrandImage from '@/components/BrandImage';

const Home = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Animation variants that respect reduced motion
  const fadeInUp = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Helmet>
        <title>The Vent Guys | Air Duct & Dryer Vent Cleaning | Space Coast, FL</title>
        <meta name="description" content="Professional air duct cleaning, dryer vent cleaning, and indoor air quality services in Melbourne, Viera, and the Space Coast. Certified experts, honest pricing." />
      </Helmet>

      {/* Exit Intent Popup */}
      <ExitIntentPopup />

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-slate-900">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <BrandImage 
             src={brandAssets.backgrounds.hero} 
             alt="Clean modern living room representing healthy air"
             className="w-full h-full object-cover opacity-40"
             fallbackSrc={brandAssets.placeholders.hero}
             priority={true} // High priority for background
             animate={false} // Disable fade-in for LCP
             sizes="100vw"
             decoding="sync"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/80 to-transparent" />
        </div>

        <div className="container relative z-10 px-4 py-20 flex flex-col md:flex-row items-center gap-12">
          {/* Hero Content */}
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="flex-1 text-center md:text-left space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-400/20 text-orange-200 text-sm font-semibold backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
              #1 Rated Air Quality Experts in Florida
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight tracking-tight">
              Breathe Cleaner, <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-200">
                Live Healthier.
              </span>
            </h1>
            
            <p className="text-xl text-slate-300 max-w-2xl mx-auto md:mx-0 leading-relaxed">
              We clear what others miss. Experience the difference of hospital-grade air duct cleaning and fire-safe dryer vent solutions.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4 pt-4">
              <Button 
                size="xl" 
                className="w-full sm:w-auto text-lg h-14 px-8 bg-orange-500 hover:bg-orange-600 shadow-xl shadow-orange-500/20"
                onClick={() => setIsModalOpen(true)}
              >
                Get Free Air Check
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                size="xl" 
                variant="outline" 
                className="w-full sm:w-auto text-lg h-14 px-8 border-slate-600 text-white hover:bg-slate-800 hover:text-white"
                asChild
              >
                <Link to="/services">Explore Services</Link>
              </Button>
            </div>

            <div className="flex items-center justify-center md:justify-start gap-6 pt-4 text-sm text-slate-400">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-500" /> NADCA Certified</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-500" /> Licensed & Insured</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-500" /> Veteran Owned</span>
            </div>
          </motion.div>

          {/* Hero Visual/Mascot - Optimized for LCP */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex-1 hidden lg:flex justify-center"
          >
             <motion.div 
               className="relative w-[500px] h-[500px]"
               animate={shouldReduceMotion ? {} : {
                 y: [-10, 10, -10],
               }}
               transition={{
                 duration: 6,
                 repeat: Infinity,
                 ease: "easeInOut"
               }}
             >
                <div className="absolute inset-0 bg-blue-500/30 rounded-full blur-[80px] animate-pulse" />
                <BrandImage 
                  src="https://wwyxohjnyqnegzbxtuxs.supabase.co/storage/v1/object/public/vent-guys-images/logo_blackBG.png"
                  alt="Vent Guys Mascot Waving" 
                  className="relative z-10 w-full h-full object-contain drop-shadow-2xl animate-mascot-float"
                  fallbackSrc={brandAssets.mascot.full}
                  priority={true} // LCP optimization
                  fetchPriority="high" // LCP optimization
                  animate={false} // Disable JS-based fade-in for LCP element
                  width={500} // Explicit width to prevent CLS
                  height={500} // Explicit height to prevent CLS
                  sizes="(max-width: 768px) 100vw, 500px"
                  decoding="sync" // Decode immediately
                  style={{
                    maxWidth: 'clamp(300px, 50vw, 500px)',
                    aspectRatio: '1 / 1'
                  }}
                />
             </motion.div>
          </motion.div>
        </div>

        {/* Wave Divider */}
        <div className="absolute bottom-0 left-0 right-0">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" className="w-full h-auto text-slate-50 fill-current">
              <path fillOpacity="1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,160C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
           </svg>
        </div>
      </section>

      {/* Trust Strip */}
      <TrustStrip />

      {/* Specials & Urgency Section */}
      <SpecialsSection />

      {/* Founder / About Section */}
      <section className="py-20 bg-white overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2 relative">
              <div className="absolute -left-10 -top-10 w-40 h-40 bg-orange-100 rounded-full blur-3xl" />
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white transform -rotate-2 hover:rotate-0 transition-transform duration-500">
                <BrandImage 
                  src={brandAssets.mascot.full} 
                  alt="The Vent Guys Team Mascot" 
                  className="w-full h-auto bg-slate-50"
                  animate={true}
                  loading="lazy"
                  decoding="async"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  style={{ aspectRatio: '4/3' }}
                />
              </div>
              {/* Floating Badge */}
              <div className="absolute -bottom-6 -right-6 bg-white p-4 rounded-xl shadow-xl border border-slate-100 flex items-center gap-3">
                 <div className="bg-blue-100 p-2 rounded-full">
                   <Shield className="w-6 h-6 text-blue-600" />
                 </div>
                 <div>
                   <p className="text-xs text-slate-500 font-semibold uppercase">Est. 2005</p>
                   <p className="text-sm font-bold text-slate-900">Veteran Owned</p>
                 </div>
              </div>
            </div>
            
            <div className="lg:w-1/2 space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
                Not Just Clean. <span className="text-orange-500">Vent Guys Clean.</span>
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                Founded on the principles of integrity and technical excellence, we saw too many homeowners falling victim to "blow-and-go" scams. We set out to change the industry standard.
              </p>
              <p className="text-slate-600 leading-relaxed">
                Using state-of-the-art HEPA filtration and high-pressure air whips, we remove the dust, allergens, and debris that others leave behind. Our mascot stands for our commitment: friendly service, fierce cleaning power.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <div className="flex items-start gap-3">
                  <Wind className="w-6 h-6 text-orange-500 shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-slate-900">Advanced Tech</h4>
                    <p className="text-sm text-slate-500">Negative pressure & whip systems.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Zap className="w-6 h-6 text-orange-500 shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-slate-900">Fire Safety</h4>
                    <p className="text-sm text-slate-500">Comprehensive dryer vent inspections.</p>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <Button variant="outline" size="lg" asChild>
                  <Link to="/about">Read Our Full Story</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Preview (Simplified) */}
      <section className="py-20 bg-slate-50">
        <div className="container mx-auto px-4 text-center">
           <div className="max-w-2xl mx-auto mb-16">
             <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Complete Air Care</h2>
             <p className="text-slate-600">From residential homes to large commercial facilities, we have the specialized equipment to handle it all.</p>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Service 1 */}
              <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow border border-slate-100">
                 <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-6 text-blue-600">
                    <Wind className="w-8 h-8" />
                 </div>
                 <h3 className="text-xl font-bold text-slate-900 mb-3">Air Duct Cleaning</h3>
                 <p className="text-slate-500 mb-6">Remove accumulated dust, mold spores, and allergens from your entire HVAC system.</p>
                 <Link to="/services" className="text-blue-600 font-semibold hover:text-blue-700 inline-flex items-center">
                   Learn More <ArrowRight className="w-4 h-4 ml-1" />
                 </Link>
              </div>

              {/* Service 2 */}
              <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow border border-slate-100">
                 <div className="w-14 h-14 bg-orange-50 rounded-xl flex items-center justify-center mx-auto mb-6 text-orange-600">
                    <Zap className="w-8 h-8" />
                 </div>
                 <h3 className="text-xl font-bold text-slate-900 mb-3">Dryer Vent Cleaning</h3>
                 <p className="text-slate-500 mb-6">Prevent fires and improve efficiency by clearing lint blockages from your dryer line.</p>
                 <Link to="/services" className="text-orange-600 font-semibold hover:text-orange-700 inline-flex items-center">
                   Learn More <ArrowRight className="w-4 h-4 ml-1" />
                 </Link>
              </div>

              {/* Service 3 */}
              <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow border border-slate-100">
                 <div className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-6 text-green-600">
                    <Shield className="w-8 h-8" />
                 </div>
                 <h3 className="text-xl font-bold text-slate-900 mb-3">Sanitization</h3>
                 <p className="text-slate-500 mb-6">Hospital-grade fogging to eliminate bacteria, viruses, and odors from ductwork.</p>
                 <Link to="/services" className="text-green-600 font-semibold hover:text-green-700 inline-flex items-center">
                   Learn More <ArrowRight className="w-4 h-4 ml-1" />
                 </Link>
              </div>
           </div>
        </div>
      </section>

      {/* Testimonials */}
      <TestimonialCarousel />

      {/* CTA Section */}
      <section className="py-24 bg-blue-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
            {/* Pattern placeholder */}
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M0 40L40 0H20L0 20M40 40V20L20 40" stroke="white" strokeWidth="2" fill="none"/>
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
        </div>
        
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Ready to Breathe Easier?</h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            Schedule your free air quality check or book your cleaning today. Our schedule fills up fast!
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
             <Button 
               size="xl" 
               className="w-full sm:w-auto bg-white text-blue-600 hover:bg-blue-50"
               onClick={() => setIsModalOpen(true)}
             >
               Get a Free Quote
             </Button>
             <Button 
               size="xl" 
               variant="outline" 
               className="w-full sm:w-auto border-blue-400 text-white hover:bg-blue-700 border-2"
               asChild
             >
               <Link to="/contact">Contact Us</Link>
             </Button>
          </div>
        </div>
      </section>

      {/* Modal */}
      <FreeAirCheckModal isOpen={isModalOpen} onOpenChange={setIsModalOpen} />
    </div>
  );
};

export default Home;