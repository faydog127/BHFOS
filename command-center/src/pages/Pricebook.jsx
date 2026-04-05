
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { CheckCircle2, Info, Tag, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { fetchPriceBook, formatPrice } from '@/lib/pricing';

const Pricebook = () => {
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      const allItems = await fetchPriceBook();
      
      // Organize items into sections dynamically
      const categories = [
        { id: 'Duct Cleaning', title: "Air Duct Cleaning", items: [] },
        { id: 'Dryer Vent', title: "Dryer Vent Cleaning", items: [] },
        { id: 'Testing', title: "Testing & Inspection", items: [] },
        { id: 'Add-On', title: "System Add-ons", items: [] },
        { id: 'Hardware', title: "Hardware Upgrades", items: [] }
      ];

      allItems.forEach(item => {
        // Basic filter to show relevant public items
        if (!item.active) return;
        
        const cat = categories.find(c => c.id === item.category) || categories.find(c => c.id === 'Add-On');
        if (cat) {
          cat.items.push(item);
        }
      });

      // Filter out empty categories
      setSections(categories.filter(c => c.items.length > 0));
      setLoading(false);
    };
    
    loadData();
  }, []);

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

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-8">
            {sections.map((section, idx) => (
              <Card key={idx} className="shadow-md border-slate-200 overflow-hidden">
                <CardHeader className="bg-slate-100 border-b border-slate-200">
                  <CardTitle className="text-2xl text-slate-800">{section.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    {section.items.map((item, i) => (
                      <div key={i} className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-50 transition-colors">
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="font-bold text-lg text-slate-900">{item.name}</h3>
                            {item.price_type === 'tiered' && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Starts At
                              </span>
                            )}
                          </div>
                          <p className="text-sm mt-1 text-slate-500">
                            {item.description || item.code}
                          </p>
                        </div>
                        <div className="text-right min-w-[120px]">
                          <span className="text-2xl font-bold text-blue-600">
                            {formatPrice(item.base_price)}
                          </span>
                          {item.price_type !== 'flat' && (
                             <div className="text-xs text-slate-400 capitalize">{item.price_type.replace('_', ' ')}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

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
