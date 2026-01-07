
import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import FaqAccordion from '@/components/FaqAccordion';
import TestimonialManager from '@/components/TestimonialManager';
import { allFaqs } from '@/config/faqs'; // Assuming a default FAQ list for InstallWorxs

const InstallWorxsHome = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Helmet>
        <title>InstallWorxs - Professional Installation Services</title>
        <meta name="description" content="Trusted installation services for residential and commercial projects. Quality workmanship guaranteed." />
      </Helmet>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-purple-700 to-indigo-900 text-white py-20 md:py-32 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img class="w-full h-full object-cover opacity-30" alt="Construction site with skilled workers and modern equipment" src="https://images.unsplash.com/photo-1583329322182-9b6703dc9fec" />
        </div>
        <div className="relative z-10 container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-4 animate-in fade-in slide-in-from-top-4 duration-1000">
            Precision & Expertise in Every Installation
          </h1>
          <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
            Your Trusted Partner for Flawless Project Execution.
          </p>
          <div className="flex justify-center gap-4 animate-in fade-in duration-1000 delay-500">
            <Button asChild className="bg-white text-purple-700 hover:bg-gray-100 px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300">
              <Link to="/contact">Get a Quote Today <ArrowRight className="ml-2 w-5 h-5" /></Link>
            </Button>
            <Button asChild variant="outline" className="border-2 border-white text-white hover:bg-white hover:text-purple-700 px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300">
              <Link to="/services">Our Solutions</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Commitment Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-10">Our Commitment to Excellence</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300">
              <CheckCircle2 className="w-12 h-12 text-purple-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Skilled Workforce</h3>
              <p className="text-gray-600">Certified technicians dedicated to the highest installation standards.</p>
            </div>
            <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300">
              <CheckCircle2 className="w-12 h-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">On-Time Delivery</h3>
              <p className="text-gray-600">Meeting project deadlines with efficient and reliable service.</p>
            </div>
            <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300">
              <CheckCircle2 className="w-12 h-12 text-green-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Quality Assurance</h3>
              <p className="text-gray-600">Rigorous quality checks ensure every installation is flawless.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Overview */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-800 text-center mb-10">Our Installation Solutions</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gray-50 rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <img class="w-full h-48 object-cover" alt="Solar panel installation on a rooftop" src="https://images.unsplash.com/photo-1692578919818-8418a9390759" />
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Solar Energy Systems</h3>
                <p className="text-gray-600 mb-4">Expert installation of residential and commercial solar panels for sustainable energy.</p>
                <Button asChild variant="ghost" className="text-purple-600 hover:text-purple-800 p-0">
                  <Link to="/services/solar">Learn More <ArrowRight className="ml-1 w-4 h-4" /></Link>
                </Button>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <img class="w-full h-48 object-cover" alt="Smart home technology installation" src="https://images.unsplash.com/photo-1666401565408-9b6b0741f0d6" />
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Smart Home Integration</h3>
                <p className="text-gray-600 mb-4">Seamless setup of smart thermostats, lighting, security, and entertainment systems.</p>
                <Button asChild variant="ghost" className="text-purple-600 hover:text-purple-800 p-0">
                  <Link to="/services/smart-home">Learn More <ArrowRight className="ml-1 w-4 h-4" /></Link>
                </Button>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <img class="w-full h-48 object-cover" alt="EV charging station installation" src="https://images.unsplash.com/photo-1662629492081-728c36f1bc5a" />
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">EV Charging Solutions</h3>
                <p className="text-gray-600 mb-4">Professional installation of electric vehicle charging stations for homes and businesses.</p>
                <Button asChild variant="ghost" className="text-purple-600 hover:text-purple-800 p-0">
                  <Link to="/services/ev-charging">Learn More <ArrowRight className="ml-1 w-4 h-4" /></Link>
                </Button>
              </div>
            </div>
          </div>
          <div className="text-center mt-10">
            <Button asChild className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300">
              <Link to="/services">View All Services <ArrowRight className="ml-2 w-5 h-5" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-gray-100 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-800 text-center mb-10">Client Success Stories</h2>
          <TestimonialManager />
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-800 text-center mb-10">Installation FAQs</h2>
          <div className="max-w-3xl mx-auto">
            <FaqAccordion faqs={allFaqs} />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-purple-600 text-white py-16 text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold mb-4">Ready for Your Next Project?</h2>
          <p className="text-lg mb-8 max-w-2xl mx-auto">
            Partner with InstallWorxs for reliable, high-quality installation solutions.
          </p>
          <Button asChild className="bg-white text-purple-700 hover:bg-gray-100 px-10 py-7 text-xl rounded-full shadow-xl hover:shadow-2xl transition-all duration-300">
            <Link to="/contact">Request a Consultation <ArrowRight className="ml-2 w-5 h-5" /></Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default InstallWorxsHome;
