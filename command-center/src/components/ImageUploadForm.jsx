import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Upload, CheckSquare } from 'lucide-react';

const ImageUploadForm = () => {
    const { toast } = useToast();
    const [preview, setPreview] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        // Mock submission
        setTimeout(() => {
            toast({
                title: "Image Uploaded! ✅",
                description: "Image uploaded with full diversity compliance.",
                className: "bg-green-100 text-green-800 border-green-200",
            });
            setIsSubmitting(false);
            setPreview(null);
            e.target.reset();
        }, 1500);
    };

    const checklistItems = [
        "Image shows a person (not just equipment/hands)",
        "Represents Central Florida demographics",
        "Feels authentic and genuine",
        "Central Florida context visible",
        "Alt-text describes person + moment",
        "Professional photography quality"
    ];

    return (
        <div className="p-6 bg-white rounded-lg shadow-md border">
            <h2 className="text-2xl font-bold text-[#1B263B] mb-6">Upload New Image Asset</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: Upload and Info */}
                <div className="space-y-6">
                    <div>
                        <Label htmlFor="image-upload">Image File</Label>
                        <Input id="image-upload" type="file" accept="image/*" required onChange={handleFileChange} className="mt-2" />
                    </div>
                    {preview && (
                        <div className="mt-4">
                            <Label>Image Preview</Label>
                            <img src={preview} alt="Preview" className="mt-2 rounded-lg max-h-60 w-full object-cover" />
                        </div>
                    )}
                    <div>
                        <Label htmlFor="alt-text">Alt-Text (Describe the person & moment)</Label>
                        <Input id="alt-text" required placeholder="e.g., Hispanic homeowner smiling..." className="mt-2" />
                    </div>
                    <div>
                        <Label htmlFor="location">Page/Section Where Used</Label>
                        <Input id="location" required placeholder="e.g., Homepage Hero, About Us Team Section" className="mt-2" />
                    </div>
                </div>

                {/* Right Column: Checklist */}
                <div className="space-y-6 bg-gray-50 p-6 rounded-lg border">
                    <h3 className="font-bold text-lg text-[#1B263B] flex items-center"><CheckSquare className="mr-2 text-[#D7263D]" />Mandatory Diversity Checklist</h3>
                    <div className="space-y-4">
                        {checklistItems.map((item, index) => (
                            <div key={index} className="flex items-center space-x-2">
                                <Checkbox id={`checklist-${index}`} required />
                                <Label htmlFor={`checklist-${index}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    {item}
                                </Label>
                            </div>
                        ))}
                    </div>
                    <div className="pt-4">
                        <Button type="submit" className="w-full bg-[#1B263B] hover:bg-[#2a3f5f]" disabled={isSubmitting}>
                            <Upload className="mr-2 h-4 w-4" />
                            {isSubmitting ? 'Uploading...' : 'Upload with Compliance Check'}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default ImageUploadForm;