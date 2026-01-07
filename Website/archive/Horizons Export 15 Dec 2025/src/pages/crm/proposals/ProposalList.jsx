import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

const ProposalList = () => {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchProposals = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('quotes')
        .select(`*, leads (first_name, last_name, company)`)
        .order('created_at', { ascending: false });
      
      setProposals(data || []);
      setLoading(false);
    };
    fetchProposals();
  }, []);

  const filteredProposals = proposals.filter(p => 
      p.quote_number?.toString().includes(search) ||
      p.leads?.first_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.leads?.last_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Proposals</h1>
          <p className="text-slate-500">Manage estimates and quotes</p>
        </div>
        <Button onClick={() => navigate('/crm/proposals/new')} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> New Proposal
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Proposals</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search..." 
                className="pl-8" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : filteredProposals.map((prop) => (
                <TableRow key={prop.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/crm/proposals/${prop.id}`)}>
                  <TableCell className="font-medium">#{prop.quote_number}</TableCell>
                  <TableCell>
                      <div className="font-medium">{prop.leads?.first_name} {prop.leads?.last_name}</div>
                      <div className="text-xs text-slate-500">{prop.leads?.company}</div>
                  </TableCell>
                  <TableCell>{format(new Date(prop.created_at), 'MMM d, yyyy')}</TableCell>
                  <TableCell>${Number(prop.total_amount).toFixed(2)}</TableCell>
                  <TableCell><Badge variant="outline">{prop.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/crm/proposals/${prop.id}`) }}>
                      View
                    </Button>
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

export default ProposalList;