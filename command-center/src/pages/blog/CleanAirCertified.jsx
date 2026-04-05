import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle, ShieldCheck, Home, Award, Building, BarChart, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FaqAccordion from '@/components/FaqAccordion';
import { allFaqs } from '@/config/faqs';

const CleanAirCertified = () => {
  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -20 }
  };

  const sectionVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  const certFaq = allFaqs.filter(faq => faq.id === 'q9');

  return (
    <>
      <Helmet>
        <title>Clean Air Certified: A New Standard for Property Listings – The Vent Guys</title>
        <meta name="description" content="Learn how The Vent Guys' Clean Air Certified program helps property managers and real estate professionals prove air quality, increase trust, and stand out in the market." />
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
            <motion.p variants={sectionVariants} className="text-base font-semibold text-[#D7263D] tracking-wide uppercase">Partners & Certification</motion.p>
            <motion.h1 variants={sectionVariants} transition={{ delay: 0.1 }} className="mt-4 text-4xl md:text-5xl font-extrabold text-[#1B263B] tracking-tight">
              Clean Air Sells — and It's Finally Measurable
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
                <img class="w-full h-auto object-cover" alt="A realtor proudly placing a 'Clean Air Certified' sign in front of a Central Florida home for sale." src="https://images.unsplash.com/photo-1560518883-ce09059ee41f" />
            </div>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <h2 className="flex items-center"><Home className="mr-3 text-[#D7263D]" />Why Air Quality Matters in Real Estate</h2>
            <p>In Florida's competitive real estate market, savvy buyers and renters are looking beyond curb appeal. They're concerned about health, safety, and hidden costs. Poor indoor air quality isn't just a nuisance; it's a liability that can derail a sale or lease. Key concerns include:</p>
            <ul className="space-y-2">
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span><strong>Humidity and dust:</strong> Creates an environment for allergens to thrive, leading to discomfort and health issues.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span><strong>Odors and microbial growth:</strong> Musty smells are a major red flag for underlying moisture problems and potential mold.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span><strong>Poor air quality:</strong> Can trigger allergies, asthma, and other respiratory problems, making a property unsuitable for sensitive individuals.</span>
              </li>
            </ul>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <h2 className="flex items-center"><Award className="mr-3 text-[#D7263D]" />How the Clean Air Certified Program Works</h2>
            <p>Our program is a straightforward, three-step process designed to provide documented proof of a property's air system hygiene, adhering to strict <Link to="/nadca-standards-air-quality-protection" className="text-[#D7263D] hover:underline">NADCA standards</Link>.</p>
            <ol className="space-y-6 list-decimal pl-6">
                <li>
                    <strong>Inspection:</strong> A certified technician performs a visual inspection of the HVAC system, including the air handler, coils, and ductwork access points. This is similar to our <Link to="/free-air-check-what-we-look-for" className="text-[#D7263D] hover:underline">Free Air Check</Link>. We document our findings with photos.
                </li>
                <li>
                    <strong>Hygiene Service:</strong> If needed, we perform a full <Link to="/mechanical-hygiene-vs-duct-cleaning" className="text-[#D7263D] hover:underline">mechanical hygiene</Link> service to remove contaminants and restore the system to a clean, efficient state.
                </li>
                <li>
                    <strong>Certification:</strong> Upon completion, the property receives its "Clean Air Certified" status, which includes:
                    <ul className="mt-4 space-y-2 !list-disc !pl-5">
                        <li>A digital certificate and badge for use in MLS listings and marketing materials.</li>
                        <li>A detailed report with before-and-after photos.</li>
                        <li>Entry into our verification database, accessible via QR code.</li>
                    </ul>
                </li>
            </ol>
          </motion.section>
            
          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }} className="not-prose my-12">
            <h3 className="text-2xl font-bold text-[#1B263B] mb-4 flex items-center">
                <HelpCircle className="mr-3 text-[#D7263D]"/>
                About The Badge
            </h3>
             <FaqAccordion faqs={certFaq} defaultOpen={true} />
             <div className="text-right mt-4">
                <Link to="/faq" className="text-sm font-semibold text-[#D7263D] hover:underline">
                    See all FAQs →
                </Link>
            </div>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <h2 className="flex items-center"><Building className="mr-3 text-[#D7263D]" />Benefits for Property Managers</h2>
            <p>Stand out in a crowded rental market and streamline your operations.</p>
             <ul className="space-y-2">
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span>Attract higher-quality tenants who value a healthy living environment.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span>Reduce complaints about odors and air quality issues during tenancy.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span>Provide documented proof of due diligence for air system maintenance.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span>Justify premium rental rates with a tangible, health-focused amenity.</span>
              </li>
            </ul>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <h2 className="flex items-center"><BarChart className="mr-3 text-[#D7263D]" />Benefits for Realtors</h2>
            <p>Build trust and overcome objections before they even arise.</p>
             <ul className="space-y-2">
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span>Differentiate your listings from the competition with a unique selling point.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span>Proactively address buyer concerns about hidden mold or air quality problems.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span>Increase buyer confidence and reduce the likelihood of inspection-related hurdles.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-4 mt-1 flex-shrink-0" />
                <span>Enhance your reputation as a detail-oriented, client-focused agent.</span>
              </li>
            </ul>
          </motion.section>

          {/* Mid-article CTA */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="my-12 bg-[#1B263B] text-white rounded-lg p-8 text-center"
          >
            <h3 className="text-2xl md:text-3xl font-bold">Exclusive Partnership Rates Available.</h3>
            <Link to="/contact">
                <Button size="lg" className="mt-4 bg-[#D7263D] hover:bg-[#b51f31] text-white">
                    Schedule a Portfolio Audit
                </Button>
            </Link>
          </motion.div>


          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <h2 className="flex items-center"><ShieldCheck className="mr-3 text-[#D7263D]" />A Healthier Property Is a Stronger Investment</h2>
            <p>Investing in verified clean air is more than a marketing tool; it's a way to protect and enhance the value of your property. It demonstrates a commitment to quality that resonates with today's discerning buyers and renters. It shows you care not just about the appearance of a property, but about the well-being of the people inside it.</p>
          </motion.section>

          <motion.section variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true }} className="mt-12 text-center border-t pt-8">
            <h2 className="flex items-center justify-center"><Award className="mr-3 text-[#D7263D]" />Join the Movement Toward Verified Clean Air</h2>
            <p>Ready to set a new standard for your listings? <Link to="/contact" className="text-[#D7263D] hover:underline">Join the movement</Link> and leverage the power of the Clean Air Certified program. Contact us to learn about partnership pricing and how to <Link to="/contact" className="text-[#D7263D] hover:underline">schedule multiple inspections</Link> for your portfolio.</p>
            <div className="mt-8">
              <Link to="/contact">
                <Button size="lg" className="bg-[#D7263D] hover:bg-[#b51f31] text-white px-8 py-6 text-lg font-semibold">
                  Join the Clean Air Certified Program
                </Button>
              </Link>
            </div>
          </motion.section>
        </article>
      </motion.div>
    </>
  );
};

export default CleanAirCertified;