import React from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, Link, Outlet } from 'react-router-dom';
import AdminNav from '@/components/AdminNav';
import { AlertCircle, FileText } from 'lucide-react';
import AdminDashboardHome from '@/components/AdminDashboardHome';

const AdminDashboard = ({ children }) => {
    const location = useLocation();

    // Define paths that should NOT show the main dashboard home component
    const isChildRoute = location.pathname !== '/admin' && location.pathname !== '/admin/';

    return (
        <>
            <Helmet>
                <title>Admin Dashboard | The Vent Guys</title>
            </Helmet>
            <div className="flex min-h-screen">
                <AdminNav />
                <main className="flex-1 p-6 bg-gray-100 overflow-y-auto h-screen">
                     <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-6" role="alert">
                        <div className="flex">
                            <div className="py-1"><AlertCircle className="h-6 w-6 text-red-500 mr-4"/></div>
                            <div>
                                <p className="font-bold">🌟 Diversity Reminder: Every image should represent Central Florida.</p>
                                <p className="text-sm">
                                    Check our{' '}
                                    <a href="/src/assets/docs/IMAGE_DIVERSITY_GUIDELINES.md" target="_blank" rel="noopener noreferrer" className="font-semibold underline hover:text-red-900">
                                        Image Guidelines <FileText className="inline h-4 w-4"/>
                                    </a>
                                    {' '}and review the{' '}
                                    <Link to="/admin/image-diversity-tracker" className="font-semibold underline hover:text-red-900">
                                        Diversity Tracker
                                    </Link>.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    {/* If we are on exactly /admin, show the dashboard home. Otherwise, render the outlet for nested routes */}
                    {!isChildRoute ? <AdminDashboardHome/> : <Outlet /> }
                    
                    {/* Render children if passed (legacy support) */}
                    {children}
                </main>
            </div>
        </>
    );
};

export default AdminDashboard;