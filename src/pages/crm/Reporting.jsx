import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

const PlaceholderContent = () => {
    const { toast } = useToast();

    const notify = () => {
        toast({
            title: "🚧 Feature in the works!",
            description: "This page is under construction. You can request this feature in your next prompt! 🚀",
        });
    };

    return (
        <div className="text-center bg-white p-12 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-[#091e39] mb-4">Reporting Coming Soon!</h2>
            <p className="text-gray-600 mb-6">Generate custom reports on sales, marketing, and operations to make data-driven decisions.</p>
            <Button onClick={notify}>Request This Feature</Button>
        </div>
    );
};

const Reporting = () => {
    return (
        <>
            <Helmet>
                <title>Reporting | The Vent Guys CRM</title>
            </Helmet>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-3xl font-bold text-[#091e39] mb-6">Reporting</h1>
                <PlaceholderContent />
            </motion.div>
        </>
    );
};

export default Reporting;