
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, Search, Filter, Download, ArrowLeft } from 'lucide-react';
import { diagnosticsLogger } from '@/services/diagnosticsLogger';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const FixesDocumentation = () => {
  const navigate = useNavigate();
  const [fixes, setFixes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadFixes = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('fixes_log')
        .select('*')
        .order('applied_at', { ascending: false });
      setFixes(data || []);
      setLoading(false);
    };
    loadFixes();
  }, []);

  const filteredFixes = fixes.filter(f => 
    f.fix_description.toLowerCase().includes(search.toLowerCase()) || 
    f.fix_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-[1800px] mx-auto min-h-screen bg-slate-50">
      <Helmet><title>Fixes Documentation | BHF</title></Helmet>

      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate('/bhf/documentation')}>
           <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">Applied Fixes Log</h1>
        <div className="flex-1" />
        <div className="relative w-64">
           <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
           <Input 
             placeholder="Search fixes..." 
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
                 <TableHead className="w-[180px]">Date</TableHead>
                 <TableHead className="w-[150px]">Type</TableHead>
                 <TableHead>Description</TableHead>
                 <TableHead>Files Changed</TableHead>
                 <TableHead className="w-[100px]">Applied By</TableHead>
                 <TableHead className="w-[100px]">Status</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {loading ? (
                 <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
               ) : filteredFixes.length === 0 ? (
                 <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">No fixes found matching your criteria.</TableCell></TableRow>
               ) : (
                 filteredFixes.map(fix => (
                   <TableRow key={fix.id}>
                     <TableCell className="font-mono text-xs text-slate-500">
                       {format(new Date(fix.applied_at), 'yyyy-MM-dd HH:mm')}
                     </TableCell>
                     <TableCell>
                       <Badge variant="outline">{fix.fix_type}</Badge>
                     </TableCell>
                     <TableCell className="font-medium">{fix.fix_description}</TableCell>
                     <TableCell>
                       <div className="flex flex-wrap gap-1">
                         {fix.files_changed?.slice(0, 2).map((f, i) => (
                           <Badge key={i} variant="secondary" className="font-mono text-[10px]">{f.split('/').pop()}</Badge>
                         ))}
                         {fix.files_changed?.length > 2 && <span className="text-xs text-slate-400">+{fix.files_changed.length - 2} more</span>}
                       </div>
                     </TableCell>
                     <TableCell>{fix.applied_by}</TableCell>
                     <TableCell>
                       <span className="flex items-center text-emerald-600 text-xs font-bold">
                         <CheckCircle className="w-3 h-3 mr-1" /> Verified
                       </span>
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

export default FixesDocumentation;
