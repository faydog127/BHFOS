
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { getTenantId } from '@/lib/tenantUtils';
import EnterpriseLayout from '@/components/crm/EnterpriseLayout';
import { EnterpriseCard } from '@/components/crm/EnterpriseCard';
import { EnterpriseTable, EnterpriseRow, EnterpriseCell } from '@/components/crm/EnterpriseTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Plus, Filter, Mail, Phone, MoreHorizontal, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';

const ContactsPage = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const tenantId = getTenantId();

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          created_at,
          organization:organizations(name),
          account:accounts(type)
        `)
        .eq('tenant_id', tenantId) // TENANT FILTER
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast({
        variant: "destructive",
        title: "Error fetching contacts",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(contact => {
    const searchString = searchTerm.toLowerCase();
    const name = `${contact.first_name || ''} ${contact.last_name || ''}`.toLowerCase();
    const email = (contact.email || '').toLowerCase();
    return name.includes(searchString) || email.includes(searchString);
  });

  return (
    <EnterpriseLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Contacts</h1>
            <p className="text-slate-500 mt-1">Manage customer database and relationship history.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="bg-white">
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 shadow-sm">
              <Plus className="w-4 h-4 mr-2" /> Add Contact
            </Button>
          </div>
        </div>

        <EnterpriseCard>
          <div className="p-4 border-b border-slate-100 flex items-center gap-4 bg-white rounded-t-lg">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search contacts..." 
                className="pl-9 h-10 bg-slate-50 border-slate-200" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="shrink-0" onClick={fetchContacts}>
              <Filter className="h-4 w-4 text-slate-500" />
            </Button>
          </div>
          
          <div className="p-0">
            <EnterpriseTable 
              className="border-0 rounded-none border-b"
              headers={['', 'Name', 'Company', 'Type', 'Actions', 'Joined', '']}
            >
              {loading ? (
                 <EnterpriseRow>
                    <EnterpriseCell colSpan={7} className="text-center py-8 text-slate-500">
                       <Loader2 className="animate-spin h-5 w-5 mx-auto" />
                    </EnterpriseCell>
                 </EnterpriseRow>
              ) : filteredContacts.length === 0 ? (
                 <EnterpriseRow>
                    <EnterpriseCell colSpan={7} className="text-center py-8 text-slate-500">
                       No contacts found.
                    </EnterpriseCell>
                 </EnterpriseRow>
              ) : (
                filteredContacts.map((contact) => (
                  <EnterpriseRow key={contact.id}>
                    <EnterpriseCell className="w-[50px] pl-4">
                      <input type="checkbox" className="rounded border-slate-300" />
                    </EnterpriseCell>
                    <EnterpriseCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-slate-100">
                          <AvatarFallback className="bg-indigo-50 text-indigo-700 text-xs font-bold">
                            {contact.first_name?.[0]}{contact.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-slate-900">{contact.first_name} {contact.last_name}</div>
                          <div className="text-xs text-slate-500">{contact.email}</div>
                        </div>
                      </div>
                    </EnterpriseCell>
                    <EnterpriseCell>{contact.organization?.name || '-'}</EnterpriseCell>
                    <EnterpriseCell>
                      <Badge variant="outline" className={cn(
                        "font-medium",
                        contact.account?.type === 'Customer' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        "bg-slate-100 text-slate-600 border-slate-200"
                      )}>
                        {contact.account?.type || 'Contact'}
                      </Badge>
                    </EnterpriseCell>
                    <EnterpriseCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => window.location.href = `mailto:${contact.email}`}>
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-green-600 hover:bg-green-50" onClick={() => window.location.href = `tel:${contact.phone}`}>
                          <Phone className="h-4 w-4" />
                        </Button>
                      </div>
                    </EnterpriseCell>
                    <EnterpriseCell className="text-slate-500 text-sm">
                        {contact.created_at ? formatDistanceToNow(new Date(contact.created_at), { addSuffix: true }) : '-'}
                    </EnterpriseCell>
                    <EnterpriseCell className="text-right pr-4">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </EnterpriseCell>
                  </EnterpriseRow>
                ))
              )}
            </EnterpriseTable>
          </div>
          
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-sm text-slate-500 rounded-b-lg">
            <div>Showing {filteredContacts.length} contacts</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled className="bg-white">Previous</Button>
              <Button variant="outline" size="sm" disabled className="bg-white">Next</Button>
            </div>
          </div>
        </EnterpriseCard>
      </div>
    </EnterpriseLayout>
  );
};

export default ContactsPage;
