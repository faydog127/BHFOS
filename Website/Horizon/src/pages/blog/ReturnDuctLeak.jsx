import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, Shield, Wrench, CheckSquare, DoorOpen, Wind, Calendar, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ReturnDuctLeak = () => {
    const pageVariants = {
        initial: { opacity: 0, y: 20 },
        in: { opacity: 1, y: 0 },
        out: { opacity: 0, y: -20 }
    };

    const sectionVariants = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.5 } }
    };

    const articleSchema = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": "https://www.yourwebsite.com/blog/return-duct-leak-attic-air/"
        },
        "headline": "The Return Leak Problem: How Attic Air Enters Your Home",
        "description": "Learn how leaky return ducts pull dusty attic air into your home and how NADCA-standard mechanical hygiene restores clean airflow.",
        "image": "https://images.unsplash.com/photo-1615865133883-92a0e6985a73", // Placeholder for /media/photos/inspections/return-box-gap.jpg
        "author": {
            "@type": "Organization",
            "name": "The Vent Guys"
        },
        "publisher": {
            "@type": "Organization",
            "name": "The Vent Guys",
            "logo": {
                "@type": "ImageObject",
                "url": "https://horizons-cdn.hostinger.com/4261d516-4b17-442c-85b4-1d2769a22a04/08435323de98fe5fafabc3ec7d834166.png"
            }
        },
        "datePublished": "2025-11-13",
        "dateModified": "2025-11-13",
        "articleBody": "In Florida, the space above your ceiling is hot, dusty, and humid. If your return duct leaks, that air can be pulled straight into your system—bypassing filters and circulating particles through every room. Leaky returns can be caused by aging seals, gaps in ductwork, damaged filter racks, and negative pressure. This pulls attic dust, fiberglass, and humidity into the air handler, raising particle counts and stressing the system. The fix involves inspection, sealing, and NADCA-standard mechanical hygiene.",
        "keywords": "return duct leak, attic dust, negative pressure, indoor air quality Florida"
    };

    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [{
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://www.yourwebsite.com/"
        }, {
            "@type": "ListItem",
            "position": 2,
            "name": "Blog",
            "item": "https://www.yourwebsite.com/blog/"
        }, {
            "@type": "ListItem",
            "position": 3,
            "name": "The Return Leak Problem: How Attic Air Enters Your Home"
        }]
    };

    return (
        <>
            <Helmet>
                <title>The Return Leak Problem: How Attic Air Enters Your Home – The Vent Guys</title>
                <meta name="description" content="Learn how leaky return ducts pull dusty attic air into your home and how NADCA-standard mechanical hygiene restores clean airflow." />
                <link rel="canonical" href="https://www.yourwebsite.com/blog/return-duct-leak-attic-air/" />
                <meta name="robots" content="index, follow" />
                <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
                <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
            </Helmet>

            <motion.div
                initial="initial"
                animate="in"
                exit="out"
                variants={pageVariants}
                transition={{ duration: 0.5 }}
                className="bg-white"
            >
                <header className="relative bg-gradient-to-b from-gray-50 to-white pt-16 pb-12">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        <motion.p variants={sectionVariants} className="text-base font-semibold text-[#D7263D] tracking-wide uppercase">Indoor Air Quality</motion.p>
                        <motion.h1 variants={sectionVariants} transition={{ delay: 0.1 }} className="mt-4 text-4xl md:text-5xl font-extrabold text-[#1B263B] tracking-tight">
                           The Return Leak Problem: How Attic Air Enters Your Home
                        </motion.h1>
                        <motion.p variants={sectionVariants} transition={{ delay: 0.2 }} className="mt-4 text-xl text-gray-600">The Hidden Shortcut Into Your Air</motion.p>
                    </div>
                </header>

                <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 prose prose-lg lg:prose-xl">
                    <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
                        <p>In Florida, the space above your ceiling is hot, dusty, and humid. If your return duct leaks, that air can be pulled straight into your system—bypassing filters and circulating particles through every room.</p>
                    </motion.section>

                    <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
                        <div className="my-8 rounded-lg shadow-lg overflow-hidden">
                            <img className="w-full h-auto object-cover" src="https://images.unsplash.com/photo-1615865133883-92a0e6985a73" alt="A visible gap in a return duct box in a dusty attic, showing a common point for attic air intrusion." />
                        </div>
                    </motion.section>

                    <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
                        <h2>Why Return Leaks Happen</h2>
                        <ul>
                            <li>Aging or poorly sealed return boxes</li>
                            <li>Gaps where flexible duct meets the plenum</li>
                            <li>Damaged filter racks that let air bypass the filter</li>
                            <li><strong>Negative pressure</strong> from closed interior doors or oversized exhaust fans</li>
                        </ul>
                    </motion.section>

                    <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
                        <h2>What You Might Notice</h2>
                        <ul>
                            <li>Musty start-up odors</li>
                            <li>Quickly graying filters</li>
                            <li>"Dirty" supply registers</li>
                            <li>Rooms that never quite cool</li>
                            <li>Itchy dust around returns</li>
                        </ul>
                    </motion.section>

                    <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
                        <h2>Why It Matters (Health & System)</h2>
                        <p>Leaky returns carry <strong>attic dust</strong>, fiberglass, and humidity into the air handler. That raises particle counts, coats coils, stresses the blower, and can aggravate sensitive airways.</p>
                    </motion.section>

                    <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
                        <h2>The Vent Guys' Fix</h2>
                        <ol className="space-y-4">
                            <li className="flex items-start"><Eye className="h-6 w-6 text-[#D7263D] mr-4 mt-1 flex-shrink-0" /><div><strong>Inspect & Document</strong> – Photo check of return box, seams, and filter rack; pressure test where feasible.</div></li>
                            <li className="flex items-start"><Wrench className="h-6 w-6 text-[#D7263D] mr-4 mt-1 flex-shrink-0" /><div><strong>Seal & Correct</strong> – Recommend proper sealing, filter rack repair, and return grille adjustments.</div></li>
                            <li className="flex items-start"><Shield className="h-6 w-6 text-[#D7263D] mr-4 mt-1 flex-shrink-0" /><div><strong><Link to="/nadca-standards-air-quality-protection" className="text-[#D7263D] hover:underline">Mechanical Hygiene</Link></strong> – <Link to="/mechanical-hygiene-vs-duct-cleaning" className="text-[#D7263D] hover:underline">NADCA-standard cleaning</Link> to remove the debris that already entered the system.</div></li>
                            <li className="flex items-start"><CheckSquare className="h-6 w-6 text-[#D7263D] mr-4 mt-1 flex-shrink-0" /><div><strong>Verify</strong> – Before/after photos and simple readings to confirm improvement.</div></li>
                        </ol>
                    </motion.section>

                    <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
                        <h2>Quick Homeowner Wins</h2>
                        <ul>
                            <li>Keep doors open or undercut to reduce room pressure imbalances.</li>
                            <li>Use a snug, correctly sized filter; avoid filter gaps.</li>
                            <li>Replace filters every 30–60 days in peak season.</li>
                            <li>Schedule an annual IAQ check to catch early leaks.</li>
                        </ul>
                    </motion.section>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="my-12 bg-[#1B263B] text-white rounded-lg p-8 text-center"
                    >
                        <h3 className="text-3xl font-bold" style={{ color: '#ffd19a' }}>Certified. Documented. Done Right — The Vent Guys</h3>
                        <p className="mt-4 text-lg text-gray-300">Return leaks are invisible until they affect your air. Book a Free Air Check to find hidden return leaks before they affect your air.</p>
                        <Link to="/contact">
                            <Button size="lg" className="mt-6 bg-[#D7263D] hover:bg-[#C2F5E9] hover:text-[#1B263B] text-white text-lg font-semibold px-8 py-3">
                                <Calendar className="mr-2 h-5 w-5" />
                                Schedule Your Free Air Check
                            </Button>
                        </Link>
                    </motion.div>
                </article>
            </motion.div>
        </>
    );
};

export default ReturnDuctLeak;