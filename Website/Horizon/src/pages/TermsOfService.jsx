import React from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardContent } from '@/components/ui/card';

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <Helmet>
        <title>Terms of Service | The Vent Guys</title>
        <meta name="description" content="Terms of Service and usage agreement for The Vent Guys services." />
      </Helmet>

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Terms of Service</h1>
          <p className="text-slate-600 mt-4">Last Updated: December 2025</p>
        </div>

        <Card>
          <CardContent className="p-8 prose prose-slate max-w-none">
            <h3>1. Acceptance of Terms</h3>
            <p>
              By accessing and using The Vent Guys website and services, you agree to be bound by these Terms of Service. 
              If you do not agree with any part of these terms, you must not use our services.
            </p>

            <h3>2. Service Booking & Cancellation</h3>
            <p>
              Appointments booked online are subject to confirmation. We reserve the right to reschedule or cancel appointments 
              due to unforeseen circumstances, weather conditions, or safety concerns. Cancellations made less than 24 hours 
              before the scheduled service time may be subject to a cancellation fee.
            </p>

            <h3>3. Service Guarantee</h3>
            <p>
              We stand by our work with a 48-hour satisfaction guarantee. If you are unsatisfied with the cleaning service performed, 
              you must notify us within 48 hours of completion. We will re-inspect and re-clean the disputed areas at no additional cost 
              if they do not meet our quality standards.
            </p>

            <h3>4. Payment Terms</h3>
            <p>
              Payment is due upon completion of services unless otherwise agreed in writing (e.g., for commercial accounts). 
              We accept major credit cards, checks, and electronic payments. Late payments may incur interest charges.
            </p>

            <h3>5. Liability</h3>
            <p>
              While we take utmost care in your property, The Vent Guys is not liable for pre-existing damages to ductwork, 
              dryer vents, or HVAC systems. We are not responsible for damages resulting from wear and tear, improper installation 
              by third parties, or structural defects.
            </p>

            <h3>6. Privacy</h3>
            <p>
              Your use of our website is also governed by our Privacy Policy. We respect your personal information and do not sell 
              your data to third parties.
            </p>

            <h3>7. Modifications</h3>
            <p>
              We reserve the right to modify these terms at any time. Continued use of our services after changes constitutes 
              acceptance of the new terms.
            </p>

            <h3>8. Contact Us</h3>
            <p>
              For questions regarding these terms, please contact us at info@theventguys.com or call (321) 360-9704.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TermsOfService;