
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { 
  Plus, Search, Filter, MoreHorizontal, Clock, AlertCircle, DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import QuickBooksIndicator from '@/components/crm/invoices/QuickBooksIndicator';

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();
  const { toast } = useToast();
  const tenantId = getTenantId();

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          lead:leads!fk_invoices_lead (
            first_name,
            last_name,
            company,
            email
          ),
          job:jobs!fk_invoices_job (
            job_number,
            status
          ),
          account:accounts!fk_invoices_account (
            name,
            type
          )
        `)
        .eq('tenant_id', tenantId) // TENANT FILTER
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast({
        title: 'Error fetching invoices',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid': return <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge>;
      case 'partial': return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Partial</Badge>;
      case 'overdue': return <Badge className="bg-red-100 text-red-800 border-red-200">Overdue</Badge>;
      case 'sent': return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Sent</Badge>;
      default: return <Badge variant="outline" className="capitalize">{status || 'Draft'}</Badge>;
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const searchString = searchTerm.toLowerCase();
    const invoiceNum = invoice.invoice_number?.toString() || '';
    const customerName = invoice.lead 
      ? (invoice.lead.company || `${invoice.lead.first_name} ${invoice.lead.last_name}`)
      : '';
    const accountName = invoice.account?.name || '';
    
    return (
      invoiceNum.includes(searchString) ||
      customerName.toLowerCase().includes(searchString) ||
      accountName.toLowerCase().includes(searchString)
    );
  });

  const totalRevenue = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);
    
  const totalOutstanding = invoices
    .filter(i => i.status !== 'paid' && i.status !== 'void')
    .reduce((sum, i) => sum + (Number(i.balance_due) || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Invoices</h1>
          <p className="text-gray-500 mt-1">Manage billing, payments, and revenue.</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" onClick={() => fetchInvoices()}>
            <Clock className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => navigate('/bhf/crm/invoices/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Create Invoice
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Lifetime revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${totalOutstanding.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Unpaid invoices</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices, customers, or amounts..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Filter: {statusFilter === 'all' ? 'All Statuses' : statusFilter}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setStatusFilter('all')}>All Statuses</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setStatusFilter('draft')}>Draft</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('sent')}>Sent</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('paid')}>Paid</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('overdue')}>Overdue</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('void')}>Void</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>QB Sync</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10">
                      Loading invoices...
                    </TableCell>
                  </TableRow>
                ) : filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      No invoices found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoice_number ? `#${invoice.invoice_number}` : 'DRAFT'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {invoice.lead?.company || 
                             (invoice.lead ? `${invoice.lead.first_name} ${invoice.lead.last_name}` : 'Unknown')}
                          </span>
                          <span className="text-xs text-gray-500">{invoice.lead?.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>{invoice.issue_date || '-'}</TableCell>
                      <TableCell>${Number(invoice.total_amount).toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell>
                          <QuickBooksIndicator 
                              invoiceId={invoice.id} 
                              status={invoice.quickbooks_sync_status} 
                              qbId={invoice.quickbooks_id}
                              onSyncComplete={fetchInvoices}
                          />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/bhf/crm/invoices/${invoice.id}`)}>
                              Edit Invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.open(`/invoices/${invoice.id}`, '_blank')}>
                              View Public Page
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Invoices;
