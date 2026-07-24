import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Plus, RefreshCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import ActionHubKanbanView from '@/components/crm/action-hub/ActionHubKanbanView';
import CrmPageHeader from '@/components/crm/CrmPageHeader';
import { useKanbanBoardData } from '@/hooks/useKanbanBoardData';
import { useTrainingMode } from '@/contexts/TrainingModeContext';
import { excludeSyntheticRows } from '@/lib/excludeSynthetic';
import { getTenantId, tenantPath } from '@/lib/tenantUtils';
import { CRM_PRODUCT_NAME } from '@/config/productBrand';

const Pipeline = () => {
  const { toast } = useToast();
  const { items, loading, error, refresh, moveItem } = useKanbanBoardData();
  const { isTrainingMode } = useTrainingMode();
  const [searchTerm, setSearchTerm] = useState('');
  const tenantId = getTenantId();

  // Live: hide synth. Training: keep board as returned (seeded boards vary).
  const hygieneItems = useMemo(
    () => (isTrainingMode ? items : excludeSyntheticRows(items, { trainingMode: false })),
    [items, isTrainingMode],
  );

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return hygieneItems;

    return hygieneItems.filter((item) => {
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
  }, [hygieneItems, searchTerm]);

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
      <Helmet><title>Opportunities | {CRM_PRODUCT_NAME}</title></Helmet>

      <div className="p-6 border-b bg-white">
        <CrmPageHeader
          className="mb-0"
          title="Opportunities"
          description="Advance qualified work without mixing it with raw lead intake."
          breadcrumbs={[
            { label: 'Hub', to: `/${tenantId}/crm` },
            { label: 'Opportunities' },
          ]}
          actions={(
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
          )}
        />
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
