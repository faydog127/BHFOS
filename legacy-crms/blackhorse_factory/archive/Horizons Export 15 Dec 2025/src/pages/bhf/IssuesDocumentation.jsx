
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Search, Download, ArrowLeft, FileCode } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const IssuesDocumentation = () => {
  const navigate = useNavigate();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadIssues = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('diagnostics_log')
        .select('*')
        .order('created_at', { ascending: false });
      setIssues(data || []);
      setLoading(false);
    };
    loadIssues();
  }, []);

  const filteredIssues = issues.filter(i => 
    i.issue_description.toLowerCase().includes(search.toLowerCase()) || 
    i.file_path.toLowerCase().includes(search.toLowerCase())
  );

  const getSeverityBadge = (sev) => {
    const s = sev?.toLowerCase();
    let color = "bg-slate-100 text-slate-700";
    if (s === 'critical') color = "bg-red-100 text-red-700 border-red-200";
    if (s === 'high') color = "bg-orange-100 text-orange-700 border-orange-200";
    if (s === 'medium') color = "bg-amber-100 text-amber-700 border-amber-200";
    
    return <Badge className={cn("border", color)}>{sev}</Badge>;
  };

  return (
    <div className="p-6 max-w-[1800px] mx-auto min-h-screen bg-slate-50">
      <Helmet><title>Issues Documentation | BHF</title></Helmet>

      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate('/bhf/documentation')}>
           <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">Detected Issues Log</h1>
        <div className="flex-1" />
        <div className="relative w-64">
           <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
           <Input 
             placeholder="Search issues..." 
             className="pl-8" 
             value={search} 
             onChange={(e) => setSearch(e.target.value)} 
           />
        </div>
        <Button variant="outline"><Download className="w-4 h-4 mr-2" /> Export</Button>
      </div>

      <Card>
        <CardContent className="p-0">
           <Table>
             <TableHeader>
               <TableRow>
                 <TableHead className="w-[180px]">Detected</TableHead>
                 <TableHead className="w-[100px]">Severity</TableHead>
                 <TableHead className="w-[120px]">Type</TableHead>
                 <TableHead>Description</TableHead>
                 <TableHead>Location</TableHead>
                 <TableHead className="w-[100px]">Status</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {loading ? (
                 <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
               ) : filteredIssues.length === 0 ? (
                 <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">No issues found matching your criteria.</TableCell></TableRow>
               ) : (
                 filteredIssues.map(issue => (
                   <TableRow key={issue.id}>
                     <TableCell className="font-mono text-xs text-slate-500">
                       {format(new Date(issue.created_at), 'yyyy-MM-dd HH:mm')}
                     </TableCell>
                     <TableCell>
                       {getSeverityBadge(issue.severity)}
                     </TableCell>
                     <TableCell className="capitalize text-sm text-slate-600">{issue.issue_type}</TableCell>
                     <TableCell className="font-medium">{issue.issue_description}</TableCell>
                     <TableCell>
                        <div className="flex items-center gap-1 text-xs font-mono text-slate-500" title={issue.file_path}>
                          <FileCode className="w-3 h-3" />
                          {issue.file_path.length > 40 ? '...' + issue.file_path.slice(-40) : issue.file_path}:{issue.line_number}
                        </div>
                     </TableCell>
                     <TableCell>
                       <Badge variant="outline" className="capitalize">{issue.status}</Badge>
                     </TableCell>
                   </TableRow>
                 ))
               )}
             </TableBody>
           </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default IssuesDocumentation;
