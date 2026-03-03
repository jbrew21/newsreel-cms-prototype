/**
 * Video Caption Extraction Module (Server-side only)
 *
 * Downloads slide videos, transcribes with Whisper,
 * splits into timed caption segments, and saves to slide_captions.
 *
 * IMPORTANT: This file uses Node.js APIs (fs, os, path) and must
 * only be imported in server-side code (API routes).
 */

import { supabase } from '../supabase/client'
import OpenAI from 'openai'
import { writeFile, unlink } from 'fs/promises'
import { createReadStream, statSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

interface CaptionSegment {
  start: number
  end: number
  text: string
}

// ============================================
// Main Entry Point
// ============================================

/**
 * Extract captions for all video slides in a story.
 * Skips portrait videos and slides that already have captions.
 */
export async function extractCaptionsForStory(storyId: string): Promise<void> {
  console.log(`[Captions] Starting extraction for story ${storyId}`)

  const { data: slides, error } = await supabase
    .from('slides')
    .select(`
      id,
      slide_content_1,
      slide_content_2,
      portrait_video,
      slide_media (
        media_id,
        role,
        media_assets (
          id,
          bucket,
          object_path,
          media_type,
          mime_type,
          duration_ms
        )
      )
    `)
    .eq('story_id', storyId)

  if (error || !slides?.length) {
    console.log(`[Captions] No slides found for story ${storyId}`)
    return
  }

  let processed = 0

  for (const slide of slides) {
    // Skip portrait videos
    if (slide.portrait_video) continue

    // Find video media asset via slide_media → media_assets
    const videoAsset = (slide.slide_media || [])
      .map((sm: any) => sm.media_assets)
      .find((asset: any) => asset?.media_type === 'video')

    if (!videoAsset) continue

    // Resolve public URL
    const { data: urlData } = supabase.storage
      .from(videoAsset.bucket)
      .getPublicUrl(videoAsset.object_path)

    const videoUrl = urlData?.publicUrl
    if (!videoUrl) continue

    // Check if captions already exist for this slide
    const { data: existing } = await supabase
      .from('slide_captions')
      .select('id, video_url')
      .eq('slide_id', slide.id)
      .limit(1)

    if (existing?.length) {
      if (existing[0].video_url === videoUrl) {
        // Same video URL — captions already up to date
        continue
      }
      // Video changed — remove stale captions
      await supabase.from('slide_captions').delete().eq('slide_id', slide.id)
    }

    await processSlideVideo({
      slideId: slide.id,
      storyId,
      videoUrl,
      slideContent1: slide.slide_content_1 as string | null,
      slideContent2: slide.slide_content_2 as string | null,
      durationMs: videoAsset.duration_ms as number | null,
    })

    processed++

    // Small delay between slides to respect API rate limits
    await new Promise(r => setTimeout(r, 1000))
  }

  console.log(`[Captions] Done for story ${storyId} — ${processed} video(s) processed`)
}

// ============================================
// Process a Single Slide Video
// ============================================

async function processSlideVideo(params: {
  slideId: string
  storyId: string
  videoUrl: string
  slideContent1: string | null
  slideContent2: string | null
  durationMs: number | null
}): Promise<void> {
  const { slideId, storyId, videoUrl, slideContent1, slideContent2, durationMs } = params
  let videoPath: string | null = null

  try {
    // Download video to temp file
    videoPath = await downloadVideo(videoUrl)

    // Check file size — Whisper limit is 25 MB
    const stats = statSync(videoPath)
    const sizeMB = stats.size / (1024 * 1024)

    if (sizeMB > 25) {
      console.warn(`[Captions] Video too large (${sizeMB.toFixed(1)}MB) for slide ${slideId}, using fallback`)
      const captions = generateFallbackCaptions(videoUrl)
      await saveCaptions({ slideId, storyId, videoUrl, slideContent1, slideContent2, transcript: captions[0].text, captions })
      return
    }

    // Transcribe with Whisper
    let transcript = ''
    let captions: CaptionSegment[]

    try {
      const openai = new OpenAI({ apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY })

      const result = await Promise.race([
        openai.audio.transcriptions.create({
          file: createReadStream(videoPath),
          model: 'whisper-1',
          response_format: 'text',
          language: 'en',
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Whisper API timed out after 60s')), 60000)
        ),
      ])

      // SDK returns string when response_format is 'text'
      transcript = typeof result === 'string' ? result : (result as any)?.text || ''

      if (!transcript.trim()) {
        captions = generateFallbackCaptions(videoUrl)
        transcript = captions[0].text
      } else {
        const durationSec = durationMs ? durationMs / 1000 : 60
        captions = processTranscript(transcript, durationSec)
      }
    } catch (err) {
      console.warn(`[Captions] Whisper failed for slide ${slideId}:`, err instanceof Error ? err.message : err)
      captions = generateFallbackCaptions(videoUrl)
      transcript = captions[0].text
    }

    // Save to slide_captions table
    await saveCaptions({ slideId, storyId, videoUrl, slideContent1, slideContent2, transcript, captions })
    console.log(`[Captions] Saved captions for slide ${slideId}`)
  } catch (err) {
    console.error(`[Captions] Failed for slide ${slideId}:`, err instanceof Error ? err.message : err)
  } finally {
    // Always clean up temp file
    if (videoPath) {
      try { await unlink(videoPath) } catch {}
    }
  }
}

// ============================================
// Video Download
// ============================================

async function downloadVideo(videoUrl: string): Promise<string> {
  const response = await fetch(videoUrl)
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status} ${response.statusText}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const fileName = `video_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.mp4`
  const filePath = join(tmpdir(), fileName)

  await writeFile(filePath, buffer)
  return filePath
}

// ============================================
// Transcript Processing
// ============================================

/**
 * Split transcript into timed caption segments.
 * Order = sentence/chunk order in the transcript.
 * Timing = estimated from word count, scaled to fit video duration.
 */
function processTranscript(transcript: string, videoDuration: number = 60): CaptionSegment[] {
  // Step 1: Split into sentences
  let sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .filter(s => s && s.trim().length > 0)

  // Step 2: If very few sentences, split on commas and conjunctions
  if (sentences.length <= 2 && transcript.length > 100) {
    sentences = transcript
      .split(/(?<=[.!?,])\s+|(?<=\s(?:and|but|or|yet|so))\s+/i)
      .filter(s => s && s.trim().length > 0)
  }

  // Step 3: Break long segments into word-based chunks (max 80 chars)
  const maxLength = 80
  const chunks: string[] = []

  for (const sentence of sentences) {
    if (sentence.length <= maxLength) {
      chunks.push(sentence.trim())
    } else {
      const words = sentence.split(/\s+/)
      let current = ''

      for (const word of words) {
        if ((current + ' ' + word).length <= maxLength) {
          current += (current ? ' ' : '') + word
        } else {
          if (current) chunks.push(current.trim())
          current = word
        }
      }
      if (current) chunks.push(current.trim())
    }
  }

  return calculateCaptionTiming(chunks, videoDuration)
}

/**
 * Assign start/end timestamps (ms) to each caption segment.
 * Reading time per segment: wordCount * 0.3s, min 1.5s, cap 8s.
 * Scaled so all segments fit within the video duration.
 */
function calculateCaptionTiming(segments: string[], videoDuration: number): CaptionSegment[] {
  if (!segments.length) return []

  // Sum up estimated reading time
  const totalReadingTime = segments.reduce((total, seg) => {
    const wordCount = seg.split(/\s+/).length
    return total + Math.max(1.5, wordCount * 0.3)
  }, 0)

  // Scale factor so captions span the full video
  const scale = Math.max(1, videoDuration / totalReadingTime)

  const captions: CaptionSegment[] = []
  let currentTime = 0

  for (const text of segments) {
    const wordCount = text.split(/\s+/).length
    const baseMs = Math.max(1500, wordCount * 300)
    const displayMs = Math.min(baseMs * scale, 8000)

    captions.push({
      start: Math.round(currentTime),
      end: Math.round(currentTime + displayMs),
      text,
    })

    currentTime += displayMs
  }

  return captions
}

// ============================================
// Fallback Captions
// ============================================

function generateFallbackCaptions(videoUrl: string): CaptionSegment[] {
  let hash = 0
  for (let i = 0; i < videoUrl.length; i++) {
    hash = ((hash << 5) - hash) + videoUrl.charCodeAt(i)
    hash = hash & hash
  }

  const options = [
    'This video shows important content related to the news story.',
    'The video demonstrates key aspects discussed in the article.',
    'Visual content supporting the main points of the story.',
    'This clip illustrates events mentioned in the article.',
  ]

  return [{
    start: 0,
    end: 60000,
    text: options[Math.abs(hash) % options.length],
  }]
}

// ============================================
// Save to Supabase
// ============================================

async function saveCaptions(params: {
  slideId: string
  storyId: string
  videoUrl: string
  slideContent1: string | null
  slideContent2: string | null
  transcript: string
  captions: CaptionSegment[]
}): Promise<void> {
  const { slideId, storyId, videoUrl, slideContent1, slideContent2, transcript, captions } = params

  // Build slide_text from content fields, fall back to transcript excerpt
  const slideText = [slideContent1, slideContent2]
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
    .join(' ')
    .trim() || transcript.substring(0, 100)

  const { error } = await supabase
    .from('slide_captions')
    .insert({
      slide_id: slideId,
      story_id: storyId,
      slide_text: slideText,
      video_url: videoUrl,
      transcript,
      captions,
    })

  if (error) {
    throw new Error(`Failed to save captions: ${error.message}`)
  }
}
