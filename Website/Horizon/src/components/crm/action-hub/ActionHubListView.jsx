import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TASK_STATUSES = ['new', 'in-progress', 'completed', 'snoozed'];

const ActionHubListView = ({ tasks, onTaskUpdate }) => {
    return (
        <div className="bg-white rounded-lg shadow-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Lead</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status (Next Step)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tasks.map(task => (
                        <TableRow key={task.id}>
                            <TableCell className="font-medium">{task.title}</TableCell>
                            <TableCell>{task.lead?.company || `${task.lead?.first_name || ''} ${task.lead?.last_name || ''}`.trim() || 'N/A'}</TableCell>
                            <TableCell>{task.due_at ? new Date(task.due_at).toLocaleDateString() : 'N/A'}</TableCell>
                            <TableCell>
                                <Select 
                                    value={task.status} 
                                    onValueChange={(newStatus) => onTaskUpdate(task.id, { status: newStatus })}
                                >
                                    <SelectTrigger className="w-[150px]">
                                        <SelectValue placeholder="Set status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TASK_STATUSES.map(status => (
                                            <SelectItem key={status} value={status}>
                                                {status.charAt(0).toUpperCase() + status.slice(1)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
             {tasks.length === 0 && (
                <div className="text-center p-10 text-gray-500">No tasks found.</div>
            )}
        </div>
    );
};

export default ActionHubListView;