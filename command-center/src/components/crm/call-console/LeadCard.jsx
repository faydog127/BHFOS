import React from 'react';
import { Flame, Coffee, Snowflake, Phone as PhoneIcon, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const LeadCard = ({ lead, onSelect, isSelected }) => {
    const { toast } = useToast();

    const getStatusStyle = (score) => {
        if (score >= 80) return { icon: Flame, color: 'text-red-500', label: 'Hot' };
        if (score >= 60) return { icon: Coffee, color: 'text-yellow-500', label: 'Warm' };
        return { icon: Snowflake, color: 'text-blue-500', label: 'Nurture' };
    };

    const score = lead.kaqi_score || 0;
    const { icon: StatusIcon, color } = getStatusStyle(score);

    const leadSignals = [
        { name: 'Hiring', show: lead.notes?.toLowerCase().includes('hiring') || lead.lead_type === 'B2B Partner' },
        { name: 'Permits', show: lead.notes?.toLowerCase().includes('permit') },
        { name: 'Reviews', show: lead.notes?.toLowerCase().includes('review') },
        { name: 'Odor', show: lead.notes?.toLowerCase().includes('odor') },
    ].filter(s => s.show).slice(0, 2);

    const handleDial = (e) => {
        e.stopPropagation();
        toast({ title: `Dialing ${lead.name}`, description: `This would initiate a call to ${lead.phone}` });
    };

    return (
        <div
            className={`p-3 rounded-lg cursor-pointer transition-all border-l-4 group ${isSelected ? `bg-[#b52025] text-white shadow-lg border-white` : 'bg-white hover:bg-gray-50 border-transparent'}`}
            onClick={() => onSelect(lead)}
        >
            <div className="flex justify-between items-start">
                <div className="flex-1">
                    <p className="font-bold text-md truncate">{lead.name}</p>
                    <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-800'}`}>{lead.status || 'New'}</span>
                        <div className={`flex items-center text-xs font-bold ${isSelected ? 'text-white' : color}`}>
                            <StatusIcon className="h-4 w-4 mr-1" />{score}
                        </div>
                    </div>
                </div>
                <div className="hidden group-hover:flex items-center justify-end space-x-1">
                    <Button size="icon" variant="ghost" className={`h-7 w-7 ${isSelected ? 'text-white hover:bg-white/20' : ''}`} onClick={handleDial}><PhoneIcon className="h-4 w-4" /></Button>
                </div>
            </div>
            <p className={`text-xs truncate mt-1 ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>{lead.lead_type || 'Unknown Type'} · {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : 'Recent'}</p>
            <div className="flex items-center justify-between mt-2">
                <div className="flex items-center space-x-2">
                    {leadSignals.map(signal => (
                        <span key={signal.name} className={`px-2 py-0.5 text-xs rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>{signal.name}</span>
                    ))}
                </div>
                 <div className={`flex items-center text-xs ${isSelected ? 'text-gray-200' : 'text-gray-400'}`}>
                    <Clock className="h-3 w-3 mr-1" /> Best: 9-11a
                </div>
            </div>
        </div>
    );
};

export default LeadCard;