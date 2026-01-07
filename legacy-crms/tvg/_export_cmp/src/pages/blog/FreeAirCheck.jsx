import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Wind, ShieldCheck, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FreeAirCheck = () => {
  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -20 }
  };

  const sectionVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <>
      <Helmet>
        <title>The Free Air Check: What We Look For in 15 Minutes | The Vent Guys</title>
        <meta name="description" content="See what our Free Air Check includes and how our NADCA-certified team identifies early signs of poor indoor air quality in your home — in just 15 minutes." />
      </Helmet>

      <motion.div
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={{ duration: 0.5 }}
        className="bg-white"
      >
        {/* Header Section */}
        <header className="relative bg-gradient-to-b from-gray-50 to-white pt-16 pb-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.p variants={sectionVariants} className="text-base font-semibold text-[#D7263D] tracking-wide uppercase">Free Inspection</motion.p>
            <motion.h1 variants={sectionVariants} transition={{ delay: 0.1 }} className="mt-4 text-4xl md:text-5xl font-extrabold text-[#1B263B] tracking-tight">
              The Free Air Check: What We Look For in 15 Minutes
            </motion.h1>
            <motion.div variants={sectionVariants} transition={{ delay: 0.2 }} className="mt-6 flex items-center justify-center space-x-4 text-gray-500">
              <div className="flex items-center">
                <img class="h-10 w-10 rounded-full mr-3" alt="Author photo" src="https://images.unsplash.com/photo-1652841190565-b96e0acbae17" />
                <span>By The Vent Guys</span>
              </div>
              <span className="text-gray-400">|</span>
              <div className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                <span>November 13, 2025</span>
              </div>
            </motion.div>
          </div>
        </header>

        {/* Main Article Content */}
        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 prose prose-lg lg:prose-xl">
          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <div className="my-8 rounded-lg shadow-lg overflow-hidden">
              <img class="w-full h-auto object-cover" alt="A friendly technician showing a senior homeowner photo-documented results from a Free Air Check on a tablet." src="https://images.unsplash.com/photo-1521791136064-7986c28e7481" />
            </div>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <p>Worried about your home's air quality but not sure where to start? Our Free Air Check is a no-pressure, 15-minute visual inspection designed to give you a clear picture of your HVAC system's health. It's the first step toward breathing cleaner, healthier air.</p>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <h2 className="flex items-center"><Camera className="mr-3 text-[#D7263D]" />What We Inspect During the Air Check</h2>
            <p>Our NADCA-certified technician will perform a targeted visual inspection of the most critical and accessible parts of your HVAC system. We focus on the areas where problems most often start:</p>
            <ul>
              <li><strong>The Return Vent & Filter:</strong> We check for excessive dust buildup, which indicates how much particulate is entering your system.</li>
              <li><strong>The Blower Motor:</strong> A dirty blower wheel reduces efficiency and spreads contaminants.</li>
              <li><strong>The Evaporator Coil:</strong> We look for signs of dust, debris, and microbial growth, which can severely impact <Link to="/florida-humidity-hidden-duct-contamination" className="text-[#D7263D] hover:underline">indoor air quality</Link>.</li>
              <li><strong>The Drain Pan:</strong> We check for standing water or blockages, a common source of musty odors and mold.</li>
              <li><strong>Accessible Ductwork:</strong> We use a camera to give you a look inside your ducts to see the level of contamination.</li>
            </ul>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <h2 className="flex items-center"><Wind className="mr-3 text-[#D7263D]" />What We're Looking For</h2>
            <p>During the inspection, we're identifying key indicators of poor air quality and system inefficiency, such as:</p>
            <ul>
              <li>Heavy dust and debris accumulation</li>
              <li>Visible signs of organic or microbial growth</li>
              <li>Moisture or water stains</li>
              <li>Musty or unusual odors</li>
            </ul>
            <p>Based on these findings, we can determine if a full <Link to="/mechanical-hygiene-vs-duct-cleaning" className="text-[#D7263D] hover:underline">mechanical hygiene</Link> service is necessary. We'll show you the photos and explain our recommendations, so you can make an informed decision.</p>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }} className="mt-12 text-center border-t pt-8">
            <h2 className="flex items-center justify-center"><ShieldCheck className="mr-3 text-[#D7263D]" />Honest Answers, No Obligation</h2>
            <p>The Free Air Check is completely complimentary. Our goal is to educate you about your home's air system. If it's clean, we'll tell you. If it needs attention, we'll show you why and provide a transparent quote for a <Link to="/nadca-standards-air-quality-protection" className="text-[#D7263D] hover:underline">certified air duct cleaning</Link>.</p>
            <div className="mt-8">
              <Link to="/contact">
                <Button size="lg" className="bg-[#D7263D] hover:bg-[#b51f31] text-white px-8 py-6 text-lg font-semibold">
                  Schedule Your Free Air Check
                </Button>
              </Link>
            </div>
          </motion.section>
        </article>
      </motion.div>
    </>
  );
};

export default FreeAirCheck;