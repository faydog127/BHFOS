import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { History, Loader2, Mail, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';

const DELIVERY_EVENT_FILTERS = {
  quote: [
    'estimate.send_requested',
    'estimate.send_previewed',
    'EstimateSmsSent',
    'QuoteSent',
    'estimate.sent',
  ],
  invoice: [
    'InvoiceSent',
    'InvoiceSmsSent',
    'ReceiptSent',
    'ReceiptSmsSent',
  ],
};

const getRecipientText = (payload = {}) =>
  payload.recipient_email ||
  payload.recipient_phone ||
  payload.to ||
  null;

const getChannel = (payload = {}, eventType = '') => {
  if (payload.delivery_channel) return payload.delivery_channel;
  if (eventType.toLowerCase().includes('sms')) return 'sms';
  if (eventType.toLowerCase().includes('receipt')) return 'email';
  return 'email';
};

const getEventLabel = (eventType = '') => {
  switch (eventType) {
    case 'QuoteSent':
      return 'Quote sent';
    case 'EstimateSmsSent':
      return 'Quote texted';
    case 'estimate.send_previewed':
      return 'Preview generated';
    case 'estimate.send_requested':
      return 'Send requested';
    case 'estimate.sent':
      return 'Delivery completed';
    case 'InvoiceSent':
      return 'Invoice sent';
    case 'InvoiceSmsSent':
      return 'Invoice texted';
    case 'ReceiptSent':
      return 'Receipt emailed';
    case 'ReceiptSmsSent':
      return 'Receipt texted';
    default:
      return eventType.replaceAll('_', ' ');
  }
};

const DeliveryHistoryCard = ({ entityType, entityId, tenantId }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchEvents = async () => {
      if (!entityId || !entityType) {
        setEvents([]);
        return;
      }

      setLoading(true);
      try {
        let query = supabase
          .from('events')
          .select('id, event_type, payload, created_at')
          .eq('entity_type', entityType)
          .eq('entity_id', entityId)
          .order('created_at', { ascending: false })
          .limit(12);

        if (tenantId) {
          query = query.eq('tenant_id', tenantId);
        }

        const allowedTypes = DELIVERY_EVENT_FILTERS[entityType] || [];
        if (allowedTypes.length > 0) {
          query = query.in('event_type', allowedTypes);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (active) setEvents(data || []);
      } catch (error) {
        console.error('Failed to load delivery history:', error);
        if (active) setEvents([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchEvents();
    return () => {
      active = false;
    };
  }, [entityId, entityType, tenantId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" /> Delivery History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading activity...
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-slate-500">No delivery activity yet.</p>
        ) : (
          events.map((event) => {
            const channel = getChannel(event.payload, event.event_type);
            const recipient = getRecipientText(event.payload);
            return (
              <div key={event.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    {channel === 'sms' ? <MessageSquare className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                    {getEventLabel(event.event_type)}
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {channel}
                  </Badge>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {format(new Date(event.created_at), 'MMM d, yyyy h:mm a')}
                </div>
                {recipient && (
                  <div className="mt-1 text-xs text-slate-600">
                    {recipient}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default DeliveryHistoryCard;
