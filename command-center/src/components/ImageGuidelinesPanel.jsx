import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Lightbulb, Check, X, Image } from 'lucide-react';

const ImageGuidelinesPanel = () => {
    return (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 h-full">
            <h3 className="text-xl font-bold text-[#1B263B] mb-4 flex items-center">
                <Lightbulb className="mr-2 text-[#D7263D]" /> Image Guidelines
            </h3>
            <p className="text-sm text-gray-600 mb-4">Every image tells a story. Your alt-text should describe the **PERSON** and the **MOMENT**, not just the action.</p>

            <Accordion type="single" collapsible defaultValue="item-1">
                <AccordionItem value="item-1">
                    <AccordionTrigger className="font-semibold">Alt-Text Examples</AccordionTrigger>
                    <AccordionContent>
                        <div className="space-y-3 text-sm">
                            <p className="font-bold text-green-600 flex items-start"><Check className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" /> GOOD:</p>
                            <ul className="list-disc pl-8 space-y-1 text-gray-700">
                                <li>"Hispanic mother and teenage daughter review air quality report after IAQ testing"</li>
                                <li>"African American homeowner smiling while technician explains duct cleaning process"</li>
                                <li>"Young family with toddler learning about filter replacement schedule"</li>
                            </ul>
                            <p className="font-bold text-red-600 flex items-start mt-4"><X className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" /> AVOID:</p>
                            <ul className="list-disc pl-8 space-y-1 text-gray-700">
                                <li>"Technician working"</li>
                                <li>"Happy customer"</li>
                            </ul>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                    <AccordionTrigger className="font-semibold">Diversity Checklist</AccordionTrigger>
                    <AccordionContent>
                        <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-start"><Image className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0 text-[#1B263B]" />Does it show a PERSON?</li>
                            <li className="flex items-start"><Image className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0 text-[#1B263B]" />Does it reflect Central Florida demographics?</li>
                            <li className="flex items-start"><Image className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0 text-[#1B263B]" />Does it feel AUTHENTIC?</li>
                            <li className="flex items-start"><Image className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0 text-[#1B263B]" />Is the alt-text descriptive?</li>
                        </ul>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
};

export default ImageGuidelinesPanel;