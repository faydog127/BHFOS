import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { PlusCircle, User, MessageSquare } from 'lucide-react';

const TestimonialManager = () => {
    const { toast } = useToast();
    const [testimonials, setTestimonials] = useState([
        { name: 'Maria G.', text: 'Incredibly professional and thorough. Our air feels so much cleaner!', service: 'Air Duct Cleaning', age: '36-55', family: 'Family w/ Kids', ethnicity: 'Hispanic' },
        { name: 'David L.', text: 'The Free Air Check was eye-opening. No pressure, just honest advice.', service: 'Free Air Check', age: '56+', family: 'Couple', ethnicity: 'Caucasian' },
    ]);

    const [newTestimonial, setNewTestimonial] = useState({ name: '', text: '', service: '', age: '', family: '', ethnicity: '' });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewTestimonial(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name, value) => {
        setNewTestimonial(prev => ({ ...prev, [name]: value }));
    };

    const addTestimonial = (e) => {
        e.preventDefault();
        if (newTestimonial.name && newTestimonial.text && newTestimonial.service) {
            setTestimonials(prev => [...prev, newTestimonial]);
            setNewTestimonial({ name: '', text: '', service: '', age: '', family: '', ethnicity: '' });
            toast({ title: "Testimonial Added!", description: "The new testimonial is now available." });
        } else {
            toast({ variant: 'destructive', title: "Missing Fields", description: "Please fill out all required fields." });
        }
    };

    return (
        <div className="p-6 bg-gray-50 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add Testimonial Form */}
            <Card className="lg:col-span-1">
                <CardHeader>
                    <CardTitle className="flex items-center"><PlusCircle className="mr-2 text-[#D7263D]" />Add New Testimonial</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={addTestimonial} className="space-y-4">
                        <div>
                            <Label htmlFor="name">Customer Name *</Label>
                            <Input id="name" name="name" value={newTestimonial.name} onChange={handleInputChange} required />
                        </div>
                        <div>
                            <Label htmlFor="text">Testimonial Text *</Label>
                            <Textarea id="text" name="text" value={newTestimonial.text} onChange={handleInputChange} required />
                        </div>
                        <div>
                            <Label htmlFor="service">Service Received *</Label>
                            <Select name="service" onValueChange={(v) => handleSelectChange('service', v)} required>
                                <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Air Duct Cleaning">Air Duct Cleaning</SelectItem>
                                    <SelectItem value="Dryer Vent Cleaning">Dryer Vent Cleaning</SelectItem>
                                    <SelectItem value="IAQ Testing">IAQ Testing</SelectItem>
                                    <SelectItem value="Free Air Check">Free Air Check</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <h4 className="font-semibold pt-2">Diversity Tags (Optional)</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <Select name="age" onValueChange={(v) => handleSelectChange('age', v)}><SelectTrigger><SelectValue placeholder="Age Range" /></SelectTrigger><SelectContent><SelectItem value="20-35">20-35</SelectItem><SelectItem value="36-55">36-55</SelectItem><SelectItem value="56+">56+</SelectItem></SelectContent></Select>
                            <Select name="family" onValueChange={(v) => handleSelectChange('family', v)}><SelectTrigger><SelectValue placeholder="Family Type" /></SelectTrigger><SelectContent><SelectItem value="Single">Single</SelectItem><SelectItem value="Couple">Couple</SelectItem><SelectItem value="Family w/ Kids">Family w/ Kids</SelectItem><SelectItem value="Multi-gen">Multi-gen</SelectItem></SelectContent></Select>
                        </div>
                        <Button type="submit" className="w-full bg-[#1B263B] hover:bg-[#2a3f5f]">Add Testimonial</Button>
                    </form>
                </CardContent>
            </Card>

            {/* Testimonial List */}
            <div className="lg:col-span-2 space-y-4">
                <h2 className="text-2xl font-bold text-[#1B263B]">Current Testimonials</h2>
                {testimonials.map((testimonial, index) => (
                    <Card key={index}>
                        <CardHeader>
                            <CardTitle className="flex items-center"><User className="mr-2" />{testimonial.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="italic text-gray-700 mb-4">"{testimonial.text}"</p>
                            <div className="flex flex-wrap gap-2 text-xs">
                                <span className="bg-[#C2F5E9] text-[#1B263B] px-2 py-1 rounded-full font-semibold">{testimonial.service}</span>
                                {testimonial.age && <span className="bg-gray-200 px-2 py-1 rounded-full">{testimonial.age}</span>}
                                {testimonial.family && <span className="bg-gray-200 px-2 py-1 rounded-full">{testimonial.family}</span>}
                                {testimonial.ethnicity && <span className="bg-gray-200 px-2 py-1 rounded-full">{testimonial.ethnicity}</span>}
                            </div>
                        </CardContent>
                    </Card>
                ))}
                 <Card className="border-dashed border-red-400 bg-red-50">
                    <CardContent className="pt-6">
                        <p className="font-bold text-[#D7263D]">Representation Gap:</p>
                        <p className="text-sm text-gray-700">Consider adding a testimonial from an **Asian American family** or a **single professional** to improve representation.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default TestimonialManager;