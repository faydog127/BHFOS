import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame, AlertTriangle, ShieldCheck, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DryerVentFireSafety = () => {
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
        <title>Dryer Vents & Fire Risk: What Every Homeowner Should Know | The Vent Guys</title>
        <meta name="description" content="Learn how clogged dryer vents create hidden fire risks and impact your home's air quality. See how our NADCA-certified process keeps your home safe." />
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
            <motion.p variants={sectionVariants} className="text-base font-semibold text-[#D7263D] tracking-wide uppercase">Home Safety</motion.p>
            <motion.h1 variants={sectionVariants} transition={{ delay: 0.1 }} className="mt-4 text-4xl md:text-5xl font-extrabold text-[#1B263B] tracking-tight">
              Dryer Vents & Fire Risk: What Every Homeowner Should Know
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
              <img class="w-full h-auto object-cover" alt="A concerned homeowner looks on as a technician shows them a large clump of lint removed from their dryer vent." src="https://images.unsplash.com/photo-1581578731548-c64695cc6952" />
            </div>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <p>You clean the lint trap in your dryer after every load, so you're safe, right? Not necessarily. The lint trap only catches about 25% of the lint produced. The rest builds up in your dryer vent, creating a serious and often overlooked fire hazard.</p>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <h2 className="flex items-center"><Flame className="mr-3 text-[#D7263D]" />The Hidden Danger of Lint Buildup</h2>
            <p>According to the U.S. Fire Administration, failure to clean dryers is the leading cause of home clothes dryer fires. Lint is highly flammable, and as it accumulates in the vent, it restricts airflow. This causes the dryer to overheat, which can ignite the lint and start a devastating fire.</p>
            <p>Warning signs of a clogged dryer vent include:</p>
            <ul>
              <li>Clothes taking longer than one cycle to dry</li>
              <li>The outside of the dryer feeling unusually hot</li>
              <li>A burning smell when the dryer is running</li>
              <li>The vent hood flap not opening properly</li>
            </ul>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <h2 className="flex items-center"><AlertTriangle className="mr-3 text-[#D7263D]" />More Than Just a Fire Risk</h2>
            <p>A clogged dryer vent doesn't just pose a fire risk. It can also force carbon monoxide (in gas dryers) back into your home and release moisture and lint particles, negatively impacting your <Link to="/florida-humidity-hidden-duct-contamination" className="text-[#D7263D] hover:underline">indoor air quality</Link>.</p>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <h2 className="flex items-center"><ShieldCheck className="mr-3 text-[#D7263D]" />The Professional Cleaning Solution</h2>
            <p>A professional dryer vent cleaning is a form of <Link to="/mechanical-hygiene-vs-duct-cleaning" className="text-[#D7263D] hover:underline">mechanical hygiene</Link> that thoroughly removes the lint buildup from the entire length of your vent. Our <Link to="/nadca-standards-air-quality-protection" className="text-[#D7263D] hover:underline">NADCA-certified process</Link> uses specialized tools to ensure your vent is completely clear, restoring proper airflow and eliminating the fire hazard.</p>
            <p>Regular professional cleaning not only keeps your family safe but also improves your dryer's efficiency, saving you time and money on energy bills.</p>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }} className="mt-12 text-center border-t pt-8">
            <h2 className="flex items-center justify-center"><Calendar className="mr-3 text-[#D7263D]" />Schedule Your Safety Inspection</h2>
            <p>Don't wait for a warning sign. Protect your home and family with a professional dryer vent cleaning. It's a small investment for significant peace of mind.</p>
            <div className="mt-8">
              <Link to="/contact">
                <Button size="lg" className="bg-[#D7263D] hover:bg-[#b51f31] text-white px-8 py-6 text-lg font-semibold">
                  Book Your Dryer Vent Cleaning
                </Button>
              </Link>
            </div>
          </motion.section>
        </article>
      </motion.div>
    </>
  );
};

export default DryerVentFireSafety;