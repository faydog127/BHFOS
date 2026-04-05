import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { 
    LayoutDashboard, 
    Phone, 
    TestTube, 
    BarChart3, 
    ShieldAlert,
    ArrowRight,
    Users,
    PhoneForwarded,
    LineChart,
    Activity
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const PortalCard = ({ title, description, icon: Icon, to, colorClass }) => (
    <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-transparent hover:border-l-blue-600">
        <CardHeader>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${colorClass}`}>
                <Icon className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardFooter>
            <Button asChild variant="ghost" className="w-full justify-between group">
                <Link to={to}>
                    Open Module
                    <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Link>
            </Button>
        </CardFooter>
    </Card>
);

const HvacVerticalPortal = () => {
    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <Helmet>
                <title>HVAC Vertical Operations | CRM</title>
            </Helmet>

            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">HVAC Vertical Operations</h1>
                        <p className="text-gray-500 mt-1">Manage partners, execute protocols, and verify system integrity.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* 1. Campaign Strategy Dashboard (NEW) */}
                     <PortalCard 
                        title="Campaign Strategy Center"
                        description="High-level strategic view. County performance, tier penetration, and health metrics."
                        icon={Activity}
                        to="/testing/hvac-strategy"
                        colorClass="bg-purple-600"
                    />

                    {/* 2. Live Test Workflow (Priority) */}
                     <PortalCard 
                        title="Live Sales Workflow"
                        description="Interactive dialer for the master candidate list. Step-by-step script and logging."
                        icon={PhoneForwarded}
                        to="/testing/hvac-live-workflow"
                        colorClass="bg-green-600"
                    />

                    {/* 3. Call Campaign Tracker */}
                    <PortalCard 
                        title="Call Campaign Tracker"
                        description="View real-time progress logs. Export data to CSV and see individual outcomes."
                        icon={LineChart}
                        to="/testing/hvac-call-tracking"
                        colorClass="bg-teal-600"
                    />

                    {/* 4. Operational Dashboard */}
                    <PortalCard 
                        title="Partner Status Dashboard"
                        description="Monitor active, at-risk, and dormant partners. Track lifecycle metrics."
                        icon={LayoutDashboard}
                        to="/crm/hvac/dashboard"
                        colorClass="bg-blue-600"
                    />

                    {/* 5. Call Console */}
                    <PortalCard 
                        title="Call Console"
                        description="Handle inbound/outbound calls with automated Chaos Flags and scripts."
                        icon={Phone}
                        to="/crm/hvac/console"
                        colorClass="bg-slate-600"
                    />

                    {/* 6. Chaos Protocol */}
                    <PortalCard 
                        title="Chaos Protocol Manager"
                        description="Manage blacklists, trigger manual flags, and review security incidents."
                        icon={ShieldAlert}
                        to="/crm/hvac/console" // Linking to console for now as it contains the flag modal
                        colorClass="bg-red-600"
                    />
                </div>

                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-gray-500" />
                        Quick Actions
                    </h2>
                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline" asChild>
                            <Link to="/partners">View Public Partner Page</Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link to="/crm/hvac/console?demo=true">Launch Console Demo</Link>
                        </Button>
                         <Button variant="outline" asChild>
                            <Link to="/testing/hvac-runner">Data Runner</Link>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HvacVerticalPortal;