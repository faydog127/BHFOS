

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';
import { DollarSign, MousePointer, Users, Target, Sparkles } from 'lucide-react';

const MetricCard = ({ title, value, sub, icon: Icon, trend }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className={`text-xs ${trend > 0 ? 'text-green-600' : 'text-red-600'} flex items-center`}>
        {trend > 0 ? '+' : ''}{trend}% from last week
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </CardContent>
  </Card>
);

const MarketingAnalyticsV2 = () => {
  const [data, setData] = useState([]);
  const [metrics, setMetrics] = useState({ spend: 0, impressions: 0, clicks: 0, leads: 0 });

  useEffect(() => {
    // Simulated data fetching since real metrics need aggregation from raw tables
    // In real app: fetch from `marketing_metrics`
    const mockData = [
      { date: 'Mon', spend: 120, leads: 5, clicks: 45 },
      { date: 'Tue', spend: 135, leads: 8, clicks: 52 },
      { date: 'Wed', spend: 110, leads: 4, clicks: 38 },
      { date: 'Thu', spend: 150, leads: 12, clicks: 65 },
      { date: 'Fri', spend: 140, leads: 9, clicks: 58 },
      { date: 'Sat', spend: 90, leads: 3, clicks: 25 },
      { date: 'Sun', spend: 85, leads: 2, clicks: 20 },
    ];
    setData(mockData);
    
    setMetrics({
        spend: mockData.reduce((a, b) => a + b.spend, 0),
        leads: mockData.reduce((a, b) => a + b.leads, 0),
        clicks: mockData.reduce((a, b) => a + b.clicks, 0),
        impressions: mockData.reduce((a, b) => a + b.clicks * 40, 0), // Est
    });
  }, []);

  const ctr = ((metrics.clicks / metrics.impressions) * 100).toFixed(2);
  const cpc = (metrics.spend / metrics.clicks).toFixed(2);
  const cpl = (metrics.spend / metrics.leads).toFixed(2);

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Spend" value={`$${metrics.spend}`} sub="Last 7 Days" icon={DollarSign} trend={12} />
        <MetricCard title="Leads Generated" value={metrics.leads} sub={`$${cpl} per lead`} icon={Users} trend={5} />
        <MetricCard title="Clicks" value={metrics.clicks} sub={`$${cpc} CPC`} icon={MousePointer} trend={8} />
        <MetricCard title="CTR" value={`${ctr}%`} sub={`${metrics.impressions.toLocaleString()} Impr.`} icon={Target} trend={-2} />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Spend vs. Leads Trend</CardTitle>
            <CardDescription>Daily performance correlation.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="spend" name="Spend ($)" fill="#8884d8" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="leads" name="Leads" fill="#82ca9d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Traffic Quality</CardTitle>
            <CardDescription>Clicks volume over the week.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="clicks" stroke="#ff7300" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* AI Insight */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-100">
        <CardHeader>
            <CardTitle className="flex items-center text-indigo-900"><Sparkles className="w-5 h-5 mr-2 text-indigo-600"/> AI Performance Insight</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-indigo-800">
                <strong>Strong Performance:</strong> "Allergy Season" campaigns are outperforming generic branding by <strong>40% CTR</strong> this week due to high pollen signals. 
                <br/>
                <strong>Recommendation:</strong> Shift $50/day budget from "General Awareness" to "Mold Prevention" campaigns as humidity trends upward.
            </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketingAnalyticsV2;
