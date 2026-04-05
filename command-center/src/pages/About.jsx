import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Shield, Award, Users, Heart, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const About = () => {
  const values = [
    { icon: Shield, title: 'Integrity', description: 'We do what we say and stand behind our work with a 100% satisfaction guarantee.' },
    { icon: Award, title: 'Excellence', description: 'NADCA-certified technicians using industry-leading equipment and techniques.' },
    { icon: Users, title: 'Community', description: 'Proudly serving Brevard County families with personalized, local service.' },
    { icon: Heart, title: 'Care', description: 'Your family\'s health and comfort are our top priorities in every job we do.' },
  ];

  return (
    <>
      <Helmet>
        <title>About Us - Veteran-Owned Air Duct Cleaning | The Vent Guys</title>
        <meta name="description" content="Learn about The Vent Guys - a Service-Disabled Veteran-Owned, NADCA-certified air duct cleaning company serving Brevard County, FL with integrity and excellence." />
      </Helmet>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#1B263B] to-[#2a3f5f] text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6">About The Vent Guys</h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Veteran-owned, NADCA-certified air duct cleaning serving Brevard County with military precision and care
            </p>
          </motion.div>
        </div>
      </section>

      {/* Our Story - P2 (Team/Trust) */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-[#1B263B] mb-6">Our Mission</h2>
              <p className="text-lg text-gray-700 mb-4">
                The Vent Guys was founded by a Service-Disabled Veteran who saw a need for honest, professional air duct cleaning services in Brevard County. After years of military service, our founder brought the same dedication to excellence and attention to detail to the HVAC industry, aiming to prevent issues like <Link to="/dryer-vent-cleaning-fire-safety" className="text-[#D7263D] font-semibold hover:underline">dryer fires from lint buildup</Link>.
              </p>
              <p className="text-lg text-gray-700 mb-4">
                We're not just another cleaning company - we're your neighbors, committed to improving the health and comfort of every home we service. Our <Link to="/nadca-standards-air-quality-protection" className="text-[#D7263D] font-semibold hover:underline">NADCA-compliant duct cleaning</Link> ensures we follow the highest industry standards, and our veteran values mean we treat every customer with respect and integrity.
              </p>
              <p className="text-lg text-gray-700">
                Today, we're proud to serve families across Brevard County, from Titusville to Melbourne, with the same commitment to service that defined our military careers. We even offer a <Link to="/free-air-check-what-we-look-for" className="text-[#D7263D] font-semibold hover:underline">Free Air Check</Link> to get started.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="rounded-2xl overflow-hidden shadow-2xl">
                <img 
                  class="w-full h-auto aspect-[4/5] object-cover" 
                  alt="The Vent Guys team, a diverse group of NADCA-certified technicians, serving Central Florida with documented air quality solutions"
                 src="https://images.unsplash.com/photo-1556742212-5b321f3c261b" />
              </div>
              <div className="absolute -bottom-6 -right-6 bg-[#D7263D] text-white p-6 rounded-xl shadow-xl max-w-xs">
                <p className="font-bold text-lg mb-2">Service-Disabled Veteran-Owned Business</p>
                <p className="text-sm">Serving with pride since 2015</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1B263B] mb-4">Our Core Values</h2>
            <p className="text-xl text-gray-600">The principles that guide everything we do</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white p-8 rounded-xl shadow-lg text-center hover:shadow-2xl transition-all hover:-translate-y-1"
              >
                <value.icon className="h-12 w-12 text-[#D7263D] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-[#1B263B] mb-3">{value.title}</h3>
                <p className="text-gray-600">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1B263B] mb-4">Certifications & Credentials</h2>
            <p className="text-xl text-gray-600">Trusted expertise you can count on</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-[#4DA6FF]/10 to-[#C2F5E9]/10 p-8 rounded-xl border-2 border-[#4DA6FF]/30 text-center flex flex-col justify-center items-center h-full"
            >
              <img src="https://horizons-cdn.hostinger.com/4261d516-4b17-442c-85b4-1d2769a22a04/e72bce9f7a2ca70965b162625bec1491.jpg" alt="NADCA Certified Logo" className="h-24 mb-4" />
              <h3 className="text-xl font-bold text-[#1B263B] mb-2">NADCA Certified</h3>
              <p className="text-gray-600">National Air Duct Cleaners Association certified technicians</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-[#4DA6FF]/10 to-[#C2F5E9]/10 p-8 rounded-xl border-2 border-[#4DA6FF]/30 text-center flex flex-col justify-center items-center h-full"
            >
              <div className="bg-white w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Shield className="h-12 w-12 text-[#D7263D]" />
              </div>
              <h3 className="text-xl font-bold text-[#1B263B] mb-2">Licensed & Insured</h3>
              <p className="text-gray-600">Fully bonded and insured for your protection and peace of mind</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-[#4DA6FF]/10 to-[#C2F5E9]/10 p-8 rounded-xl border-2 border-[#4DA6FF]/30 text-center flex flex-col justify-center items-center h-full"
            >
              <img src="https://horizons-cdn.hostinger.com/4261d516-4b17-442c-85b4-1d2769a22a04/ce0f4417890ef8b3cac12b2bceb2a897.jpg" alt="Service-Disabled Veteran-Owned Small Business Certified Logo" className="h-24 mb-4" />
              <h3 className="text-xl font-bold text-[#1B263B] mb-2">SDVOSB</h3>
              <p className="text-gray-600">Service-Disabled Veteran-Owned Small Business</p>
            </motion.div>
          </div>
            
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16 bg-[#1B263B] text-white p-8 rounded-lg text-center shadow-lg"
          >
            <h3 className="text-2xl font-bold mb-4">Why Does NADCA Certification Matter?</h3>
            <p className="text-gray-300 max-w-2xl mx-auto mb-6">
              It's your assurance that you're hiring a professional committed to the highest standards of quality, ethics, and customer service. Our process follows strict <Link to="/mechanical-hygiene-vs-duct-cleaning" className="text-white font-semibold hover:underline">mechanical hygiene</Link> protocols.
            </p>
            <Link to="/nadca-standards-air-quality-protection">
              <span className="font-semibold text-white hover:text-[#C2F5E9] inline-flex items-center">
                Learn How NADCA Protects Your Home <ExternalLink className="ml-2 h-4 w-4" />
              </span>
            </Link>
          </motion.div>

        </div>
      </section>
    </>
  );
};

export default About;