import { supabase } from './customSupabaseClient';

export const generateContent = async (type, context) => {
  try {
    const { data, error } = await supabase.functions.invoke('generate-campaign-content', {
      body: { type, context }
    });

    if (error) {
      console.error('Supabase Function Error:', error);
      throw new Error(error.message || 'Failed to generate content');
    }
    
    return data.result;
  } catch (error) {
    console.error('AI Generation Error:', error);
    throw error;
  }
};