import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const MarketingAnalytics = ({ leads, loading }) => {
  if (loading) return <div className="p-8 text-center">Loading analytics...</div>;
  if (!leads || leads.length === 0) return <div className="p-8 text-center text-muted-foreground">No lead data available for analytics.</div>;

  // Process Data for Charts
  const channelCounts = leads.reduce((acc, curr) => {
    const ch = curr.marketing_channel || 'Unknown';
    acc[ch] = (acc[ch] || 0) + 1;
    return acc;
  }, {});

  const chartData = Object.entries(channelCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Process Data for Top Sources Table
  const sourceStats = leads.reduce((acc, curr) => {
    const key = `${curr.marketing_channel || 'Unknown'}-${curr.marketing_source_detail || 'General'}`;
    if (!acc[key]) {
      acc[key] = {
        channel: curr.marketing_channel || 'Unknown',
        detail: curr.marketing_source_detail || 'General',
        total: 0,
        partner: 0
      };
    }
    acc[key].total += 1;
    if (curr.is_partner) acc[key].partner += 1;
    return acc;
  }, {});

  const sortedSources = Object.values(sourceStats)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Charts Section */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Lead Sources Overview</CardTitle>
          <CardDescription>Breakdown by marketing channel</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="value" fill="#091e39" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Distribution Pie */}
      <Card>
        <CardHeader>
          <CardTitle>Distribution</CardTitle>
          <CardDescription>Share of voice</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top Sources Table */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Top Performers</CardTitle>
          <CardDescription>Detailed breakdown by specific source</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Source Detail</TableHead>
                <TableHead className="text-right">Total Leads</TableHead>
                <TableHead className="text-right">Partner Leads</TableHead>
                <TableHead className="text-right">% of Volume</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSources.map((source, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{source.channel}</TableCell>
                  <TableCell className="text-muted-foreground">{source.detail}</TableCell>
                  <TableCell className="text-right font-bold">{source.total}</TableCell>
                  <TableCell className="text-right">{source.partner > 0 ? <Badge variant="secondary">{source.partner}</Badge> : '-'}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {((source.total / leads.length) * 100).toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketingAnalytics;