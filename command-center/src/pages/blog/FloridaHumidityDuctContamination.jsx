import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Droplets, Wind, ShieldCheck, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FloridaHumidityDuctContamination = () => {
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
        <title>Florida Humidity & Hidden Duct Contamination | The Vent Guys</title>
        <meta name="description" content="Learn how Florida humidity leads to duct contamination and poor indoor air quality — and how NADCA-certified mechanical hygiene protects your home's air." />
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
            <motion.p variants={sectionVariants} className="text-base font-semibold text-[#D7263D] tracking-wide uppercase">Indoor Air Quality</motion.p>
            <motion.h1 variants={sectionVariants} transition={{ delay: 0.1 }} className="mt-4 text-4xl md:text-5xl font-extrabold text-[#1B263B] tracking-tight">
              Florida Humidity & Hidden Duct Contamination
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
              <img class="w-full h-auto object-cover" alt="African American family reviewing an air quality report in their Central Florida home, concerned about humidity." src="https://images.unsplash.com/photo-1556742212-5b321f3c261b" />
            </div>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <p>Living in Florida means enjoying the sunshine, but it also means battling relentless humidity. While you feel it outside, the real battle is happening inside your home's HVAC system. The combination of high humidity and dust creates a perfect breeding ground for mold, bacteria, and other contaminants within your air ducts.</p>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <h2 className="flex items-center"><Droplets className="mr-3 text-[#D7263D]" />The Problem: Condensation & Contamination</h2>
            <p>Your air conditioner works by cooling warm, humid air. As the air cools, moisture condenses on the evaporator coil and inside your ductwork. This moisture, combined with dust, pollen, and skin cells that are naturally present in your home's air, creates a sticky, nutrient-rich environment where microbial growth can thrive.</p>
            <p>This leads to:</p>
            <ul>
              <li>Musty odors coming from your vents</li>
              <li>Increased allergy and asthma symptoms</li>
              <li>Visible mold or mildew around vent covers</li>
              <li>Reduced HVAC efficiency and higher energy bills</li>
            </ul>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <h2 className="flex items-center"><Wind className="mr-3 text-[#D7263D]" />The Solution: NADCA-Certified Mechanical Hygiene</h2>
            <p>Standard "blow-and-go" duct cleaning isn't enough to solve this problem. You need a comprehensive approach known as <Link to="/mechanical-hygiene-vs-duct-cleaning" className="text-[#D7263D] hover:underline">mechanical hygiene</Link>. This process, guided by strict NADCA standards, involves:</p>
            <ol>
              <li><strong>Source Removal:</strong> Using powerful, HEPA-filtered vacuums to place the entire system under negative pressure.</li>
              <li><strong>Agitation:</strong> Employing specialized tools like brushes and air whips to dislodge all contaminants from the duct surfaces.</li>
              <li><strong>Component Cleaning:</strong> Thoroughly cleaning the evaporator coil, blower motor, and drain pan to remove all traces of microbial growth.</li>
            </ol>
            <p>This is the only way to ensure your system is truly clean and reset to a neutral state. Our <Link to="/nadca-standards-air-quality-protection" className="text-[#D7263D] hover:underline">NADCA-certified</Link> process guarantees this level of clean.</p>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }} className="mt-12 text-center border-t pt-8">
            <h2 className="flex items-center justify-center"><ShieldCheck className="mr-3 text-[#D7263D]" />Protect Your Home's Air Quality</h2>
            <p>Don't let Florida's humidity compromise your family's health. If you've noticed musty smells or an increase in allergies, it's time to see what's hiding in your ducts.</p>
            <div className="mt-8">
              <Link to="/contact">
                <Button size="lg" className="bg-[#D7263D] hover:bg-[#b51f31] text-white px-8 py-6 text-lg font-semibold">
                  Schedule a Free Air Check
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-gray-600">Our <Link to="/free-air-check-what-we-look-for" className="text-[#D7263D] hover:underline">Free Air Check</Link> is a no-obligation inspection to assess your system's condition.</p>
          </motion.section>
        </article>
      </motion.div>
    </>
  );
};

export default FloridaHumidityDuctContamination;