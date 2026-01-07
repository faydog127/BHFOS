
import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import FaqAccordion from '@/components/FaqAccordion';
import TestimonialManager from '@/components/TestimonialManager';
import { allFaqs } from '@/config/faqs'; // Assuming a default FAQ list for demo

const DemoHome = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Helmet>
        <title>Demo Company - Experience Our Platform</title>
        <meta name="description" content="Explore the features of our platform with a live demo environment." />
      </Helmet>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-red-700 to-red-900 text-white py-20 md:py-32 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img class="w-full h-full object-cover opacity-30" alt="Futuristic interface with data visualizations" src="https://images.unsplash.com/photo-1686061593213-98dad7c599b9" />
        </div>
        <div className="relative z-10 container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-4 animate-in fade-in slide-in-from-top-4 duration-1000">
            Experience the Power of Demo Company
          </h1>
          <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
            Dive into our platform's capabilities with a live demonstration.
          </p>
          <div className="flex justify-center gap-4 animate-in fade-in duration-1000 delay-500">
            <Button asChild className="bg-white text-red-700 hover:bg-gray-100 px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300">
              <Link to="/bhf/crm/leads">Go to CRM Dashboard <ArrowRight className="ml-2 w-5 h-5" /></Link>
            </Button>
            <Button asChild variant="outline" className="border-2 border-white text-white hover:bg-white hover:text-red-700 px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300">
              <Link to="/about">About Our Tech</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-10">What You'll Discover</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300">
              <CheckCircle2 className="w-12 h-12 text-red-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">CRM Management</h3>
              <p className="text-gray-600">Seamlessly manage leads, contacts, and customer relationships.</p>
            </div>
            <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300">
              <CheckCircle2 className="w-12 h-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Automated Workflows</h3>
              <p className="text-gray-600">Streamline operations with powerful, customizable automation.</p>
            </div>
            <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300">
              <CheckCircle2 className="w-12 h-12 text-green-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Real-time Analytics</h3>
              <p className="text-gray-600">Gain actionable insights with comprehensive performance dashboards.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-800 text-center mb-10">How Our Demo Works</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gray-50 rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <img class="w-full h-48 object-cover" alt="User interacting with a dashboard" src="https://images.unsplash.com/photo-1678227547309-f25998d4fc86" />
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Explore Freely</h3>
                <p className="text-gray-600 mb-4">Navigate through all the modules and features at your own pace.</p>
                <Button asChild variant="ghost" className="text-red-600 hover:text-red-800 p-0">
                  <Link to="/bhf/crm/leads">Start Exploring <ArrowRight className="ml-1 w-4 h-4" /></Link>
                </Button>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <img class="w-full h-48 object-cover" alt="Data flow diagram" src="https://images.unsplash.com/photo-1700941019917-731dc64ce685" />
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Interact with Data</h3>
                <p className="text-gray-600 mb-4">Modify, create, and delete demo data to understand functionality.</p>
                <Button asChild variant="ghost" className="text-red-600 hover:text-red-800 p-0">
                  <Link to="/bhf/crm/pricebook">Manage Data <ArrowRight className="ml-1 w-4 h-4" /></Link>
                </Button>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <img class="w-full h-48 object-cover" alt="Team collaborating on a project" src="https://images.unsplash.com/photo-1636987050384-9b079c700f63" />
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Discover Integrations</h3>
                <p className="text-gray-600 mb-4">See how our platform integrates with other essential business tools.</p>
                <Button asChild variant="ghost" className="text-red-600 hover:text-red-800 p-0">
                  <Link to="/bhf/crm/settings">View Integrations <ArrowRight className="ml-1 w-4 h-4" /></Link>
                </Button>
              </div>
            </div>
          </div>
          <div className="text-center mt-10">
            <Button asChild className="bg-red-600 hover:bg-red-700 text-white px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300">
              <Link to="/bhf/crm">Access Full Demo <ArrowRight className="ml-2 w-5 h-5" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-gray-100 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-800 text-center mb-10">Our Partners Love It</h2>
          <TestimonialManager />
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-800 text-center mb-10">Common Questions</h2>
          <div className="max-w-3xl mx-auto">
            <FaqAccordion faqs={allFaqs} />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-red-600 text-white py-16 text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold mb-4">Ready to Transform Your Business?</h2>
          <p className="text-lg mb-8 max-w-2xl mx-auto">
            Contact us today to discuss how Demo Company can empower your operations.
          </p>
          <Button asChild className="bg-white text-red-700 hover:bg-gray-100 px-10 py-7 text-xl rounded-full shadow-xl hover:shadow-2xl transition-all duration-300">
            <Link to="/contact">Get in Touch <ArrowRight className="ml-2 w-5 h-5" /></Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default DemoHome;
