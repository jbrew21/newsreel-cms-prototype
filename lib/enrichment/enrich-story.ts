/**
 * Story Enrichment Module (Server-side only)
 *
 * Reads story headline + slide text, sends to Claude Sonnet,
 * and saves structured categorization to the story_enrichment table.
 *
 * IMPORTANT: Only import in server-side code (API routes).
 */

import { supabase } from '../supabase/client'
import Anthropic from '@anthropic-ai/sdk'

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
const CLAUDE_TIMEOUT_MS = 30_000
const CLAUDE_MAX_TOKENS = 1500

// ============================================
// Main Entry Point
// ============================================

/**
 * Enrich a story with AI-generated categorization metadata.
 * Skips if enrichment already exists and story content hasn't changed.
 */
export async function enrichStory(storyId: string): Promise<void> {
  console.log(`[Enrichment] Starting for story ${storyId}`)

  try {
    // Fetch story headline + subhead
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .select('id, story_headline, subhead')
      .eq('id', storyId)
      .single()

    if (storyError || !story) {
      console.log(`[Enrichment] Story not found: ${storyId}`)
      return
    }

    if (!story.story_headline) {
      console.log(`[Enrichment] No headline for story ${storyId}, skipping`)
      return
    }

    // Fetch all slides in order
    const { data: slides, error: slidesError } = await supabase
      .from('slides')
      .select('slide_index, slide_title, slide_headline_1, slide_content_1, slide_headline_2, slide_content_2, slide_quote')
      .eq('story_id', storyId)
      .order('slide_index', { ascending: true })

    if (slidesError || !slides?.length) {
      console.log(`[Enrichment] No slides found for story ${storyId}`)
      return
    }

    // Build content fingerprint to detect changes
    const fingerprint = buildContentFingerprint(story, slides)

    // Check if enrichment already exists and is up to date
    const { data: existing } = await supabase
      .from('story_enrichment')
      .select('id, content_fingerprint')
      .eq('story_id', storyId)
      .limit(1)

    if (existing?.length && existing[0].content_fingerprint === fingerprint) {
      console.log(`[Enrichment] Already up to date for story ${storyId}`)
      return
    }

    // Build story text for Claude
    const storyText = buildStoryText(story, slides)

    // Call Claude Sonnet
    const enrichment = await classifyStory(storyText)
    if (!enrichment) {
      console.warn(`[Enrichment] Classification failed for story ${storyId}`)
      return
    }

    // Upsert into story_enrichment
    await saveEnrichment(storyId, enrichment, fingerprint, existing?.length ? existing[0].id : null)

    console.log(`[Enrichment] Done for story ${storyId} — category: ${enrichment.category}`)
  } catch (err) {
    console.error(`[Enrichment] Failed for story ${storyId}:`, err instanceof Error ? err.message : err)
  }
}

// ============================================
// Build Story Text for Claude
// ============================================

function buildStoryText(
  story: { story_headline: string | null; subhead: string | null },
  slides: SlideRow[]
): string {
  let text = `Headline: ${story.story_headline}\n`
  if (story.subhead) {
    text += `Subheadline: ${story.subhead}\n`
  }
  text += '\n'

  for (const slide of slides) {
    text += `--- Slide ${slide.slide_index + 1} ---\n`
    if (slide.slide_title) text += `Title: ${slide.slide_title}\n`
    if (slide.slide_headline_1) text += `Headline: ${slide.slide_headline_1}\n`
    if (slide.slide_content_1) text += `${slide.slide_content_1}\n`
    if (slide.slide_headline_2) text += `Headline: ${slide.slide_headline_2}\n`
    if (slide.slide_content_2) text += `${slide.slide_content_2}\n`
    if (slide.slide_quote) text += `Quote: "${slide.slide_quote}"\n`
    text += '\n'
  }

  return text
}

// ============================================
// Claude Classification
// ============================================

const SYSTEM_PROMPT = `You are a news story classifier. You read a story and return structured metadata as JSON.

RULES:
- Be accurate. Only use information present in the story.
- category: Pick ONE broad category. Use standard news categories: Politics, Business, Technology, Science, Health, Sports, Entertainment, World, Environment, Education, Crime, Lifestyle, Culture, Opinion.
- subcategory: A narrower topic within the category. Examples: Technology → "Artificial Intelligence", Sports → "Cricket", Politics → "Elections".
- topics: 2-5 specific topics or themes discussed. Be specific, not generic.
- tags: 3-8 searchable keywords. Lowercase, specific to this story.
- entities: People, organizations, and places explicitly mentioned. Each has a "name" and "type" (person, org, place).
- locale_country: ISO 3166-1 country name where the story is primarily based. null if unclear or global.
- locale_region: State, province, or region. null if unclear.
- locale_city: City name. null if unclear.
- coordinates: [latitude, longitude] of the primary location. null if unclear or not location-specific.
- scope: "local" (city/district level), "national" (country level), or "international" (multi-country or global).
- sentiment: "positive", "neutral", or "negative" — the overall tone of the story.

OUTPUT FORMAT:
Return ONLY valid JSON with this exact structure:
{
  "category": "Technology",
  "subcategory": "Artificial Intelligence",
  "topics": ["OpenAI", "GPT-5", "AI Regulation"],
  "tags": ["openai", "artificial intelligence", "gpt", "sam altman"],
  "entities": [
    {"name": "Sam Altman", "type": "person"},
    {"name": "OpenAI", "type": "org"},
    {"name": "San Francisco", "type": "place"}
  ],
  "locale_country": "United States",
  "locale_region": "California",
  "locale_city": "San Francisco",
  "coordinates": [37.7749, -122.4194],
  "scope": "international",
  "sentiment": "neutral"
}

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences, no explanation.`

async function classifyStory(storyText: string): Promise<EnrichmentResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[Enrichment] Missing ANTHROPIC_API_KEY')
    return null
  }

  const client = new Anthropic({ apiKey })

  try {
    const result = await Promise.race([
      client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: CLAUDE_MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Classify this story:\n\n${storyText}`,
          },
        ],
        temperature: 0,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Claude API timed out after 30s')), CLAUDE_TIMEOUT_MS)
      ),
    ])

    const textBlock = result.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return null

    let cleaned = textBlock.text.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    }

    const parsed = JSON.parse(cleaned)
    return validateEnrichment(parsed)
  } catch (err) {
    console.error('[Enrichment] Claude classification failed:', err instanceof Error ? err.message : err)
    return null
  }
}

// ============================================
// Validation
// ============================================

const VALID_SCOPES = ['local', 'national', 'international']
const VALID_SENTIMENTS = ['positive', 'neutral', 'negative']

function validateEnrichment(raw: Record<string, unknown>): EnrichmentResult | null {
  if (!raw.category || typeof raw.category !== 'string') return null

  const scope = typeof raw.scope === 'string' && VALID_SCOPES.includes(raw.scope) ? raw.scope : null
  const sentiment = typeof raw.sentiment === 'string' && VALID_SENTIMENTS.includes(raw.sentiment) ? raw.sentiment : null

  let coordinates: [number, number] | null = null
  if (Array.isArray(raw.coordinates) && raw.coordinates.length === 2) {
    const [lat, lng] = raw.coordinates
    if (typeof lat === 'number' && typeof lng === 'number' && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      coordinates = [lat, lng]
    }
  }

  return {
    category: raw.category as string,
    subcategory: typeof raw.subcategory === 'string' ? raw.subcategory : null,
    topics: Array.isArray(raw.topics) ? raw.topics.filter((t): t is string => typeof t === 'string') : [],
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : [],
    entities: Array.isArray(raw.entities)
      ? raw.entities.filter((e): e is Entity => typeof e === 'object' && e !== null && typeof e.name === 'string' && typeof e.type === 'string')
      : [],
    locale_country: typeof raw.locale_country === 'string' ? raw.locale_country : null,
    locale_region: typeof raw.locale_region === 'string' ? raw.locale_region : null,
    locale_city: typeof raw.locale_city === 'string' ? raw.locale_city : null,
    coordinates,
    scope,
    sentiment,
  }
}

// ============================================
// Save to Supabase
// ============================================

async function saveEnrichment(
  storyId: string,
  enrichment: EnrichmentResult,
  fingerprint: string,
  existingId: string | null
): Promise<void> {
  const row = {
    story_id: storyId,
    category: enrichment.category,
    subcategory: enrichment.subcategory,
    topics: enrichment.topics,
    tags: enrichment.tags,
    entities: enrichment.entities,
    locale_country: enrichment.locale_country,
    locale_region: enrichment.locale_region,
    locale_city: enrichment.locale_city,
    coordinates: enrichment.coordinates ? `(${enrichment.coordinates[0]},${enrichment.coordinates[1]})` : null,
    scope: enrichment.scope,
    sentiment: enrichment.sentiment,
    model_version: CLAUDE_MODEL,
    content_fingerprint: fingerprint,
    updated_at: new Date().toISOString(),
  }

  if (existingId) {
    const { error } = await supabase
      .from('story_enrichment')
      .update(row)
      .eq('id', existingId)

    if (error) throw new Error(`Failed to update enrichment: ${error.message}`)
  } else {
    const { error } = await supabase
      .from('story_enrichment')
      .insert(row)

    if (error) throw new Error(`Failed to insert enrichment: ${error.message}`)
  }
}

// ============================================
// Helpers
// ============================================

interface SlideRow {
  slide_index: number
  slide_title: string | null
  slide_headline_1: string | null
  slide_content_1: string | null
  slide_headline_2: string | null
  slide_content_2: string | null
  slide_quote: string | null
}

interface Entity {
  name: string
  type: string
}

interface EnrichmentResult {
  category: string
  subcategory: string | null
  topics: string[]
  tags: string[]
  entities: Entity[]
  locale_country: string | null
  locale_region: string | null
  locale_city: string | null
  coordinates: [number, number] | null
  scope: string | null
  sentiment: string | null
}

/**
 * Build a simple fingerprint of story content to detect changes.
 */
function buildContentFingerprint(
  story: { story_headline: string | null; subhead: string | null },
  slides: SlideRow[]
): string {
  const parts = [story.story_headline, story.subhead]
  for (const s of slides) {
    parts.push(s.slide_title, s.slide_headline_1, s.slide_content_1, s.slide_headline_2, s.slide_content_2, s.slide_quote)
  }
  return parts.filter(Boolean).join('|')
}
