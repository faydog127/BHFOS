import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { 
  Star, ShieldCheck, CheckCircle2, ArrowRight, 
  PlayCircle, Camera, Clock, BadgeCheck, Calculator 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { trackCallClick, trackBookClick, trackOfferClick } from '@/lib/tracking';
import FreeAirCheckModal from '@/components/FreeAirCheckModal';
import EstimateWizard from '@/components/EstimateWizard';
import SpecialsSection from '@/components/SpecialsSection'; // Added Import

const Home = () => {
  const [showAirCheckModal, setShowAirCheckModal] = useState(false);
  const [showEstimator, setShowEstimator] = useState(false); 

  const handleFreeAirCheckClick = () => {
    trackOfferClick('free_air_check');
    setShowAirCheckModal(true);
  };

  const handleEstimatorClick = () => {
      setShowEstimator(true);
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Helmet>
        <title>The Vent Guys | NADCA Certified Duct & Dryer Vent Cleaning</title>
        <meta name="description" content="Professional NADCA-certified air duct and dryer vent cleaning in Brevard County. Photo-verified results, 48-hour SLA, and no hidden fees. Book your free air check today." />
      </Helmet>

      {/* TRUST STRIP */}
      <div className="bg-blue-900 text-white py-2 px-4 text-center text-xs md:text-sm font-medium sticky top-16 md:top-20 z-40 shadow-sm">
        <div className="container mx-auto flex flex-wrap justify-center gap-3 md:gap-8 items-center">
          <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400 fill-yellow-400" /> 4.9/5 Google Rated</span>
          <span className="hidden md:inline opacity-50">|</span>
          <span className="flex items-center gap-1"><BadgeCheck className="w-3 h-3 text-blue-300" /> NADCA Certified</span>
          <span className="hidden md:inline opacity-50">|</span>
          <span className="flex items-center gap-1"><Camera className="w-3 h-3 text-blue-300" /> Photo-Verified Work</span>
          <span className="hidden md:inline opacity-50">|</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-blue-300" /> 48-Hour SLA</span>
        </div>
      </div>

      {/* HERO SECTION */}
      <section className="relative bg-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            alt="Clean modern living room with good air quality" 
            className="w-full h-full object-cover opacity-30" 
            src="https://images.unsplash.com/photo-1656122381069-9ec666d95cf1" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-slate-900/40"></div>
        </div>

        <div className="container mx-auto px-4 py-16 md:py-24 lg:py-32 relative z-10">
          <div className="max-w-3xl">
            <div className="flex gap-2 mb-6 flex-wrap">
               <span className="bg-blue-600/20 border border-blue-500/30 text-blue-200 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                 Serving Brevard County
               </span>
               <span className="bg-green-600/20 border border-green-500/30 text-green-200 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                 <ShieldCheck className="w-3 h-3" /> Fully Insured
               </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-6 text-white">
              NADCA-Level Duct & Dryer Vent Cleaning — <span className="text-blue-400">Photo-Verified.</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-slate-300 mb-8 leading-relaxed max-w-2xl">
              No hidden fees. No mess. Documented results you can trust with our 48-Hour SLA guarantee.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg h-14 px-8 shadow-lg shadow-blue-900/20"
                asChild
                onClick={() => trackBookClick('hero_primary')}
              >
                <Link to="/booking">Book Online</Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="bg-transparent border-slate-400 text-white hover:bg-white/10 hover:text-white hover:border-white font-semibold text-lg h-14 px-8"
                asChild
                onClick={() => trackCallClick('hero_secondary')}
              >
                <a href="tel:3213609704">Call Now</a>
              </Button>
            </div>

            <div className="mt-10 pt-8 border-t border-slate-800 flex flex-wrap gap-6 md:gap-12 items-center opacity-90">
               <div className="bg-white rounded-md p-2 shadow-sm flex items-center justify-center h-16 w-auto">
                 <img 
                   src="https://horizons-cdn.hostinger.com/4261d516-4b17-442c-85b4-1d2769a22a04/f4b1326b89f7e33e3c403875e9f7442a.png" 
                   alt="NADCA Certified Member Seal" 
                   className="h-full w-auto object-contain" 
                 />
               </div>

               <div className="bg-white rounded-md p-2 shadow-sm flex items-center justify-center h-24 w-auto">
                 <img
                    src="https://horizons-cdn.hostinger.com/4261d516-4b17-442c-85b4-1d2769a22a04/66cfd791bc41361d9e6457d872f80a87.png"
                    alt="The Vent Guys Clean Air Standard Badge"
                    className="h-full w-auto object-contain"
                  />
               </div>

               <div className="flex items-center gap-3">
                 <div className="flex flex-col items-center justify-center bg-white/10 rounded-lg h-16 px-3 min-w-[80px] border border-white/10">
                    <span className="font-bold text-2xl text-white leading-none">4.9</span>
                    <div className="flex text-yellow-400 mt-1">
                      <Star className="w-3 h-3 fill-current" />
                      <Star className="w-3 h-3 fill-current" />
                      <Star className="w-3 h-3 fill-current" />
                      <Star className="w-3 h-3 fill-current" />
                      <Star className="w-3 h-3 fill-current" />
                    </div>
                 </div>
                 <span className="font-bold text-white text-sm hidden sm:block">Google<br/>Rated</span>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* NEW SPECIALS SECTION */}
      <SpecialsSection />

      {/* OFFER BLOCK */}
      <section className="py-16 bg-blue-50 border-y border-blue-100">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center gap-12 max-w-5xl mx-auto">
            <div className="flex-1 space-y-6">
              <div className="inline-block bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide mb-2">
                Limited Time Offer
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
                Free In-Home Air Check
                <span className="block text-lg font-normal text-slate-600 mt-2">(15–20 Minute Inspection)</span>
              </h2>
              <p className="text-slate-700 text-lg">
                Not sure if you need cleaning? We'll come out, inspect your system, and give you an honest assessment with photos.
              </p>
              
              <ul className="space-y-3">
                {[
                  "Visual checklist of your system's health",
                  "Photo documentation of any issues found",
                  "No-pressure educational consultation",
                  "Clear next-step recommendations"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-700">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button 
                  size="lg" 
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                  onClick={handleFreeAirCheckClick}
                >
                  Book Your Free Air Check
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-blue-200 text-blue-700 hover:bg-blue-50"
                  asChild
                  onClick={() => trackCallClick('offer_block')}
                >
                  <a href="tel:3213609704">Call Now</a>
                </Button>
              </div>
            </div>
            <div className="flex-1 w-full max-w-md">
               <div className="bg-white p-6 rounded-2xl shadow-xl border border-blue-100 relative overflow-hidden">
                 <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-bl-lg">
                   $0 Cost
                 </div>
                 <img 
                   alt="Technician showing inspection results on a tablet to a homeowner" 
                   className="w-full h-64 object-cover rounded-lg mb-4"
                  src="https://images.unsplash.com/photo-1634967389630-b6bbab0fab7e" />
                 <div className="text-center">
                   <p className="font-bold text-slate-800">"I didn't know what was in my vents until they showed me."</p>
                   <div className="flex justify-center text-yellow-400 mt-2 mb-1">
                     <Star className="w-4 h-4 fill-current" />
                     <Star className="w-4 h-4 fill-current" />
                     <Star className="w-4 h-4 fill-current" />
                     <Star className="w-4 h-4 fill-current" />
                     <Star className="w-4 h-4 fill-current" />
                   </div>
                   <p className="text-xs text-slate-500">- Sarah M., Palm Bay</p>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROGRAMS ROW & NEW CTA */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Our Core Services</h2>
            <p className="text-slate-600 mt-4">Specialized solutions for every need</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
            {/* Card 1 */}
            <Card className="hover:shadow-lg transition-shadow border-slate-200">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <div className="text-blue-600 font-bold text-xl">💨</div>
                </div>
                <CardTitle className="text-xl">Dryer Vent Cleaning</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-6">
                  Prevent fires and improve efficiency. We clean the entire run from connection to termination point, measuring airflow before and after.
                </p>
                <Link to="/services" className="text-blue-600 font-semibold hover:text-blue-800 inline-flex items-center group">
                  Learn More <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
              </CardContent>
            </Card>

            {/* Card 2 */}
            <Card className="hover:shadow-lg transition-shadow border-slate-200">
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <BadgeCheck className="w-6 h-6 text-green-600" />
                </div>
                <CardTitle className="text-xl">NADCA Duct Cleaning</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-6">
                  Comprehensive source removal cleaning for your HVAC system. Adhering strictly to NADCA ACR 2021 standards for indoor air quality.
                </p>
                <Link to="/services" className="text-blue-600 font-semibold hover:text-blue-800 inline-flex items-center group">
                  Learn More <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
              </CardContent>
            </Card>

            {/* Card 3 */}
            <Card className="hover:shadow-lg transition-shadow border-slate-200">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <div className="text-purple-600 font-bold text-xl">🏢</div>
                </div>
                <CardTitle className="text-xl">Property Manager Program</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-6">
                  Volume pricing and automated scheduling for HOAs and property managers. Keep your residents safe and compliant effortlessly.
                </p>
                <Link to="/property-managers" className="text-blue-600 font-semibold hover:text-blue-800 inline-flex items-center group">
                  Learn More <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="max-w-6xl mx-auto">
            <div className="bg-gradient-to-r from-slate-900 to-blue-900 rounded-xl p-8 md:p-10 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
               <div className="flex-1">
                  <h3 className="text-2xl md:text-3xl font-bold mb-2">Curious about pricing?</h3>
                  <p className="text-blue-100 text-lg">Use our new online estimator to get a customized quote for your specific home size and needs instantly.</p>
               </div>
               <div className="flex-shrink-0">
                  <Button size="lg" className="bg-yellow-400 hover:bg-yellow-500 text-yellow-950 font-bold text-lg h-14 px-8 shadow-md" onClick={handleEstimatorClick}>
                       <Calculator className="mr-2 h-5 w-5" />
                       Get Your Estimate
                  </Button>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 bg-blue-900 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Breathe Cleaner Air?</h2>
          <p className="text-blue-200 text-xl mb-8 max-w-2xl mx-auto">
            Schedule your service today and experience the difference of a professional, photo-verified cleaning.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button 
              size="lg" 
              className="bg-white text-blue-900 hover:bg-blue-50 font-bold h-14 px-8"
              asChild
              onClick={() => trackBookClick('footer_cta')}
            >
              <Link to="/booking">Book Online Now</Link>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-blue-400 text-blue-100 hover:bg-blue-800 hover:text-white h-14 px-8"
              asChild
              onClick={() => trackCallClick('footer_cta')}
            >
              <a href="tel:3213609704">Call (321) 360-9704</a>
            </Button>
          </div>
        </div>
      </section>

      <FreeAirCheckModal open={showAirCheckModal} onOpenChange={setShowAirCheckModal} />
      <EstimateWizard open={showEstimator} onOpenChange={setShowEstimator} />
    </div>
  );
};

export default Home;