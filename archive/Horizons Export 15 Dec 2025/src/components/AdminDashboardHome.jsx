import React from 'react';

const AdminDashboardHome = () => {
    return (
        <div>
            <h1 className="text-3xl font-bold text-[#1B263B] mb-6">Admin Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h2 className="font-bold text-xl mb-4">Submissions Overview</h2>
                        <p className="text-gray-600">Contact form submissions will be displayed here. This feature is under construction.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboardHome;