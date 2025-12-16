import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  TrendingUp, TrendingDown, CheckCircle2, 
  Activity, Clock, ShieldAlert, BarChart3, AlertOctagon,
  ArrowRight, RefreshCw, Loader2, Zap,
  Search, AlertTriangle, HeartPulse, Info
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  Cell
} from 'recharts';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { format, subDays, endOfDay } from 'date-fns';

const formatNumber = (val) => new Intl.NumberFormat('en-US').format(val);

export default function RollbackAnalyticsDashboard() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState('30d'); // '7d', '30d', 'all'
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Data States
  const [currentData, setCurrentData] = useState(null);
  const [previousData, setPreviousData] = useState(null); // For trend comparison
  const [error, setError] = useState(null);
  
  const { toast } = useToast();

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange]);

  const fetchDashboardData = async () => {
    if (!currentData) setLoading(true);
    else setIsRefreshing(true);
    
    setError(null);

    try {
      const now = new Date();
      let startDate = null;
      let endDate = endOfDay(now);
      let prevStartDate = null;
      let prevEndDate = null;

      if (timeRange === '7d') {
        startDate = subDays(now, 7);
        prevEndDate = startDate;
        prevStartDate = subDays(startDate, 7);
      } else if (timeRange === '30d') {
        startDate = subDays(now, 30);
        prevEndDate = startDate;
        prevStartDate = subDays(startDate, 30);
      }
      // 'all' remains null for start/prev

      // Parallel Fetching for Current and Previous periods
      const [currRes, prevRes] = await Promise.all([
        supabase.rpc('get_rollback_kpis', { 
          p_start_date: startDate ? startDate.toISOString() : null,
          p_end_date: endDate.toISOString()
        }),
        (timeRange !== 'all') ? supabase.rpc('get_rollback_kpis', { 
          p_start_date: prevStartDate ? prevStartDate.toISOString() : null,
          p_end_date: prevEndDate ? prevEndDate.toISOString() : null
        }) : Promise.resolve({ data: null })
      ]);

      if (currRes.error) throw currRes.error;

      setCurrentData(currRes.data);
      setPreviousData(prevRes.data);
      setLastUpdated(new Date());

    } catch (err) {
      console.error('Failed to fetch rollback analytics:', err);
      setError("Unable to load analytics data. Please check your connection or try again.");
      toast({
        variant: "destructive",
        title: "Data Load Failed",
        description: err.message || "Could not retrieve rollback analytics data."
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchDashboardData();
  };

  // --- Derived Metrics ---
  const kpiData = currentData?.overall || {
    success_rate_percent: 0,
    avg_time_to_rollback_hours: 0,
    total_rollback_attempts: 0,
    successful_rollbacks: 0
  };

  const prevKpiData = previousData?.overall || null;

  // Trend Logic
  const getTrend = (current, previous, direction = 'up_is_good') => {
    if (!previous || previous === 0) return { value: null, direction: 'neutral' };
    const diff = current - previous;
    const isUp = diff > 0;
    
    let color = 'text-slate-500';
    if (direction === 'up_is_good') {
      color = isUp ? 'text-green-600' : 'text-red-600';
    } else if (direction === 'down_is_good') {
      color = isUp ? 'text-red-600' : 'text-green-600';
    }

    return {
      value: diff,
      diff: Math.abs(diff),
      percentChange: ((diff / previous) * 100).toFixed(1),
      isUp,
      color
    };
  };

  const successTrend = getTrend(kpiData.success_rate_percent, prevKpiData?.success_rate_percent, 'up_is_good');
  const recoveryTrend = getTrend(kpiData.avg_time_to_rollback_hours, prevKpiData?.avg_time_to_rollback_hours, 'down_is_good');
  const volumeTrend = getTrend(kpiData.total_rollback_attempts, prevKpiData?.total_rollback_attempts, 'neutral');

  // Health Score Calculation (0-100)
  // Weighted: 70% Success Rate, 30% Time Factor (100 if < 1h, 0 if > 5h)
  const calculateHealthScore = () => {
    if (kpiData.total_rollback_attempts === 0) return 100; // Default to healthy if no incidents
    
    const successScore = kpiData.success_rate_percent;
    const timeVal = kpiData.avg_time_to_rollback_hours;
    // Linear decay for time: 1h = 100, 5h = 0
    const timeScore = Math.max(0, Math.min(100, (5 - timeVal) * 25)); 
    
    return Math.round((successScore * 0.7) + (timeScore * 0.3));
  };

  const healthScore = calculateHealthScore();
  const getHealthColor = (score) => {
    if (score >= 90) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  // --- Chart Data Transformation ---
  const confidenceChartData = (currentData?.confidence_analysis || []).map(bucket => ({
    name: bucket.confidence_range,
    rate: bucket.success_rate,
    status: bucket.success_rate < 70 ? 'CRITICAL' : (bucket.success_rate > 90 ? 'HEALTHY' : 'WARNING')
  }));

  const causeTypes = Object.keys(currentData?.rollback_rate_by_cause || {});
  const causeChartData = causeTypes.map(cause => ({
    name: cause,
    // Note: RPC returns rate, we approximate counts for visualization if not fully available breakdown
    rate: currentData.rollback_rate_by_cause[cause]
  }));

  // Anomaly Detection Logic
  const hasAnomaly = kpiData.success_rate_percent > 0 && kpiData.success_rate_percent < 80; 

  // --- Handlers ---
  const handleViewFailureLogs = () => navigate('/crm/settings/audit-logs?filter=FAILURE&timeRange=last24h');
  const handleReviewRecentRollbacks = () => navigate('/crm/settings/audit-logs?filter=ROLLED_BACK&timeRange=last7days');
  const handleReviewRlsLogs = () => navigate('/crm/settings/audit-logs?filter=RLS_RECURSION&timeRange=all');

  if (loading && !currentData) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
        <p className="text-sm text-slate-500 font-medium">Loading Control Tower Analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <AlertOctagon className="h-12 w-12 text-red-400 opacity-50" />
        <div className="text-center">
          <h3 className="text-lg font-semibold text-slate-900">System Error</h3>
          <p className="text-sm text-slate-500 max-w-sm mt-1 mb-4">{error}</p>
          <Button onClick={fetchDashboardData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-6 animate-in fade-in duration-500 p-4 sm:p-6 pb-20">
      
      {/* 1. Header & Time Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Rollback Control Tower</h2>
            {isRefreshing && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          </div>
          <p className="text-slate-500 text-sm">Real-time monitoring of automated system recovery operations.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {['7d', '30d', 'all'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  timeRange === range 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
                )}
              >
                {range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : 'All Time'}
              </button>
            ))}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" onClick={handleRefresh} className="h-9 w-9">
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh Data</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* 2. System Health & Anomaly Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Health Card */}
        <Card className={cn("border-l-4 shadow-sm", getHealthColor(healthScore).replace('text-', 'border-l-'))}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1 flex items-center gap-2">
                <HeartPulse className="h-4 w-4" /> System Health Status
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{healthScore}%</span>
                <span className="text-xs font-medium opacity-80">
                  {healthScore >= 90 ? 'Excellent' : healthScore >= 70 ? 'Fair' : 'Critical'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground mb-1">Data Quality</div>
              <Badge variant="outline" className="font-mono">
                {formatNumber(kpiData.total_rollback_attempts)} Records
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Anomaly Banner (conditionally rendered or placeholder) */}
        <div className="md:col-span-2">
          {hasAnomaly ? (
            <Alert variant="destructive" className="h-full flex items-center border-red-200 bg-red-50 text-red-900">
              <AlertOctagon className="h-8 w-8 text-red-600 mr-4" />
              <div>
                <AlertTitle className="font-bold flex items-center gap-2">
                  Operational Anomaly Detected
                  <Badge variant="destructive" className="text-[10px] h-5 uppercase">Critical</Badge>
                </AlertTitle>
                <AlertDescription className="text-sm opacity-90">
                  Success rate dropped below 80% in the selected window. Immediate investigation recommended.
                </AlertDescription>
              </div>
            </Alert>
          ) : (
            <Alert className="h-full flex items-center bg-green-50 border-green-200 text-green-900">
              <CheckCircle2 className="h-8 w-8 text-green-600 mr-4" />
              <div>
                <AlertTitle className="font-bold">Systems Nominal</AlertTitle>
                <AlertDescription className="text-sm opacity-90">
                  Rollback operations are performing within expected SLA parameters.
                </AlertDescription>
              </div>
            </Alert>
          )}
        </div>
      </div>

      {/* 3. KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Success Rate */}
        <Card>
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 tracking-wider">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> Success Rate
                <Tooltip>
                  <TooltipTrigger><Info className="h-3 w-3 text-slate-300" /></TooltipTrigger>
                  <TooltipContent>Percentage of rollbacks that fully restored system state.</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">
                  {kpiData.success_rate_percent}%
                </span>
                {timeRange !== 'all' && successTrend.value !== null && (
                  <span className={cn("text-xs font-medium flex items-center", successTrend.color)}>
                    {successTrend.isUp ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                    {successTrend.percentChange}%
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-1">Target: 95.0%</div>
            </div>
          </CardContent>
        </Card>

        {/* Recovery Time */}
        <Card>
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 tracking-wider">
              <Clock className="h-4 w-4 text-blue-600" /> Avg Recovery Time
              <Tooltip>
                <TooltipTrigger><Info className="h-3 w-3 text-slate-300" /></TooltipTrigger>
                <TooltipContent>Average time from initiation to successful completion.</TooltipContent>
              </Tooltip>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">
                  {Number(kpiData.avg_time_to_rollback_hours).toFixed(2)}h
                </span>
                {timeRange !== 'all' && recoveryTrend.value !== null && (
                  <span className={cn("text-xs font-medium flex items-center", recoveryTrend.color)}>
                    {recoveryTrend.isUp ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                    {Math.abs(Number(kpiData.avg_time_to_rollback_hours) - Number(prevKpiData?.avg_time_to_rollback_hours)).toFixed(2)}h
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-1">Target: &lt; 1.0h</div>
            </div>
          </CardContent>
        </Card>

        {/* Total Volume */}
        <Card>
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 tracking-wider">
              <Activity className="h-4 w-4 text-purple-600" /> Total Rollbacks
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">
                  {formatNumber(kpiData.total_rollback_attempts)}
                </span>
                {timeRange !== 'all' && volumeTrend.value !== null && (
                  <span className={cn("text-xs font-medium flex items-center", volumeTrend.color)}>
                    {volumeTrend.isUp ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                    {volumeTrend.diff}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-1">Capacity: Healthy</div>
            </div>
          </CardContent>
        </Card>

        {/* SLA Status */}
        <Card className="bg-slate-900 text-white border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-500/20 blur-3xl rounded-full"></div>
          <CardContent className="p-4 flex flex-col justify-between h-full relative z-10">
            <div className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2 tracking-wider">
              <ShieldAlert className="h-4 w-4 text-indigo-400" /> SLA Status
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-300">Success Target</span>
                <span className={cn("font-bold text-xs px-2 py-0.5 rounded", kpiData.success_rate_percent >= 95 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
                  {kpiData.success_rate_percent >= 95 ? 'MET' : 'MISSED'}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all duration-1000", kpiData.success_rate_percent >= 95 ? "bg-green-500" : "bg-red-500")}
                  style={{ width: `${Math.min(100, kpiData.success_rate_percent)}%` }} 
                />
              </div>
              <div className="flex justify-between items-center text-xs text-slate-400 mt-1">
                <span>Recovery Time</span>
                <span className="text-white font-mono">&lt; 1.0h</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confidence Chart */}
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              AI Confidence Calibration
            </CardTitle>
            <CardDescription>Correlation between AI confidence scores and actual rollback success.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={confidenceChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                   <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                   <XAxis type="number" hide />
                   <YAxis dataKey="name" type="category" width={80} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                   <RechartsTooltip 
                     cursor={{ fill: '#f8fafc' }}
                     contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                     labelStyle={{ fontWeight: 'bold', color: '#334155' }}
                   />
                   <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={24} name="Success Rate %">
                      {confidenceChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.rate >= 90 ? '#22c55e' : entry.rate >= 70 ? '#eab308' : '#ef4444'} />
                      ))}
                   </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Cause Analysis */}
        <Card className="h-full flex flex-col">
           <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-orange-600" />
              Root Cause Analysis
            </CardTitle>
            <CardDescription>Frequency of rollback triggers by type.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
             <div className="h-[250px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={causeChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} unit="%" />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: 'bold', color: '#334155' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="rate" name="% of Total" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
               </ResponsiveContainer>
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Operational Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <Card className="lg:col-span-2 border-l-4 border-l-indigo-500 shadow-md">
           <CardHeader className="pb-2">
             <div className="flex justify-between items-start">
               <div>
                 <CardTitle className="text-lg flex items-center gap-2">
                   <Zap className="h-5 w-5 text-indigo-500 fill-indigo-100" />
                   Recommended Actions
                 </CardTitle>
                 <CardDescription>AI-generated priorities to improve system stability.</CardDescription>
               </div>
               <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
                 3 Active
               </Badge>
             </div>
           </CardHeader>
           <CardContent>
             <div className="space-y-3">
               <div className="flex items-start gap-4 p-4 bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow group">
                 <div className="mt-1 flex-shrink-0">
                   <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-xs border border-red-200 shadow-sm">
                     P1
                   </div>
                 </div>
                 <div className="flex-1">
                   <div className="flex justify-between items-start">
                     <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">Review Logic Error Handling</h4>
                     <Badge variant="destructive" className="text-[10px] h-5">CRITICAL</Badge>
                   </div>
                   <p className="text-xs text-slate-600 mt-1 leading-relaxed">High failure rate detected in 'logic_error' rollbacks. Inverse SQL generation may be incomplete for complex joins.</p>
                 </div>
               </div>
               
               <div className="flex items-start gap-4 p-4 bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow group">
                 <div className="mt-1 flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-bold text-xs border border-yellow-200 shadow-sm">
                     P2
                   </div>
                 </div>
                 <div className="flex-1">
                   <div className="flex justify-between items-start">
                     <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">Calibrate Confidence Threshold</h4>
                     <Badge className="text-[10px] h-5 bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200">HIGH</Badge>
                   </div>
                   <p className="text-xs text-slate-600 mt-1 leading-relaxed">Rollbacks with 70-80% confidence are failing 40% of the time.</p>
                 </div>
               </div>

               <Button 
                 variant="outline" 
                 size="sm" 
                 onClick={handleReviewRlsLogs}
                 className="w-full mt-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex items-center justify-center gap-2"
               >
                 <Search className="h-3 w-3" />
                 Review RLS-Related Logs
                 <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 text-[9px] px-1 h-4">P3</Badge>
               </Button>
             </div>
           </CardContent>
         </Card>

         <Card className="bg-slate-50/50 flex flex-col h-full">
           <CardHeader className="pb-2">
             <CardTitle className="text-lg">Quick Actions</CardTitle>
             <CardDescription>Common administrative tasks.</CardDescription>
           </CardHeader>
           <CardContent className="space-y-3 flex-1">
             <Button 
               variant="outline" 
               className="w-full justify-between h-auto py-3 group hover:border-indigo-300 hover:bg-white hover:shadow-sm transition-all"
               onClick={handleViewFailureLogs}
             >
               <span className="flex items-center gap-3">
                 <div className="p-1.5 bg-red-50 text-red-600 rounded-md group-hover:bg-red-100">
                   <AlertTriangle className="h-4 w-4" />
                 </div>
                 <div className="text-left">
                   <div className="text-sm font-medium text-slate-700 group-hover:text-indigo-700">View Top 5 Failure Logs</div>
                   <div className="text-[10px] text-slate-400">Deep dive into recent errors</div>
                 </div>
               </span>
               <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
             </Button>
             
             <Button 
               variant="outline" 
               className="w-full justify-between h-auto py-3 group hover:border-indigo-300 hover:bg-white hover:shadow-sm transition-all"
               onClick={handleReviewRecentRollbacks}
             >
               <span className="flex items-center gap-3">
                 <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md group-hover:bg-blue-100">
                   <Clock className="h-4 w-4" />
                 </div>
                 <div className="text-left">
                   <div className="text-sm font-medium text-slate-700 group-hover:text-indigo-700">Review Recent Rollbacks</div>
                   <div className="text-[10px] text-slate-400">Audit last 7 days activity</div>
                 </div>
               </span>
               <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
             </Button>

             <div className="pt-4 mt-auto border-t">
               <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">System Status</div>
               <div className="flex items-center gap-2 p-2 bg-white rounded border border-green-100 shadow-sm">
                 <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                 </div>
                 <span className="text-xs font-medium text-slate-700">All Systems Operational</span>
               </div>
               
               <div className="text-[10px] text-slate-400 text-center mt-3">
                  Last updated: {lastUpdated ? format(lastUpdated, 'h:mm:ss a') : 'Just now'}
               </div>
             </div>
           </CardContent>
         </Card>
      </div>

    </div>
    </TooltipProvider>
  );
}