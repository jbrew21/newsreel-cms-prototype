#!/usr/bin/env node

/**
 * One-time backfill script: Extract captions for all existing video slides.
 * Run from project root: node scripts/backfill-captions.js
 *
 * Safe to run multiple times — skips slides that already have captions.
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

async function main() {
  console.log('=== Caption Backfill ===\n')
  console.log('Fetching all stories...')

  const { data: stories, error } = await supabase
    .from('stories')
    .select('id, story_headline')
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

    const { data: slides, error: slideError } = await supabase
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
            id, bucket, object_path, media_type, mime_type, duration_ms
          )
        )
      `)
      .eq('story_id', story.id)

    if (slideError || !slides?.length) {
      console.log('  No slides found, skipping\n')
      continue
    }

    let storyHasVideos = false

    for (const slide of slides) {
      if (slide.portrait_video) continue

      // Find video media asset
      const videoAsset = (slide.slide_media || [])
        .map(sm => sm.media_assets)
        .find(asset => asset?.media_type === 'video')

      if (!videoAsset) continue
      storyHasVideos = true

      // Resolve public URL
      const { data: urlData } = supabase.storage
        .from(videoAsset.bucket)
        .getPublicUrl(videoAsset.object_path)

      const videoUrl = urlData?.publicUrl
      if (!videoUrl) continue

      // Check if captions already exist
      const { data: existing } = await supabase
        .from('slide_captions')
        .select('id, video_url')
        .eq('slide_id', slide.id)
        .limit(1)

      if (existing?.length && existing[0].video_url === videoUrl) {
        console.log(`  Slide ${slide.id}: already has captions, skipping`)
        totalSkipped++
        continue
      }

      // Remove stale captions if video URL changed
      if (existing?.length) {
        await supabase.from('slide_captions').delete().eq('slide_id', slide.id)
      }

      // Download and process
      let videoPath = null
      try {
        console.log(`  Slide ${slide.id}: downloading video...`)
        const resp = await fetch(videoUrl)
        if (!resp.ok) throw new Error(`Download failed: ${resp.status}`)

        const buffer = Buffer.from(await resp.arrayBuffer())
        const fileName = `video_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.mp4`
        videoPath = path.join(os.tmpdir(), fileName)
        fs.writeFileSync(videoPath, buffer)

        const sizeMB = buffer.length / (1024 * 1024)
        console.log(`  Slide ${slide.id}: ${sizeMB.toFixed(1)} MB`)

        let transcript = ''
        let captions

        if (sizeMB > 25) {
          console.log(`  Slide ${slide.id}: too large for Whisper, using fallback`)
          captions = generateFallbackCaptions(videoUrl)
          transcript = captions[0].text
        } else {
          try {
            console.log(`  Slide ${slide.id}: transcribing with Whisper...`)
            const result = await openai.audio.transcriptions.create({
              file: fs.createReadStream(videoPath),
              model: 'whisper-1',
              response_format: 'text',
              language: 'en',
            })

            transcript = typeof result === 'string' ? result : (result?.text || '')

            if (!transcript.trim()) {
              console.log(`  Slide ${slide.id}: empty transcript, using fallback`)
              captions = generateFallbackCaptions(videoUrl)
              transcript = captions[0].text
            } else {
              const durationSec = videoAsset.duration_ms ? videoAsset.duration_ms / 1000 : 60
              captions = processTranscript(transcript, durationSec)
              console.log(`  Slide ${slide.id}: ${captions.length} caption segments`)
            }
          } catch (err) {
            console.warn(`  Slide ${slide.id}: Whisper failed: ${err.message}`)
            captions = generateFallbackCaptions(videoUrl)
            transcript = captions[0].text
          }
        }

        // Build slide_text
        const slideText = [slide.slide_content_1, slide.slide_content_2]
          .filter(t => typeof t === 'string' && t.length > 0)
          .join(' ')
          .trim() || transcript.substring(0, 100)

        // Save to slide_captions
        const { error: insertError } = await supabase
          .from('slide_captions')
          .insert({
            slide_id: slide.id,
            story_id: story.id,
            slide_text: slideText,
            video_url: videoUrl,
            transcript,
            captions,
          })

        if (insertError) {
          console.error(`  Slide ${slide.id}: SAVE FAILED: ${insertError.message}`)
          totalFailed++
        } else {
          console.log(`  Slide ${slide.id}: captions saved!`)
          totalProcessed++
        }

        // Delay between Whisper calls
        await new Promise(r => setTimeout(r, 1500))
      } catch (err) {
        console.error(`  Slide ${slide.id}: FAILED: ${err.message}`)
        totalFailed++
      } finally {
        if (videoPath && fs.existsSync(videoPath)) {
          fs.unlinkSync(videoPath)
        }
      }
    }

    if (!storyHasVideos) {
      console.log('  No video slides\n')
    } else {
      console.log('')
    }
  }

  console.log('=== BACKFILL COMPLETE ===')
  console.log(`Processed: ${totalProcessed}`)
  console.log(`Skipped:   ${totalSkipped}`)
  console.log(`Failed:    ${totalFailed}`)
}

// ---- Helper functions (same logic as extract-captions.ts) ----

function processTranscript(transcript, videoDuration) {
  videoDuration = videoDuration || 60
  let sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .filter(s => s && s.trim().length > 0)

  if (sentences.length <= 2 && transcript.length > 100) {
    sentences = transcript
      .split(/(?<=[.!?,])\s+|(?<=\s(?:and|but|or|yet|so))\s+/i)
      .filter(s => s && s.trim().length > 0)
  }

  const maxLength = 80
  const chunks = []
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

function calculateCaptionTiming(segments, videoDuration) {
  if (!segments.length) return []

  const totalReadingTime = segments.reduce((total, seg) => {
    const wordCount = seg.split(/\s+/).length
    return total + Math.max(1.5, wordCount * 0.3)
  }, 0)

  const scale = Math.max(1, videoDuration / totalReadingTime)
  const captions = []
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

function generateFallbackCaptions(videoUrl) {
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
  return [{ start: 0, end: 60000, text: options[Math.abs(hash) % options.length] }]
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
