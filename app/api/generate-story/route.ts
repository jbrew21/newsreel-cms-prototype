import { NextRequest, NextResponse } from 'next/server'

const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY
const OPENAI_MODEL = process.env.NEXT_PUBLIC_OPENAI_MODEL || 'gpt-4'

const SYSTEM_PROMPT = `You are a Newsreel story writer. You write stories in AP Style for a mobile news app called Newsreel. Your stories are structured as slide-based briefs.

STYLE GUIDE:
- Fun, engaging AND informative
- Brevity with substance - Short but not shallow
- Flow matters - Each slide should connect smoothly to the next
- Active voice, punchy headlines
- Each slide body should be one or two sentences maximum
- NEVER use the words "Fresh" or "Blasted" - these are banned

STORY STRUCTURE:
- Slide 1: The hook. Use "The hook \u{1F3A3}" as the subheadline. This is the attention-grabbing opening.
- Slides 2+: The story body. Each slide uses ONE of these key phrases as the subheadline:
  * "Zoom in \u{1F50D}" - Highlight specific, granular details
  * "Zoom out \u{1F30E}" - Provide the bigger picture, broader context
  * "Rewind \u{23EA}" - Brief timeline or background
  * "By the numbers \u{1F4CA}" - A meaningful stat or fact
  * "What to watch for \u{1F440}" - What could happen next
  * "Counterpoint \u{1F504}" - Alternate perspective or opposing view
  * "Yes, but... \u{1F447}" - A key caveat or limitation
  * "Food for thought \u{1F34E}" - An insight for deeper reflection
  * "Tangent \u{1F300}" - A related but tangential point
- Use varied key phrases across slides. Don't repeat the same phrase.

TRIGGER WARNINGS:
- If the topic involves sensitive content (violence, suicide, sexual assault, etc.), the FIRST slide must be a trigger warning.
- For trigger warning slides, use "Content warning \u{26A0}\u{FE0F}" as the subheadline.
- For general: "This story contains details about ___ that some viewers may find distressing."
- For suicide: Include the 988 Suicide & Crisis Lifeline info.
- For sexual assault: Include the National Sexual Assault Hotline (1-800-656-4673).
- If a trigger warning is needed, add it as an EXTRA slide at the beginning (so the total slide count becomes slideCount + 1).

QUIZ:
- Always generate a quiz at the end
- Medium-hard question reinforcing a key detail
- 4 concise answer choices, exactly one correct
- The correct answer must NOT be a number or percentage
- Mark which answer is correct using the correct_answer field (a, b, c, or d)
- Questions should describe the main point or further future discussions

OUTPUT FORMAT:
Return valid JSON with this exact structure:
{
  "story_headline": "Short punchy headline in active voice",
  "subhead": "A brief subtitle providing additional context",
  "story_type": "brief",
  "needs_trigger_warning": false,
  "slides": [
    {
      "slide_headline_1": "The hook \u{1F3A3}",
      "slide_content_1": "One or two sentences max."
    }
  ],
  "quiz": {
    "quiz_content": "The quiz question?",
    "quiz_answer_a": "Option A",
    "quiz_answer_b": "Option B",
    "quiz_answer_c": "Option C",
    "quiz_answer_d": "Option D",
    "correct_answer": "a"
  }
}

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences, no explanation.`

export async function POST(request: NextRequest) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    )
  }

  try {
    const { prompt, slideCount } = await request.json()

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid prompt' },
        { status: 400 }
      )
    }

    const numSlides = Math.min(Math.max(Number(slideCount) || 4, 2), 8)

    const userMessage = `Write a Newsreel brief story about: "${prompt}"

Number of slides: EXACTLY ${numSlides} (not counting any trigger warning slide if needed).

CRITICAL RULES:
- You MUST generate EXACTLY ${numSlides} slides, no more, no less
- EVERY single slide MUST have both "slide_headline_1" AND "slide_content_1" filled with substantive content
- NO empty slides. Every slide must contain real, meaningful text
- Slide 1 must use "The hook 🎣" key phrase
- Each remaining slide uses a DIFFERENT key phrase from the list
- Each slide body is 1-2 sentences with real substance
- Include a quiz at the end
- Return ONLY valid JSON

Double-check: your response must contain exactly ${numSlides} slides, and NONE of them can have empty or missing content.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.8,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('OpenAI API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to generate story. Please try again.' },
        { status: response.status }
      )
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim()

    if (!content) {
      return NextResponse.json(
        { error: 'No content generated. Please try again.' },
        { status: 500 }
      )
    }

    // Parse the JSON response - strip markdown fences if present
    let cleaned = content
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    }

    const storyData = JSON.parse(cleaned)

    // Post-process: ensure all slides have content
    if (storyData.slides && Array.isArray(storyData.slides)) {
      // Filter out any completely empty slides
      storyData.slides = storyData.slides.filter(
        (s: any) => s.slide_headline_1?.trim() || s.slide_content_1?.trim()
      )

      // If we ended up with fewer slides than requested, that's still valid
      // The AI should have generated enough, but we won't pad with empty ones
    }

    return NextResponse.json({ story: storyData })
  } catch (error) {
    console.error('Error generating story:', error)
    return NextResponse.json(
      { error: 'Failed to generate story. Please try again.' },
      { status: 500 }
    )
  }
}
