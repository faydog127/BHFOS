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
            <h2 className="text-2xl font-bold text-[#091e39] mb-4">My Money Coming Soon!</h2>
            <p className="text-gray-600 mb-6">Track revenue, manage invoices, and integrate with your payment processor all in one place.</p>
            <Button onClick={notify}>Request This Feature</Button>
        </div>
    );
};

const MyMoney = () => {
    return (
        <>
            <Helmet>
                <title>My Money | The Vent Guys CRM</title>
            </Helmet>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-3xl font-bold text-[#091e39] mb-6">My Money</h1>
                <PlaceholderContent />
            </motion.div>
        </>
    );
};

export default MyMoney;