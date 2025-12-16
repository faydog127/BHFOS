
import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import FaqAccordion from '@/components/FaqAccordion';
import TestimonialManager from '@/components/TestimonialManager';
import { allFaqs } from '@/config/faqs';

const Home = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Helmet>
        <title>The Vent Guys - NADCA Certified Dryer Vent & Air Duct Cleaning</title>
        <meta name="description" content="Expert dryer vent and air duct cleaning services in Brevard County, FL. Improve air quality, prevent fires, and save energy with NADCA certified professionals." />
      </Helmet>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-blue-700 to-indigo-800 text-white py-20 md:py-32 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img class="w-full h-full object-cover opacity-30" alt="Clean air duct background" src="https://images.unsplash.com/photo-1574334292321-4844f63aefef" />
        </div>
        <div className="relative z-10 container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-4 animate-in fade-in slide-in-from-top-4 duration-1000">
            Breathe Cleaner, Live Healthier
          </h1>
          <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
            NADCA Certified Air Duct & Dryer Vent Cleaning for a Safer Home.
          </p>
          <div className="flex justify-center gap-4 animate-in fade-in duration-1000 delay-500">
            <Button asChild className="bg-white text-blue-700 hover:bg-gray-100 px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300">
              <Link to="/booking">Book Online Today <ArrowRight className="ml-2 w-5 h-5" /></Link>
            </Button>
            <Button asChild variant="outline" className="border-2 border-white text-white hover:bg-white hover:text-blue-700 px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300">
              <Link to="/services">Learn More</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Trust & Quality Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-10">Why Choose The Vent Guys?</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300">
              <CheckCircle2 className="w-12 h-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">NADCA Certified</h3>
              <p className="text-gray-600">The highest standard in air duct cleaning. We follow strict guidelines.</p>
            </div>
            <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300">
              <CheckCircle2 className="w-12 h-12 text-green-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Photo-Verified Results</h3>
              <p className="text-gray-600">See the difference! Before-and-after photos with every service.</p>
            </div>
            <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300">
              <CheckCircle2 className="w-12 h-12 text-purple-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Transparent Pricing</h3>
              <p className="text-gray-600">No hidden fees, no surprises. Honest quotes every time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Overview */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-800 text-center mb-10">Our Core Services</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gray-50 rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <img class="w-full h-48 object-cover" alt="Air duct cleaning service" src="https://images.unsplash.com/photo-1574334292321-4844f63aefef" />
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Air Duct Cleaning</h3>
                <p className="text-gray-600 mb-4">Improve indoor air quality by removing dust, allergens, and contaminants from your HVAC system.</p>
                <Button asChild variant="ghost" className="text-blue-600 hover:text-blue-800 p-0">
                  <Link to="/services/air-duct-cleaning">Learn More <ArrowRight className="ml-1 w-4 h-4" /></Link>
                </Button>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <img class="w-full h-48 object-cover" alt="Dryer vent cleaning service" src="https://images.unsplash.com/photo-1572081790780-1a7739896259" />
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Dryer Vent Cleaning</h3>
                <p className="text-gray-600 mb-4">Prevent dryer fires, reduce energy costs, and extend your dryer's lifespan.</p>
                <Button asChild variant="ghost" className="text-blue-600 hover:text-blue-800 p-0">
                  <Link to="/services/dryer-vent-cleaning">Learn More <ArrowRight className="ml-1 w-4 h-4" /></Link>
                </Button>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <img class="w-full h-48 object-cover" alt="UV light installation" src="https://images.unsplash.com/photo-1699974783477-74e9ab7546a4" />
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">UV Light Installation</h3>
                <p className="text-gray-600 mb-4">Enhance air purity by eliminating airborne pathogens, mold, and bacteria.</p>
                <Button asChild variant="ghost" className="text-blue-600 hover:text-blue-800 p-0">
                  <Link to="/services/uv-light-installation">Learn More <ArrowRight className="ml-1 w-4 h-4" /></Link>
                </Button>
              </div>
            </div>
          </div>
          <div className="text-center mt-10">
            <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300">
              <Link to="/services">View All Services <ArrowRight className="ml-2 w-5 h-5" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-gray-100 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-800 text-center mb-10">What Our Customers Say</h2>
          <TestimonialManager />
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-800 text-center mb-10">Frequently Asked Questions</h2>
          <div className="max-w-3xl mx-auto">
            <FaqAccordion faqs={allFaqs} />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 text-white py-16 text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold mb-4">Ready for Cleaner Air?</h2>
          <p className="text-lg mb-8 max-w-2xl mx-auto">
            Don't compromise on your home's air quality. Get a free estimate today!
          </p>
          <Button asChild className="bg-white text-blue-700 hover:bg-gray-100 px-10 py-7 text-xl rounded-full shadow-xl hover:shadow-2xl transition-all duration-300">
            <Link to="/booking">Get My Free Quote <ArrowRight className="ml-2 w-5 h-5" /></Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Home;
