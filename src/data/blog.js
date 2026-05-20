import { supabase } from '../lib/supabase'

export const slugify = (text) =>
  text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

export const BLOG_CATEGORIES = [
  { name: 'Study Tips', slug: 'study-tips', color: '#3b82f6' },
  { name: 'Writing Guides', slug: 'writing-guides', color: '#8b5cf6' },
  { name: 'Programming', slug: 'programming', color: '#ec4899' },
  { name: 'Career & Future', slug: 'career', color: '#f59e0b' },
  { name: 'Student Life', slug: 'student-life', color: '#10b981' },
  { name: 'Subject Help', slug: 'subject-help', color: '#06b6d4' }
]

// ===== POST OPERATIONS =====

export const getAllPosts = async () => {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .order('published_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching all posts:', error)
    return []
  }
  return data
}

export const getPublishedPosts = async () => {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (error) {
    console.error('Error fetching published posts:', error)
    return []
  }
  // Convert Supabase DB snake_case fields to camelCase where frontend expects it
  return data.map(post => ({
    ...post,
    coverImage: post.cover_image,
    authorAvatar: post.author_avatar,
    authorBio: post.author_bio,
    readTime: post.read_time,
    publishedAt: post.published_at
  }))
}

export const getPostBySlug = async (slug) => {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !data) return null
  
  return {
    ...data,
    coverImage: data.cover_image,
    authorAvatar: data.author_avatar,
    authorBio: data.author_bio,
    readTime: data.read_time,
    publishedAt: data.published_at
  }
}

export const getRelatedPosts = async (currentSlug, limit = 3) => {
  const current = await getPostBySlug(currentSlug)
  if (!current) return []

  const allPublished = await getPublishedPosts()
  
  return allPublished
    .filter(p => p.slug !== currentSlug)
    .map(p => {
      let score = 0
      if (p.category === current.category) score += 5
      const currentTags = current.tags || []
      const pTags = p.tags || []
      const sharedTags = pTags.filter(t => currentTags.includes(t)).length
      score += sharedTags * 2
      return { ...p, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// Dummy exports to prevent assignpro's internal AdminDashboard from crashing
// (The real admin dashboard is now in the 'easyadmin' project)
export const deletePost = async (id) => {
  console.log('Use the easyadmin dashboard to delete posts')
}

export const savePost = async (post) => {
  console.log('Use the easyadmin dashboard to save posts')
  return post
}

// ===== AUTH (Frontend only replace with real auth later) =====
const AUTH_KEY = 'assignpro_admin_auth'

export const login = (email, password) => {
  // TODO: Replace this with Firebase Auth or your backend API
  // For now, accepts ANY non-empty email and password
  if (email && password && password.length >= 4) {
    const session = {
      email,
      loggedInAt: new Date().toISOString()
    }
    localStorage.setItem(AUTH_KEY, JSON.stringify(session))
    return { success: true, user: session }
  }
  return { success: false, error: 'Invalid credentials' }
}

export const logout = () => {
  localStorage.removeItem(AUTH_KEY)
}

export const getCurrentUser = () => {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null')
  } catch {
    return null
  }
}

export const isAuthenticated = () => {
  return getCurrentUser() !== null
}
