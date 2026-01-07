
import { supabase } from './supabaseClient';

export const LEADS_TO = "leads@vent-guys.com";

export const sendEmail = async ({ to, subject, html, text, from, replyTo }) => {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: { 
      to, 
      subject, 
      html, 
      text, 
      from, 
      reply_to: replyTo 
    }
  });

  if (error) {
    console.error('Error sending email:', error);
    throw error;
  }
  
  return data;
};
