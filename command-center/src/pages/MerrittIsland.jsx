import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Shield, Award, CheckCircle, Droplets, Wind, Sparkles, Snowflake } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MerrittIsland = () => {
    
    const offers = [
      { title: '$149 IAQ Audit', description: 'Data-backed inspection with humidity readings, photo documentation, and a Good/Better/Best plan. $149 credited to any Mechanical Hygiene service within 30 days.', cta: 'Book $149 IAQ Audit', link: '/contact' },
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
        { q: "Why is the IAQ Audit $149?", a: "Because you’re getting real diagnostics—readings, photos, and a prioritized plan. The $149 is credited to any Mechanical Hygiene service within 30 days." },
        { q: "Free Check vs. $149 Audit?", a: "The Free Check is a quick visual. The Audit includes measurements, photos, and a written Good/Better/Best plan you keep." },
        { q: "Do you work with short-term rentals?", a: "Yes. We help hosts reduce odor complaints and provide Clean Air Certified assets for listings." },
        { q: "Do you handle microbial growth?", a: "Florida law separates assessment from remediation for microbial growth. We focus on diagnostics and mechanical hygiene and partner for remediation when needed." },
        { q: "How fast can you come to Merritt Island?", a: "Island addresses are prioritized. Most visits within 48 hours."}
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
                <title>Indoor Air Quality in Merritt Island | The Vent Guys</title>
                <meta name="description" content="IAQ testing and mechanical hygiene on Merritt Island. NADCA-Certified, veteran-owned. Book a $149 IAQ Audit (credited if you proceed) or schedule a free in-home air check." />
                <script type="application/ld+json">{`
                    {
                        "@context":"https://schema.org",
                        "@type":"Service",
                        "name":"Indoor Air Quality & Mechanical Hygiene – Merritt Island",
                        "provider":{"@type":"LocalBusiness","name":"The Vent Guys"},
                        "areaServed":{"@type":"Place","name":"Merritt Island, FL"},
                        "offers":{"@type":"Offer","price":"149.00","priceCurrency":"USD"},
                        "serviceType":"Indoor Air Quality Audit, Duct & Coil Mechanical Hygiene",
                        "description":"IAQ testing and mechanical hygiene in Merritt Island. $149 IAQ Audit with photos and a Good/Better/Best plan. Fee credited to any Mechanical Hygiene service within 30 days."
                    }
                `}</script>
                <script type="application/ld+json">{JSON.stringify(jsonLdFaq)}</script>
            </Helmet>

            {/* Hero Section */}
            <section className="relative bg-[#091e39] text-white py-20 md:py-24 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url('https://horizons-cdn.hostinger.com/4261d516-4b17-442c-85b4-1d2769a22a04/2ceb8cf2dda5044ec4c2b4ace9213ead.png')`, backgroundSize: '300px', backgroundRepeat: 'repeat' }}></div>
                <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-5xl md:text-6xl font-bold mb-4 leading-tight title-case">
                        Breathe Better with Mechanical Hygiene Done Right.
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
                    <p className="text-lg text-[#231f20]">From <strong className="text-[#173861]">South Tropical Trail</strong> to <strong className="text-[#173861]">Sykes Creek</strong>, <strong className="text-[#173861]">Newfound Harbor</strong>, and <strong className="text-[#173861]">Banana River</strong> neighborhoods, island humidity, salt air, and coastal odors linger in returns, coils, and ducts. We measure what’s happening in your system, show you the photos, and fix it with a health-first, NADCA-Certified process built for barrier-island living.</p>
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

            {/* Coastal Air Section */}
            <section className="py-20 bg-[#d1d3d4]/50">
                <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                            <h2 className="text-4xl md:text-5xl text-[#091e39] mb-6 title-case">Coastal Air Meets Indoor Comfort</h2>
                            <p className="text-lg text-[#231f20] mb-6">
                               Salt air and moisture creep into returns and coils, pushing odors and “sticky” rooms. Our process documents what’s happening, prioritizes fixes, and proves results with time-stamped photos.
                            </p>
                        </motion.div>
                        <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="grid grid-cols-2 gap-4">
                            <img class="rounded-lg shadow-md w-full aspect-square object-cover" alt="Condensate pan overflow risk - before cleaning on Merritt Island" src="https://images.unsplash.com/photo-1612778731810-51783069ca34" />
                            <img class="rounded-lg shadow-md w-full aspect-square object-cover" alt="Clean HVAC blower wheel on Merritt Island" src="https://images.unsplash.com/photo-1665722651322-b67bfe892562" />
                        </motion.div>
                    </div>
                </div>
            </section>
            
            {/* Warning Signs Section */}
            <section className="py-20 bg-white">
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
            <section className="py-20 bg-[#d1d3d4]/50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                     <div className="text-center mb-12">
                        <h2 className="text-4xl md:text-5xl text-[#091e39] mb-4 title-case">Frequently Asked Questions</h2>
                    </div>
                    <div className="space-y-4">
                        {faqs.map((faq, index) => (
                             <details key={index} className="bg-white p-6 rounded-lg shadow-sm cursor-pointer group" open={index === 0}>
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

            {/* Final CTA */}
            <section className="py-20 bg-[#091e39] text-white">
                 <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-4xl md:text-5xl font-bold mb-4 title-case">Ready to breathe better on Merritt Island?</h2>
                    <p className="text-lg text-[#f1b57b] mb-8">
                       Your $149 audit is credited if you proceed within 30 days.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link to="/contact"><Button size="lg" className="bg-[#b52025] hover:bg-[#831618] uppercase tracking-wider">Book $149 IAQ Audit</Button></Link>
                        <Link to="/contact"><Button size="lg" variant="outline" className="border-[#f1b57b] text-[#f1b57b] hover:bg-[#f1b57b] hover:text-[#091e39] uppercase tracking-wider">Schedule Free In-Home Air Check</Button></Link>
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

export default MerrittIsland;