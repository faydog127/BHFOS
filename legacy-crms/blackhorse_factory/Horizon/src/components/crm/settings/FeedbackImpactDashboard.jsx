import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ThumbsUp, ThumbsDown, Activity, AlertTriangle, Target, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, Cell, PieChart, Pie
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function FeedbackImpactDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const { data: analytics, error } = await supabase.rpc('get_feedback_analytics', { days_lookback: 30 });
        if (error) throw error;
        setData(analytics);
      } catch (err) {
        console.error('Failed to fetch feedback analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!data || !data.summary || data.summary.total === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-300">
        <Activity className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-slate-900">No Feedback Data Yet</h3>
        <p className="text-slate-500 max-w-sm mx-auto mt-1">
          Once you start submitting feedback on System Doctor fixes, analytics will appear here.
        </p>
      </div>
    );
  }

  const { summary, confidence_accuracy, sentiment_breakdown, weekly_trend, root_causes } = data;

  const sentimentData = sentiment_breakdown.map(item => ({
    name: item.feedback_sentiment,
    value: item.count,
    color: item.feedback_sentiment === 'EXCELLENT' ? '#22c55e' :
           item.feedback_sentiment === 'SUCCESS' ? '#3b82f6' :
           item.feedback_sentiment === 'PARTIAL' ? '#eab308' :
           item.feedback_sentiment === 'NEGATIVE' ? '#f97316' : '#ef4444'
  }));

  const trendData = weekly_trend.map(week => ({
    name: format(new Date(week.week), 'MMM d'),
    rate: week.total > 0 ? Math.round((week.success_count / week.total) * 100) : 0,
    total: week.total
  }));

  const calculateSuccessRate = (bucket) => {
    if (!bucket || bucket.total === 0) return 0;
    return Math.round((bucket.success / bucket.total) * 100);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Fixes</p>
                <h3 className="text-2xl font-bold">{summary.total}</h3>
              </div>
              <Activity className="h-8 w-8 text-indigo-100 bg-indigo-500 rounded p-1.5" />
            </div>
            <p className="text-xs text-slate-400 mt-2">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Positive Impact</p>
                <h3 className="text-2xl font-bold text-green-600">
                  {summary.total > 0 ? Math.round((summary.positive / summary.total) * 100) : 0}%
                </h3>
              </div>
              <ThumbsUp className="h-8 w-8 text-green-100 bg-green-500 rounded p-1.5" />
            </div>
            <p className="text-xs text-slate-400 mt-2">{summary.positive} successful fixes</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Partial Fixes</p>
                <h3 className="text-2xl font-bold text-yellow-600">
                  {summary.total > 0 ? Math.round((summary.partial / summary.total) * 100) : 0}%
                </h3>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-100 bg-yellow-500 rounded p-1.5" />
            </div>
            <p className="text-xs text-slate-400 mt-2">{summary.partial} needed tweaks</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Negative Impact</p>
                <h3 className="text-2xl font-bold text-red-600">
                  {summary.total > 0 ? Math.round((summary.negative / summary.total) * 100) : 0}%
                </h3>
              </div>
              <ThumbsDown className="h-8 w-8 text-red-100 bg-red-500 rounded p-1.5" />
            </div>
            <p className="text-xs text-slate-400 mt-2">{summary.negative} rolled back or failed</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 2. Confidence Calibration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-indigo-500" />
              AI Confidence Calibration
            </CardTitle>
            <CardDescription>Does high AI confidence actually mean high success?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-green-700">High Confidence (90%+)</span>
                <span className="text-slate-500">{confidence_accuracy.high.total} fixes</span>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={calculateSuccessRate(confidence_accuracy.high)} className="h-2.5 flex-1 bg-slate-100" indicatorClassName="bg-green-500" />
                <span className="text-sm font-bold w-12 text-right">{calculateSuccessRate(confidence_accuracy.high)}%</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-yellow-700">Medium Confidence (70-89%)</span>
                <span className="text-slate-500">{confidence_accuracy.medium.total} fixes</span>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={calculateSuccessRate(confidence_accuracy.medium)} className="h-2.5 flex-1 bg-slate-100" indicatorClassName="bg-yellow-500" />
                <span className="text-sm font-bold w-12 text-right">{calculateSuccessRate(confidence_accuracy.medium)}%</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-red-700">Low Confidence (&lt;70%)</span>
                <span className="text-slate-500">{confidence_accuracy.low.total} fixes</span>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={calculateSuccessRate(confidence_accuracy.low)} className="h-2.5 flex-1 bg-slate-100" indicatorClassName="bg-red-500" />
                <span className="text-sm font-bold w-12 text-right">{calculateSuccessRate(confidence_accuracy.low)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Sentiment Breakdown Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Feedback Sentiment</CardTitle>
            <CardDescription>Distribution of user ratings.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
             <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sentimentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {sentimentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
             </div>
             <div className="space-y-2 text-sm ml-4">
                {sentimentData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="capitalize text-slate-600">{item.name.toLowerCase()}:</span>
                    <span className="font-semibold">{item.value}</span>
                  </div>
                ))}
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 4. Weekly Trend */}
        <Card>
          <CardHeader>
             <CardTitle className="text-lg">Success Rate Trend (Weekly)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line type="monotone" dataKey="rate" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 5. Root Cause Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Issues & Fix Effectiveness</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
                {root_causes.map((rc, idx) => {
                   const successRate = rc.count > 0 ? Math.round((rc.successes / rc.count) * 100) : 0;
                   return (
                     <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                        <div className="flex flex-col">
                           <span className="font-medium text-sm text-slate-800 capitalize">{rc.root_cause_type.replace('_', ' ')}</span>
                           <span className="text-xs text-slate-500">{rc.count} occurrences</span>
                        </div>
                        <div className="flex flex-col items-end">
                           <Badge variant={successRate >= 80 ? 'default' : successRate >= 50 ? 'secondary' : 'destructive'} className={cn(
                             successRate >= 80 ? "bg-green-100 text-green-800 hover:bg-green-200" : ""
                           )}>
                             {successRate}% Success
                           </Badge>
                        </div>
                     </div>
                   );
                })}
             </div>
          </CardContent>
        </Card>
      
      </div>
    </div>
  );
}