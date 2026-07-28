/**
 * Claude vision OCR for TikTok Product Trends screenshots.
 * Model: claude-sonnet-4-6 — API key stays server-side only.
 */

export const PRODUCT_SCOUT_OCR_MODEL = 'claude-sonnet-4-6'

/** @typedef {'7' | '30'} ProductScoutOcrPeriod */

/**
 * Structured output schema forced via tool_use tool_choice.
 * @param {ProductScoutOcrPeriod} [period='30']
 */
export function buildProductScoutOcrTool(period = '30') {
  const windowLabel = period === '7' ? '7-day' : '30-day'
  return {
    name: 'extract_trend_metrics',
    description:
      'Extract TikTok Shop Product Trends metric values and their period-over-period deltas from the screenshot. Use null when a value is missing or illegible. Never invent numbers.',
    input_schema: {
      type: 'object',
      properties: {
        orders: {
          type: ['number', 'null'],
          description: `Absolute ${windowLabel} orders count (expand K/M suffixes, e.g. 24.1K → 24100). Null if not shown or illegible.`,
        },
        delta_orders: {
          type: ['number', 'null'],
          description:
            'Period-over-period change for orders. Prefer the small green/red triangle indicator under the main value (▲190 → 190, ▼1.2K → -1200). Expand K/M. Null if missing or illegible.',
        },
        ctr: {
          type: ['number', 'null'],
          description:
            'Click-through rate as a plain number (e.g. 3.5 for 3.5%). Null if not shown or illegible.',
        },
        delta_ctr: {
          type: ['number', 'null'],
          description:
            'Period-over-period CTR change as a plain signed number (▲1.8% → 1.8, ▼0.5 → -0.5). Null if missing or illegible.',
        },
        creators: {
          type: ['number', 'null'],
          description:
            'Number of creators count (expand K/M). Null if not shown or illegible.',
        },
        delta_creators: {
          type: ['number', 'null'],
          description:
            'Period-over-period creators change from the small ▲/▼ indicator under the main value (expand K/M). Null if missing or illegible.',
        },
        atc: {
          type: ['number', 'null'],
          description:
            'Add-to-cart users count (expand K/M). Null if not shown or illegible.',
        },
        delta_atc: {
          type: ['number', 'null'],
          description:
            'Period-over-period add-to-cart change from the small ▲/▼ indicator under the main value (expand K/M). Null if missing or illegible.',
        },
        confidence: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description:
            'low = blurry/cropped/hard to read; medium = mostly clear with some uncertainty; high = clearly readable values (including deltas when present).',
        },
      },
      required: [
        'orders',
        'delta_orders',
        'ctr',
        'delta_ctr',
        'creators',
        'delta_creators',
        'atc',
        'delta_atc',
        'confidence',
      ],
      additionalProperties: false,
    },
  }
}

/** Default 30-day tool (backward-compatible export for verify scripts). */
export const PRODUCT_SCOUT_OCR_TOOL = buildProductScoutOcrTool('30')

export function buildProductScoutOcrSystemPrompt(period = '30') {
  const windowLabel = period === '7' ? '7-day' : '30-day'
  return `You extract metrics from TikTok Shop "Product trends" / product promotion screenshots for CreatorExec Product Scout.

This image is the ${windowLabel} Product trends view. Prefer metrics labeled or scoped to ${windowLabel} when both windows appear.

Each metric usually has:
1) A large primary VALUE (Orders, CTR, Number of creators, Add-to-cart users).
2) A smaller DELTA under or beside that value: a colored triangle ▲ (up / green / positive) or ▼ (down / red / negative) followed by a number like ▲190, ▲1.8%, ▼0.5, or ▲13.2K. That delta is period-over-period change — extract it separately from the primary value.

Rules (strict):
- Extract EXACTLY what is visibly shown on the image.
- Do NOT guess, estimate, interpolate, or invent missing figures.
- If a metric or its delta is cropped, blurry, covered, or not present, return null for that field.
- Expand compact suffixes to absolute numbers (24.1K → 24100, 1.2M → 1200000).
- CTR primary and delta_ctr should be plain numbers as shown (3.5% → 3.5; ▲1.8% → 1.8), not fractions like 0.035.
- Delta fields must be signed: positive for ▲ / green / +, negative for ▼ / red / -.
- Do not copy the primary value into a delta field unless that same number is independently shown as the delta indicator text.
- Set confidence based on image clarity of the metrics region: high only when values (and readable deltas) are clear; low when blurry, dark, tiny, or partly cut off.
- Call the extract_trend_metrics tool with your answer. Do not wrap values in strings.`
}

export const PRODUCT_SCOUT_OCR_SYSTEM_PROMPT = buildProductScoutOcrSystemPrompt('30')

export function buildProductScoutOcrUserPrompt(period = '30') {
  const windowLabel = period === '7' ? '7-day' : '30-day'
  return `Read this TikTok Product trends screenshot (${windowLabel} window) and extract:
- primary values: orders, CTR, number of creators, add-to-cart users
- deltas: the small ▲/▼ (or +/-) change indicators under each primary metric (delta_orders, delta_ctr, delta_creators, delta_atc)

Return only what you can clearly read for the ${windowLabel} view. Use null for anything illegible or missing.`
}

export const PRODUCT_SCOUT_OCR_USER_PROMPT = buildProductScoutOcrUserPrompt('30')

const CONFIDENCE_VALUES = new Set(['low', 'medium', 'high'])

function asNullableNumber(value) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

export function normalizeExtractedMetrics(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Malformed extraction payload')
  }

  const confidence = raw.confidence
  if (!CONFIDENCE_VALUES.has(confidence)) {
    throw new Error('Malformed extraction: invalid confidence')
  }

  return {
    orders: asNullableNumber(raw.orders),
    delta_orders: asNullableNumber(raw.delta_orders),
    ctr: asNullableNumber(raw.ctr),
    delta_ctr: asNullableNumber(raw.delta_ctr),
    creators: asNullableNumber(raw.creators),
    delta_creators: asNullableNumber(raw.delta_creators),
    atc: asNullableNumber(raw.atc),
    delta_atc: asNullableNumber(raw.delta_atc),
    confidence,
  }
}

export async function extractTrendMetricsFromImage({
  apiKey,
  imageBase64,
  mediaType = 'image/jpeg',
  period = '30',
  fetchImpl = fetch,
}) {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const resolvedPeriod = period === '7' ? '7' : '30'
  const tool = buildProductScoutOcrTool(resolvedPeriod)
  const system = buildProductScoutOcrSystemPrompt(resolvedPeriod)
  const userPrompt = buildProductScoutOcrUserPrompt(resolvedPeriod)

  const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: PRODUCT_SCOUT_OCR_MODEL,
      max_tokens: 768,
      temperature: 0,
      system,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      payload?.error?.message ??
      (typeof payload?.error === 'string' ? payload.error : null) ??
      `Claude API error (${response.status})`
    const error = new Error(message)
    error.status = response.status
    error.payload = payload
    throw error
  }

  const toolBlock = Array.isArray(payload.content)
    ? payload.content.find((block) => block.type === 'tool_use' && block.name === tool.name)
    : null

  if (!toolBlock?.input) {
    throw new Error('Claude did not return structured extraction output')
  }

  return normalizeExtractedMetrics(toolBlock.input)
}
