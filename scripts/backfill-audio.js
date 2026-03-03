#!/usr/bin/env node

/**
 * One-time backfill script: Generate audio narration for all existing stories.
 * Run from project root: node scripts/backfill-audio.js
 *
 * Safe to run multiple times — skips stories that already have audio.
 * Does NOT touch the UI, save flow, or any other tables.
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const os = require('os')

// OpenAI SDK v4+ CJS import
const openaiModule = require('openai')
const OpenAI = openaiModule.default || openaiModule

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const openaiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}
if (!openaiKey) {
  console.error('Missing NEXT_PUBLIC_OPENAI_API_KEY in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)
const openai = new OpenAI({ apiKey: openaiKey })

const STORAGE_BUCKET = 'story-media'
const TTS_MODEL = 'tts-1-hd'
const TTS_VOICE = 'onyx'
const GPT_MODEL = 'gpt-4o'

async function main() {
  console.log('=== Audio Narration Backfill ===\n')
  console.log('Fetching all stories...')

  const { data: stories, error } = await supabase
    .from('stories')
    .select('id, story_headline, subhead')
    .order('created_at', { ascending: false })

  if (error || !stories) {
    console.error('Failed to fetch stories:', error)
    process.exit(1)
  }

  console.log(`Found ${stories.length} stories\n`)

  let totalProcessed = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (let si = 0; si < stories.length; si++) {
    const story = stories[si]
    console.log(`[${si + 1}/${stories.length}] "${story.story_headline || 'Untitled'}" (${story.id})`)

    if (!story.story_headline) {
      console.log('  No headline, skipping\n')
      totalSkipped++
      continue
    }

    // Fetch slides
    const { data: slides, error: slideError } = await supabase
      .from('slides')
      .select('slide_index, slide_title, slide_headline_1, slide_content_1, slide_headline_2, slide_content_2, slide_quote')
      .eq('story_id', story.id)
      .order('slide_index', { ascending: true })

    if (slideError || !slides?.length) {
      console.log('  No slides found, skipping\n')
      totalSkipped++
      continue
    }

    // Check if audio already exists
    const { data: existing } = await supabase
      .from('story_audio')
      .select('id')
      .eq('story_id', story.id)
      .limit(1)

    if (existing?.length) {
      console.log('  Audio already exists, skipping\n')
      totalSkipped++
      continue
    }

    let tempPath = null

    try {
      // Step 1: Build narration script with GPT-4o
      console.log('  Generating narration script...')
      const narrationText = await buildNarrationScript(story.story_headline, story.subhead, slides)

      if (!narrationText) {
        console.error('  Failed to generate narration script')
        totalFailed++
        continue
      }

      console.log(`  Script ready (${narrationText.length} chars)`)

      // Step 2: Convert to speech with TTS-HD
      console.log(`  Converting to speech (${TTS_MODEL}, voice: ${TTS_VOICE})...`)
      tempPath = await generateSpeech(narrationText)

      const sizeMB = fs.statSync(tempPath).size / (1024 * 1024)
      console.log(`  Audio file: ${sizeMB.toFixed(2)} MB`)

      // Step 3: Upload to Supabase storage
      console.log('  Uploading to storage...')
      const objectPath = `stories/${story.id}/audio/narration.mp3`
      const audioUrl = await uploadAudio(objectPath, tempPath)

      // Step 4: Save to story_audio table
      const { error: insertError } = await supabase
        .from('story_audio')
        .insert({
          story_id: story.id,
          audio_url: audioUrl,
          bucket: STORAGE_BUCKET,
          object_path: objectPath,
          narration_text: narrationText,
          voice: TTS_VOICE,
        })

      if (insertError) {
        console.error(`  SAVE FAILED: ${insertError.message}`)
        totalFailed++
      } else {
        console.log('  Audio saved!\n')
        totalProcessed++
      }

      // Delay between stories to respect API rate limits
      await new Promise(r => setTimeout(r, 2000))
    } catch (err) {
      console.error(`  FAILED: ${err.message}\n`)
      totalFailed++
    } finally {
      if (tempPath && fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath)
      }
    }
  }

  console.log('=== BACKFILL COMPLETE ===')
  console.log(`Processed: ${totalProcessed}`)
  console.log(`Skipped:   ${totalSkipped}`)
  console.log(`Failed:    ${totalFailed}`)
}

// ============================================
// Narration Script (GPT-4o)
// ============================================

async function buildNarrationScript(headline, subhead, slides) {
  let storyContent = `Headline: ${headline}\n`
  if (subhead) {
    storyContent += `Subheadline: ${subhead}\n`
  }
  storyContent += '\n'

  for (const slide of slides) {
    storyContent += `--- Slide ${slide.slide_index + 1} ---\n`
    if (slide.slide_title) storyContent += `Title: ${slide.slide_title}\n`
    if (slide.slide_headline_1) storyContent += `Headline: ${slide.slide_headline_1}\n`
    if (slide.slide_content_1) storyContent += `${slide.slide_content_1}\n`
    if (slide.slide_headline_2) storyContent += `Headline: ${slide.slide_headline_2}\n`
    if (slide.slide_content_2) storyContent += `${slide.slide_content_2}\n`
    if (slide.slide_quote) storyContent += `Quote: "${slide.slide_quote}"\n`
    storyContent += '\n'
  }

  try {
    const response = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a professional news podcast narrator. Write a narration script for this news story that will be converted to audio.

Rules:
- Match the tone to the content — serious and measured for hard news, warm for human interest, energetic for sports/entertainment
- Open with a compelling hook that draws the listener in
- Transition smoothly between sections — never say "Slide 1" or "Section 2"
- Include quoted text naturally when present (e.g. "As one source put it...")
- Close with a brief wrap-up that ties the story together
- Keep it concise — aim for a 30-90 second read depending on story length
- Do NOT add any stage directions, sound effects, labels, or markdown
- Do NOT add introductions like "Welcome to..." or sign-offs like "This has been..."
- Just output the pure narration text, ready to be spoken aloud
- Be accurate — only use information from the provided story content, never invent facts`,
        },
        {
          role: 'user',
          content: storyContent,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    })

    return response.choices[0]?.message?.content?.trim() || null
  } catch (err) {
    console.error('  GPT error:', err.message)
    return null
  }
}

// ============================================
// Speech Generation (OpenAI TTS-HD)
// ============================================

async function generateSpeech(narrationText) {
  const response = await openai.audio.speech.create({
    model: TTS_MODEL,
    voice: TTS_VOICE,
    input: narrationText,
  })

  const buffer = Buffer.from(await response.arrayBuffer())
  const fileName = `audio_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.mp3`
  const filePath = path.join(os.tmpdir(), fileName)

  fs.writeFileSync(filePath, buffer)
  return filePath
}

// ============================================
// Storage Upload
// ============================================

async function uploadAudio(objectPath, filePath) {
  const fileBuffer = fs.readFileSync(filePath)

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(objectPath, fileBuffer, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'audio/mpeg',
    })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath)
  return data.publicUrl
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
