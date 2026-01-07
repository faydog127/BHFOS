
import React from 'react';
import EnterpriseLayout from '@/components/crm/EnterpriseLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, Users, DollarSign, Phone, ArrowUpRight, 
  ArrowDownRight, MoreHorizontal, Calendar 
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock Data for Dashboard
const stats = [
  { 
    title: 'Total Revenue', 
    value: '$124,592', 
    change: '+12.5%', 
    trend: 'up', 
    icon: DollarSign,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50'
  },
  { 
    title: 'Active Leads', 
    value: '1,429', 
    change: '+8.2%', 
    trend: 'up', 
    icon: Users,
    color: 'text-blue-600',
    bg: 'bg-blue-50'
  },
  { 
    title: 'Calls Made', 
    value: '842', 
    change: '-2.4%', 
    trend: 'down', 
    icon: Phone,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50'
  },
  { 
    title: 'Avg Deal Size', 
    value: '$12,450', 
    change: '+4.1%', 
    trend: 'up', 
    icon: TrendingUp,
    color: 'text-orange-600',
    bg: 'bg-orange-50'
  },
];

const recentActivity = [
  { id: 1, user: 'Sarah Wilson', action: 'Closed deal', target: 'Acme Corp', time: '2 mins ago', amount: '$45,000' },
  { id: 2, user: 'Mike Chen', action: 'New lead', target: 'TechStart Inc', time: '15 mins ago', status: 'Hot' },
  { id: 3, user: 'Jessica Lee', action: 'Call completed', target: 'Global Systems', time: '1 hour ago', duration: '14m' },
  { id: 4, user: 'Tom Davis', action: 'Sent proposal', target: 'Nebula Stream', time: '3 hours ago', amount: '$12,500' },
  { id: 5, user: 'System', action: 'Automated follow-up', target: 'Lead #4921', time: '5 hours ago', type: 'Email' },
];

const Dashboard = () => {
  return (
    <EnterpriseLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Executive Dashboard</h1>
            <p className="text-slate-500 mt-1">Overview of your sales performance and team activities.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="bg-white">
              <Calendar className="mr-2 h-4 w-4" />
              Last 30 Days
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
              Generate Report
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, idx) => (
            <Card key={idx} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className={cn("p-2 rounded-lg", stat.bg)}>
                    <stat.icon className={cn("h-6 w-6", stat.color)} />
                  </div>
                  {stat.trend === 'up' ? (
                    <div className="flex items-center text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-full">
                      <ArrowUpRight className="h-3 w-3 mr-1" />
                      {stat.change}
                    </div>
                  ) : (
                    <div className="flex items-center text-red-600 text-xs font-bold bg-red-50 px-2 py-1 rounded-full">
                      <ArrowDownRight className="h-3 w-3 mr-1" />
                      {stat.change}
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
                  <p className="text-sm text-slate-500 font-medium">{stat.title}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Content Section: Charts & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Chart Area (Placeholder for now) */}
          <Card className="lg:col-span-2 border-slate-200 shadow-sm h-[400px] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <CardTitle className="text-lg">Revenue Overview</CardTitle>
                <CardDescription>Monthly revenue vs targets</CardDescription>
              </div>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-5 w-5 text-slate-400" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center bg-slate-50/50">
               <div className="text-center text-slate-400">
                 <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-20" />
                 <p>Interactive Chart Component Loading...</p>
               </div>
            </CardContent>
          </Card>

          {/* Recent Activity Feed */}
          <Card className="border-slate-200 shadow-sm h-[400px] flex flex-col">
            <CardHeader className="pb-2 border-b border-slate-100">
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <CardDescription>Live updates from your team</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              <div className="divide-y divide-slate-100">
                {recentActivity.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                      {item.user.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {item.user} <span className="text-slate-500 font-normal">{item.action}</span>
                      </p>
                      <p className="text-xs text-indigo-600 font-medium truncate">{item.target}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">{item.time}</p>
                      {item.amount && <p className="text-xs font-bold text-emerald-600">{item.amount}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </EnterpriseLayout>
  );
};

export default Dashboard;
