import { NextRequest, NextResponse } from 'next/server'

const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY
const OPENAI_MODEL = process.env.NEXT_PUBLIC_OPENAI_MODEL || 'gpt-4'

interface GeneratedQuiz {
  id: string
  question: string
  options: string[]
  correctAnswer: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
}

interface GeneratedPoll {
  id: string
  question: string
  tags: string[]
}

interface GenerationResponse {
  quizzes: GeneratedQuiz[]
  polls: GeneratedPoll[]
}

const SYSTEM_PROMPT = `You are an AI content analyst for Newsreel, a mobile news app. Your job is to generate engaging quizzes and polls based on news stories.

YOU MUST GENERATE EXACTLY:
- 4 QUIZ QUESTIONS (not fewer, exactly 4)
- 4 POLL QUESTIONS (not fewer, exactly 4)

QUIZ RULES:
- Each question tests comprehension of story details
- Each question has exactly 4 multiple-choice answers
- CRITICAL: THE CORRECT ANSWER IS ALWAYS IN POSITION 0 (first option)
- Randomize wrong answers in positions 1, 2, 3
- Assign ONE difficulty: easy, medium, or hard
- Add 2-3 tags per quiz
- Questions span multiple story sections

POLL RULES:
- Each poll asks for reader opinion/perspective
- Based on story topic and implications
- Add 2-3 tags per poll
- Diverse topics, not repetitive

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "quizzes": [
    {
      "id": "q1",
      "question": "Full question text?",
      "options": ["CORRECT_ANSWER_HERE", "wrong option 1", "wrong option 2", "wrong option 3"],
      "difficulty": "medium",
      "tags": ["tag1", "tag2", "tag3"]
    },
    {
      "id": "q2",
      "question": "Another question?",
      "options": ["CORRECT_ANSWER_HERE", "wrong option 1", "wrong option 2", "wrong option 3"],
      "difficulty": "easy",
      "tags": ["tag1", "tag2"]
    },
    {
      "id": "q3",
      "question": "Third question?",
      "options": ["CORRECT_ANSWER_HERE", "wrong option 1", "wrong option 2", "wrong option 3"],
      "difficulty": "hard",
      "tags": ["tag1", "tag2", "tag3"]
    },
    {
      "id": "q4",
      "question": "Fourth question?",
      "options": ["CORRECT_ANSWER_HERE", "wrong option 1", "wrong option 2", "wrong option 3"],
      "difficulty": "medium",
      "tags": ["tag1", "tag2"]
    }
  ],
  "polls": [
    {"id": "p1", "question": "Poll question 1?", "tags": ["tag1", "tag2"]},
    {"id": "p2", "question": "Poll question 2?", "tags": ["tag1", "tag2"]},
    {"id": "p3", "question": "Poll question 3?", "tags": ["tag1", "tag2"]},
    {"id": "p4", "question": "Poll question 4?", "tags": ["tag1", "tag2"]}
  ]
}

RULES:
- EXACTLY 4 quizzes, EXACTLY 4 polls
- ALWAYS put correct answer in first position of options array
- Return ONLY valid JSON. No markdown, no explanation, no commentary.`

export async function POST(request: NextRequest) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    )
  }

  try {
    const { headline, subhead, slides } = await request.json()

    // Guard: Check if story has content
    if (!headline || !slides || slides.length === 0) {
      return NextResponse.json(
        { error: 'Please draft your story first to get AI suggestions for quizzes and polls' },
        { status: 400 }
      )
    }

    // Build story context
    const storyContent = [
      headline,
      subhead,
      ...slides
        .slice(0, 6) // Use first 6 slides to avoid token limits
        .map((s: any) => `${s.slide_headline_1}: ${s.slide_content_1}`)
    ].filter(Boolean).join('\n')

    const userPrompt = `Based on this news story, generate 4-8 engaging quizzes and 4-8 polls:

${storyContent}`

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
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('OpenAI API error:', error)
      throw new Error(error.error?.message || 'Failed to generate quizzes and polls')
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No content in OpenAI response')
    }

    // Parse JSON response
    const parsed: GenerationResponse = JSON.parse(content)

    // Validate and normalize response
    const quizzes = (parsed.quizzes || [])
      .filter((q: any) => q.question && q.options && q.options.length === 4)
      .map((q: any, idx: number) => ({
        id: q.id || `q${idx + 1}`,
        question: q.question || '',
        options: q.options.slice(0, 4),
        // Correct answer is always in position 0 (first option = 'a')
        correctAnswer: 'a',
        difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
        tags: Array.isArray(q.tags) ? q.tags.filter((t: any) => t && typeof t === 'string').slice(0, 3) : [],
      }))
      .slice(0, 4)

    const polls = (parsed.polls || [])
      .filter((p: any) => p.question)
      .map((p: any, idx: number) => ({
        id: p.id || `p${idx + 1}`,
        question: p.question || '',
        tags: Array.isArray(p.tags) ? p.tags.filter((t: any) => t && typeof t === 'string').slice(0, 3) : [],
      }))
      .slice(0, 4)

    return NextResponse.json({
      quizzes,
      polls,
    })
  } catch (error) {
    console.error('Error generating quizzes and polls:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate quizzes and polls'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
