import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Plus, RefreshCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import ActionHubKanbanView from '@/components/crm/action-hub/ActionHubKanbanView';
import { useKanbanBoardData } from '@/hooks/useKanbanBoardData';
import { getTenantId, tenantPath } from '@/lib/tenantUtils';

const Pipeline = () => {
  const { toast } = useToast();
  const { items, loading, error, refresh, moveItem } = useKanbanBoardData();
  const [searchTerm, setSearchTerm] = useState('');
  const tenantId = getTenantId();

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return items;

    return items.filter((item) => {
      const haystack = [
        item.title,
        item.subtitle,
        item.status,
        item.entity_type,
        item.related?.lead_id,
        item.related?.quote_id,
        item.related?.job_id,
        item.related?.invoice_id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [items, searchTerm]);

  const handleMove = async ({ item, toColumnKey }) => {
    const result = await moveItem({ item, toColumnKey });
    if (!result.ok) {
      toast({
        variant: 'destructive',
        title: 'Move failed',
        description: result.error,
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <Helmet><title>Opportunities | CRM</title></Helmet>

      <div className="p-6 border-b bg-white">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Opportunities</h1>
            <p className="text-muted-foreground">Advance qualified work without mixing it with raw lead intake.</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search cards..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={refresh}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button asChild>
              <Link to={tenantPath('/crm/leads', tenantId)}>
                <Plus className="mr-2 h-4 w-4" /> Open Leads
              </Link>
            </Button>
          </div>
        </div>
        {error && (
          <div className="mt-3 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 bg-slate-50/50">
        <ActionHubKanbanView items={filteredItems} isLoading={loading} onMove={handleMove} />
      </div>
    </div>
  );
};

export default Pipeline;
