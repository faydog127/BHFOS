
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronsUpDown, Building } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/lib/customSupabaseClient';
import { getUrlTenant } from '@/lib/tenantUtils';

const TenantSwitcher = () => {
  const navigate = useNavigate();
  const currentTenantId = getUrlTenant();
  const [open, setOpen] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const { data, error } = await supabase
          .from('tenants')
          .select('id, name')
          .eq('status', 'active');
        
        if (data) {
          setTenants(data);
        } else {
          // Fallback if tenants table is empty or inaccessible (mock for safety)
          setTenants([
             { id: 'tvg', name: 'The Vent Guys' },
             { id: 'demo', name: 'Demo Environment' },
             { id: 'installworxs', name: 'InstallWorxs' }
          ]);
        }
      } catch (e) {
        console.error("Failed to fetch tenants", e);
      } finally {
        setLoading(false);
      }
    };
    fetchTenants();
  }, []);

  const handleSelect = (tenantId) => {
    setOpen(false);
    if (tenantId === currentTenantId) return;
    
    // Switch tenant but try to keep the same sub-path (e.g. /crm/dashboard)
    const currentPath = window.location.pathname;
    const pathParts = currentPath.split('/').filter(Boolean);
    
    if (pathParts.length > 0) {
      // Replace the first part (tenantId) with new one
      pathParts[0] = tenantId;
      const newPath = '/' + pathParts.join('/');
      navigate(newPath);
    } else {
      navigate(`/${tenantId}/crm/dashboard`);
    }
  };

  const currentTenant = tenants.find((t) => t.id === currentTenantId) || { name: currentTenantId };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white mb-4"
        >
          <div className="flex items-center gap-2 truncate">
             <Building className="h-4 w-4 shrink-0 opacity-50" />
             <span className="truncate">{currentTenant.name || 'Select Tenant'}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0 bg-slate-900 border-slate-700">
        <Command className="bg-slate-900 text-slate-200">
          <CommandInput placeholder="Search tenant..." className="h-9" />
          <CommandList>
            <CommandEmpty>No tenant found.</CommandEmpty>
            <CommandGroup>
              {tenants.map((tenant) => (
                <CommandItem
                  key={tenant.id}
                  value={tenant.id}
                  onSelect={() => handleSelect(tenant.id)}
                  className="text-slate-200 aria-selected:bg-slate-800"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      currentTenantId === tenant.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {tenant.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default TenantSwitcher;
