
import React from 'react';
import EnterpriseLayout from '@/components/crm/EnterpriseLayout';
import { EnterpriseCard, EnterpriseCardHeader, EnterpriseCardContent } from '@/components/crm/EnterpriseCard';
import { EnterpriseTable, EnterpriseRow, EnterpriseCell } from '@/components/crm/EnterpriseTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Plus, Filter, Mail, Phone, MoreHorizontal, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

const mockContacts = [
  { id: 1, name: "Alice Johnson", email: "alice@example.com", phone: "(555) 123-4567", company: "Acme Corp", status: "Active", lastContact: "2 days ago" },
  { id: 2, name: "Bob Smith", email: "bob@example.com", phone: "(555) 987-6543", company: "Globex", status: "New", lastContact: "Never" },
  { id: 3, name: "Carol White", email: "carol@example.com", phone: "(555) 456-7890", company: "TechStart", status: "Inactive", lastContact: "1 month ago" },
  { id: 4, name: "Dave Brown", email: "dave@example.com", phone: "(555) 222-3333", company: "Consulting LLC", status: "Active", lastContact: "5 hours ago" },
  { id: 5, name: "Eve Davis", email: "eve@example.com", phone: "(555) 444-5555", company: "Design Co", status: "Active", lastContact: "1 week ago" },
];

const ContactsPage = () => {
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
              <Input placeholder="Search contacts..." className="pl-9 h-10 bg-slate-50 border-slate-200" />
            </div>
            <Button variant="outline" size="icon" className="shrink-0">
              <Filter className="h-4 w-4 text-slate-500" />
            </Button>
          </div>
          
          <div className="p-0">
            <EnterpriseTable 
              className="border-0 rounded-none border-b"
              headers={['', 'Name', 'Company', 'Status', 'Actions', 'Last Activity', '']}
            >
              {mockContacts.map((contact) => (
                <EnterpriseRow key={contact.id}>
                  <EnterpriseCell className="w-[50px] pl-4">
                    <input type="checkbox" className="rounded border-slate-300" />
                  </EnterpriseCell>
                  <EnterpriseCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-slate-100">
                        <AvatarFallback className="bg-indigo-50 text-indigo-700 text-xs font-bold">
                          {contact.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold text-slate-900">{contact.name}</div>
                        <div className="text-xs text-slate-500">{contact.email}</div>
                      </div>
                    </div>
                  </EnterpriseCell>
                  <EnterpriseCell>{contact.company}</EnterpriseCell>
                  <EnterpriseCell>
                    <Badge variant="outline" className={cn(
                      "font-medium",
                      contact.status === 'Active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      contact.status === 'New' ? "bg-blue-50 text-blue-700 border-blue-200" :
                      "bg-slate-100 text-slate-600 border-slate-200"
                    )}>
                      {contact.status}
                    </Badge>
                  </EnterpriseCell>
                  <EnterpriseCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50">
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-green-600 hover:bg-green-50">
                        <Phone className="h-4 w-4" />
                      </Button>
                    </div>
                  </EnterpriseCell>
                  <EnterpriseCell className="text-slate-500 text-sm">{contact.lastContact}</EnterpriseCell>
                  <EnterpriseCell className="text-right pr-4">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </EnterpriseCell>
                </EnterpriseRow>
              ))}
            </EnterpriseTable>
          </div>
          
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-sm text-slate-500 rounded-b-lg">
            <div>Showing 1-5 of 5 contacts</div>
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
