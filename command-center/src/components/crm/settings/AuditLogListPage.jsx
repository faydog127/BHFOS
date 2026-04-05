import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Loader2, Filter, Search, RotateCcw, Calendar, 
  CheckCircle, XCircle, AlertTriangle, AlertOctagon, 
  ChevronRight, Terminal, User, FileDown, ArrowRightLeft,
  BrainCircuit, ShieldAlert, Flag, Info
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import { format, subHours, subDays } from 'date-fns';
import AuditLogDetailsModal from '@/components/crm/settings/AuditLogDetailsModal';
import FixDiffModal from '@/components/crm/settings/FixDiffModal';

export default function AuditLogListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  // New Modal States
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [diffLog, setDiffLog] = useState(null);

  // Filter States
  const [statusFilter, setStatusFilter] = useState('all');
  const [causeFilter, setCauseFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('all');
  const [featureSearch, setFeatureSearch] = useState('');

  // Sync with URL params on mount
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    const rangeParam = searchParams.get('timeRange');
    const causeParam = searchParams.get('cause');
    const statusParam = searchParams.get('status');

    if (rangeParam) setTimeRange(rangeParam);
    
    // Handle overloaded "filter" param or specific params
    if (filterParam) {
      if (['FAILURE', 'SUCCESS', 'ROLLED_BACK', 'PARTIAL_SUCCESS'].includes(filterParam)) {
        setStatusFilter(filterParam);
      } else if (filterParam === 'RLS_RECURSION') {
        setCauseFilter(filterParam);
      } else {
        setStatusFilter(filterParam); // Fallback
      }
    }

    if (statusParam) setStatusFilter(statusParam);
    if (causeParam) setCauseFilter(causeParam);

  }, [searchParams]);

  // Fetch data when filters change
  useEffect(() => {
    fetchLogs();
  }, [statusFilter, causeFilter, timeRange]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let startDate = null;
      const now = new Date();

      if (timeRange === 'last24h' || timeRange === '24h') startDate = subHours(now, 24);
      else if (timeRange === 'last7days' || timeRange === '7d') startDate = subDays(now, 7);
      else if (timeRange === 'last30days' || timeRange === '30d') startDate = subDays(now, 30);

      const rpcStatus = statusFilter === 'all' ? null : statusFilter;
      const rpcCause = causeFilter === 'all' ? null : causeFilter;
      const rpcStart = startDate ? startDate.toISOString() : null;

      const { data, error } = await supabase.rpc('get_system_audit_log', {
        p_status: rpcStatus,
        p_root_cause_type: rpcCause,
        p_start_date: rpcStart,
        p_limit: 100 
      });

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (log) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };
  
  const handleDiffClick = (e, log) => {
    e.stopPropagation();
    setDiffLog(log);
    setDiffModalOpen(true);
  };

  const handleExportMigration = (e, log) => {
    e.stopPropagation();
    try {
      const steps = log.doctor_response_jsonb?.recommendation?.fix_plan?.steps || 
                    log.doctor_response_jsonb?.fix_plan?.steps || [];
                    
      if (!steps.length) return;

      const sqlContent = [
        `-- Migration Export for Fix ${log.id}`,
        `-- Generated at: ${new Date().toISOString()}`,
        `-- Feature: ${log.feature_id}`,
        `-- Root Cause: ${log.root_cause_type}`,
        `-- Environment: ${log.environment}`,
        '',
        'BEGIN;',
        '',
        steps.map((step, i) => (
          `-- Step ${i + 1}: ${step.description}\n${step.sql};`
        )).join('\n\n'),
        '',
        'COMMIT;'
      ].join('\n');

      const blob = new Blob([sqlContent], { type: 'application/sql' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fix_migration_${log.feature_id}_${log.id.slice(0,8)}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS': return <Badge className="bg-green-100 text-green-800 border-green-200">Success</Badge>;
      case 'FAILURE': return <Badge variant="destructive">Failure</Badge>;
      case 'ROLLED_BACK': return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">Rolled Back</Badge>;
      case 'PARTIAL_SUCCESS': return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Partial</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRiskBadge = (log) => {
    // Determine risk based on destructive flags or step analysis
    if (log.destructive_steps > 0) return <Badge variant="destructive" className="text-[10px] h-5">CRITICAL</Badge>;
    if (log.is_destructive_action) return <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-[10px] h-5">HIGH</Badge>;
    return <Badge variant="outline" className="text-slate-500 text-[10px] h-5 border-slate-200 bg-slate-50">LOW</Badge>;
  };
  
  const getConfidenceIndicator = (log) => {
    const score = log.doctor_response_jsonb?.recommendation?.confidence_score;
    if (typeof score !== 'number') return null;
    
    const isMisfire = score >= 0.9 && ['NEGATIVE', 'WORSE'].includes(log.feedback_sentiment);
    const colorClass = score >= 0.9 ? 'text-green-600' : score >= 0.7 ? 'text-yellow-600' : 'text-red-600';
    
    return (
      <div className="flex items-center gap-1.5" title="AI Confidence Score">
        <span className={cn("font-bold text-xs font-mono", colorClass)}>
          {(score * 100).toFixed(0)}%
        </span>
        {isMisfire && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Flag className="h-3 w-3 text-red-500 fill-red-100" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-semibold text-red-600">Confidence Misfire</p>
                <p className="text-xs">High confidence ({'>'}90%) but negative user outcome.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  };

  const renderReasoningPopover = (log) => {
    const reasoning = log.doctor_response_jsonb?.root_cause_analysis || 
                      log.doctor_response_jsonb?.recommendation?.reasoning || 
                      "No detailed reasoning provided.";
    
    // Attempt to extract top factors if structured, otherwise just show text
    // This is a heuristic based on typical LLM output formats
    const previewText = reasoning.length > 300 ? reasoning.substring(0, 300) + '...' : reasoning;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-indigo-600" onClick={(e) => e.stopPropagation()}>
            <BrainCircuit className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 shadow-lg border-indigo-100" side="left">
          <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-100 flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-indigo-600" />
            <h4 className="font-semibold text-indigo-900 text-xs">AI Reasoning Snapshot</h4>
          </div>
          <div className="p-4 text-xs text-slate-600 leading-relaxed max-h-[300px] overflow-y-auto">
            {previewText}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Applied Fixes Management</h1>
          <p className="text-muted-foreground">Detailed history of system repairs, migrations, and automated actions.</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" onClick={fetchLogs}>
             <RotateCcw className="h-4 w-4 mr-2" /> Refresh
           </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Filter className="h-5 w-5 text-muted-foreground" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="SUCCESS">Success</SelectItem>
                  <SelectItem value="FAILURE">Failure</SelectItem>
                  <SelectItem value="ROLLED_BACK">Rolled Back</SelectItem>
                  <SelectItem value="PARTIAL_SUCCESS">Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
               <label className="text-xs font-semibold text-muted-foreground uppercase">Root Cause</label>
               <Select value={causeFilter} onValueChange={setCauseFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Causes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Causes</SelectItem>
                  <SelectItem value="logic_error">Logic Error</SelectItem>
                  <SelectItem value="RLS_RECURSION">RLS Recursion</SelectItem>
                  <SelectItem value="syntax_error">Syntax Error</SelectItem>
                  <SelectItem value="timeout">Timeout</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
               <label className="text-xs font-semibold text-muted-foreground uppercase">Time Range</label>
               <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger>
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="last24h">Last 24 Hours</SelectItem>
                  <SelectItem value="last7days">Last 7 Days</SelectItem>
                  <SelectItem value="last30days">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
               <label className="text-xs font-semibold text-muted-foreground uppercase">Search</label>
               <div className="relative">
                 <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                 <Input 
                   placeholder="Filter by feature ID..." 
                   className="pl-8" 
                   value={featureSearch}
                   onChange={(e) => setFeatureSearch(e.target.value)}
                 />
               </div>
            </div>

          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Timestamp</TableHead>
                <TableHead className="w-[220px]">Feature & Risk</TableHead>
                <TableHead className="w-[200px]">Diagnosis</TableHead>
                <TableHead className="w-[100px] text-center">Analysis</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span>Loading logs...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No logs found matching your filters.
                  </TableCell>
                </TableRow>
              ) : (
                logs
                  .filter(l => !featureSearch || l.feature_id.toLowerCase().includes(featureSearch.toLowerCase()))
                  .map((log) => (
                  <TableRow key={log.id} className="cursor-pointer hover:bg-slate-50 group" onClick={() => handleRowClick(log)}>
                    
                    {/* Timestamp */}
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {format(new Date(log.timestamp_utc), 'MMM d, HH:mm')}
                    </TableCell>
                    
                    {/* Feature & Risk */}
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <span className="font-medium text-slate-900 text-sm">{log.feature_id}</span>
                        <div className="flex items-center gap-2">
                           {getRiskBadge(log)}
                           <span className="text-[10px] text-muted-foreground uppercase">{log.environment}</span>
                        </div>
                      </div>
                    </TableCell>
                    
                    {/* Diagnosis / Root Cause */}
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="secondary" className="font-mono text-[10px] w-fit">
                          {log.root_cause_type}
                        </Badge>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                           <span className="opacity-75">Conf:</span>
                           {getConfidenceIndicator(log)}
                        </div>
                      </div>
                    </TableCell>

                    {/* AI Analysis Tools */}
                    <TableCell className="text-center">
                      <div className="flex justify-center items-center gap-1">
                         {renderReasoningPopover(log)}
                         <TooltipProvider>
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-indigo-600" onClick={(e) => handleDiffClick(e, log)}>
                                 <ArrowRightLeft className="h-4 w-4" />
                               </Button>
                             </TooltipTrigger>
                             <TooltipContent>View SQL Diff</TooltipContent>
                           </Tooltip>
                         </TooltipProvider>
                      </div>
                    </TableCell>
                    
                    {/* Status */}
                    <TableCell>
                      {getStatusBadge(log.execution_status)}
                    </TableCell>
                    
                    {/* Actions */}
                    <TableCell className="text-right">
                       <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <TooltipProvider>
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500" onClick={(e) => handleExportMigration(e, log)}>
                                 <FileDown className="h-4 w-4" />
                               </Button>
                             </TooltipTrigger>
                             <TooltipContent>Export Migration (.sql)</TooltipContent>
                           </Tooltip>
                         </TooltipProvider>
                         
                         <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); handleRowClick(log); }}>
                           Details
                         </Button>
                       </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AuditLogDetailsModal 
        open={detailsOpen} 
        onOpenChange={setDetailsOpen} 
        log={selectedLog} 
      />
      
      <FixDiffModal
        open={diffModalOpen}
        onOpenChange={setDiffModalOpen}
        log={diffLog}
      />
    </div>
  );
}