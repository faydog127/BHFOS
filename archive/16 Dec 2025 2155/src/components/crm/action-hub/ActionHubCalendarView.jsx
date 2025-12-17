import React from 'react';
import { useToast } from '@/components/ui/use-toast';

// Simple calendar implementation, not a full library
const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ActionHubCalendarView = ({ tasks, onTaskUpdate }) => {
    const { toast } = useToast();

    // Group tasks by date
    const tasksByDate = tasks.reduce((acc, task) => {
        if (!task.due_at) return acc;
        const date = new Date(task.due_at).toISOString().split('T')[0];
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(task);
        return acc;
    }, {});

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const handleTaskClick = (task) => {
        toast({
            title: task.title,
            description: `Lead: ${task.lead?.company || 'N/A'}. Due: ${new Date(task.due_at).toLocaleDateString()}`,
        });
    };

    const renderCells = () => {
        const cells = [];
        for (let i = 0; i < firstDay; i++) {
            cells.push(<div key={`empty-${i}`} className="p-2 border-r border-b border-gray-200"></div>);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = new Date(year, month, day + 1).toISOString().split('T')[0];
            const dayTasks = tasksByDate[dateStr] || [];

            cells.push(
                <div key={day} className="p-2 border-r border-b border-gray-200 min-h-[120px]">
                    <div className="font-bold text-sm">{day}</div>
                    <div className="mt-1 space-y-1">
                        {dayTasks.map(task => (
                             <div 
                                key={task.id} 
                                className="text-xs bg-blue-100 text-blue-800 p-1 rounded cursor-pointer hover:bg-blue-200 truncate"
                                onClick={() => handleTaskClick(task)}
                            >
                                {task.title}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return cells;
    };


    return (
        <div className="bg-white rounded-lg shadow-md p-4">
            <div className="text-center text-xl font-bold mb-4">
                {new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </div>
            <div className="grid grid-cols-7 border-t border-l border-gray-200">
                {days.map(day => (
                    <div key={day} className="text-center font-semibold p-2 border-r border-b bg-gray-50">{day}</div>
                ))}
                {renderCells()}
            </div>
        </div>
    );
};

export default ActionHubCalendarView;