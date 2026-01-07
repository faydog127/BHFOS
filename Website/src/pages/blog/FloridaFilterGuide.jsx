import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Filter, Layers, Thermometer, Box, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FloridaFilterGuide = () => {
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
            "@id": "https://www.yourwebsite.com/blog/florida-air-filter-guide-merv-cadence/"
        },
        "headline": "The Florida Filter Guide: MERV, Cadence, and Clean Air That Works",
        "description": "A simple guide to choosing the right filter and replacement schedule for Florida homes—without restricting airflow.",
        "image": "https://images.unsplash.com/photo-1573164713988-8665fc963095",
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
        "articleBody": "In Florida, humidity and long AC runtimes mean your filter strategy has to balance capture with airflow. The best filters for Florida homes are typically MERV 8-11 to avoid restricting airflow. A too-restrictive filter can lower airflow and reduce dehumidification. Change 1\" filters every 30-45 days in summer, and 4-5\" media every 90-120 days. Our approach is to check filter fit, match MERV to your system, perform mechanical hygiene to remove existing debris, and create a simple maintenance plan.",
        "keywords": "best air filter florida, MERV 8–11, filter replacement schedule, indoor air quality Brevard"
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
            "name": "The Florida Filter Guide: MERV, Cadence, and Clean Air That Works"
        }]
    };

    return (
        <>
            <Helmet>
                <title>The Florida Filter Guide: MERV, Cadence, and Clean Air That Works – The Vent Guys</title>
                <meta name="description" content="A simple guide to choosing the right filter and replacement schedule for Florida homes—without restricting airflow." />
                <link rel="canonical" href="https://www.yourwebsite.com/blog/florida-air-filter-guide-merv-cadence/" />
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
                        <motion.p variants={sectionVariants} className="text-base font-semibold text-[#D7263D] tracking-wide uppercase">Homeowner Guides</motion.p>
                        <motion.h1 variants={sectionVariants} transition={{ delay: 0.1 }} className="mt-4 text-4xl md:text-5xl font-extrabold text-[#1B263B] tracking-tight">
                            The Florida Filter Guide: MERV, Cadence, and Clean Air That Works
                        </motion.h1>
                    </div>
                </header>

                <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 prose prose-lg lg:prose-xl">
                    <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
                        <p>Filters do two jobs: they protect your equipment and support cleaner indoor air. In Florida, humidity and long AC runtimes mean your filter strategy has to balance capture with airflow.</p>
                    </motion.section>
                    
                    <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
                        <div className="my-8 rounded-lg shadow-lg overflow-hidden">
                            <img className="w-full h-auto object-cover" src="https://images.unsplash.com/photo-1573164713988-8665fc963095" alt="A young family with a toddler learning from a technician about the right air filter for their home." />
                        </div>
                    </motion.section>

                    <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
                        <h3><Filter className="inline-block mr-2 text-[#D7263D]" />MERV Made Simple</h3>
                        <ul>
                            <li><strong>MERV 8–11:</strong> Sweet spot for most homes—captures common dust and dander without choking airflow.</li>
                            <li><strong>MERV 13:</strong> Higher capture, but only if your system is sized for it; otherwise it can reduce airflow.</li>
                            <li><strong>1" vs 4–5" Media:</strong> Deeper media filters provide more surface area and longer life at the same MERV.</li>
                        </ul>
                    </motion.section>

                    <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
                        <h3><Thermometer className="inline-block mr-2 text-[#D7263D]" />Cadence (Florida Reality)</h3>
                        <ul>
                            <li><strong>Summer/Humid Months:</strong> Every 30–45 days (1" filters) or 90–120 days (4–5" media).</li>
                            <li><strong>Shoulder Seasons:</strong> Extend modestly if filters remain clean and airflow is normal.</li>
                            <li><strong>Pets, renovations, or nearby construction:</strong> Change more often.</li>
                        </ul>
                    </motion.section>

                    <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
                        <h2>Signs It's Time</h2>
                        <ul>
                            <li>Whistling return</li>
                            <li>Bent filter</li>
                            <li>Dust streaks around the rack</li>
                            <li>Worsening odors on start-up</li>
                            <li>Rooms feeling starved for air</li>
                        </ul>
                    </motion.section>
                    
                    <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
                        <h2>Don't Over-Filter</h2>
                        <p>A too-restrictive filter can lower airflow, reduce dehumidification, and make the system feel muggy. Aim for <strong>MERV 8–11</strong> unless your equipment and duct design are verified for higher MERV.</p>
                    </motion.section>

                    <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
                        <h2>The Vent Guys' Approach</h2>
                        <ol>
                            <li><strong>Fit Check:</strong> Ensure the filter seals properly—no bypass gaps.</li>
                            <li><strong>System Match:</strong> Recommend a MERV that your blower can handle.</li>
                            <li><strong><Link to="/mechanical-hygiene-vs-duct-cleaning" className="text-[#D7263D] hover:underline">Mechanical Hygiene</Link>:</strong> Remove existing debris with a <Link to="/nadca-standards-air-quality-protection" className="text-[#D7263D] hover:underline">NADCA-standard cleaning</Link> so the new filter isn't overwhelmed on day one.</li>
                            <li><strong>Maintenance Plan:</strong> Simple <strong>cadence</strong> aligned to Florida humidity.</li>
                        </ol>
                    </motion.section>

                    <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
                        <h2>Quick Wins</h2>
                        <ul>
                            <li>Note the install date on the filter frame.</li>
                            <li>Keep returns unblocked; never tape a filter loosely in place.</li>
                            <li>Pair filter changes with a seasonal IAQ check.</li>
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
                        <p className="mt-4 text-lg text-gray-300">Not sure which MERV your system can handle? Book a Free Air Check and we'll verify it on site.</p>
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

export default FloridaFilterGuide;