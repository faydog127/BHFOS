import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  ShieldCheck, 
  AlertTriangle, 
  Wind, 
  ArrowRight,
  Search,
  Camera,
  Ban,
  HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from '@/components/ui/card';

const Standards = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>NADCA Standards: What They Require & How We Exceed Them | The Vent Guys</title>
        <meta name="description" content="We strictly follow NADCA's ACR Standard for HVAC cleaning: source removal, negative pressure, and agitation. Then we add photo proof and flat-rate transparency." />
      </Helmet>

      {/* Hero Section */}
      <section className="bg-[#1B263B] text-white py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-4 py-1 text-blue-200 text-sm font-medium mb-6">
            <ShieldCheck className="w-4 h-4" />
            <span>The Gold Standard of Air Duct Cleaning</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
            NADCA Standards: What They Require—<br className="hidden md:block" />And How We Exceed Them
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            NADCA's ACR Standard is the rulebook for professional HVAC/air-duct cleaning. It mandates source removal using negative pressure, mechanical agitation, controlled containment, and verification. We build our entire process on it—then add photo proof and flat-rate transparency.
          </p>
        </div>
      </section>

      {/* What is NADCA ACR Section */}
      <section className="py-16 md:py-20 bg-white">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">What Is NADCA ACR (In Plain English)?</h2>
            <div className="w-20 h-1 bg-[#D7263D] mx-auto rounded-full"></div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mb-10">
            {[
              {
                title: "Source Removal",
                desc: "Dust and debris must be physically removed from the system, not just blown around or encapsulated."
              },
              {
                title: "Negative Pressure",
                desc: "A powerful vacuum is attached to the trunk line to keep particles from entering the home during cleaning."
              },
              {
                title: "Mechanical Agitation",
                desc: "Whips, brushes, and air skippers scrub duct interiors so debris actually releases from the walls."
              },
              {
                title: "Access & Containment",
                desc: "Proper access openings and sealed work zones prevent cross-contamination of your living space."
              },
              {
                title: "Verification",
                desc: "Post-clean inspection confirms the system is truly clean according to measurable standards."
              }
            ].map((item, idx) => (
              <div key={idx} className="flex gap-4 items-start p-4 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="bg-blue-100 p-2 rounded-full shrink-0 mt-1">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg mb-1">{item.title}</h3>
                  <p className="text-slate-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-900/5 border-l-4 border-blue-600 p-6 rounded-r-lg">
            <p className="text-blue-900 font-medium text-lg flex gap-3 items-center">
              <Wind className="w-6 h-6 shrink-0" />
              "If a company isn't talking about negative pressure and mechanical agitation, they're not cleaning to the standard."
            </p>
          </div>
        </div>
      </section>

      {/* Our Method Steps */}
      <section className="py-16 bg-slate-50 border-y border-slate-200">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">Our NADCA-Aligned Method (Step-By-Step)</h2>
          
          <div className="space-y-8">
            {[
              {
                step: 1,
                title: "Assessment & Protection",
                desc: "We inspect the system first to identify issues. Drop cloths and booties are used to protect your home."
              },
              {
                step: 2,
                title: "Negative Pressure Setup",
                desc: "We connect our HEPA-filtered vacuum to your main trunk line, creating a vacuum seal for the entire system."
              },
              {
                step: 3,
                title: "Agitation (The Scrub)",
                desc: "While under vacuum, we use air whips and brushes down every vent to dislodge stuck-on dust."
              },
              {
                step: 4,
                title: "Component Cleaning",
                desc: "We clean the blower motor, coils, and registers to ensure the heart of the system is efficient."
              },
              {
                step: 5,
                title: "Verification & Photo Proof",
                desc: "We show you the results. If it's not clean, we're not done. You get a full report."
              }
            ].map((item) => (
              <div key={item.step} className="flex md:items-center gap-6 relative group">
                {/* Connector Line */}
                <div className={`absolute left-[27px] top-16 bottom-[-32px] w-0.5 bg-slate-200 group-last:hidden`}></div>
                
                <div className="w-14 h-14 rounded-full bg-white border-2 border-[#D7263D] text-[#D7263D] flex items-center justify-center font-bold text-2xl shrink-0 shadow-sm z-10">
                  {item.step}
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex-1">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-slate-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What to Expect & Beyond Minimum */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12">
            {/* What to Expect */}
            <div>
              <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Search className="w-6 h-6 text-blue-600" />
                Expectations for Compliant Cleaning
              </h3>
              <ul className="space-y-4">
                {[
                  "Full inspection of the system before starting.",
                  "Strict containment to protect your living areas.",
                  "Use of specialized agitation tools (not just air).",
                  "Equipment that captures debris (HEPA or vented outside).",
                  "Honest reporting of any mold or damage found."
                ].map((point, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-700">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* Beyond Minimum */}
            <div className="bg-[#1B263B] text-white p-8 rounded-2xl shadow-xl">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-[#D7263D]" />
                Where We Go Beyond the Minimum
              </h3>
              <ul className="space-y-5">
                {[
                  "Photo Verification: We don't just say it's clean; we prove it with clear photos.",
                  "Flat-Rate Transparency: No hidden fees or upcharges at the door.",
                  "48-Hour SLA: We prioritize reliability and communication.",
                  "Educational Approach: We explain the 'why' behind every step."
                ].map((point, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                    <span className="text-slate-200 leading-snug">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Red Flags */}
      <section className="py-16 bg-red-50/50">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900 flex items-center justify-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              Red Flags (Not NADCA-Aligned)
            </h2>
            <p className="text-slate-600 mt-4">
              If you see these signs, proceed with caution. These are common indicators of "blow-and-go" scams.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              "Offers a 'Whole House Special' for under $100.",
              "Claims the job will take less than an hour.",
              "Uses only a shop-vac at the register (no negative pressure).",
              "Refuses to show you inside the ducts before or after.",
              "Pressures you to buy UV lights or mold treatments immediately."
            ].map((flag, i) => (
              <div key={i} className="flex items-center gap-4 bg-white p-4 rounded-lg border border-red-100 shadow-sm">
                <Ban className="w-6 h-6 text-red-500 shrink-0" />
                <span className="text-slate-800 font-medium">{flag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-white border-t border-slate-100">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-10">FAQ (Fast Answers)</h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>Does NADCA membership really matter?</AccordionTrigger>
              <AccordionContent>
                Yes. It guarantees the company follows a globally recognized standard for safety and efficacy, carries liability insurance, and has certified staff on the team.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>How long does a compliant cleaning take?</AccordionTrigger>
              <AccordionContent>
                A proper source-removal cleaning for an average home takes 3-5 hours. Companies claiming 45 minutes are likely skipping critical steps.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Will the process make my house dusty?</AccordionTrigger>
              <AccordionContent>
                No. Because we put the system under negative pressure (vacuum), all dust is pulled directly into our equipment, not blown into your rooms.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>Do you use chemicals?</AccordionTrigger>
              <AccordionContent>
                Source removal (physical cleaning) is the primary method. Chemicals are only used if absolutely necessary for sanitization, and always EPA-registered and approved by you first.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-[#1B263B] text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready for a Real Clean?</h2>
          <p className="text-blue-200 text-xl mb-8 max-w-2xl mx-auto">
            Get the peace of mind that comes with verified, NADCA-compliant service.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button 
              size="lg" 
              className="bg-[#D7263D] hover:bg-[#b51f31] text-white font-bold h-14 px-8 text-lg"
              asChild
            >
              <Link to="/contact">Get a NADCA-Aligned Cleaning Quote</Link>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-slate-400 text-white hover:bg-white hover:text-[#1B263B] h-14 px-8 text-lg"
              asChild
            >
              <Link to="/gallery">See Before & After Photos</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Standards;