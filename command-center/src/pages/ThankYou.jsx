import React from 'react';
import { Helmet } from 'react-helmet';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const ThankYou = () => {
  return (
    <div className="container mx-auto py-20 px-4 text-center min-h-[60vh] flex flex-col items-center justify-center">
      <Helmet>
        <title>Thank You | The Vent Guys</title>
      </Helmet>
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
        <CheckCircle2 className="w-10 h-10 text-green-600" />
      </div>
      <h1 className="text-4xl font-bold text-slate-900 mb-4">Thank You!</h1>
      <p className="text-xl text-slate-600 mb-8 max-w-xl mx-auto">
        We've received your information. One of our team members will be in touch shortly to confirm your details.
      </p>
      <Button className="bg-blue-600 hover:bg-blue-700" asChild>
        <Link to="/">Return Home</Link>
      </Button>
    </div>
  );
};

export default ThankYou;