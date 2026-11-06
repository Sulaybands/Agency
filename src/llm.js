/**
 * Single-Provider Optional LLM Abstraction
 * - Uses deterministic code for all KPI math, matching, ROI attribution, and rules.
 * - Uses a single configured OpenAI-compatible or Anthropic endpoint ONLY for optional
 *   natural-language outreach/follow-up copy polishing when LLM_API_KEY is present.
 * - Never makes network calls if LLM_API_KEY is absent; falls back cleanly to
 *   deterministic, non-clinical templates labeled with their generation source.
 */

export function getLlmStatus() {
  const provider = process.env.LLM_PROVIDER || 'none';
  const hasKey = Boolean(process.env.LLM_API_KEY && process.env.LLM_API_KEY.trim());
  return {
    configured: hasKey && provider !== 'none',
    provider: hasKey ? provider : 'deterministic-fallback',
    model: hasKey ? process.env.LLM_MODEL || 'configured-default' : 'deterministic-v1'
  };
}

export function generateDeterministicDraft({
  category,
  recipientName,
  locationName,
  orgName,
  daysSinceInquiryOrVisit,
  membershipTierName
}) {
  const firstName = (recipientName || 'there').split(' ')[0];
  const loc = locationName || orgName || 'our studio';

  if (category === 'lead_recovery') {
    return {
      source: 'deterministic-template',
      subject: `Quick follow-up from ${loc}`,
      body: `Hi ${firstName}, thank you for reaching out to ${loc}. Our client concierge wanted to make sure your consultation request didn't slip through the cracks—we have two convenient consultation windows open this week if you'd still like to speak with our team. Reply STOP anytime to opt out.`
    };
  }

  if (category === 'consultation_followup') {
    return {
      source: 'deterministic-template',
      subject: `Checking in after your visit at ${loc}`,
      body: `Hi ${firstName}, it was wonderful hosting your consultation at ${loc}. Let us know if you have any scheduling or pricing questions—we're happy to hold a preferred appointment slot whenever you're ready. Reply STOP anytime to opt out.`
    };
  }

  if (category === 'membership_opportunity') {
    const tier = membershipTierName || 'VIP Aesthetic Membership';
    return {
      source: 'deterministic-template',
      subject: `Member perks available at ${loc}`,
      body: `Hi ${firstName}, since you've visited ${loc} multiple times this year, our front-desk team noted you qualify for banked monthly credits and preferred member pricing through our ${tier}. Happy to share the simple breakdown before your next booking if helpful! Reply STOP to opt out.`
    };
  }

  // Default: non-clinical retention / re-engagement check-in (zero treatment or medical claims)
  const timeframe = daysSinceInquiryOrVisit
    ? `it has been a few months`
    : `it has been a little while`;
  return {
    source: 'deterministic-template',
    subject: `We'd love to welcome you back to ${loc}`,
    body: `Hi ${firstName}, ${timeframe} since we last saw you at ${loc}. Whenever you're planning your next self-care or consultation visit, we'd love to offer priority scheduling with your preferred studio team. Reply STOP anytime to opt out.`
  };
}

export async function draftApprovedCommunication(context) {
  const deterministic = generateDeterministicDraft(context);
  const status = getLlmStatus();
  if (!status.configured) {
    return deterministic;
  }

  // Optional single-provider call when user explicitly configures LLM_API_KEY + LLM_BASE_URL
  try {
    const baseUrl =
      process.env.LLM_BASE_URL || 'https://api.openai.com/v1/chat/completions';
    const model = process.env.LLM_MODEL || 'gpt-4o-mini';
    const prompt = [
      'Write a concise, warm, non-clinical front-desk follow-up message (max 55 words).',
      'STRICT RULES: Never give medical advice, never name diagnoses or medical suitability, and include opt-out language.',
      `Context: Category=${context.category}, FirstName=${context.recipientName}, Studio=${context.locationName}.`
    ].join('\n');

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 140,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!res.ok) return deterministic;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) return deterministic;
    return {
      source: `llm:${status.provider}`,
      subject: deterministic.subject,
      body: content
    };
  } catch {
    return deterministic;
  }
}
