import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Shield, Award, CheckCircle, Droplets, Wind, Sparkles, Snowflake } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PortStJohn = () => {
    
    const offers = [
      { title: '$149 IAQ Audit', description: 'Humidity/temperature readings, visual particulate assessment, photo documentation, and a written Good/Better/Best plan. $149 credited to any Mechanical Hygiene service within 30 days.', cta: 'Book $149 IAQ Audit', link: '/contact' },
      { title: 'Free In-Home Air Check', description: '15–20 minute visual walkthrough. No tools, no pressure—just an expert opinion.', cta: 'Schedule Free Check', link: '/contact' },
      { title: 'Mechanical Hygiene Plan', description: 'Filters, coils, drains, and ducts serviced to NADCA baselines with photo proof.', cta: 'Learn More', link: '/services' },
    ];

    const warningSigns = [
        { icon: Droplets, title: 'Indoor humidity >60%', text: 'When indoor RH stays above 60%, moisture condenses on coils, pans, and even inside returns. That fuels musty odors and dust that clings to surfaces. We verify readings, check for sweating at the coil/pan, and document drain performance. The fix is targeted hygiene and better moisture control—not deodorizer.' },
        { icon: Wind, title: 'Musty or “old house” odor after AC stops', text: 'If odors bloom when the system cycles off, there’s usually residue on coils/returns or water lingering in the pan/drain. We photograph what we find and clean to hygiene baselines. You’ll receive before/after photos and simple prevention tips.' },
        { icon: Sparkles, title: 'Dark lines on vents / dust streaks', text: 'Those gray halos around vent registers signal particulate recirculation. We inspect filters, returns, and accessible duct sections, then remove the buildup that feeds the streaks. Expect less dusting and clearer air once the source is addressed.' },
        { icon: Snowflake, title: 'Condensation or “sweating” at coils/pans', text: 'Visible sweating tells us the system is struggling to drain moisture. We check pan pitch, drain flow, and coil surfaces. Clearing the drain and restoring coil hygiene are quick wins that protect the system and improve comfort.' },
    ];
    
    const faqs = [
        { q: "Why is the IAQ Audit $149?", a: "You receive measurements, photos, and a prioritized plan—and we credit the $149 toward any Mechanical Hygiene service within 30 days." },
        { q: "Free Check vs. Audit?", a: "Free Check = quick visual. Audit = readings, photos, and a written Good/Better/Best plan." },
        { q: "Do you handle microbial growth?", a: "Assessment and remediation for microbial growth are separate in Florida. We provide diagnostics/mechanical hygiene and refer/partner for remediation when needed." },
        { q: "How soon can you come to Port St. John?", a: "Port St. John and Cocoa addresses are prioritized. Most visits within 48 hours."}
    ];

    const jsonLdFaq = {
      "@context":"https://schema.org",
      "@type":"FAQPage",
      "mainEntity": faqs.map(faq => ({
            "@type": "Question",
            "name": faq.q,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": faq.a
            }
        }))
    };

    return (
        <>
            <Helmet>
                <title>Indoor Air Quality in Port St. John | The Vent Guys</title>
                <meta name="description" content="IAQ testing and mechanical hygiene in Port St. John. NADCA-Certified, veteran-owned. Book a $149 IAQ Audit (credited if you proceed) or schedule a free in-home air check." />
                <script type="application/ld+json">{`
                    {
                        "@context":"https://schema.org",
                        "@type":"Service",
                        "name":"Indoor Air Quality & Mechanical Hygiene – Port St. John",
                        "provider":{"@type":"LocalBusiness","name":"The Vent Guys"},
                        "areaServed":{"@type":"Place","name":"Port St. John, FL"},
                        "offers":{"@type":"Offer","price":"149.00","priceCurrency":"USD"},
                        "serviceType":"Indoor Air Quality Audit, Duct & Coil Mechanical Hygiene",
                        "description":"IAQ testing and mechanical hygiene in Port St. John. $149 IAQ Audit with photos and a Good/Better/Best plan. Fee credited to any Mechanical Hygiene service within 30 days."
                    }
                `}</script>
                <script type="application/ld+json">{JSON.stringify(jsonLdFaq)}</script>
            </Helmet>

            {/* Hero Section */}
            <section className="relative bg-[#091e39] text-white py-20 md:py-24 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url('https://horizons-cdn.hostinger.com/4261d516-4b17-442c-85b4-1d2769a22a04/2ceb8cf2dda5044ec4c2b4ace9213ead.png')`, backgroundSize: '300px', backgroundRepeat: 'repeat' }}></div>
                <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-5xl md:text-6xl font-bold mb-4 leading-tight title-case">
                        Port St. John IAQ Services: Mechanical Hygiene Done Right.
                    </motion.h1>
                    <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="text-lg text-[#d1d3d4] mb-8 max-w-3xl mx-auto">
                       Indoor air quality testing and photo-documented hygiene built for Florida humidity. <strong className="text-white">$149 IAQ Audit (credited if you proceed).</strong>
                    </motion.p>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                        <Link to="/contact"><Button size="lg" className="bg-[#b52025] hover:bg-[#831618] uppercase tracking-wider">Book $149 IAQ Audit</Button></Link>
                        <Link to="/contact"><Button size="lg" variant="outline" className="border-[#f1b57b] text-[#f1b57b] hover:bg-[#f1b57b] hover:text-[#091e39] uppercase tracking-wider">Schedule Free In-Home Air Check</Button></Link>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="flex justify-center items-center space-x-4 sm:space-x-6 text-sm text-[#939393]">
                        <span className="flex items-center"><Award className="h-4 w-4 mr-1.5 text-[#f1b57b]" /> NADCA Certified</span>
                        <span className="flex items-center"><Shield className="h-4 w-4 mr-1.5 text-[#f1b57b]" /> SDVOSB</span>
                        <span className="flex items-center"><CheckCircle className="h-4 w-4 mr-1.5 text-[#f1b57b]" /> Certified & Insured</span>
                    </motion.div>
                </div>
            </section>

            {/* Local Intro */}
            <section className="py-16 bg-white">
                 <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <p className="text-lg text-[#231f20]">From neighborhoods along <strong className="text-[#173861]">US-1</strong> to communities near <strong className="text-[#173861]">Fay Boulevard</strong>, homes in Port St. John fight humidity, dust, and lingering odors. We test what’s inside your system, show you the photos, and fix it with a health-first, NADCA-Certified process built for the Space Coast.</p>
                 </div>
            </section>

            {/* 3 Core Offers */}
            <section className="pt-8 pb-20 bg-white">
              <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {offers.map((offer, index) => (
                    <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }} className="bg-white p-8 rounded-xl shadow-lg text-center border-t-4 border-[#b52025] hover:shadow-2xl hover:-translate-y-2 transition-all flex flex-col">
                      <h3 className="text-2xl text-[#091e39] mb-3 title-case">{offer.title}</h3>
                      <p className="text-[#939393] flex-grow mb-6">{offer.description}</p>
                      <Link to={offer.link}>
                          <Button variant={index === 0 ? "default" : "outline"} className={`w-full uppercase tracking-wider ${index === 0 ? 'bg-[#b52025] hover:bg-[#831618]' : 'border-[#b52025] text-[#b52025] hover:bg-[#b52025] hover:text-white'}`}>
                              {offer.cta}
                          </Button>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>
            
            {/* Warning Signs Section */}
            <section className="py-20 bg-[#d1d3d4]/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl text-[#091e39] mb-4 title-case">Warning Signs in Your Home</h2>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8">
                        {warningSigns.map((sign, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="flex items-start space-x-4">
                                <sign.icon className="h-8 w-8 text-[#b52025] flex-shrink-0 mt-1" />
                                <div>
                                    <h3 className="text-xl font-semibold text-[#091e39] title-case">{sign.title}</h3>
                                    <p className="text-[#231f20]">{sign.text}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-20 bg-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                     <div className="text-center mb-12">
                        <h2 className="text-4xl md:text-5xl text-[#091e39] mb-4 title-case">Port St. John IAQ: Frequently Asked Questions</h2>
                    </div>
                    <div className="space-y-4">
                        {faqs.map((faq, index) => (
                             <details key={index} className="bg-gray-50 p-6 rounded-lg shadow-sm cursor-pointer group" open={index === 0}>
                                <summary className="font-semibold text-lg text-[#091e39] flex justify-between items-center list-none">
                                    {faq.q}
                                    <div className="ml-2 transition-transform transform group-open:rotate-180">
                                        <ChevronDown className="h-5 w-5" />
                                    </div>
                                </summary>
                                <p className="mt-4 text-[#231f20]">{faq.a}</p>
                             </details>
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
};

const ChevronDown = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

export default PortStJohn;