import React from 'react';
import { Helmet } from 'react-helmet';
import PartnerStatusDashboard from '@/components/crm/hvac/PartnerStatusDashboard';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const HvacPartnerDashboardPage = () => {
    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <Helmet>
                <title>Partner Dashboard | HVAC</title>
            </Helmet>

            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex items-center gap-4 mb-6">
                    <Button variant="ghost" size="sm" asChild>
                        <Link to="/crm/hvac">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Portal
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-bold text-gray-900">Partner Status Dashboard</h1>
                </div>

                {/* The Main Component */}
                <PartnerStatusDashboard />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                     <div className="bg-white p-6 rounded-lg border shadow-sm">
                        <h3 className="font-semibold mb-4">Active Pipeline (Recent)</h3>
                        <div className="h-64 flex items-center justify-center text-gray-400 bg-gray-50 rounded border border-dashed">
                            Pipeline Chart Placeholder
                        </div>
                     </div>
                     <div className="bg-white p-6 rounded-lg border shadow-sm">
                        <h3 className="font-semibold mb-4">Regional Distribution</h3>
                        <div className="h-64 flex items-center justify-center text-gray-400 bg-gray-50 rounded border border-dashed">
                            Map/Region Chart Placeholder
                        </div>
                     </div>
                </div>
            </div>
        </div>
    );
};

export default HvacPartnerDashboardPage;