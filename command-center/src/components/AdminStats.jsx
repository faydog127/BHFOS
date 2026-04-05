import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Inbox, CheckCircle, PhoneOutgoing, Archive } from 'lucide-react';

const AdminStats = ({ submissions }) => {
    const stats = {
        total: submissions.length,
        new: submissions.filter(s => s.status === 'New').length,
        contacted: submissions.filter(s => s.status === 'Contacted').length,
        completed: submissions.filter(s => s.status === 'Completed').length,
    };

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard title="Total Submissions" value={stats.total} icon={<Inbox className="h-4 w-4 text-muted-foreground" />} />
            <StatCard title="New" value={stats.new} icon={<PhoneOutgoing className="h-4 w-4 text-red-500" />} />
            <StatCard title="Contacted" value={stats.contacted} icon={<CheckCircle className="h-4 w-4 text-yellow-500" />} />
            <StatCard title="Completed" value={stats.completed} icon={<CheckCircle className="h-4 w-4 text-green-500" />} />
        </div>
    );
};

const StatCard = ({ title, value, icon }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

export default AdminStats;