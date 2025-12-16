import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle, ShieldCheck, Award, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NadcaStandards = () => {
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
        <title>How NADCA Standards Protect Your Home's Air – The Vent Guys</title>
        <meta name="description" content="Learn what NADCA standards require, why they matter for your home's air quality, and how The Vent Guys apply them to every inspection and cleaning in Brevard County." />
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
            <motion.p variants={sectionVariants} className="text-base font-semibold text-[#D7263D] tracking-wide uppercase">Education & Standards</motion.p>
            <motion.h1 variants={sectionVariants} transition={{ delay: 0.1 }} className="mt-4 text-4xl md:text-5xl font-extrabold text-[#1B263B] tracking-tight">
              The Gold Standard of Clean Air
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
                <img class="w-full h-auto object-cover" alt="A diverse group of technicians in a training session, learning about NADCA standards for air duct cleaning." src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7" />
            </div>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <p>When you hire a company to clean your air ducts, you're trusting them with the health of your home's respiratory system. But how do you know they're doing the job right? The answer lies with <a href="https://nadca.com/" target="_blank" rel="noopener noreferrer" className="text-[#D7263D] hover:underline">NADCA</a>, the National Air Duct Cleaners Association.</p>
          </motion.section>
          
          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <h2 className="flex items-center"><Award className="mr-3 text-[#D7263D]" />What the NADCA Standard Requires</h2>
            <p>NADCA's guidelines, specifically <a href="https://nadca.com/resources/standards" target="_blank" rel="noopener noreferrer" className="text-[#D7263D] hover:underline">ACR, The NADCA Standard</a>, outline a rigorous methodology for the assessment, cleaning, and restoration of HVAC systems. It's not just about vacuuming out some dust; it's about a complete process to ensure true <Link to="/mechanical-hygiene-vs-duct-cleaning" className="text-[#D7263D] hover:underline">mechanical hygiene</Link>. The key phases are:</p>
            <ul className="space-y-4">
              <li className="flex items-start">
                <ShieldCheck className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span><strong>Assessment:</strong> A thorough inspection of the entire HVAC system before any work begins, identifying areas of concern and establishing a clear scope of work. This is what we do during our <Link to="/free-air-check-what-we-look-for" className="text-[#D7263D] hover:underline">Free Air Check</Link>.</span>
              </li>
              <li className="flex items-start">
                <ShieldCheck className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span><strong>Cleaning:</strong> The use of contained, source-removal methods. This means using powerful, HEPA-filtered vacuums to place the system under negative pressure while dislodging debris with specialized tools.</span>
              </li>
              <li className="flex items-start">
                <ShieldCheck className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span><strong>Verification:</strong> A post-cleaning inspection to ensure all components have been cleaned to the standard and the system is functioning correctly. This is how a property becomes <Link to="/clean-air-certified-property-listings" className="text-[#D7263D] hover:underline">Clean Air Certified</Link>.</span>
              </li>
            </ul>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <h2 className="flex items-center"><CheckCircle className="mr-3 text-[#D7263D]" />Why Standards Matter for Homeowners</h2>
            <p>Hiring a NADCA-certified company isn't just about a logo on a van. It provides tangible benefits:</p>
             <ul className="space-y-4">
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span><strong>Protection:</strong> Prevents damage to your HVAC system and protects your home from cross-contamination.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span><strong>Accountability:</strong> Certified companies must adhere to a code of ethics and have at least one certified Air Systems Cleaning Specialist on staff.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span><strong>Quality:</strong> Ensures a higher level of cleaning, leading to better indoor air quality and improved system efficiency.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span><strong>Transparency:</strong> NADCA's standards require clear communication and documentation, so you know exactly what work was performed.</span>
              </li>
            </ul>
          </motion.section>
          
          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <h2 className="flex items-center"><AlertTriangle className="mr-3 text-[#D7263D]" />What Happens When Companies Don't Follow NADCA</h2>
            <p>Uncertified cleaners often use improper techniques that can make your air quality worse. Common issues include "blow-and-go" services that just stir up dust, cross-contaminating the home, or even damaging fragile ductwork. This not only fails to solve the problem but can create new, more expensive ones.</p>
          </motion.section>

          {/* Mid-article CTA */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="my-12 bg-[#1B263B] text-white rounded-lg p-8 text-center"
          >
            <h3 className="text-2xl md:text-3xl font-bold">Don't Risk Subpar Cleaning.</h3>
            <p className="mt-2 text-lg text-gray-300">Choose NADCA-Certified Quality in Brevard County.</p>
            <Link to="/contact">
                <Button size="lg" className="mt-4 bg-[#D7263D] hover:bg-[#b51f31] text-white">
                    Get a Free, Honest Quote
                </Button>
            </Link>
          </motion.div>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <h2 className="flex items-center"><Award className="mr-3 text-[#D7263D]" />The Vent Guys' Commitment to NADCA Standards</h2>
            <p>Our commitment to NADCA is non-negotiable. Every service we perform is guided by these principles, ensuring we deliver the highest standard of care on every job.</p>
             <ul className="space-y-4">
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span>Our technicians are trained through the <Link to="/about" className="text-[#D7263D] hover:underline">ASCS (Air Systems Cleaning Specialist) program</Link>.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span>We use state-of-the-art, HEPA-filtered equipment to guarantee source removal.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span>We provide detailed before-and-after photo reports to document our work.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span>We carry full liability insurance and adhere strictly to the NADCA Code of Ethics.</span>
              </li>
            </ul>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <h2 className="flex items-center"><ShieldCheck className="mr-3 text-[#D7263D]" />The Florida Factor — Humidity, Dust, and Compliance</h2>
            <p>In Brevard County, high humidity and fine dust create a perfect breeding ground for microbial growth in air ducts. NADCA standards are especially critical here, as they are specifically designed to safely and effectively remove these contaminants without spreading them through your home. Choosing a certified professional is the single best way to ensure your air duct cleaning service is a solution, not a new problem.</p>
          </motion.section>
          
          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <h2 className="flex items-center"><CheckCircle className="mr-3 text-[#D7263D]" />Peace of Mind You Can Prove</h2>
            <p>When you choose The Vent Guys, you're not just getting cleaner ducts—you're getting the documented, verifiable results that come from adhering to the industry's highest standard. That's peace of mind you can breathe in.</p>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }} className="mt-12 text-center border-t pt-8">
            <h2 className="flex items-center justify-center"><Calendar className="mr-3 text-[#D7263D]" />Choose Certified. Breathe Confidently.</h2>
            <p>Ready to see what a true, NADCA-compliant cleaning looks like? <Link to="/contact" className="text-[#D7263D] hover:underline">Schedule your Free Air Check today</Link> and let our certified team show you the difference.</p>
            <div className="mt-8">
              <Link to="/contact">
                <Button size="lg" className="bg-[#D7263D] hover:bg-[#b51f31] text-white px-8 py-6 text-lg font-semibold">
                  Schedule Your Free Air Check Today
                </Button>
              </Link>
            </div>
          </motion.section>
        </article>
      </motion.div>
    </>
  );
};

export default NadcaStandards;