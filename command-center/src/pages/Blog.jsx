import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Blog = () => {
  const articles = [
    {
      title: 'Florida Humidity & Hidden Duct Contamination',
      excerpt: 'Learn how Florida humidity leads to duct contamination and poor indoor air quality — and how NADCA-certified mechanical hygiene protects your home\'s air.',
      category: 'Indoor Air Quality',
      readTime: '6 min read',
      path: '/florida-humidity-hidden-duct-contamination',
      altText: 'African American family reviewing an air quality report in their Central Florida home, concerned about humidity.',
      image: "https://images.unsplash.com/photo-1556742212-5b321f3c261b"
    },
    {
      title: 'How NADCA Standards Protect Your Home\'s Air',
      excerpt: 'Learn what NADCA standards require, why they matter, and how The Vent Guys apply them to every cleaning in Brevard County.',
      category: 'Education',
      readTime: '7 min read',
      path: '/nadca-standards-air-quality-protection',
      altText: 'A diverse group of technicians in a training session, learning about NADCA standards for air duct cleaning.',
      image: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7'
    },
     {
      title: 'The Return Leak Problem: How Attic Air Enters Your Home',
      excerpt: 'Florida\'s attic air is hot, dusty, and humid. If your return duct leaks, that air bypasses your filter and circulates through your home. Learn how negative pressure creates this hidden problem and how mechanical hygiene restores clean airflow.',
      category: 'Indoor Air Quality',
      readTime: '5 min read',
      path: '/blog/return-duct-leak-attic-air/',
      altText: 'A visible gap in a return duct box in a dusty attic, showing a common point for attic air intrusion.',
      image: 'https://images.unsplash.com/photo-1615865133883-92a0e6985a73'
    },
    {
      title: 'Dryer Vents & Fire Risk: What Every Homeowner Should Know',
      excerpt: 'Learn how clogged dryer vents create hidden fire risks and impact your home\'s air quality. See how our NADCA-certified process keeps your home safe.',
      category: 'Home Safety',
      readTime: '5 min read',
      path: '/dryer-vent-cleaning-fire-safety',
      altText: 'A concerned homeowner looks on as a technician shows them a large clump of lint removed from their dryer vent.',
      image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952"
    },
    {
      title: 'The Florida Filter Guide: MERV, Cadence, and Clean Air',
      excerpt: 'Choosing the right filter for Florida means balancing capture with airflow. This guide breaks down MERV ratings, replacement schedules, and why over-filtering can hurt your system\'s performance.',
      category: 'Homeowner Guides',
      readTime: '4 min read',
      path: '/blog/florida-air-filter-guide-merv-cadence/',
      altText: 'A young family with a toddler learning from a technician about the right air filter for their home.',
      image: 'https://images.unsplash.com/photo-1573164713988-8665fc963095'
    },
    {
      title: 'Mechanical Hygiene vs. Air Duct Cleaning',
      excerpt: 'Discover why true mechanical hygiene goes beyond standard duct cleaning. Learn how our NADCA-certified process ensures your HVAC system and air are truly clean.',
      category: 'Education',
      readTime: '5 min read',
      path: '/mechanical-hygiene-vs-duct-cleaning',
      altText: 'Side-by-side comparison of a dirty duct and a clean duct after a mechanical hygiene service.',
      image: 'https://images.unsplash.com/photo-1617965074274-1372c3641f6f'
    },
    {
      title: 'The Free Air Check: What We Look For in 15 Minutes',
      excerpt: 'See what our Free Air Check includes and how our NADCA-certified team identifies early signs of poor indoor air quality in your home — in just 15 minutes.',
      category: 'Free Inspection',
      readTime: '4 min read',
      path: '/free-air-check-what-we-look-for',
      altText: 'A friendly technician showing a senior homeowner photo-documented results from a Free Air Check on a tablet.',
      image: 'https://images.unsplash.com/photo-1521791136064-7986c28e7481'
    },
    {
      title: 'Clean Air Certified: A New Standard for Property Listings',
      excerpt: 'Learn how our Clean Air Certified program helps property managers and realtors prove air quality, increase trust, and stand out in the market.',
      category: 'Partners',
      readTime: '6 min read',
      path: '/clean-air-certified-property-listings',
      altText: 'A realtor proudly placing a "Clean Air Certified" sign in front of a Central Florida home for sale.',
      image: 'https://images.unsplash.com/photo-1560518883-ce09059ee41f'
    },
  ];

  return (
    <>
      <Helmet>
        <title>Air Duct Cleaning Blog & IAQ Education | The Vent Guys</title>
        <meta name="description" content="Expert tips on air duct cleaning, indoor air quality, and HVAC maintenance from NADCA-certified professionals serving Brevard County, FL." />
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
            <BookOpen className="h-16 w-16 text-[#C2F5E9] mx-auto mb-6" />
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Learning Center</h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Expert insights on indoor air quality, HVAC maintenance, and healthy home living from NADCA-certified professionals
            </p>
          </motion.div>
        </div>
      </section>

      {/* Articles Grid */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map((article, index) => (
              <motion.article
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1 flex flex-col"
              >
                <Link to={article.path} className="block">
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      className="w-full h-full object-cover transition-transform hover:scale-105 duration-300" 
                      alt={article.altText}
                     src={article.image} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <span className="inline-block bg-[#D7263D] text-white px-3 py-1 rounded-full text-xs font-semibold">
                        {article.category}
                      </span>
                    </div>
                  </div>
                </Link>

                <div className="p-6 flex flex-col flex-grow">
                  <h2 className="text-xl font-bold text-[#1B263B] mb-3 line-clamp-2">
                    <Link to={article.path} className="hover:text-[#D7263D] transition-colors">{article.title}</Link>
                  </h2>
                  <p className="text-gray-600 mb-4 line-clamp-3 flex-grow">
                    {article.excerpt}
                  </p>
                  
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-sm text-gray-500">{article.readTime}</span>
                    <Link to={article.path}>
                      <Button variant="ghost" className="text-[#D7263D] hover:text-[#b51f31] p-0">
                        Read More <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Educational CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1B263B] mb-6">
            Have Questions About Indoor Air Quality?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Our NADCA-certified experts are here to help. Schedule a free consultation to discuss your home's air quality needs.
          </p>
          <Link to="/contact">
            <Button size="lg" className="bg-[#D7263D] hover:bg-[#b51f31] text-white px-8 py-6 text-lg font-semibold">
              Contact Our Experts
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
};

export default Blog;