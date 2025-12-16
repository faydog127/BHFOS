import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Users, Home, Smile, CheckSquare } from 'lucide-react';

const DiversityTracker = () => {
    // Mock data - this would be fetched from your image database/CMS
    const totalImages = 50;
    const diversityData = {
        ethnicity: [
            { name: 'Caucasian', value: 20 },
            { name: 'Hispanic', value: 12 },
            { name: 'African American', value: 8 },
            { name: 'Asian American', value: 5 },
            { name: 'Other/Mixed', value: 5 },
        ],
        age: [
            { name: '20-35', value: 15 },
            { name: '36-55', value: 25 },
            { name: '56+', value: 10 },
        ],
        family: [
            { name: 'Single', value: 10 },
            { name: 'Couple', value: 15 },
            { name: 'Family w/ Kids', value: 20 },
            { name: 'Multi-gen', value: 5 },
        ],
    };

    const complianceData = {
        diverseRepresentation: 42,
        authenticFeel: 38,
        properAltText: 45,
        needsReplacement: 8,
    };

    const COLORS = ['#1B263B', '#4DA6FF', '#D7263D', '#C2F5E9', '#8884d8'];

    const renderProgress = (label, value, total) => {
        const percentage = Math.round((value / total) * 100);
        return (
            <div>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                    <span className="text-sm font-bold text-[#1B263B]">{percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-[#4DA6FF] h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 bg-gray-50">
            <h1 className="text-3xl font-bold text-[#1B263B] mb-6">Image Diversity & Compliance Tracker</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><CheckSquare className="mr-2 text-[#D7263D]" />Overall Compliance</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {renderProgress('Diverse Representation', complianceData.diverseRepresentation, totalImages)}
                        {renderProgress('Authentic Feel', complianceData.authenticFeel, totalImages)}
                        {renderProgress('Proper Alt-Text', complianceData.properAltText, totalImages)}
                        <div className="pt-2">
                            <p className="text-lg font-bold text-[#D7263D]">{complianceData.needsReplacement} images flagged for replacement.</p>
                            <p className="text-sm text-gray-600">Review in the Asset Manager to update high-priority images.</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><Users className="mr-2 text-[#D7263D]" />Ethnicity Representation</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={diversityData.ethnicity} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                    {diversityData.ethnicity.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center"><Smile className="mr-2 text-[#D7263D]" />Age & Family Type Representation</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={diversityData.age} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="value" fill="#1B263B" />
                            </BarChart>
                        </ResponsiveContainer>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={diversityData.family} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="value" fill="#D7263D" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default DiversityTracker;