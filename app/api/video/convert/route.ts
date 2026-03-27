import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { execFile } from 'child_process'

const CONVERSION_TIMEOUT_MS = 30_000

export async function POST(request: NextRequest) {
  const id = randomUUID()
  const inputPath = join(tmpdir(), `input-${id}.webm`)
  const outputPath = join(tmpdir(), `output-${id}.mp4`)

  try {
    const formData = await request.formData()
    const file = formData.get('video') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(inputPath, buffer)

    // Convert WebM (VP9/Opus) → MP4 (H.264/AAC)
    await new Promise<void>((resolve, reject) => {
      const args = [
        '-i', inputPath,
        '-c:v', 'libx264',        // H.264 video codec
        '-preset', 'fast',         // Fast encoding
        '-crf', '23',              // Quality
        '-c:a', 'aac',             // AAC audio codec
        '-b:a', '128k',            // Audio bitrate
        '-movflags', '+faststart', // Streaming-friendly
        '-pix_fmt', 'yuv420p',     // Max compatibility
        '-y',                      // Overwrite output
        outputPath,
      ]

      const proc = execFile('ffmpeg', args, { timeout: CONVERSION_TIMEOUT_MS }, (error, stdout, stderr) => {
        if (error) {
          console.error('[video/convert] FFmpeg error:', error.message)
          console.error('[video/convert] FFmpeg stderr:', stderr)
          reject(new Error(`FFmpeg conversion failed: ${error.message}`))
        } else {
          console.log('[video/convert] Conversion complete')
          resolve()
        }
      })

      proc.on('error', (err) => {
        reject(new Error(`Failed to start ffmpeg: ${err.message}. Is ffmpeg installed?`))
      })
    })

    const mp4Buffer = await fs.readFile(outputPath)

    return new NextResponse(mp4Buffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': mp4Buffer.length.toString(),
      },
    })
  } catch (err: any) {
    console.error('[video/convert] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Conversion failed' },
      { status: 500 }
    )
  } finally {
    await fs.unlink(inputPath).catch(() => {})
    await fs.unlink(outputPath).catch(() => {})
  }
}
