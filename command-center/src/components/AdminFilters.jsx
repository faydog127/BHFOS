import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

const AdminFilters = ({ filters, setFilters, onExport }) => {
    const handleInputChange = (e) => {
        setFilters(prev => ({ ...prev, search: e.target.value }));
    };

    const handleSelectChange = (name, value) => {
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({
            search: '',
            service: 'all',
            status: 'all',
            dateRange: 'all',
        });
    };

    return (
        <div className="p-4 bg-white rounded-lg shadow-sm border mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-center">
                <div className="relative lg:col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search by name, email, or phone..."
                        value={filters.search}
                        onChange={handleInputChange}
                        className="pl-10"
                    />
                </div>
                <Select value={filters.service} onValueChange={(value) => handleSelectChange('service', value)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Filter by Service" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Services</SelectItem>
                        <SelectItem value="free-air-check">Free Air Check</SelectItem>
                        <SelectItem value="air-duct">Air Duct Cleaning</SelectItem>
                        <SelectItem value="dryer-vent">Dryer Vent Cleaning</SelectItem>
                        <SelectItem value="iaq-testing">IAQ Testing</SelectItem>
                        <SelectItem value="not-sure">Not Sure</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filters.status} onValueChange={(value) => handleSelectChange('status', value)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Filter by Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="New">New</SelectItem>
                        <SelectItem value="Contacted">Contacted</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Archived">Archived</SelectItem>
                    </SelectContent>
                </Select>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={clearFilters} className="w-full">
                        <X className="h-4 w-4 mr-2" /> Clear
                    </Button>
                    <Button onClick={onExport} className="w-full bg-[#1B263B] hover:bg-[#2a3f5f]">
                        Export CSV
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AdminFilters;