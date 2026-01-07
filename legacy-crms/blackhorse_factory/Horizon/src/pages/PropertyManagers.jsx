import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Award, Camera, CheckSquare, Clock, Download, Phone, Gauge, BadgeCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PropertyManagers = () => {
    const whyChooseUs = [
        { icon: Gauge, headline: 'Predictable Windows', text: '48-hour SLA; rush available.' },
        { icon: Camera, headline: 'Defensible Records', text: 'Time-stamped photos + unit log.' },
        { icon: BadgeCheck, headline: 'Certification Assets', text: 'Badge + verification QR for listings.' },
        { icon: AlertTriangle, headline: 'Moisture Risk Flags', text: 'Heads-up notes your team can act on.' },
    ];

    const tiers = [
        { title: 'Tier 1: Turn-Ready Hygiene', description: 'Return/coil visual, drain check/clear, filter change, odor neutralization.', goal: 'Goal: showable unit today.', triggers: 'For quick turns and light odors.' },
        { title: 'Tier 2: Hygiene + Certification', description: 'Tier 1 plus coil hygiene to baseline, documented photos, and Clean Air Certified listing assets.', goal: 'Goal: certification + photos on file.', triggers: 'Best for most turns.' },
        { title: 'Tier 3: Deep Hygiene + Risk Flags', description: 'Tier 2 plus extended coil/return work, detailed findings, and Moisture Risk Flags (attic/crawl/closet).', goal: 'Goal: stabilize air-side and document risks.', triggers: 'For persistent odor/humidity issues or sensitive tenants.' },
    ];

    const faqs = [
        { q: "How fast can you start?", a: "Once enrolled, partners get a 48-hour SLA for standard turns." },
        { q: "How do we receive documentation?", a: "A unit report (4–8 photos + notes) and a portfolio log (shared sheet or portal)." },
        { q: "What does “Clean Air Certified” cover?", a: "It certifies the unit’s air-side hygiene at time of service (returns, coil access, drain). It’s not a whole-home microbial growth guarantee." },
        { q: "How do you handle Florida microbial growth rules?", a: "Assessment and remediation for microbial growth are legally separate. We provide diagnostics/mechanical hygiene and refer or partner for remediation when needed." },
        { q: "Can you coordinate keys/entry and elevator rules?", a: "Yes—add your site rules to the partner profile and we’ll follow them." }
    ];

    const jsonLdService = {
        "@context": "https://schema.org",
        "@type": "Service",
        "name": "Clean Air Partnership Program (Property Managers)",
        "provider": { "@type": "LocalBusiness", "name": "The Vent Guys" },
        "areaServed": [
            { "@type": "AdministrativeArea", "name": "Brevard County, FL" },
            { "@type": "AdministrativeArea", "name": "Volusia County, FL" }
        ],
        "serviceType": "Unit-Turn Mechanical Hygiene; IAQ Documentation; Certification",
        "offers": { "@type": "AggregateOffer", "lowPrice": "$$", "priceCurrency": "USD" },
        "description": "48-hour SLA for unit turns, NADCA-Certified hygiene on returns/coil/drain, time-stamped photos, and Clean Air Certified listing assets with QR verification."
    };

    const jsonLdFaq = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
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
                <title>Property Manager Program | Clean Air Partnership – The Vent Guys</title>
                <meta name="description" content="Faster turns, fewer complaints, documented compliance. Clean Air Partnership for property managers in Brevard & Volusia. 48-hour SLA, unit-turn protocol, and certification." />
                <script type="application/ld+json">{JSON.stringify(jsonLdService)}</script>
                <script type="application/ld+json">{JSON.stringify(jsonLdFaq)}</script>
            </Helmet>

            {/* Hero Section */}
            <section className="relative bg-[#091e39] text-white py-20 md:py-24 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url('https://horizons-cdn.hostinger.com/4261d516-4b17-442c-85b4-1d2769a22a04/2ceb8cf2dda5044ec4c2b4ace9213ead.png')`, backgroundSize: '300px', backgroundRepeat: 'repeat' }}></div>
                <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-5xl md:text-6xl font-bold mb-4 leading-tight title-case">
                        Clean Air Partnership Program
                    </motion.h1>
                    <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="text-lg text-[#d1d3d4] mb-8 max-w-3xl mx-auto">
                        Turn units faster with fewer complaints. <strong className="text-white">48-Hour SLA</strong> for active partners, photo-verified <Link to="/clean-air-certified-property-listings" className="text-white font-semibold hover:underline">“Clean Air Certified”</Link> for listings, and clean records for inspections.
                    </motion.p>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="flex flex-col sm:flex-row gap-4 justify-center mb-2">
                        <Link to="/contact"><Button size="lg" className="bg-[#b52025] hover:bg-[#831618] uppercase tracking-wider">Request Program Pricing</Button></Link>
                        <Link to="/contact"><Button size="lg" variant="outline" className="border-[#f1b57b] text-[#f1b57b] hover:bg-[#f1b57b] hover:text-[#091e39] uppercase tracking-wider">Schedule a Portfolio Walkthrough</Button></Link>
                    </motion.div>
                    <p className="text-sm text-[#939393] mt-2">We service multifamily, HOA/condo, and scattered SFR portfolios across Brevard & Volusia.</p>
                </div>
            </section>

            {/* Why Partners Choose TVG Section */}
            <section className="py-20 bg-white">
                <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-4xl md:text-5xl text-[#091e39] mb-4 title-case">Why Partners Choose TVG</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {whyChooseUs.map((item, index) => (
                            <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }} className="bg-white p-6 rounded-xl shadow-md text-center border-t-4 border-[#f1b57b]">
                                <item.icon className="h-10 w-10 text-[#091e39] mx-auto mb-4" />
                                <h3 className="text-xl text-[#091e39] mb-2 title-case">{item.headline}</h3>
                                <p className="text-sm text-[#939393]">{item.text}</p>
                            </motion.div>
                        ))}
                    </div>
                    <div className="mt-12 text-center text-lg text-[#939393] italic">
                        Trusted by property teams across Titusville, Cocoa, Rockledge, Merritt Island, and NSB.
                    </div>
                </div>
            </section>

            {/* Mid-page CTA */}
            <section className="py-20 bg-[#d1d3d4]/50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-4xl md:text-5xl text-[#091e39] mb-4 title-case">Join the Clean Air Partner Network</h2>
                    <p className="text-lg text-[#231f20] mb-8">Priority scheduling, photo documentation, and certification assets that close listings faster.</p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link to="/contact"><Button size="lg" className="bg-[#b52025] hover:bg-[#831618] uppercase tracking-wider">Request Program Pricing</Button></Link>
                        <Link to="/contact"><Button size="lg" variant="outline" className="border-[#091e39] text-[#091e39] hover:bg-[#091e39] hover:text-white uppercase tracking-wider">Schedule a Portfolio Walkthrough</Button></Link>
                    </div>
                </div>
            </section>

            {/* Tiers Section */}
            <section className="py-20 bg-white">
                <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-4xl md:text-5xl text-[#091e39] mb-4 title-case">Our Service Tiers</h2>
                        <p className="text-lg text-[#231f20]">Find the perfect <Link to="/mechanical-hygiene-vs-duct-cleaning" className="text-[#D7263D] font-semibold hover:underline">hygiene level</Link> for your portfolio.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {tiers.map((tier, index) => (
                            <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }} className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-[#b52025] hover:shadow-2xl hover:-translate-y-2 transition-all flex flex-col">
                                <h3 className="text-2xl text-[#091e39] font-bold mb-3 title-case">{tier.title}</h3>
                                <p className="text-[#939393] mb-4">{tier.description}</p>
                                <p className="text-[#091e39] font-semibold mb-2">{tier.goal}</p>
                                <p className="text-sm text-[#b52025] italic">{tier.triggers}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Vendor Packet Section */}
            <section className="py-20 bg-[#d1d3d4]/50">
                <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-4xl md:text-5xl text-[#091e39] mb-4 title-case">Partner Resources</h2>
                    <p className="text-lg text-[#231f20] mb-8">
                        Need details for your vendor board? Download our Clean Air Partnership Packet.
                    </p>
                    <Link to="/vendor-packet">
                        <Button size="lg" className="bg-[#b52025] hover:bg-[#831618] uppercase tracking-wider mb-12">
                            <Download className="mr-3 h-5 w-5" /> Download Vendor Packet
                        </Button>
                    </Link>
                </div>
            </section>
        </>
    );
};

export default PropertyManagers;