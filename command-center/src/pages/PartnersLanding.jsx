import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, 
  Wind, 
  Home, 
  Building2, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  ClipboardCheck, 
  FileText,
  Download,
  GraduationCap,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import PartnerRegistrationForm from '@/components/PartnerRegistrationForm';
import VolumeCalculator from '@/components/partners/VolumeCalculator';

const PartnersLanding = () => {
  const navigate = useNavigate();

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  };

  const partners = [
      { 
          id: 'realtor',
          title: "Real Estate Agents", 
          icon: Home,
          link: "/partners/realtor",
          color: "bg-blue-100 text-blue-700",
          bullets: ["Pre-listing air checks", "Pass/Fail hygiene audits", "Clean Air Certified badge"] 
      },
      { 
          id: 'pm',
          title: "Property Managers", 
          icon: Building2,
          link: "/partners/property-manager",
          color: "bg-purple-100 text-purple-700",
          bullets: ["Portfolio scheduling", "Tenant complaint defense", "Turnover deep cleans"] 
      },
      { 
          id: 'investor',
          title: "Investors / Landlords", 
          icon: Users,
          link: "/partners/realtor", 
          color: "bg-yellow-100 text-yellow-700",
          bullets: ["Asset protection", "Mold prevention audits", "Renovation clean-up"] 
      },
      { 
          id: 'hoa',
          title: "HOAs & Boards", 
          icon: ClipboardCheck,
          link: "/partners/hoa",
          color: "bg-green-100 text-green-700",
          bullets: ["Dryer vent safety", "Multi-unit compliance", "Volume pricing"] 
      }
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <Helmet>
        <title>Clean Air Partnership Program | The Vent Guys</title>
        <meta name="description" content="Partner with The Vent Guys to protect indoor air quality in your listings and portfolios. For Agents, Property Managers, and HOAs." />
      </Helmet>

      {/* 1) HERO SECTION */}
      <section className="relative bg-[#1B263B] text-white pt-24 pb-32 overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-[#D7263D] rounded-full opacity-10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-blue-500 rounded-full opacity-10 blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col lg:flex-row gap-12 items-center">
            <div className="lg:w-3/5 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1 mb-6 border border-white/20 backdrop-blur-sm">
                    <ShieldCheck className="w-4 h-4 text-[#D7263D]" />
                    <span className="text-xs md:text-sm font-medium tracking-wide uppercase">Official Partner Program</span>
                </div>
                
                <h1 className="text-4xl md:text-6xl font-bold mb-6 font-oswald tracking-tight leading-tight">
                    Clean Air Partnership Program <br/>
                    <span className="text-blue-200 text-2xl md:text-4xl font-normal block mt-2">for Agents & Property Managers</span>
                </h1>
                
                <p className="text-lg md:text-xl text-gray-300 mb-8 font-light leading-relaxed max-w-2xl mx-auto lg:mx-0">
                    Protect the people who live in your properties, reduce health complaints, and turn indoor air quality into a selling point—not a liability.
                </p>
                
                <div className="mb-8 text-sm text-gray-400 bg-black/20 inline-block px-4 py-2 rounded-lg border border-white/5">
                    <span className="font-semibold text-white">The Vent Guys:</span> Specialists in mechanical hygiene & indoor air quality. We are NOT an HVAC maintenance contractor.
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                    <Button 
                        onClick={() => scrollToSection('who-we-partner-with')} 
                        size="lg" 
                        className="bg-[#D7263D] hover:bg-[#b01c2e] text-white text-lg px-8 py-6 h-auto shadow-lg shadow-red-900/20"
                    >
                        Apply for Partnership
                    </Button>
                    <Button 
                        onClick={() => scrollToSection('how-it-works')}
                        variant="outline" 
                        className="border-white text-white hover:bg-white hover:text-[#1B263B] text-lg px-8 py-6 h-auto"
                    >
                        How the Program Works
                    </Button>
                </div>
            </div>

            <div className="hidden lg:block lg:w-2/5">
                <div className="bg-white text-slate-900 p-6 rounded-2xl shadow-2xl border-t-4 border-[#D7263D] relative transform rotate-2 hover:rotate-0 transition-transform duration-500">
                    <div className="absolute -top-4 -right-4 bg-green-600 text-white rounded-full p-3 shadow-lg">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <h3 className="font-oswald font-bold text-2xl mb-2 text-[#1B263B]">Clean Air Certified™</h3>
                    <p className="text-gray-600 text-sm mb-4">
                        Differentiate your listings. When a property passes our rigorous NADCA-aligned inspection, it earns the badge.
                    </p>
                    <div className="bg-gray-100 rounded-md p-3 font-mono text-xs text-gray-600 border border-gray-200">
                        <span className="text-gray-400 block mb-1 text-[10px]">MLS REMARKS EXAMPLE:</span>
                        "This home is Clean Air Certified by The Vent Guys. Mechanical hygiene audit passed; ducts verified clean. Documentation available."
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* 2) WHO WE PARTNER WITH */}
      <section id="who-we-partner-with" className="py-20 bg-white scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-[#1B263B] mb-4 font-oswald">Select Your Industry</h2>
                <p className="text-lg text-gray-600">
                    Click your role below to start your specific partner application.
                </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                {partners.map((card, idx) => (
                    <motion.div 
                        key={idx} 
                        whileHover={{ y: -5 }}
                        className="group cursor-pointer h-full"
                        onClick={() => navigate(card.link)}
                    >
                        <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all h-full flex flex-col">
                            <div className={`w-14 h-14 ${card.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                <card.icon className="w-7 h-7" />
                            </div>
                            <h3 className="font-bold text-xl mb-4 text-[#1B263B] group-hover:text-blue-700 flex items-center justify-between">
                                {card.title}
                                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </h3>
                            <ul className="space-y-2 mb-6 flex-grow">
                                {card.bullets.map((bullet, bIdx) => (
                                    <li key={bIdx} className="flex items-start gap-2 text-sm text-gray-600">
                                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                        {bullet}
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-auto pt-4 border-t border-gray-200">
                                <span className="text-sm font-medium text-blue-600 group-hover:underline">Apply as {card.title.split(' ')[0]} &rarr;</span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
      </section>

      {/* 2.5) VOLUME PRICING CALCULATOR SECTION (NEW) */}
      <section className="py-24 bg-slate-900 text-white overflow-hidden relative">
         <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-900/20 transform skew-x-12 translate-x-32"></div>
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
             <div className="grid lg:grid-cols-2 gap-16 items-center">
                 <div>
                    <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 rounded-full px-4 py-1 mb-6 border border-blue-400/20">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-sm font-medium">Portfolio Pricing Available</span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold font-oswald mb-6">
                        Scale Your Portfolio,<br/>
                        <span className="text-blue-400">Boost Your Margins.</span>
                    </h2>
                    <p className="text-lg text-gray-300 mb-8 leading-relaxed">
                        We reward volume. Property Managers and Institutional Investors unlock automatic discount tiers based on monthly service volume. The more units we service, the less you pay.
                    </p>
                    
                    <ul className="space-y-6">
                        <li className="flex gap-4">
                            <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-400 font-bold shrink-0">1</div>
                            <div>
                                <h4 className="font-bold text-xl mb-1">Guaranteed Monthly Availability</h4>
                                <p className="text-gray-400 text-sm">Volume partners get reserved slots in our schedule to ensure turnover deadlines are met.</p>
                            </div>
                        </li>
                        <li className="flex gap-4">
                            <div className="w-12 h-12 bg-green-600/20 rounded-xl flex items-center justify-center text-green-400 font-bold shrink-0">2</div>
                            <div>
                                <h4 className="font-bold text-xl mb-1">Automated Tier Upgrades</h4>
                                <p className="text-gray-400 text-sm">Our system tracks your booking volume and automatically applies higher discount tiers as you grow.</p>
                            </div>
                        </li>
                    </ul>
                 </div>
                 
                 <div>
                     <VolumeCalculator />
                 </div>
             </div>
         </div>
      </section>

      {/* 3) WHY IAQ MATTERS */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row gap-12 items-center">
                <div className="md:w-1/2">
                    <div className="relative">
                        <img alt="Dirty air duct close up" className="rounded-2xl shadow-xl border-4 border-white w-full" src="https://images.unsplash.com/photo-1537806239205-a57710afa1d7" />
                        <div className="absolute -bottom-6 -right-6 bg-white p-4 rounded-xl shadow-lg border border-gray-100 max-w-xs hidden md:block">
                            <div className="flex items-center gap-2 text-[#D7263D] font-bold mb-1">
                                <AlertTriangle className="w-5 h-5" /> Invisible Risks
                            </div>
                            <p className="text-xs text-gray-500">Most contamination (mold, fiberglass, construction dust) is hidden deep in the mechanical lines.</p>
                        </div>
                    </div>
                </div>
                <div className="md:w-1/2">
                    <h2 className="text-3xl md:text-4xl font-bold text-[#1B263B] mb-6 font-oswald">Why Indoor Air Quality Matters</h2>
                    <p className="text-gray-600 mb-6 text-lg">
                        Most problems are invisible until they aren't. Particles, moisture, and mold in ducts often go unnoticed during standard inspections but cause major headaches later.
                    </p>
                    
                    <div className="space-y-4 mb-8">
                        {[
                            "Tenant health complaints & liability",
                            "Failed inspections or compliance issues",
                            "Surprise expenses after closing",
                            "Lost trust with buyers or residents"
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-[#D7263D]" />
                                <span className="font-medium text-gray-700">{item}</span>
                            </div>
                        ))}
                    </div>

                    <div className="bg-blue-100 p-4 rounded-lg border-l-4 border-blue-600">
                        <p className="text-blue-900 text-sm font-medium">
                            "We are not your HVAC maintenance vendor; we focus on the health side of mechanical hygiene and work alongside your HVAC contractor and licensed mold remediator."
                        </p>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* 4) PROGRAM OVERVIEW */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <span className="text-[#D7263D] font-bold tracking-wider uppercase text-sm">Program Methodology</span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1B263B] mb-4 font-oswald mt-2">What Is the Clean Air Partnership?</h2>
            <p className="text-gray-600 max-w-2xl mx-auto mb-16">
                Think of us as your IAQ support arm. We don't just "clean vents"—we manage the hygiene of the entire mechanical breathing system.
            </p>

            <div className="grid md:grid-cols-3 gap-8 text-left">
                <div className="border-t-4 border-blue-500 p-8 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-5xl font-black text-blue-100 mb-4">01</div>
                    <h3 className="text-xl font-bold text-[#1B263B] mb-3">Assess</h3>
                    <p className="text-gray-600 leading-relaxed">
                        Free or low-cost walkthroughs and IAQ audits tailored to your property type. We identify red flags before they become crises.
                    </p>
                </div>
                <div className="border-t-4 border-purple-500 p-8 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-5xl font-black text-purple-100 mb-4">02</div>
                    <h3 className="text-xl font-bold text-[#1B263B] mb-3">Plan</h3>
                    <p className="text-gray-600 leading-relaxed">
                        Prioritized recommendations with Good / Better / Best options and clear cost ranges. You get defensible data to make decisions.
                    </p>
                </div>
                <div className="border-t-4 border-green-500 p-8 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-5xl font-black text-green-100 mb-4">03</div>
                    <h3 className="text-xl font-bold text-[#1B263B] mb-3">Protect</h3>
                    <p className="text-gray-600 leading-relaxed">
                        Ongoing checks, certification updates, and education so your portfolio keeps breathing clean. We help you stay compliant.
                    </p>
                </div>
            </div>
        </div>
      </section>

      {/* 5) REQUEST INFO SECTION */}
      <section id="request-info" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16">
                {/* Left: Logic Explainer */}
                <div>
                    <h2 className="text-4xl font-bold text-[#1B263B] mb-6 font-oswald">
                        Have Questions?
                    </h2>
                    <p className="text-lg text-gray-600 mb-8">
                        Not ready to apply for a partner role yet? No problem. Fill out this form to get a program guide and connect with our team.
                    </p>

                    <div className="bg-slate-50 rounded-xl p-8 border border-slate-100">
                        <h4 className="font-bold text-[#1B263B] mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-blue-500" /> Why Connect First?
                        </h4>
                        <ul className="space-y-4">
                            <li className="flex gap-3">
                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs">1</div>
                                <div>
                                    <h5 className="font-bold text-sm text-gray-900">Custom Pricing</h5>
                                    <p className="text-sm text-gray-500">We can discuss volume discounts tailored to your portfolio size.</p>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs">2</div>
                                <div>
                                    <h5 className="font-bold text-sm text-gray-900">Integration</h5>
                                    <p className="text-sm text-gray-500">Learn how we integrate with AppFolio, Buildium, or your work order system.</p>
                                </div>
                            </li>
                            <li className="flex gap-3">
                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs">3</div>
                                <div>
                                    <h5 className="font-bold text-sm text-gray-900">Education</h5>
                                    <p className="text-sm text-gray-500">Schedule a "Lunch & Learn" for your team about mold risks.</p>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Right: Request Info Form */}
                <div>
                    <PartnerRegistrationForm />
                </div>
            </div>
        </div>
      </section>

      {/* 6) FAQ + FINAL CTA */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center mb-12 font-oswald text-[#1B263B]">Frequently Asked Questions</h2>
            
            <Accordion type="single" collapsible className="w-full mb-16">
                <AccordionItem value="item-1">
                    <AccordionTrigger className="text-left font-medium text-lg">Do you replace our HVAC contractor?</AccordionTrigger>
                    <AccordionContent className="text-gray-600">
                        No. We work alongside them. We specialize in the hygiene and cleaning of the system, while they focus on the mechanical repair and maintenance. We often refer repair work back to your preferred HVAC vendor.
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                    <AccordionTrigger className="text-left font-medium text-lg">Is Clean Air Certification the same as a code inspection?</AccordionTrigger>
                    <AccordionContent className="text-gray-600">
                        No. It is a voluntary hygiene standard based on NADCA (National Air Duct Cleaners Association) guidelines. It verifies that the ventilation system is physically clean, but it does not certify mechanical code compliance.
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                    <AccordionTrigger className="text-left font-medium text-lg">What does it cost to become a Clean Air Partner?</AccordionTrigger>
                    <AccordionContent className="text-gray-600">
                        Registration is free. Tier 1 benefits are free. Higher tiers (Portfolio Programs) may have volume commitments or service agreements, but the core partnership is open to all qualified professionals at no cost.
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-4">
                    <AccordionTrigger className="text-left font-medium text-lg">Do you work outside Central Florida?</AccordionTrigger>
                    <AccordionContent className="text-gray-600">
                        Currently, our primary service area is Brevard County and surrounding areas (Volusia, Indian River). Contact us for large commercial portfolios outside this range.
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            {/* Final CTA Card */}
            <div className="bg-[#1B263B] rounded-2xl p-8 md:p-12 text-center text-white shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-blue-900/50 to-[#D7263D]/20"></div>
                 <div className="relative z-10">
                    <h3 className="text-3xl font-bold font-oswald mb-4">Ready to Turn Clean Air into a Selling Point?</h3>
                    <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
                        Apply for partnership today or request info to discuss your portfolio needs.
                    </p>
                    <div className="flex justify-center gap-4 flex-col sm:flex-row">
                        <Button onClick={() => scrollToSection('who-we-partner-with')} size="lg" className="bg-[#D7263D] hover:bg-[#b01c2e] text-white font-bold">
                            Apply Now
                        </Button>
                        <Button onClick={() => scrollToSection('request-info')} size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-[#1B263B] w-full sm:w-auto">
                            Request Info
                        </Button>
                    </div>
                 </div>
            </div>
        </div>
      </section>
    </div>
  );
};

export default PartnersLanding;