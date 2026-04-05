import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Users, ArrowUpRight, TrendingUp, CalendarDays } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const KpiCard = ({ title, value, subtext, icon: Icon, colorClass, loading, to }) => {
  const Content = (
    <CardContent className="p-6 relative group">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <h2 className="text-2xl font-bold tracking-tight">{value}</h2>
          )}
        </div>
        <div className={`p-3 rounded-full ${colorClass} bg-opacity-10 group-hover:scale-110 transition-transform`}>
          <Icon className={`w-5 h-5 ${colorClass.replace('bg-', 'text-')}`} />
        </div>
      </div>
      {subtext && (
        <div className="mt-4 text-xs text-muted-foreground flex items-center">
          {subtext}
        </div>
      )}
      {to && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/5 transition-opacity rounded-lg cursor-pointer">
          <span className="bg-white shadow-sm px-2 py-1 rounded text-xs font-medium text-slate-900">View Details</span>
        </div>
      )}
    </CardContent>
  );

  if (to) {
    return (
      <Link to={to} className="block no-underline">
        <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
          {Content}
        </Card>
      </Link>
    );
  }

  return (
    <Card className="overflow-hidden">
      {Content}
    </Card>
  );
};

const MarketingScoreboard = ({ leads, dateRange, loading }) => {
  // Filter leads by date range
  const filterLeads = (days) => {
    if (!leads) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return leads.filter(l => new Date(l.created_at) >= cutoff);
  };

  const last30Days = filterLeads(30);
  const thisWeek = filterLeads(7);
  
  // Calculate Top Channel
  const channels = last30Days.reduce((acc, curr) => {
    const ch = curr.marketing_channel || 'Direct/Unknown';
    acc[ch] = (acc[ch] || 0) + 1;
    return acc;
  }, {});
  
  const topChannelEntry = Object.entries(channels).sort((a, b) => b[1] - a[1])[0];

  // Calculate Partner Leads
  const partnerLeads = last30Days.filter(l => l.is_partner || l.marketing_channel === 'Partner').length;

  // Avg Leads Per Day
  const avgLeads = (last30Days.length / 30).toFixed(1);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard 
        title="Leads (30 Days)" 
        value={last30Days.length}
        subtext={`${thisWeek.length} in the last 7 days`}
        icon={Users}
        colorClass="bg-blue-500 text-blue-500"
        loading={loading}
        to="/crm/leads-list?range=30"
      />
      <KpiCard 
        title="Top Channel" 
        value={topChannelEntry ? topChannelEntry[0] : 'N/A'}
        subtext={topChannelEntry ? `${topChannelEntry[1]} leads` : 'No data'}
        icon={TrendingUp}
        colorClass="bg-green-500 text-green-500"
        loading={loading}
      />
      <KpiCard 
        title="Partner Sourced" 
        value={partnerLeads}
        subtext="From active partners"
        icon={ArrowUpRight}
        colorClass="bg-purple-500 text-purple-500"
        loading={loading}
      />
      <KpiCard 
        title="Daily Average" 
        value={avgLeads}
        subtext="Leads per day (30d avg)"
        icon={CalendarDays}
        colorClass="bg-orange-500 text-orange-500"
        loading={loading}
      />
    </div>
  );
};

export default MarketingScoreboard;