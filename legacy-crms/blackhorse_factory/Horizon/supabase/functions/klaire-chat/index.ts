import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import OpenAI from 'https://esm.sh/openai@4.52.7'

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
})

async function getBrandProfile() {
  const { data, error } = await supabaseAdmin.from('brand_profile').select('key, value');
  if (error) {
    console.error('Error fetching brand profile:', error);
    return {};
  }
  const brandProfile = data.reduce((acc, { key, value }) => {
    acc[key] = value;
    return acc;
  }, {});
  return brandProfile;
}

Deno.serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { messages, sessionId } = await req.json();
    const lastUserMessage = messages[messages.length - 1]?.content;

    // 1. Fetch Brand Profile from Supabase
    const brand = await getBrandProfile();

    // 2. Construct System Prompt
    const systemPrompt = `You are KLAIRE, a friendly, professional, and highly knowledgeable AI assistant for "The Vent Guys," a premier air duct cleaning company.
Your persona is helpful, reassuring, and expert. Your goal is to answer user questions, explain the company's services, and guide potential customers towards booking a service or getting a free quote.
---
Company Profile:
- Company Name: ${brand.company_name || 'The Vent Guys'}
- Tagline: "${brand.tagline || 'Breathe Cleaner, Live Better.'}"
- Core Services: ${brand.core_services || 'Residential & Commercial Air Duct Cleaning, Dryer Vent Cleaning, HVAC System Hygiene.'}
- Key Differentiators: ${brand.differentiators || 'NADCA Certified Technicians, State-of-the-art equipment, Transparent pricing, Focus on customer education and indoor air quality.'}
- Service Area: ${brand.service_area || 'Brevard County, Florida and surrounding areas.'}
- Call to Action: Encourage users to book a free estimate, call for a quote, or visit the booking page.
---
Operational Guidelines:
- Be concise and clear.
- Do NOT provide specific price quotes; instead, guide users to the official booking/quote channels.
- If asked about something outside your expertise (e.g., plumbing, roofing), politely state that it's not a service offered by The Vent Guys and refocus on air quality solutions.
- Keep a positive and helpful tone. You are the first point of contact and represent the brand.
- Start the first conversation in a friendly and welcoming manner.
`;

    // 3. Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 256,
      stream: false,
    });

    const botResponse = completion.choices[0].message.content;

    // 4. Log conversation to Supabase
    if (sessionId && lastUserMessage && botResponse) {
        const { error: logError } = await supabaseAdmin.from('klaire_chat_logs').insert({
            session_id: sessionId,
            user_message: lastUserMessage,
            bot_response: botResponse,
        });

        if (logError) {
            console.error('Error logging chat:', logError);
        }
    }


    // 5. Return response
    return new Response(JSON.stringify({ reply: botResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error in klaire-chat function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})