import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wind, ShieldCheck, CheckCircle, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MechanicalHygieneVsDuctCleaning = () => {
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
        <title>Mechanical Hygiene vs. Air Duct Cleaning | The Vent Guys</title>
        <meta name="description" content="Discover why true mechanical hygiene goes beyond standard duct cleaning. Learn how our NADCA-certified process ensures your HVAC system and air are truly clean." />
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
            <motion.p variants={sectionVariants} className="text-base font-semibold text-[#D7263D] tracking-wide uppercase">Education</motion.p>
            <motion.h1 variants={sectionVariants} transition={{ delay: 0.1 }} className="mt-4 text-4xl md:text-5xl font-extrabold text-[#1B263B] tracking-tight">
              Mechanical Hygiene vs. "Air Duct Cleaning"
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
              <img class="w-full h-auto object-cover" alt="Side-by-side comparison of a dirty duct and a clean duct after a mechanical hygiene service." src="https://images.unsplash.com/photo-1617965074274-1372c3641f6f" />
            </div>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <p>You've seen the ads for "$99 whole-house air duct cleaning." It sounds like a great deal, but what are you actually getting? In the professional world, there's a critical difference between a cheap "blow-and-go" service and true <strong>mechanical hygiene</strong>.</p>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <h2 className="flex items-center"><Wind className="mr-3 text-[#D7263D]" />What is "Blow-and-Go" Duct Cleaning?</h2>
            <p>This is the service offered by many low-price companies. They typically use a portable vacuum, stick it in a vent, and maybe blow some compressed air around. This process often does more harm than good:</p>
            <ul>
              <li>It fails to create the necessary negative pressure to contain contaminants.</li>
              <li>It can dislodge dust and debris, spreading it throughout your home.</li>
              <li>It completely ignores critical components like the blower, coils, and drain pan.</li>
            </ul>
            <p>The result? You've paid for a service that didn't clean your system and may have worsened your <Link to="/florida-humidity-hidden-duct-contamination" className="text-[#D7263D] hover:underline">indoor air quality</Link>.</p>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <h2 className="flex items-center"><ShieldCheck className="mr-3 text-[#D7263D]" />What is Mechanical Hygiene?</h2>
            <p>Mechanical hygiene is the professional standard for HVAC cleaning, as defined by <Link to="/nadca-standards-air-quality-protection" className="text-[#D7263D] hover:underline">NADCA standards</Link>. It's a holistic process that treats your entire HVAC system as an interconnected unit. The goal is source removal—physically removing all contaminants from the system.</p>
            <p>A true mechanical hygiene service includes:</p>
            <ul>
              <li><CheckCircle className="inline-block h-5 w-5 text-green-500 mr-2" />Placing the entire system under negative pressure with a powerful, HEPA-filtered vacuum.</li>
              <li><CheckCircle className="inline-block h-5 w-5 text-green-500 mr-2" />Using agitation tools (brushes, whips) to scrub every inch of the ductwork.</li>
              <li><CheckCircle className="inline-block h-5 w-5 text-green-500 mr-2" />Cleaning the air handler, including the blower motor, housing, and evaporator coil.</li>
              <li><CheckCircle className="inline-block h-5 w-5 text-green-500 mr-2" />Verifying the cleaning with before-and-after photos.</li>
            </ul>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }} className="mt-12 text-center border-t pt-8">
            <h2 className="flex items-center justify-center"><CheckCircle className="mr-3 text-[#D7263D]" />Choose Real Clean, Not a Real Gimmick</h2>
            <p>When it comes to your home's air, you get what you pay for. Investing in a professional, NADCA-certified mechanical hygiene service is the only way to ensure your air ducts are truly clean and your family is breathing healthier air.</p>
            <div className="mt-8">
              <Link to="/contact">
                <Button size="lg" className="bg-[#D7263D] hover:bg-[#b51f31] text-white px-8 py-6 text-lg font-semibold">
                  Schedule a Free Air Check
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-gray-600">Our <Link to="/free-air-check-what-we-look-for" className="text-[#D7263D] hover:underline">Free Air Check</Link> will show you exactly what's in your system.</p>
          </motion.section>
        </article>
      </motion.div>
    </>
  );
};

export default MechanicalHygieneVsDuctCleaning;