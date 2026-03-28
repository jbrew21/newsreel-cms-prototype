/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SlideMedia {
  url: string
  media_type: 'image' | 'video' | string
  role: string
}

interface CmsSlide {
  id: string
  slide_index: number
  slide_headline_1: string | null
  slide_content_1: string | null
  slide_headline_2: string | null
  slide_content_2: string | null
  slide_quote: string | null
  slide_media_source: string | null
  portrait_video: boolean
  media: SlideMedia[]
  captions: Array<{ start: number; end: number; text: string }> | null
}

interface CmsAuthor {
  id: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  role: string | null
  organization: string | null
}

interface CmsQuiz {
  id: string
  question: string
  answer_a: string
  answer_b: string | null
  answer_c: string | null
  answer_d: string | null
}

interface CmsPoll {
  id: string
  question: string
  econ_weight: number | null
  social_weight: number | null
  importance: number | null
}

interface CmsStory {
  id: string
  story_headline: string
  subhead: string | null
  story_media_source: string | null
  partner_name: string | null
  partner_article_link: string | null
  cover: { url: string | null; media_type: string | null } | null
  authors: CmsAuthor[]
  slides: CmsSlide[]
  quiz: CmsQuiz | null
  poll: CmsPoll | null
}

type VirtualSlide =
  | { type: 'intro'; key: 'intro' }
  | { type: 'content'; slide: CmsSlide; key: string }
  | { type: 'quiz'; quiz: CmsQuiz; key: 'quiz' }
  | { type: 'poll'; poll: CmsPoll; key: 'poll' }

// ─── Shared helpers ───────────────────────────────────────────────────────────

function authorDisplayName(authors: CmsAuthor[]): string {
  if (!authors.length) return ''
  const p = authors[0]
  const base = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
  return authors.length === 1
    ? base
    : `${base} and ${authors.length - 1} other${authors.length > 2 ? 's' : ''}`
}

// ─── Author Badge — content slides (28px avatars, glass pill) ─────────────────

function AuthorBadge({ authors }: { authors: CmsAuthor[] }) {
  if (!authors.length) return null
  const name = authorDisplayName(authors)
  const avatarGroupWidth = 28 + (Math.min(authors.length, 3) - 1) * 8.4

  return (
    <div
      style={{
        position: 'absolute',
        left: 20,
        bottom: 20,
        maxWidth: '70%',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        padding: '6px 10px',
        borderRadius: 20,
        background: 'rgba(0,0,0,0.15)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        zIndex: 20,
      }}
    >
      <div style={{ position: 'relative', width: avatarGroupWidth, height: 28, marginRight: 8, flexShrink: 0 }}>
        {authors.slice(0, 3).map((a, i) => (
          <div
            key={a.id}
            style={{
              position: 'absolute',
              left: i * 28 * 0.3,
              width: 28,
              height: 28,
              borderRadius: '50%',
              overflow: 'hidden',
              background: '#1F1F1F',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 3 - i,
              border: '1.5px solid rgba(255,255,255,0.15)',
            }}
          >
            {a.avatar_url ? (
              <img src={a.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: '#FFF', fontSize: 10, fontWeight: 600, lineHeight: 1 }}>
                {(a.first_name?.[0] ?? '').toUpperCase()}{(a.last_name?.[0] ?? '').toUpperCase()}
              </span>
            )}
          </div>
        ))}
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, color: '#FFF', fontFamily: '"DM Sans",sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
        {name}
      </span>
    </div>
  )
}

// ─── Author Byline — intro slide (45px avatars, newsreelRed) ─────────────────

function AuthorByline({ authors }: { authors: CmsAuthor[] }) {
  if (!authors.length) return null
  const name = authorDisplayName(authors)
  const avatarGroupWidth = 45 + (Math.min(authors.length, 3) - 1) * 13.5

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: avatarGroupWidth, height: 45, flexShrink: 0 }}>
        {authors.slice(0, 3).map((a, i) => (
          <div
            key={a.id}
            style={{
              position: 'absolute',
              left: i * 45 * 0.3,
              width: 45,
              height: 45,
              borderRadius: '50%',
              overflow: 'hidden',
              background: '#1F1F1F',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 3 - i,
              border: '2px solid #000',
            }}
          >
            {a.avatar_url ? (
              <img src={a.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: '#FFF', fontSize: 14, fontWeight: 600, lineHeight: 1 }}>
                {(a.first_name?.[0] ?? '').toUpperCase()}{(a.last_name?.[0] ?? '').toUpperCase()}
              </span>
            )}
          </div>
        ))}
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#FF6343', fontFamily: '"DM Sans",sans-serif', textDecoration: 'underline' }}>
        By {name}
      </span>
    </div>
  )
}

// ─── Chat Bubble — content slides ─────────────────────────────────────────────

function ChatBubble({ slide }: { slide: CmsSlide }) {
  const hasContent1 = !!slide.slide_content_1
  const headline = hasContent1 ? slide.slide_headline_1 : slide.slide_headline_2
  const body = hasContent1 ? slide.slide_content_1 : slide.slide_content_2
  if (!headline && !body) return null

  return (
    <div
      style={{
        background: 'rgba(30,58,95,0.4)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderRadius: 16,
        padding: 16,
        maxWidth: '87%',
        boxShadow: '0 4px 8px rgba(0,0,0,0.4)',
        marginBottom: 16,
      }}
    >
      {headline && (
        <p style={{ fontSize: 20.8, lineHeight: '27.2px', fontWeight: 700, color: '#FFF', marginBottom: body ? 16 : 0, marginTop: 0, fontFamily: '"DM Sans",sans-serif' }}>
          {headline}
        </p>
      )}
      {body && (
        <p style={{ fontSize: 16, lineHeight: '21.6px', fontWeight: 400, color: '#FFF', fontFamily: '"DM Sans",sans-serif', margin: 0 }}>
          {body}
        </p>
      )}
    </div>
  )
}

// ─── Source Label — content slides ───────────────────────────────────────────

function SourceLabel({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <span
      style={{
        position: 'absolute', left: 20, top: 78,
        fontSize: 12.5, lineHeight: '17.5px', color: '#F0F0F0',
        fontFamily: '"DM Sans",sans-serif', fontWeight: 400,
        zIndex: 10, pointerEvents: 'none',
      }}
    >
      {text}
    </span>
  )
}

// ─── Content Slide Renderer ───────────────────────────────────────────────────

function ContentSlideRenderer({ slide, authors }: { slide: CmsSlide; authors: CmsAuthor[] }) {
  const heroMedia = slide.media.find((m) => m.role === 'hero') ?? slide.media[0] ?? null
  const isVideo = heroMedia?.media_type === 'video'
  const isPortrait = isVideo && slide.portrait_video

  // Mode C — portrait video fullscreen
  if (isPortrait && heroMedia) {
    return (
      <>
        <video src={heroMedia.url} autoPlay loop muted playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }} />
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%',
          background: 'linear-gradient(to bottom,transparent,rgba(0,0,0,0.6) 60%,rgba(0,0,0,0.85))',
          zIndex: 2, pointerEvents: 'none',
        }} />
        <SourceLabel text={slide.slide_media_source} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-start', paddingBottom: 80, paddingLeft: 16, paddingRight: 16, zIndex: 10 }}>
          <ChatBubble slide={slide} />
        </div>
        <AuthorBadge authors={authors} />
      </>
    )
  }

  // Mode A/B — image or landscape video
  return (
    <>
      {heroMedia && (
        <>
          {isVideo ? (
            <video src={heroMedia.url} autoPlay loop muted playsInline
              style={{ position: 'absolute', top: 64, left: 0, width: '100%', height: 'calc(100% - 64px)', objectFit: 'cover', zIndex: 0 }} />
          ) : (
            <img src={heroMedia.url} alt=""
              style={{ position: 'absolute', top: 64, left: 0, width: '100%', height: 'calc(100% - 64px)', objectFit: 'cover', zIndex: 0 }} />
          )}
          <div style={{
            position: 'absolute', top: 64, left: 0, right: 0, bottom: 0,
            backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            background: 'rgba(0,0,0,0.6)', zIndex: 1, pointerEvents: 'none',
          }} />
        </>
      )}
      <SourceLabel text={slide.slide_media_source} />
      {heroMedia && (
        <div style={{ position: 'absolute', top: 130, left: 0, right: 0, zIndex: 5 }}>
          {isVideo ? (
            <video src={heroMedia.url} autoPlay loop muted playsInline
              style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
          ) : (
            <img src={heroMedia.url} alt=""
              style={{ width: '100%', objectFit: 'contain', display: 'block' }} />
          )}
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-start', paddingBottom: 80, paddingLeft: 16, paddingRight: 16, zIndex: 10 }}>
        <ChatBubble slide={slide} />
      </div>
      <AuthorBadge authors={authors} />
    </>
  )
}

// ─── Story Intro Slide ────────────────────────────────────────────────────────

function StoryIntroSlide({ story }: { story: CmsStory }) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        background: '#000000',
        overflowY: 'auto', overflowX: 'hidden',
        paddingTop: 80, paddingBottom: 48, paddingLeft: 16, paddingRight: 16,
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* 1:1 hero — image or video */}
      {story.cover?.url && (
        <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', marginBottom: 8, flexShrink: 0 }}>
          {story.cover.media_type === 'video' ? (
            <video
              src={story.cover.url}
              autoPlay
              loop
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <img
              src={story.cover.url}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
        </div>
      )}

      {/* Source credit */}
      <p style={{
        fontSize: 12, color: '#F0F0F0', textAlign: 'center',
        fontFamily: '"DM Sans",sans-serif', fontWeight: 400,
        margin: 0, marginBottom: 24,
        minHeight: 16,
      }}>
        {story.story_media_source ?? ''}
      </p>

      {/* Headline — serif */}
      <p style={{
        fontSize: 32, lineHeight: '1.25', fontWeight: 700,
        color: '#FFFFFF', textAlign: 'center',
        fontFamily: 'var(--font-playfair),Georgia,"Times New Roman",serif',
        margin: 0, marginBottom: 30,
      }}>
        {story.story_headline}
      </p>

      {/* Subhead */}
      {story.subhead && (
        <p style={{
          fontSize: 15, lineHeight: '1.5', color: 'rgba(255,255,255,0.75)',
          textAlign: 'center', fontFamily: '"DM Sans",sans-serif', fontWeight: 400,
          margin: 0, marginBottom: 24,
        }}>
          {story.subhead}
        </p>
      )}

      {/* Author byline */}
      <AuthorByline authors={story.authors} />

      {/* Partner */}
      {story.partner_name && (
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: '#F0F0F0', fontFamily: '"DM Sans",sans-serif' }}>
            Read full story on{' '}
            <span style={{ color: '#FF6343', fontWeight: 700, textDecoration: 'underline' }}>
              {story.partner_name}
            </span>
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Quiz Slide ───────────────────────────────────────────────────────────────

function QuizSlide({ quiz }: { quiz: CmsQuiz }) {
  const [{ shuffledAnswers, mockPercentages }] = useState(() => {
    const answers = [
      { text: quiz.answer_a, isCorrect: true },
      ...(quiz.answer_b ? [{ text: quiz.answer_b, isCorrect: false }] : []),
      ...(quiz.answer_c ? [{ text: quiz.answer_c, isCorrect: false }] : []),
      ...(quiz.answer_d ? [{ text: quiz.answer_d, isCorrect: false }] : []),
    ]
    // Fisher-Yates shuffle
    for (let i = answers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[answers[i], answers[j]] = [answers[j], answers[i]]
    }
    const correctIdx = answers.findIndex((a) => a.isCorrect)
    const base = answers.map((_, i) =>
      i === correctIdx ? 50 + Math.floor(Math.random() * 10) : Math.floor(Math.random() * 18) + 5
    )
    const sum = base.reduce((a, b) => a + b, 0)
    const percentages = base.map((v) => Math.round((v / sum) * 100))
    return { shuffledAnswers: answers, mockPercentages: percentages }
  })

  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        background: '#000000',
        overflowY: 'auto', overflowX: 'hidden',
        paddingTop: 80, paddingBottom: 40, paddingLeft: 20, paddingRight: 20,
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Question */}
      <p style={{
        fontSize: 18, lineHeight: '1.55', color: '#F0F0F0', textAlign: 'center',
        fontFamily: '"DM Sans",sans-serif', fontWeight: 400,
        margin: 0, marginBottom: 24,
      }}>
        {quiz.question}
      </p>

      {/* Answer options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {shuffledAnswers.map((answer, i) => {
          let bgColor = '#1F1F1F'
          let borderStyle = '1px solid #898989'

          if (submitted) {
            if (answer.isCorrect) {
              bgColor = 'rgba(34,197,94,0.3)'
              borderStyle = '2px solid #22C55E'
            } else if (i === selected) {
              bgColor = 'rgba(239,68,68,0.3)'
              borderStyle = '2px solid #EF4444'
            } else {
              bgColor = 'rgba(239,68,68,0.08)'
            }
          } else if (i === selected) {
            borderStyle = '2px solid #E0E0E0'
          }

          return (
            <button
              key={i}
              onClick={() => !submitted && setSelected(i)}
              style={{
                background: bgColor,
                border: borderStyle,
                borderRadius: 16,
                padding: '12px 16px',
                minHeight: 48,
                cursor: submitted ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
                textAlign: 'left',
                transition: 'background 0.3s ease, border 0.2s ease',
              }}
            >
              {/* Community % fill sweep */}
              {submitted && (
                <div
                  style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${mockPercentages[i]}%`,
                    background: answer.isCorrect ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.1)',
                    transition: 'width 0.6s ease',
                    pointerEvents: 'none',
                  }}
                />
              )}

              <span style={{ fontSize: 14, color: '#FFF', fontFamily: '"DM Sans",sans-serif', fontWeight: 400, position: 'relative', zIndex: 1, lineHeight: 1.4 }}>
                {answer.text}
              </span>

              {submitted && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 8, position: 'relative', zIndex: 1 }}>
                  <span style={{ fontSize: 13, color: '#FFF', fontFamily: 'var(--font-ibm-plex-mono),"IBM Plex Mono",monospace', fontWeight: 600 }}>
                    {mockPercentages[i]}%
                  </span>
                  <span style={{ fontSize: 13, color: answer.isCorrect ? '#22C55E' : '#EF4444', fontWeight: 700 }}>
                    {answer.isCorrect ? '✓' : '✗'}
                  </span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Submit / Continue */}
      {selected !== null && (
        <button
          onClick={() => !submitted && setSubmitted(true)}
          style={{
            background: '#FF6343',
            border: 'none',
            borderRadius: 8,
            height: 60,
            cursor: 'pointer',
            fontFamily: 'var(--font-ibm-plex-mono),"IBM Plex Mono",monospace',
            fontSize: 16,
            fontWeight: 700,
            color: '#000',
            width: '100%',
            flexShrink: 0,
            letterSpacing: '0.05em',
          }}
        >
          {submitted ? 'CONTINUE →' : 'SUBMIT'}
        </button>
      )}
    </div>
  )
}

// ─── Poll Slide ───────────────────────────────────────────────────────────────

const POLL_LABELS = ['Strongly\nDisagree', 'Disagree', 'Neutral', 'Agree', 'Strongly\nAgree']
const MOCK_POLL_DATA = [8, 15, 23, 46, 8]

function PollSlide({ poll }: { poll: CmsPoll }) {
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)

  const selectPosition = (pos: number) => {
    setSelected(pos)
    setSubmitted(true)
  }

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = (e.clientX - rect.left) / rect.width
    selectPosition(Math.max(0, Math.min(4, Math.round(x * 4))))
  }

  const maxPct = Math.max(...MOCK_POLL_DATA)

  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        background: '#000000',
        overflowY: 'auto', overflowX: 'hidden',
        paddingTop: 80, paddingBottom: 40, paddingLeft: 20, paddingRight: 20,
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* "Where do you stand?" — serif */}
      <p style={{
        fontSize: 28, lineHeight: '1.2', fontWeight: 700, color: '#FFFFFF', textAlign: 'center',
        fontFamily: 'var(--font-playfair),Georgia,"Times New Roman",serif',
        margin: 0, marginBottom: 16,
      }}>
        Where do you stand?
      </p>

      {/* Poll question */}
      <p style={{
        fontSize: 16, lineHeight: '1.55', color: '#F0F0F0', textAlign: 'center',
        fontFamily: '"DM Sans",sans-serif', fontWeight: 400,
        margin: 0, marginBottom: 28,
      }}>
        {poll.question}
      </p>

      {/* Bar chart */}
      <div style={{ height: 160, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', marginBottom: 16, gap: 4 }}>
        {MOCK_POLL_DATA.map((pct, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%' }}>
            <span style={{
              fontSize: 12, color: '#FFF', fontWeight: 600,
              fontFamily: '"DM Sans",sans-serif',
              opacity: submitted ? 1 : 0,
              transition: 'opacity 0.3s ease 0.2s',
            }}>
              {pct}%
            </span>
            <div style={{
              width: '60%',
              height: submitted ? `${Math.max(8, (pct / maxPct) * 120)}px` : '4px',
              background: i === selected ? '#FFD700' : 'rgba(255,255,255,0.3)',
              borderRadius: 4,
              transition: 'height 0.5s ease, background 0.3s ease',
            }} />
          </div>
        ))}
      </div>

      {/* Slider track */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        style={{
          background: '#1F1F1F',
          borderRadius: 8,
          height: 85,
          position: 'relative',
          cursor: 'pointer',
          marginBottom: 12,
          userSelect: 'none',
        }}
      >
        {/* Gold center line */}
        <div style={{
          position: 'absolute', top: '50%', left: 12, right: 12,
          height: 1, background: '#FFD700',
          transform: 'translateY(-50%)', pointerEvents: 'none',
        }} />

        {/* Tick marks × 5 */}
        {[0, 1, 2, 3, 4].map((pos) => {
          const isSelected = selected === pos
          // offset first/last ticks to align with the gold line endpoints
          const leftPct = pos === 0 ? 0 : pos === 4 ? 100 : (pos / 4) * 100
          const leftAdjust = pos === 0 ? 12 : pos === 4 ? -12 : 0
          return (
            <div
              key={pos}
              style={{
                position: 'absolute',
                top: '50%',
                left: `calc(${leftPct}% + ${leftAdjust}px)`,
                transform: 'translateX(-50%) translateY(-50%)',
                width: isSelected ? 8 : 2,
                height: isSelected ? 28 : 18,
                background: isSelected ? '#FFD700' : 'rgba(255,255,255,0.3)',
                borderRadius: 2,
                transition: 'all 0.2s ease',
                pointerEvents: 'none',
              }}
            />
          )
        })}
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        {POLL_LABELS.map((label, i) => (
          <span
            key={i}
            style={{
              fontSize: 10, textAlign: 'center',
              color: selected === i ? '#FFD700' : 'rgba(255,255,255,0.6)',
              fontFamily: '"DM Sans",sans-serif',
              fontWeight: selected === i ? 600 : 400,
              maxWidth: 52, lineHeight: '1.2',
              whiteSpace: 'pre-line',
              transition: 'color 0.2s ease',
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Prompt */}
      <p style={{
        fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center',
        fontFamily: '"DM Sans",sans-serif', fontStyle: 'italic',
        margin: 0, marginBottom: submitted ? 10 : 0,
      }}>
        {submitted ? 'Tap or slide to change your response' : 'Tap to select your response'}
      </p>

      {submitted && (
        <p style={{
          fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center',
          fontFamily: '"DM Sans",sans-serif', margin: 0,
        }}>
          1,247 people have answered this poll
        </p>
      )}
    </div>
  )
}

// ─── Slide Dispatcher ─────────────────────────────────────────────────────────

function SlideDispatcher({ virtualSlide, story }: { virtualSlide: VirtualSlide; story: CmsStory }) {
  if (virtualSlide.type === 'intro') return <StoryIntroSlide story={story} />
  if (virtualSlide.type === 'content') return <ContentSlideRenderer slide={virtualSlide.slide} authors={story.authors} />
  if (virtualSlide.type === 'quiz') return <QuizSlide quiz={virtualSlide.quiz} />
  if (virtualSlide.type === 'poll') return <PollSlide poll={virtualSlide.poll} />
  return null
}

// ─── Main Export ──────────────────────────────────────────────────────────────

interface MobileSlidePreviewProps {
  storyId: string
}

export function MobileSlidePreview({ storyId }: MobileSlidePreviewProps) {
  const [story, setStory] = useState<CmsStory | null>(null)
  const [loadingStory, setLoadingStory] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    setLoadingStory(true)
    setFetchError(null)
    fetch(`/api/stories/${storyId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.story) setStory(data.story)
        else setFetchError('Story not found')
      })
      .catch(() => setFetchError('Failed to load preview'))
      .finally(() => setLoadingStory(false))
  }, [storyId])

  const virtualSlides: VirtualSlide[] = story
    ? [
        { type: 'intro', key: 'intro' },
        ...story.slides.map((s) => ({ type: 'content' as const, slide: s, key: s.id })),
        ...(story.quiz ? [{ type: 'quiz' as const, quiz: story.quiz, key: 'quiz' as const }] : []),
        ...(story.poll ? [{ type: 'poll' as const, poll: story.poll, key: 'poll' as const }] : []),
      ]
    : []

  const total = virtualSlides.length

  const goPrev = useCallback(() => setCurrentIndex((i) => Math.max(0, i - 1)), [])
  const goNext = useCallback(() => setCurrentIndex((i) => Math.min(total - 1, i + 1)), [total])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, goNext])

  useEffect(() => { setCurrentIndex(0) }, [storyId])

  if (loadingStory) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (fetchError || !story) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        {fetchError ?? 'Could not load preview'}
      </div>
    )
  }

  if (!virtualSlides.length) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        No slides to preview
      </div>
    )
  }

  const currentVSlide = virtualSlides[currentIndex]
  const progress = (currentIndex + 1) / total

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Phone frame */}
      <div
        style={{
          width: 375,
          height: 812,
          background: '#000000',
          borderRadius: 44,
          overflow: 'hidden',
          position: 'relative',
          flexShrink: 0,
          boxShadow: '0 0 0 1px rgba(255,255,255,0.08),0 24px 64px rgba(0,0,0,0.45),0 8px 24px rgba(0,0,0,0.3)',
        }}
      >
        {/* Progress bar */}
        <div
          style={{
            position: 'absolute', top: 64, left: 0, right: 0,
            height: 7, background: 'rgba(255,255,255,0.2)',
            zIndex: 50, pointerEvents: 'none',
          }}
        >
          <div style={{ height: '100%', width: `${progress * 100}%`, background: '#FFFFFF', transition: 'width 0.25s ease' }} />
        </div>

        {/* Slide content */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <SlideDispatcher key={currentVSlide.key} virtualSlide={currentVSlide} story={story} />
        </div>
      </div>

      {/* Navigation controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className={cn('flex h-8 w-8 items-center justify-center rounded-full border border-border transition-colors', 'hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30')}
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[80px] text-center text-sm tabular-nums text-muted-foreground">
          Slide {currentIndex + 1} of {total}
        </span>
        <button
          onClick={goNext}
          disabled={currentIndex === total - 1}
          className={cn('flex h-8 w-8 items-center justify-center rounded-full border border-border transition-colors', 'hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30')}
          aria-label="Next slide"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
