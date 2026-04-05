import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { getStatusBadgeClass } from '@/lib/statusUtils';

const SubmissionModal = ({ submission, isOpen, onClose, onStatusChange }) => {
    if (!submission) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Submission Details</DialogTitle>
                    <DialogDescription>
                        Received on {new Date(submission.created_at).toLocaleString()}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <span className="text-right font-semibold">Name</span>
                        <span className="col-span-3">{submission.name}</span>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <span className="text-right font-semibold">Email</span>
                        <span className="col-span-3">{submission.email || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <span className="text-right font-semibold">Phone</span>
                        <span className="col-span-3">{submission.phone || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <span className="text-right font-semibold">Service</span>
                        <span className="col-span-3 capitalize">{submission.service?.replace('-', ' ') || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-4 items-start gap-4">
                        <span className="text-right font-semibold pt-1">Message</span>
                        <p className="col-span-3 bg-gray-100 p-2 rounded-md text-sm">{submission.message || 'No message provided.'}</p>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <span className="text-right font-semibold">Status</span>
                        <div className="col-span-3 flex items-center gap-2">
                             <Badge className={getStatusBadgeClass(submission.status)}>{submission.status}</Badge>
                            <Select defaultValue={submission.status} onValueChange={(newStatus) => onStatusChange(submission.id, newStatus)}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Change Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="New">New</SelectItem>
                                    <SelectItem value="Contacted">Contacted</SelectItem>
                                    <SelectItem value="Completed">Completed</SelectItem>
                                    <SelectItem value="Archived">Archived</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SubmissionModal;