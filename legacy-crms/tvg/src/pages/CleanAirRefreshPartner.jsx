import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HeartHandshake as Handshake, User, Building, Mail, Phone, MessageSquare, Briefcase } from 'lucide-react';
import { formatPhoneNumber } from '@/lib/formUtils';
import { useNavigate } from 'react-router-dom';

const CleanAirRefreshPartner = () => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    
    // Form State
    const [partnerType, setPartnerType] = useState('');
    const [organizationName, setOrganizationName] = useState('');
    const [contactName, setContactName] = useState('');
    const [email, setEmail] = useState('');
    const [mobilePhone, setMobilePhone] = useState('');
    const [biggestHeadache, setBiggestHeadache] = useState('');
    const [numUnits, setNumUnits] = useState('');

    const handlePhoneChange = (e) => {
        const formatted = formatPhoneNumber(e.target.value);
        setMobilePhone(formatted);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        if (!partnerType || !contactName || !email || !mobilePhone) {
            toast({
                variant: 'destructive',
                title: 'Missing Information',
                description: 'Please fill out all required fields.',
            });
            setLoading(false);
            return;
        }

        const submissionData = {
            partner_type: partnerType,
            organization_name: organizationName,
            contact_name: contactName,
            email,
            mobile_phone: mobilePhone,
            biggest_headache: biggestHeadache,
            num_units: numUnits ? parseInt(numUnits) : null,
            // Set defaults for required fields in DB that aren't in this simple form
            program_use: ['Referral Program'],
            interest_reasons: ['Reliable Service'],
            welcome_email_status: 'pending',
            followup_email_status: 'pending'
        };

        try {
            const { error } = await supabase.from('partner_registrations').insert([submissionData]);
            if (error) throw error;

            toast({
                title: 'Registration Successful!',
                description: "Thank you for your interest. We'll be in touch soon.",
            });
            
            // Redirect to a thank you page
            navigate('/partners/welcome');

        } catch (error) {
            console.error('Submission Error:', error);
            toast({
                variant: 'destructive',
                title: 'Submission Failed',
                description: error.message || 'An unexpected error occurred. Please try again.',
            });
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <>
            <Helmet>
                <title>Clean Air Refresh Partner Program | The Vent Guys</title>
                <meta name="description" content="Join our Clean Air Refresh Program. Ideal for Realtors, Property Managers, and Landlords looking to provide top-tier air quality for their properties." />
            </Helmet>

            <div className="bg-slate-50">
                <div className="container mx-auto px-4 py-16 lg:py-24">
                    <div className="max-w-4xl mx-auto text-center">
                        <Handshake className="mx-auto h-12 w-12 text-primary mb-4" />
                        <h1 className="text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
                            Partner with The Vent Guys
                        </h1>
                        <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
                            Join our complimentary <span className="font-semibold text-primary">Clean Air Refresh Program</span> to ensure every property turnover includes certified clean air, adding value and peace of mind for you and your clients.
                        </p>
                    </div>

                    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        {/* Left Side: Benefits */}
                        <div className="space-y-8 pt-4">
                            <BenefitItem
                                title="Add Value, Not Cost"
                                description="Our program is free to join. Offer a premium service that distinguishes your properties in a competitive market without impacting your budget."
                            />
                            <BenefitItem
                                title="Streamlined Scheduling"
                                description="We coordinate directly with tenants or access vacant properties with a Supra key, minimizing your administrative burden."
                            />
                            <BenefitItem
                                title="Certified Quality & Peace of Mind"
                                description="Receive a 'Clean Air Certified' certificate for each property, a powerful marketing tool that demonstrates your commitment to resident health and safety."
                            />
                            <BenefitItem
                                title="Priority Service & Billing"
                                description="Partners receive priority scheduling and flexible net-30 billing options to align with your operational cash flow."
                            />
                        </div>

                        {/* Right Side: Form */}
                        <Card className="shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-2xl">Become a Partner</CardTitle>
                                <CardDescription>Fill out the form below to get started. It only takes a minute.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    {/* Partner Type */}
                                    <div className="space-y-2">
                                        <Label htmlFor="partnerType"><Briefcase className="inline h-4 w-4 mr-2" />I am a...</Label>
                                        <Select onValueChange={setPartnerType} value={partnerType} required>
                                            <SelectTrigger id="partnerType">
                                                <SelectValue placeholder="Select your role" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="realtor">Realtor / Broker</SelectItem>
                                                <SelectItem value="property_manager">Property Manager</SelectItem>
                                                <SelectItem value="investor_landlord">Investor / Landlord</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Contact Name */}
                                    <div className="space-y-2">
                                        <Label htmlFor="contactName"><User className="inline h-4 w-4 mr-2" />Full Name</Label>
                                        <Input id="contactName" placeholder="John Doe" value={contactName} onChange={(e) => setContactName(e.target.value)} required />
                                    </div>

                                    {/* Organization Name */}
                                    <div className="space-y-2">
                                        <Label htmlFor="organizationName"><Building className="inline h-4 w-4 mr-2" />Company / Brokerage (Optional)</Label>
                                        <Input id="organizationName" placeholder="e.g., Premier Properties Inc." value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
                                    </div>

                                    {/* Email */}
                                    <div className="space-y-2">
                                        <Label htmlFor="email"><Mail className="inline h-4 w-4 mr-2" />Email Address</Label>
                                        <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                                    </div>

                                    {/* Phone */}
                                    <div className="space-y-2">
                                        <Label htmlFor="mobilePhone"><Phone className="inline h-4 w-4 mr-2" />Mobile Phone</Label>
                                        <Input id="mobilePhone" placeholder="(555) 123-4567" value={mobilePhone} onChange={handlePhoneChange} required />
                                    </div>

                                    {/* Units / Doors */}
                                    <div className="space-y-2">
                                        <Label htmlFor="numUnits">Properties / Units Managed</Label>
                                        <Input id="numUnits" type="number" placeholder="e.g., 50" value={numUnits} onChange={(e) => setNumUnits(e.target.value)} />
                                    </div>

                                    {/* Biggest Headache */}
                                    <div className="space-y-2">
                                        <Label htmlFor="biggestHeadache"><MessageSquare className="inline h-4 w-4 mr-2" />What's your biggest headache with property maintenance?</Label>
                                        <Textarea id="biggestHeadache" placeholder="e.g., Finding reliable vendors, scheduling with tenants, etc." value={biggestHeadache} onChange={(e) => setBiggestHeadache(e.target.value)} />
                                    </div>
                                    
                                    <Button type="submit" className="w-full" disabled={loading}>
                                        {loading ? 'Submitting...' : 'Join the Program'}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
};

const BenefitItem = ({ title, description }) => (
    <div className="flex">
        <div className="flex-shrink-0">
            <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary text-white">
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
            </div>
        </div>
        <div className="ml-4">
            <dt className="text-lg leading-6 font-medium text-slate-900">{title}</dt>
            <dd className="mt-2 text-base text-slate-500">{description}</dd>
        </div>
    </div>
);


export default CleanAirRefreshPartner;