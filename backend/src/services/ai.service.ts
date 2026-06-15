import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = 'gpt-4o-mini';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SegmentRule {
  field: string;
  operator: string;
  value: unknown;
}

export interface CampaignMessageResult {
  subject: string;
  headline: string;
  message: string;
  cta: string;
  variants: Array<{
    label: string;
    subject: string;
    message: string;
  }>;
}

export interface PerformanceAnalysis {
  whatWorked: string[];
  whatFailed: string[];
  suggestions: string[];
  bestSegment: string;
  bestChannel: string;
  predictedNextCampaign: {
    targetAudience: string;
    recommendedChannel: string;
    messageStrategy: string;
    expectedOpenRate: string;
  };
}

export interface CopilotMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ─── Mock Fallbacks ───────────────────────────────────────────────────────────

const mockSegmentRules = (prompt: string): SegmentRule[] => {
  const lower = prompt.toLowerCase();
  const rules: SegmentRule[] = [];

  if (lower.includes('high value') || lower.includes('premium') || lower.includes('spent')) {
    rules.push({ field: 'totalSpent', operator: 'gt', value: 5000 });
  }
  if (lower.includes('inactive') || lower.includes('lapsed') || lower.includes('no purchase')) {
    rules.push({ field: 'lastPurchaseDate', operator: 'moreThanDaysAgo', value: 90 });
  }
  if (lower.includes('active') || lower.includes('recent')) {
    rules.push({ field: 'lastPurchaseDate', operator: 'daysAgo', value: 30 });
  }
  if (lower.includes('delhi')) {
    rules.push({ field: 'city', operator: 'eq', value: 'Delhi' });
  }
  if (lower.includes('mumbai')) {
    rules.push({ field: 'city', operator: 'eq', value: 'Mumbai' });
  }
  if (lower.includes('young') || lower.includes('millennial')) {
    rules.push({ field: 'age', operator: 'between', value: [18, 35] });
  }
  if (lower.includes('loyal') || lower.includes('frequent') || lower.includes('repeat')) {
    rules.push({ field: 'totalOrders', operator: 'gt', value: 5 });
  }
  if (lower.includes('new') || lower.includes('first')) {
    rules.push({ field: 'totalOrders', operator: 'lte', value: 1 });
  }

  if (rules.length === 0) {
    rules.push({ field: 'totalSpent', operator: 'gt', value: 1000 });
  }

  return rules;
};

const mockCampaignMessage = (
  goal: string,
  audience: string,
  tone: string
): CampaignMessageResult => {
  const toneMap: Record<string, string> = {
    formal: 'We are pleased to',
    casual: 'Hey there! We',
    urgent: 'LAST CHANCE:',
    friendly: 'Great news!',
  };
  const prefix = toneMap[tone?.toLowerCase()] || 'Hi there,';

  return {
    subject: `Special Offer: ${goal} — Just for You!`,
    headline: `Exclusive Deal for Our Valued ${audience} Customers`,
    message: `${prefix} have an exciting offer tailored specifically for you. ${goal}. Don't miss out on this limited-time opportunity designed for our ${audience} customers.`,
    cta: 'Shop Now & Save',
    variants: [
      {
        label: 'Variant A - Discount Focus',
        subject: `Save Big: ${goal}`,
        message: `${prefix} bring you incredible savings. ${goal}. Act now!`,
      },
      {
        label: 'Variant B - Exclusivity Focus',
        subject: `Exclusive for You: ${goal}`,
        message: `You've been selected for this exclusive offer. ${goal}. Available only to our premium ${audience}.`,
      },
    ],
  };
};

const mockPerformanceAnalysis = (): PerformanceAnalysis => ({
  whatWorked: [
    'Email subject lines with personalization had 34% higher open rates',
    'Weekend sends outperformed weekday sends by 18%',
    'Customers with 3+ orders had 2.5x higher click rates',
  ],
  whatFailed: [
    'Generic mass messaging showed low engagement',
    'SMS campaigns had low conversion for high-value products',
    'Late-night sends (after 10 PM) had near-zero engagement',
  ],
  suggestions: [
    'Segment further by purchase category for hyper-personalization',
    'A/B test subject lines before full campaign launch',
    'Add a countdown timer for time-limited offers',
    'Use WhatsApp for high-value customer follow-ups',
  ],
  bestSegment: 'High-value loyal customers (totalSpent > 5000, orders > 5)',
  bestChannel: 'EMAIL',
  predictedNextCampaign: {
    targetAudience: 'Customers with purchase history in last 60 days',
    recommendedChannel: 'EMAIL',
    messageStrategy: 'Personalized product recommendations based on past purchases',
    expectedOpenRate: '28-35%',
  },
});

// ─── AI Service Methods ───────────────────────────────────────────────────────

/**
 * Build segment filter rules from a natural language prompt
 */
export const buildSegment = async (prompt: string): Promise<SegmentRule[]> => {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a CRM segment builder AI. Convert natural language customer descriptions into structured filter rules.
          
Available fields and operators:
- totalSpent: "gt", "gte", "lt", "lte", "eq", "between" (value: number or [min, max])
- totalOrders: "gt", "gte", "lt", "lte", "eq", "between" (value: number or [min, max])
- age: "gt", "gte", "lt", "lte", "eq", "between" (value: number or [min, max])
- lastPurchaseDate: "daysAgo" (active in last N days), "moreThanDaysAgo" (inactive for N days), "before", "after" (value: number for days or ISO date string)
- joinedDate: "daysAgo", "moreThanDaysAgo", "before", "after" (value: number for days or ISO date string)
- city: "eq", "neq", "in" (value: string or array of strings)
- gender: "eq" (value: "MALE", "FEMALE", or "OTHER")
- tags: "contains", "in" (value: string or array of strings)

Return ONLY a JSON object with this exact structure:
{
  "rules": [
    { "field": "fieldName", "operator": "operatorName", "value": valueHere }
  ],
  "operator": "AND"
}

The outer "operator" should be "AND" or "OR" to combine rules.`,
        },
        {
          role: 'user',
          content: `Build segment rules for: "${prompt}"`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from AI');

    const parsed = JSON.parse(content);
    return parsed.rules as SegmentRule[];
  } catch (error) {
    console.error('AI buildSegment failed, using mock:', error);
    return mockSegmentRules(prompt);
  }
};

/**
 * Generate campaign message content
 */
export const generateCampaignMessage = async (
  goal: string,
  audience: string,
  tone: string
): Promise<CampaignMessageResult> => {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert CRM campaign copywriter for an Indian e-commerce/retail business. 
Create compelling campaign messages that drive engagement and conversions.
Return ONLY a JSON object with this exact structure:
{
  "subject": "Email subject line (max 60 chars)",
  "headline": "Campaign headline (max 80 chars)",
  "message": "Main message body (2-3 sentences, engaging)",
  "cta": "Call to action button text (max 30 chars)",
  "variants": [
    { "label": "Variant A - Description", "subject": "Subject A", "message": "Message A" },
    { "label": "Variant B - Description", "subject": "Subject B", "message": "Message B" }
  ]
}`,
        },
        {
          role: 'user',
          content: `Create a campaign message with:
- Goal: ${goal}
- Target audience: ${audience}
- Tone: ${tone || 'friendly'}
- Context: Indian customers, mix of Hindi & English is welcome`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from AI');

    return JSON.parse(content) as CampaignMessageResult;
  } catch (error) {
    console.error('AI generateCampaignMessage failed, using mock:', error);
    return mockCampaignMessage(goal, audience, tone);
  }
};

/**
 * Analyze campaign performance and provide insights
 */
export const analyzePerformance = async (campaignData: {
  name: string;
  channel: string;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalConverted: number;
  totalFailed: number;
  segment?: string;
  goal?: string;
  audienceSize?: number;
}): Promise<PerformanceAnalysis> => {
  try {
    const openRate =
      campaignData.totalSent > 0
        ? ((campaignData.totalOpened / campaignData.totalSent) * 100).toFixed(1)
        : '0';
    const clickRate =
      campaignData.totalOpened > 0
        ? ((campaignData.totalClicked / campaignData.totalOpened) * 100).toFixed(1)
        : '0';
    const conversionRate =
      campaignData.totalClicked > 0
        ? ((campaignData.totalConverted / campaignData.totalClicked) * 100).toFixed(1)
        : '0';
    const failRate =
      campaignData.totalSent > 0
        ? ((campaignData.totalFailed / campaignData.totalSent) * 100).toFixed(1)
        : '0';

    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a CRM analytics expert. Analyze campaign performance data and provide actionable insights.
Return ONLY a JSON object with this exact structure:
{
  "whatWorked": ["insight 1", "insight 2", "insight 3"],
  "whatFailed": ["issue 1", "issue 2"],
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4"],
  "bestSegment": "Description of what customer segment performed best",
  "bestChannel": "EMAIL or SMS or WHATSAPP or PUSH",
  "predictedNextCampaign": {
    "targetAudience": "Who to target next",
    "recommendedChannel": "Channel recommendation",
    "messageStrategy": "Message strategy description",
    "expectedOpenRate": "Expected open rate range"
  }
}`,
        },
        {
          role: 'user',
          content: `Analyze this campaign performance:
- Campaign: ${campaignData.name}
- Channel: ${campaignData.channel}
- Goal: ${campaignData.goal || 'General engagement'}
- Segment: ${campaignData.segment || 'Mixed audience'}
- Total Sent: ${campaignData.totalSent}
- Delivered: ${campaignData.totalDelivered}
- Opened: ${campaignData.totalOpened} (${openRate}% open rate)
- Clicked: ${campaignData.totalClicked} (${clickRate}% click-to-open rate)
- Converted: ${campaignData.totalConverted} (${conversionRate}% conversion rate)
- Failed: ${campaignData.totalFailed} (${failRate}% fail rate)`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from AI');

    return JSON.parse(content) as PerformanceAnalysis;
  } catch (error) {
    console.error('AI analyzePerformance failed, using mock:', error);
    return mockPerformanceAnalysis();
  }
};

/**
 * AI Copilot chat — context-aware CRM assistant
 */
export const copilotChat = async (
  messages: CopilotMessage[],
  context?: {
    totalCustomers?: number;
    totalCampaigns?: number;
    totalRevenue?: number;
    recentCampaigns?: string[];
  }
): Promise<string> => {
  try {
    const systemContext = context
      ? `Current CRM context:
- Total Customers: ${context.totalCustomers || 'Unknown'}
- Total Campaigns: ${context.totalCampaigns || 'Unknown'}  
- Total Revenue: ₹${context.totalRevenue?.toLocaleString() || 'Unknown'}
- Recent Campaigns: ${context.recentCampaigns?.join(', ') || 'None'}

`
      : '';

    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.6,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: `${systemContext}You are SmartReach AI, an intelligent CRM assistant for an Indian retail/e-commerce business. 
You help with:
- Customer segmentation strategies
- Campaign optimization and A/B testing
- Customer behavior analysis  
- Revenue growth strategies
- Marketing automation advice
- Data-driven recommendations

Be concise, actionable, and specific. Use data from the context when available.
Respond in the same language as the user (English or Hindi mix is fine).`,
        },
        ...messages.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
      ],
    });

    return response.choices[0]?.message?.content || "I'm sorry, I couldn't process that. Please try again.";
  } catch (error) {
    console.error('AI copilotChat failed:', error);
    return "I'm experiencing some connectivity issues right now. Please try again in a moment. In the meantime, you can explore your campaign analytics and customer segments for insights.";
  }
};

/**
 * Generate campaign name suggestions
 */
export const generateCampaignNames = async (
  goal: string,
  channel: string
): Promise<string[]> => {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.8,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Generate creative campaign names. Return JSON: { "names": ["name1", "name2", ...5 names] }',
        },
        {
          role: 'user',
          content: `Generate 5 creative campaign names for: Goal="${goal}", Channel="${channel}"`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response');
    const parsed = JSON.parse(content);
    return parsed.names as string[];
  } catch (error) {
    console.error('AI generateCampaignNames failed:', error);
    return [
      `${goal} Campaign`,
      `${channel} Engagement Drive`,
      `Customer Re-engagement ${new Date().getFullYear()}`,
      `Smart Outreach Initiative`,
      `Growth Campaign Q${Math.ceil((new Date().getMonth() + 1) / 3)}`,
    ];
  }
};
