import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { corsHeaders } from '@/lib/supabase/api-helpers'

/**
 * GET /api/authors
 *
 * Public endpoint to list all authors.
 *
 * Query params:
 *   - page (default: 1)
 *   - limit (default: 50, max: 100)
 *
 * Returns: { authors: [...], pagination: { page, limit, total, total_pages } }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
  const offset = (page - 1) * limit

  try {
    const { data: authors, error, count } = await supabase
      .from('authors')
      .select(`
        id,
        author_first_name,
        author_last_name,
        author_bio,
        author_role,
        author_organization,
        author_email,
        author_avatar,
        author_cover,
        author_twitter,
        author_linked_in,
        created_at
      `, { count: 'exact' })
      .order('author_first_name', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders })
    }

    const result = (authors || []).map((author: any) => ({
      id: author.id,
      first_name: author.author_first_name || null,
      last_name: author.author_last_name || null,
      name: `${author.author_first_name || ''} ${author.author_last_name || ''}`.trim(),
      bio: author.author_bio || null,
      role: author.author_role || null,
      organization: author.author_organization || null,
      email: author.author_email || null,
      avatar_url: author.author_avatar || null,
      cover_url: author.author_cover || null,
      twitter: author.author_twitter || null,
      linkedin: author.author_linked_in || null,
      created_at: author.created_at,
    }))

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      authors: result,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    }, { headers: corsHeaders })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500, headers: corsHeaders })
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}
