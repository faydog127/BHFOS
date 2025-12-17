
import React from 'react';
import { Link } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

// Helper function to parse and link content
const LinkedContent = ({ content }) => {
    if (!content) return null;
    const parts = content.split(/(\[.*?\]\(.*?\))/g);
    return (
        <>
            {parts.map((part, index) => {
                const match = part.match(/\[(.*?)\]\((.*?)\)/);
                if (match) {
                    const [, text, url] = match;
                    return (
                        <Link key={index} to={url} className="text-[#D7263D] font-semibold hover:underline">
                            {text}
                        </Link>
                    );
                }
                return part;
            })}
        </>
    );
};

const FaqAccordion = ({ faqs = [], defaultOpen = false }) => {
    if (!faqs || !Array.isArray(faqs) || faqs.length === 0) {
        return null;
    }

    return (
        <Accordion type="single" collapsible className="w-full" defaultValue={defaultOpen ? faqs[0]?.id : null}>
            {faqs.map((faq) => (
                <AccordionItem value={faq.id} key={faq.id}>
                    <AccordionTrigger className="text-left text-lg font-bold text-[#1B263B] hover:text-[#D7263D]">
                        {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="prose max-w-none text-gray-700">
                        <LinkedContent content={faq.answer} />
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
};

export default FaqAccordion;
