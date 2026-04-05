import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ImageAssetManager = () => {
    const { toast } = useToast();

    // Mock data - this would be fetched from your image database/CMS
    const images = [
        { id: 1, path: '/hero-main.jpg', alt: 'Central Florida homeowner smiling in modern kitchen, representing diverse community served by The Vent Guys', page: 'Homepage Hero', score: 'Good' },
        { id: 2, path: '/about-team.jpg', alt: 'The Vent Guys team serving Central Florida with certified, documented air quality solutions', page: 'About Us', score: 'Good' },
        { id: 3, path: '/services/duct-cleaning.jpg', alt: 'Diverse technician performing air duct cleaning in mid-century Central Florida home', page: 'Services', score: 'Good' },
        { id: 4, path: '/blog/generic-hvac.jpg', alt: 'HVAC system', page: 'Blog: Why Clean Air Matters', score: 'Poor' },
        { id: 5, path: '/testimonials/customer1.jpg', alt: 'Happy customer', page: 'Testimonials', score: 'Needs Improvement' },
    ];

    const getScoreBadge = (score) => {
        switch (score) {
            case 'Good': return 'bg-green-100 text-green-800';
            case 'Needs Improvement': return 'bg-yellow-100 text-yellow-800';
            case 'Poor': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };
    
    const showToast = () => toast({ description: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀" });

    return (
        <div className="p-6 bg-white rounded-lg shadow-md border">
            <h2 className="text-2xl font-bold text-[#1B263B] mb-6">Image Asset Manager</h2>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Preview</TableHead>
                            <TableHead>Alt-Text</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Diversity Score</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {images.map(image => (
                            <TableRow key={image.id}>
                                <TableCell>
                                    <img src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=100" alt="preview" className="h-12 w-16 object-cover rounded-md" />
                                </TableCell>
                                <TableCell className="max-w-xs truncate">{image.alt}</TableCell>
                                <TableCell>{image.page}</TableCell>
                                <TableCell>
                                    <Badge className={getScoreBadge(image.score)}>{image.score}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={showToast}><Edit className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="text-red-500" onClick={showToast}><Trash2 className="h-4 w-4" /></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default ImageAssetManager;