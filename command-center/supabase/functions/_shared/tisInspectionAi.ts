import OpenAI from 'https://esm.sh/openai@4.52.7'

export const TIS_INSPECTION_PROMPT_VERSION = 'tis-inspection-v1'

export const analyzeInspectionPhoto = async (input: {
  imageUrl: string
  caption?: string | null
  notes?: string | null
}) => {
  const client = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') })
  const model = Deno.env.get('TIS_INSPECTION_AI_MODEL') || 'gpt-5.2'
  const completion = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'You assist HVAC inspection technicians by analyzing photo evidence.',
          'Return JSON with keys finding and narrative.',
          'finding must contain title, description, severity, category, recommended_action, confidence.',
          'narrative must be a concise factual report sentence.',
          'Never approve a finding. Never provide or infer prices. Clearly describe uncertainty.',
          'Do not claim anything that is not visible in the photo or stated in technician context.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Caption: ${input.caption || 'None'}\nTechnician notes: ${input.notes || 'None'}` },
          { type: 'image_url', image_url: { url: input.imageUrl, detail: 'low' } },
        ],
      },
    ],
  })
  const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}')
  return { model, finding: parsed.finding, narrative: parsed.narrative }
}
