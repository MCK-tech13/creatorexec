/**
 * Claude vision OCR for TikTok Product Trends screenshots.
 * Model: claude-sonnet-4-6 — API key stays server-side only.
 */

export const PRODUCT_SCOUT_OCR_MODEL = 'claude-sonnet-4-6'

/** Structured output schema forced via tool_use tool_choice. */
export const PRODUCT_SCOUT_OCR_TOOL = {
  name: 'extract_trend_metrics',
  description:
    'Extract TikTok Shop Product Trends metric values visible in the screenshot. Use null when a value is missing or illegible. Never invent numbers.',
  input_schema: {
    type: 'object',
    properties: {
      orders: {
        type: ['number', 'null'],
        description:
          'Absolute 30-day orders count (expand K/M suffixes, e.g. 24.1K → 24100). Null if not shown or illegible.',
      },
      ctr: {
        type: ['number', 'null'],
        description:
          'Click-through rate as a plain number (e.g. 3.5 for 3.5%). Null if not shown or illegible.',
      },
      creators: {
        type: ['number', 'null'],
        description:
          'Number of creators count (expand K/M). Null if not shown or illegible.',
      },
      atc: {
        type: ['number', 'null'],
        description:
          'Add-to-cart users count (expand K/M). Null if not shown or illegible.',
      },
      confidence: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description:
          'low = blurry/cropped/hard to read; medium = mostly clear with some uncertainty; high = clearly readable values.',
      },
    },
    required: ['orders', 'ctr', 'creators', 'atc', 'confidence'],
    additionalProperties: false,
  },
}

export const PRODUCT_SCOUT_OCR_SYSTEM_PROMPT = `You extract metrics from TikTok Shop "Product trends" / product promotion screenshots for CreatorExec Product Scout.

Rules (strict):
- Extract EXACTLY what is visibly shown on the image.
- Do NOT guess, estimate, interpolate, or invent missing figures.
- If a metric is cropped, blurry, covered, or not present, return null for that field.
- Expand compact suffixes to absolute numbers (24.1K → 24100, 1.2M → 1200000).
- CTR should be the numeric rate as shown (3.5% → 3.5), not a fraction like 0.035.
- Set confidence based on image clarity of the metrics region: high only when values are clearly readable; low when blurry, dark, tiny, or partly cut off.
- Call the extract_trend_metrics tool with your answer. Do not wrap values in strings.`

export const PRODUCT_SCOUT_OCR_USER_PROMPT = `Read this TikTok Product trends screenshot and extract orders, CTR, number of creators, and add-to-cart users.

Return only what you can clearly read. Use null for anything illegible or missing.`

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
    ctr: asNullableNumber(raw.ctr),
    creators: asNullableNumber(raw.creators),
    atc: asNullableNumber(raw.atc),
    confidence,
  }
}

export async function extractTrendMetricsFromImage({
  apiKey,
  imageBase64,
  mediaType = 'image/jpeg',
  fetchImpl = fetch,
}) {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: PRODUCT_SCOUT_OCR_MODEL,
      max_tokens: 512,
      temperature: 0,
      system: PRODUCT_SCOUT_OCR_SYSTEM_PROMPT,
      tools: [PRODUCT_SCOUT_OCR_TOOL],
      tool_choice: { type: 'tool', name: PRODUCT_SCOUT_OCR_TOOL.name },
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
              text: PRODUCT_SCOUT_OCR_USER_PROMPT,
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
    ? payload.content.find((block) => block.type === 'tool_use' && block.name === PRODUCT_SCOUT_OCR_TOOL.name)
    : null

  if (!toolBlock?.input) {
    throw new Error('Claude did not return structured extraction output')
  }

  return normalizeExtractedMetrics(toolBlock.input)
}
