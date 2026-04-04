import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// ─── Constants ───────────────────────────────────────────────────────────────

const TRANSFORM_TIMEOUT_MS = 30_000
const MAX_TEXT_LENGTH = 5000
const MIN_TEXT_LENGTH = 50

// ─── SSRF protection ─────────────────────────────────────────────────────────

const BLOCKED_PATTERNS = [
  /^file:\/\//i,
  /^ftp:\/\//i,
  /localhost/i,
  /127\.0\.0\.\d/,
  /\[::1\]/,
  /10\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
  /172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}/,
  /192\.168\.\d{1,3}\.\d{1,3}/,
  /0\.0\.0\.0/,
]

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    const full = parsed.href
    return !BLOCKED_PATTERNS.some((p) => p.test(full))
  } catch {
    return false
  }
}

// ─── Rate limiting (in-memory, per-IP) ───────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// ─── HTML scraping (Tier 1 — regex, free, instant) ───────────────────────────

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
}

function extractFromHtml(html: string): { title: string; siteName: string; text: string } {
  // Title: og:title → <title>
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i)?.[1]
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
  const title = (ogTitle || titleTag || '').trim()

  // Site name
  const siteName = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i)?.[1]
    ?? ''

  // Article text: <article> → all <p> → strip all tags
  let text = ''
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  if (articleMatch) {
    const paragraphs = articleMatch[1].match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []
    text = paragraphs.map((p) => p.replace(/<[^>]+>/g, '').trim()).filter(Boolean).join('\n\n')
  }
  if (!text || text.length < 100) {
    const allP = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []
    text = allP.map((p) => p.replace(/<[^>]+>/g, '').trim()).filter(Boolean).join('\n\n')
  }
  if (!text || text.length < 100) {
    text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  return { title, siteName: siteName.trim(), text }
}

// ─── Firecrawl (Tier 2) ─────────────────────────────────────────────────────

async function firecrawlScrape(url: string): Promise<{ title: string; siteName: string; text: string } | null> {
  const key = process.env.FIRECRAWL_API_KEY
  if (!key) return null

  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ url, formats: ['markdown'] }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.success || !data.data) return null

    const text = data.data.markdown || ''
    if (text.length < 200) return null

    return {
      title: data.data.metadata?.title || data.data.metadata?.ogTitle || '',
      siteName: data.data.metadata?.ogSiteName || data.data.metadata?.sourceURL || '',
      text,
    }
  } catch {
    return null
  }
}

// ─── System prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a Newsreel story writer. You write stories in AP Style for a mobile news app called Newsreel. Your stories are structured as slide-based briefs.

STYLE GUIDE:
- Fun, engaging AND informative
- Brevity with substance - Short but not shallow
- Flow matters - Each slide should connect smoothly to the next
- Active voice, punchy headlines
- Each slide body should be one or two sentences maximum
- NEVER use the words "Fresh" or "Blasted" - these are banned

STORY STRUCTURE:
- Slide 1: The hook. Use "The hook" as the subheadline. This is the attention-grabbing opening.
- Slides 2+: The story body. Each slide uses ONE of these key phrases as the subheadline:
  * "Zoom in" - Highlight specific, granular details
  * "Zoom out" - Provide the bigger picture, broader context
  * "Rewind" - Brief timeline or background
  * "By the numbers" - A meaningful stat or fact
  * "What to watch for" - What could happen next
  * "Counterpoint" - Alternate perspective or opposing view
  * "Yes, but..." - A key caveat or limitation
  * "Food for thought" - An insight for deeper reflection
  * "Tangent" - A related but tangential point
- Use varied key phrases across slides. Don't repeat the same phrase.
- CRITICAL: Each slide MUST have a UNIQUE gif_query and image_query. NEVER repeat any query.
  * If you used "robot" for slide 1, you CANNOT use "robot" for slide 2,3,4,5...
  * If you used "computer" for slide 2, use "laptop" or "office" or "coding" for another tech slide
  * GENERATE COMPLETELY DIFFERENT QUERIES FOR EACH SLIDE. This is non-negotiable.

TRIGGER WARNINGS:
- If the topic involves sensitive content (violence, suicide, sexual assault, etc.), the FIRST slide must be a trigger warning.
- For trigger warning slides, use "Content warning" as the subheadline.

POLL (LIKERT SCALE):
- Always generate a poll: an opinion-based question asking readers "Where do you stand?"
- The question should be directly based on the story's topic and implications
- Provide exactly 5 Likert scale options representing a spectrum of perspectives
- Example topic: "AI regulation" → Question: "Where do you stand on AI regulation in the workplace?"
- Options should span from one extreme to the other (e.g., Strongly Disagree → Strongly Agree)
- Keep options concise and clear, avoiding ambiguity

QUIZ:
- Always generate a quiz at the end
- Medium-hard question reinforcing a key detail
- 4 concise answer choices, exactly one correct
- The correct answer must NOT be a number or percentage
- Mark which answer is correct using the correct_answer field (a, b, c, or d)

MEDIA QUERIES:
CRITICAL: Queries must be RELEVANT to the story subject. Do NOT use generic stock photo terms.
Think: what would a journalist search to illustrate THIS specific story?

- "image_query": 1-2 words, directly tied to the story's subject matter
  - Story about Wikipedia → "wikipedia", "encyclopedia", "wiki editing"
  - Story about Tesla stock → "Tesla", "Elon Musk", "electric car"
  - Story about hurricane → "hurricane damage", "storm surge"
  - Story about a court case → "supreme court", "judge gavel"
  - GOOD: uses names, brands, places, or specific things FROM the article
  - BAD: generic terms like "birthday cake", "trophy", "smartphone" that have nothing to do with the story

- "gif_query": 1-3 words, expressive reaction or action related to the slide's tone
  - Read: "Stock prices plummeted" → gif_query: "stock market crash"
  - Read: "FDA approves medicine" → gif_query: "celebration cheering"
  - Read: "Milestone anniversary" → gif_query: "happy anniversary"
  - Read: "Unexpected growth" → gif_query: "mind blown"
  - Must be CONCRETE and SEARCHABLE (what would you type in Giphy search bar?)

QUERY RULES:
- image_query must reference the ACTUAL topic — names, brands, places, events from the article
- gif_query should match the slide's emotional tone or action
- NEVER use generic filler terms unrelated to the story (e.g. "birthday cake" for a tech story)
- Each slide's gif_query MUST BE UNIQUE — never repeat the same query across slides
- Each slide's image_query MUST BE UNIQUE — never repeat the same query across slides

OUTPUT FORMAT:
Return valid JSON with this exact structure:
{
  "story_headline": "Short punchy headline in active voice",
  "subhead": "A brief subtitle providing additional context",
  "source_name": "The publication name",
  "slides": [
    {
      "subheadline": "The hook",
      "content": "One or two sentences max.",
      "image_query": "concrete visual nouns for photos/videos",
      "gif_query": "action words for animated GIFs"
    }
  ],
  "quiz": {
    "question": "The quiz question?",
    "answers": {
      "a": "Option A",
      "b": "Option B",
      "c": "Option C",
      "d": "Option D"
    },
    "correct_answer": "a"
  },
  "guess": {
    "question": "Before you read: what do you think about [topic]?",
    "options": ["Option 1", "Option 2", "Option 3"]
  },
  "poll": {
    "question": "Where do you stand on [specific topic from story]?",
    "options": [
      "Strongly Disagree",
      "Disagree",
      "Neutral",
      "Agree",
      "Strongly Agree"
    ]
  }
}

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences, no explanation.`

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Parse & validate
  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { url } = body
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  }

  // 2. Auto-detect: is this a URL or raw pasted text?
  const input = url.trim()
  const isUrl = /^https?:\/\//i.test(input)

  // 3. SSRF check (only for URLs)
  if (isUrl && !isSafeUrl(input)) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 400 })
  }

  // 4. Rate limit
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 })
  }

  let title = ''
  let siteName = ''
  let text = ''

  if (isUrl) {
    // ─── Link mode: scrape content (2-tier: direct fetch → Firecrawl) ──
    // Tier 1: Direct fetch with browser headers
    try {
      const res = await fetch(input, { headers: BROWSER_HEADERS, redirect: 'follow' })
      if (res.ok) {
        const html = await res.text()
        const tier1 = extractFromHtml(html)
        title = tier1.title
        siteName = tier1.siteName
        text = tier1.text
      }
    } catch {
      // Direct fetch failed (network error, timeout, etc.) — fall through to Firecrawl
    }

    // Tier 2: Firecrawl if direct fetch failed or returned insufficient text
    if (text.length < 400) {
      const tier2 = await firecrawlScrape(input)
      if (tier2 && tier2.text.length > text.length) {
        text = tier2.text
        if (tier2.title) title = tier2.title
        if (tier2.siteName) siteName = tier2.siteName
      }
    }

    // Fallback site name from hostname
    if (!siteName) {
      try {
        siteName = new URL(input).hostname.replace(/^www\./, '')
      } catch {
        siteName = 'Unknown'
      }
    }
  } else {
    // ─── Text mode: raw pasted text, skip all scraping ─────────────────
    text = input
    siteName = 'User Provided'
  }

  // Cap text & validate minimum
  text = text.slice(0, MAX_TEXT_LENGTH)
  if (text.length < MIN_TEXT_LENGTH) {
    return NextResponse.json({
      error: isUrl
        ? 'Could not extract enough text from this URL. The site may be blocking automated access.'
        : 'Please provide more text (at least a few sentences).',
    }, { status: 422 })
  }

  if (!title) title = 'Untitled Article'

  // 6. Call Claude
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })
  }

  const userMessage = `Transform this article into a Newsreel brief story.

ARTICLE TITLE: ${title}
SOURCE: ${siteName}
URL: ${url}

ARTICLE TEXT:
${text}

CRITICAL RULES:
- Decide the best number of slides (between 3 and 8) based on the article's depth and complexity. Short articles get fewer slides, rich articles get more.
- EVERY slide MUST have both "subheadline" AND "content" filled with substantive content
- Slide 1 must use "The hook" key phrase
- Each remaining slide uses a DIFFERENT key phrase from the list
- Each slide body is 1-2 sentences with real substance
- Include a quiz, a guess question, and a poll (Likert scale, 5 options, "Where do you stand?" framing)
- Return ONLY valid JSON`

  const client = new Anthropic({ apiKey: anthropicKey })

  let rawResponse: string
  try {
    const result = await Promise.race([
      client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Claude API timeout')), TRANSFORM_TIMEOUT_MS)
      ),
    ])

    const textBlock = result.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'No text response from Claude' }, { status: 502 })
    }
    rawResponse = textBlock.text
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Claude API error'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  // 7. Post-process: strip markdown fences, parse JSON
  let cleaned = rawResponse.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  }

  let story: Record<string, unknown>
  try {
    story = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'Claude returned invalid JSON', raw: cleaned }, { status: 502 })
  }

  // 8. Fill missing queries & add source metadata
  const slides = Array.isArray(story.slides) ? story.slides : []
  for (const slide of slides) {
    if (!slide.image_query) slide.image_query = title.split(' ')[0] || 'news'
    if (!slide.gif_query) {
      const firstNoun = (slide.content || '').split(/\s+/).find((w: string) => w.length > 3) || 'celebration'
      slide.gif_query = firstNoun
    }
  }

  story.source_url = url
  story.source_name = story.source_name || siteName

  return NextResponse.json({ story })
}
