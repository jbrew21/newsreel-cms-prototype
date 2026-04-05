/**
 * Story Audio Narration Module (Server-side only)
 *
 * Gathers story text, crafts a narration script with GPT-4o,
 * converts to speech with OpenAI TTS-HD, uploads MP3, and
 * saves to the story_audio table.
 *
 * IMPORTANT: This file uses Node.js APIs (fs, os, path) and must
 * only be imported in server-side code (API routes).
 */

import { supabase } from '../supabase/client'
import { getPublicUrl } from '../supabase/storage'
import OpenAI from 'openai'
import { writeFile, unlink, readFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const STORAGE_BUCKET = 'story-media'
const TTS_MODEL = 'tts-1-hd'
const TTS_VOICE = 'onyx'
const GPT_MODEL = 'gpt-4o'

// ============================================
// Main Entry Point
// ============================================

/**
 * Generate podcast-style audio narration for a story.
 * Skips if audio already exists and story text hasn't changed.
 */
export async function generateAudioForStory(storyId: string): Promise<void> {
  console.log(`[Audio] Starting narration generation for story ${storyId}`)

  let tempPath: string | null = null

  try {
    // Fetch story headline + subhead
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .select('id, story_headline, subhead')
      .eq('id', storyId)
      .single()

    if (storyError || !story) {
      console.log(`[Audio] Story not found: ${storyId}`)
      return
    }

    if (!story.story_headline) {
      console.log(`[Audio] No headline for story ${storyId}, skipping`)
      return
    }

    // Fetch all slides in order
    const { data: slides, error: slidesError } = await supabase
      .from('slides')
      .select('slide_index, slide_title, slide_headline_1, slide_content_1, slide_headline_2, slide_content_2, slide_quote')
      .eq('story_id', storyId)
      .order('slide_index', { ascending: true })

    if (slidesError || !slides?.length) {
      console.log(`[Audio] No slides found for story ${storyId}`)
      return
    }

    // Build a content fingerprint to detect changes
    const contentFingerprint = buildContentFingerprint(story, slides)

    // Check if audio already exists
    const { data: existing } = await supabase
      .from('story_audio')
      .select('id, narration_text, object_path')
      .eq('story_id', storyId)
      .limit(1)

    if (existing?.length) {
      // Compare fingerprint — if content hasn't changed, skip
      const existingFingerprint = existing[0].narration_text
        ? buildContentFingerprint(story, slides)
        : null

      if (existingFingerprint === contentFingerprint) {
        console.log(`[Audio] Audio already up to date for story ${storyId}`)
        return
      }

      // Content changed — remove stale audio
      console.log(`[Audio] Story content changed, regenerating audio for ${storyId}`)
      await supabase.storage.from(STORAGE_BUCKET).remove([existing[0].object_path])
      await supabase.from('story_audio').delete().eq('story_id', storyId)
    }

    // Step 1: Craft narration script with GPT-4o
    const narrationText = await buildNarrationScript(story.story_headline, story.subhead, slides)
    if (!narrationText) {
      console.warn(`[Audio] Failed to generate narration script for story ${storyId}`)
      return
    }

    console.log(`[Audio] Narration script ready (${narrationText.length} chars) for story ${storyId}`)

    // Step 2: Convert to speech with TTS-HD
    tempPath = await generateSpeech(narrationText)

    // Step 3: Upload MP3 to Supabase storage
    const objectPath = `stories/${storyId}/audio/narration.mp3`
    const audioUrl = await uploadAudioToStorage(objectPath, tempPath)

    // Step 4: Save record to story_audio table
    await saveStoryAudio({
      storyId,
      audioUrl,
      objectPath,
      narrationText,
      voice: TTS_VOICE,
    })

    console.log(`[Audio] Done for story ${storyId} — audio saved`)
  } catch (err) {
    console.error(`[Audio] Failed for story ${storyId}:`, err instanceof Error ? err.message : err)
  } finally {
    if (tempPath) {
      try { await unlink(tempPath) } catch {}
    }
  }
}

// ============================================
// Narration Script Generation (GPT-4o)
// ============================================

async function buildNarrationScript(
  headline: string,
  subhead: string | null,
  slides: SlideRow[]
): Promise<string | null> {
  const openai = new OpenAI({ apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY })

  // Build structured story content for the prompt
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
    const response = await Promise.race([
      openai.chat.completions.create({
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
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('GPT-4o timed out after 30s')), 30000)
      ),
    ])

    return response.choices[0]?.message?.content?.trim() || null
  } catch (err) {
    console.error('[Audio] GPT narration failed:', err instanceof Error ? err.message : err)
    return null
  }
}

// ============================================
// Speech Generation (OpenAI TTS-HD)
// ============================================

async function generateSpeech(narrationText: string): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY })

  const response = await Promise.race([
    openai.audio.speech.create({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: narrationText,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TTS API timed out after 60s')), 60000)
    ),
  ])

  const buffer = Buffer.from(await response.arrayBuffer())
  const fileName = `audio_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.mp3`
  const filePath = join(tmpdir(), fileName)

  await writeFile(filePath, buffer)
  return filePath
}

// ============================================
// Storage Upload
// ============================================

async function uploadAudioToStorage(objectPath: string, filePath: string): Promise<string> {
  const fileBuffer = await readFile(filePath)

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(objectPath, fileBuffer, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'audio/mpeg',
    })

  if (error) {
    throw new Error(`Failed to upload audio: ${error.message}`)
  }

  return getPublicUrl(STORAGE_BUCKET, objectPath)
}

// ============================================
// Save to Database
// ============================================

async function saveStoryAudio(params: {
  storyId: string
  audioUrl: string
  objectPath: string
  narrationText: string
  voice: string
}): Promise<void> {
  const { storyId, audioUrl, objectPath, narrationText, voice } = params

  const { error } = await supabase
    .from('story_audio')
    .insert({
      story_id: storyId,
      audio_url: audioUrl,
      bucket: STORAGE_BUCKET,
      object_path: objectPath,
      narration_text: narrationText,
      voice,
    })

  if (error) {
    throw new Error(`Failed to save story audio: ${error.message}`)
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
