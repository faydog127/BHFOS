import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { CheckCircle2, Info, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const Pricebook = () => {
  const pricingItems = [
    {
      category: "Air Duct Cleaning",
      items: [
        { name: "Standard Home (< 1500 sq ft)", price: "$149", note: "Base package" },
        { name: "Medium Home (1500 - 2500 sq ft)", price: "$229", note: "Most popular" },
        { name: "Large Home (2500+ sq ft)", price: "$299+", note: "Call for exact quote" }
      ]
    },
    {
      category: "Dryer Vent Cleaning",
      items: [
        { 
          name: "Dryer Vent Cleaning", 
          price: "$129", 
          highlight: true,
          badge: "Online Special",
          note: "Normally $150 - Online Booking Only" 
        }
      ]
    },
    {
      category: "Additional Services",
      items: [
        { name: "IAQ Testing", price: "$99", note: "Comprehensive analysis" },
        { name: "System Sanitizer", price: "$49", note: "Antimicrobial fogging" },
        { name: "UV-C Light Installation", price: "Call for Quote", note: "Hardware + Install" },
        { name: "Electrostatic Filters", price: "Call for Quote", note: "Washable lifetime filters" }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <Helmet>
        <title>Pricing Guide | The Vent Guys</title>
        <meta name="description" content="Transparent pricing for air duct and dryer vent cleaning in Brevard County. See our latest specials and standard rates." />
      </Helmet>

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Transparent Pricing</h1>
          <p className="text-xl text-slate-600">No hidden fees. Know exactly what you're paying for.</p>
        </div>

        <div className="space-y-8">
          {pricingItems.map((section, idx) => (
            <Card key={idx} className="shadow-md border-slate-200 overflow-hidden">
              <CardHeader className="bg-slate-100 border-b border-slate-200">
                <CardTitle className="text-2xl text-slate-800">{section.category}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {section.items.map((item, i) => (
                    <div key={i} className={`p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-50 transition-colors ${item.highlight ? 'bg-green-50/50' : ''}`}>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-lg text-slate-900">{item.name}</h3>
                          {item.badge && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <Tag className="w-3 h-3 mr-1" />
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className={`text-sm mt-1 ${item.highlight ? 'text-green-700 font-medium' : 'text-slate-500'}`}>
                          {item.note}
                        </p>
                      </div>
                      <div className="text-right min-w-[120px]">
                        <span className={`text-2xl font-bold ${item.highlight ? 'text-green-600' : 'text-blue-600'}`}>
                          {item.price}
                        </span>
                        {item.highlight && (
                            <div className="text-xs text-slate-400 line-through">$150</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 bg-blue-900 rounded-2xl p-8 text-white text-center shadow-xl">
          <h2 className="text-2xl font-bold mb-4">Ready to Schedule?</h2>
          <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
            Book online now to lock in our special pricing. Our 48-hour SLA guarantees prompt service.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button asChild size="lg" className="bg-white text-blue-900 hover:bg-blue-50 font-bold h-12 px-8">
              <Link to="/booking">Book Online Now</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-blue-400 text-blue-100 hover:text-white hover:bg-blue-800 h-12 px-8">
              <Link to="/estimate-wizard">Build Custom Estimate</Link>
            </Button>
          </div>
        </div>

        <div className="mt-12 text-center text-sm text-slate-500 flex justify-center items-center gap-2">
           <Info className="w-4 h-4" />
           <p>All prices subject to on-site verification of square footage and system accessibility.</p>
        </div>
      </div>
    </div>
  );
};

export default Pricebook;