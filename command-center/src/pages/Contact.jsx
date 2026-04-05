import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Phone, Mail, MapPin } from 'lucide-react';
import LeadCaptureForm from '@/components/LeadCaptureForm';

const Contact = () => {
  return (
    <>
      <Helmet>
        <title>Contact The Vent Guys | Brevard County, FL</title>
        <meta name="description" content="Contact The Vent Guys for NADCA-certified air duct cleaning in Brevard County. Call us or fill out our form to schedule a free air check." />
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
            Get in Touch
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl text-gray-300 max-w-3xl mx-auto"
          >
            We're here to answer your questions and help you breathe cleaner air. Schedule your free, no-obligation air check today.
          </motion.p>
        </div>
      </section>

      {/* Contact Form & Info Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            
            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white p-8 rounded-xl shadow-lg"
            >
              <h2 className="text-3xl font-bold text-[#1B263B] mb-6">Send Us a Message</h2>
              <LeadCaptureForm formType="contact" />
            </motion.div>

            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              <h2 className="text-3xl font-bold text-[#1B263B] mb-6">Contact Information</h2>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 bg-[#D7263D] p-3 rounded-full">
                  <Phone className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-[#1B263B]">Call Us</h3>
                  <p className="text-gray-600">Speak directly with our team.</p>
                  <a href="tel:+13213609704" className="text-[#D7263D] font-bold text-lg hover:underline">(321) 360-9704</a>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 bg-[#D7263D] p-3 rounded-full">
                  <Mail className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-[#1B263B]">Email Us</h3>
                  <p className="text-gray-600">For general inquiries and partnerships.</p>
                  <a href="mailto:info@vent-guys.com" className="text-[#D7263D] font-bold text-lg hover:underline">info@vent-guys.com</a>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 bg-[#D7263D] p-3 rounded-full">
                  <MapPin className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-[#1B263B]">Service Area</h3>
                  <p className="text-gray-600">Proudly serving all of Brevard County, FL, including Melbourne, Viera, Suntree, Rockledge, and surrounding areas.</p>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>
    </>
  );
};

export default Contact;