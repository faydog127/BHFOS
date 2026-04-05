import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ShieldCheck, Wind, Thermometer, Microscope } from 'lucide-react';
import LeadCaptureForm from '@/components/LeadCaptureForm';

const FreeAirCheck = () => {
  return (
    <>
      <Helmet>
        <title>Free Air Check | The Vent Guys</title>
        <meta name="description" content="Schedule your free, no-obligation 15-minute air check with The Vent Guys. See what's hiding in your ducts and learn how to improve your home's air quality." />
      </Helmet>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#1B263B] to-[#2a3f5f] text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-4xl md:text-5xl font-bold mb-4"
          >
            Claim Your Free Air Check
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl text-gray-300 max-w-3xl mx-auto"
          >
            Our 15-minute visual inspection is fast, free, and comes with zero obligation. See what's hiding in your ducts.
          </motion.p>
        </div>
      </section>

      {/* Form & Info Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            
            {/* Form */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white p-8 rounded-xl shadow-lg"
            >
              <h2 className="text-3xl font-bold text-[#1B263B] mb-2">Schedule Your Check</h2>
              <p className="text-gray-600 mb-6">Fill out the form below and we'll contact you to confirm a time.</p>
              <LeadCaptureForm formType="free-air-check" />
            </motion.div>

            {/* What We Check */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              <h2 className="text-3xl font-bold text-[#1B263B] mb-6">What's Included in Your Free Check?</h2>
              <p className="text-gray-700">
                Our certified technician will perform a quick, non-invasive visual inspection of key components of your HVAC system to identify common signs of contamination and inefficiency.
              </p>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 bg-[#D7263D] p-3 rounded-full">
                    <Wind className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-[#1B263B]">Filter & Blower Check</h3>
                    <p className="text-gray-600">We'll examine your air filter and blower fan for buildup that restricts airflow and spreads dust.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 bg-[#D7263D] p-3 rounded-full">
                    <Microscope className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-[#1B263B]">Visible Duct & Register Inspection</h3>
                    <p className="text-gray-600">A look inside accessible ductwork and registers for signs of dust, debris, or microbial growth.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 bg-[#D7263D] p-3 rounded-full">
                    <Thermometer className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-[#1B263B]">Humidity & Odor Assessment</h3>
                    <p className="text-gray-600">We'll note any unusual odors or signs of excess humidity that could point to hidden issues.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 bg-[#D7263D] p-3 rounded-full">
                    <ShieldCheck className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-[#1B263B]">No-Pressure Recommendations</h3>
                    <p className="text-gray-600">You'll receive a straightforward summary of our findings and professional advice, with no obligation to purchase any services.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
};

export default FreeAirCheck;