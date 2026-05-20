import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import AdminLayout from './AdminLayout'
import { getPostById, savePost, slugify, BLOG_CATEGORIES } from '../../data/blog'

function AdminPostEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const [post, setPost] = useState({
    id: '',
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    coverImage: '',
    category: BLOG_CATEGORIES[0].name,
    tags: '',
    author: '',
    authorBio: '',
    authorAvatar: '',
    publishedAt: new Date().toISOString().split('T')[0],
    readTime: 5,
    featured: false,
    status: 'draft'
  })

  // Load post if editing
  useEffect(() => {
    if (isEditing) {
      const existingPost = getPostById(id)
      if (existingPost) {
        setPost({
          ...existingPost,
          tags: existingPost.tags.join(', ')
        })
      } else {
        navigate('/admin')
      }
    }
  }, [id, isEditing, navigate])

  // Auto-generate slug from title
  useEffect(() => {
    if (!isEditing && post.title) {
      setPost(prev => ({ ...prev, slug: slugify(prev.title) }))
    }
  }, [post.title, isEditing])

  // Auto-calc read time based on word count
  useEffect(() => {
    if (post.content) {
      const wordCount = post.content.replace(/<[^>]*>/g, '').split(/\s+/).length
      const readTime = Math.max(1, Math.round(wordCount / 200))
      setPost(prev => ({ ...prev, readTime }))
    }
  }, [post.content])

  const handleChange = (field, value) => {
    setPost(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = (status) => {
    if (!post.title || !post.content) {
      alert('Title and content are required.')
      return
    }
    if (!post.author) {
      alert('Author name is required.')
      return
    }

    const tagsArray = typeof post.tags === 'string'
      ? post.tags.split(',').map(t => t.trim()).filter(Boolean)
      : post.tags

    const postToSave = {
      ...post,
      tags: tagsArray,
      authorAvatar: post.authorAvatar || post.author.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
      status
    }

    savePost(postToSave)
    alert(`Post ${status === 'published' ? 'published' : 'saved as draft'}!`)
    navigate('/admin')
  }

  const insertFormatting = (tag) => {
    const textarea = document.querySelector('.editor-content-area')
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = post.content.substring(start, end)

    let insertion = ''
    if (tag === 'h2') insertion = `<h2>${selectedText || 'Heading'}</h2>`
    else if (tag === 'h3') insertion = `<h3>${selectedText || 'Subheading'}</h3>`
    else if (tag === 'p') insertion = `<p>${selectedText || 'Paragraph text'}</p>`
    else if (tag === 'strong') insertion = `<strong>${selectedText || 'bold'}</strong>`
    else if (tag === 'em') insertion = `<em>${selectedText || 'italic'}</em>`
    else if (tag === 'ul') insertion = `<ul>\n  <li>Item 1</li>\n  <li>Item 2</li>\n</ul>`
    else if (tag === 'blockquote') insertion = `<blockquote>${selectedText || 'Quote text'}</blockquote>`
    else if (tag === 'a') {
      const url = prompt('Enter URL:')
      if (url) insertion = `<a href="${url}">${selectedText || 'link text'}</a>`
      else return
    }

    const newContent = post.content.substring(0, start) + insertion + post.content.substring(end)
    handleChange('content', newContent)
  }

  return (
    <AdminLayout title={isEditing ? 'Edit Post' : 'New Post'}>
      <div className="editor-layout">
        {/* Main editor */}
        <div className="editor-main">
          <input
            type="text"
            className="title-input"
            placeholder="Post title..."
            value={post.title}
            onChange={(e) => handleChange('title', e.target.value)}
          />
          <textarea
            className="excerpt-input"
            placeholder="Short excerpt / subtitle..."
            value={post.excerpt}
            onChange={(e) => handleChange('excerpt', e.target.value)}
            rows={2}
          />

          <div className="editor-toolbar">
            <button className="editor-tool-btn" onClick={() => insertFormatting('h2')} title="Heading 2">H2</button>
            <button className="editor-tool-btn" onClick={() => insertFormatting('h3')} title="Heading 3">H3</button>
            <button className="editor-tool-btn" onClick={() => insertFormatting('p')} title="Paragraph">¶</button>
            <button className="editor-tool-btn" onClick={() => insertFormatting('strong')} title="Bold"><strong>B</strong></button>
            <button className="editor-tool-btn" onClick={() => insertFormatting('em')} title="Italic"><em>I</em></button>
            <button className="editor-tool-btn" onClick={() => insertFormatting('ul')} title="List">• List</button>
            <button className="editor-tool-btn" onClick={() => insertFormatting('blockquote')} title="Quote">❝ Quote</button>
            <button className="editor-tool-btn" onClick={() => insertFormatting('a')} title="Link">🔗 Link</button>
          </div>

          <textarea
            className="editor-content-area"
            placeholder="Start writing your post... (HTML supported)"
            value={post.content}
            onChange={(e) => handleChange('content', e.target.value)}
            rows={20}
          />

          <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
            💡 Tip: Use HTML tags for formatting. Click the toolbar buttons to insert tags around selected text.
          </p>
        </div>

        {/* Sidebar */}
        <div className="editor-sidebar">
          {/* Publish Actions */}
          <div className="editor-block">
            <h4>Publish</h4>
            <div className="editor-actions">
              <button onClick={() => handleSave('draft')} className="btn btn-outline btn-block">
                💾 Save Draft
              </button>
              <button onClick={() => handleSave('published')} className="btn btn-primary btn-block">
                🚀 Publish Now
              </button>
              <Link to="/admin" className="btn btn-text" style={{ textAlign: 'center', marginTop: '4px' }}>
                ← Cancel
              </Link>
            </div>
          </div>

          {/* Cover Image */}
          <div className="editor-block">
            <h4>Cover Image</h4>
            <input
              type="url"
              placeholder="https://..."
              value={post.coverImage}
              onChange={(e) => handleChange('coverImage', e.target.value)}
            />
            {post.coverImage && (
              <img
                src={post.coverImage}
                alt="Cover preview"
                style={{ width: '100%', borderRadius: '6px', marginTop: '8px' }}
                onError={(e) => { e.target.style.display = 'none' }}
              />
            )}
          </div>

          {/* Meta */}
          <div className="editor-block">
            <h4>Post Settings</h4>
            <label>Slug (URL)</label>
            <input
              type="text"
              value={post.slug}
              onChange={(e) => handleChange('slug', slugify(e.target.value))}
              placeholder="post-url-slug"
            />

            <label>Category</label>
            <select
              value={post.category}
              onChange={(e) => handleChange('category', e.target.value)}
            >
              {BLOG_CATEGORIES.map(c => <option key={c.slug}>{c.name}</option>)}
            </select>

            <label>Tags (comma-separated)</label>
            <input
              type="text"
              value={post.tags}
              onChange={(e) => handleChange('tags', e.target.value)}
              placeholder="essay, writing, tips"
            />

            <label>Publish Date</label>
            <input
              type="date"
              value={post.publishedAt}
              onChange={(e) => handleChange('publishedAt', e.target.value)}
            />

            <label style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#374151' }}>
              <input
                type="checkbox"
                checked={post.featured}
                onChange={(e) => handleChange('featured', e.target.checked)}
                style={{ width: 'auto', margin: 0 }}
              />
              Mark as featured
            </label>
          </div>

          {/* Author */}
          <div className="editor-block">
            <h4>Author</h4>
            <label>Name</label>
            <input
              type="text"
              value={post.author}
              onChange={(e) => handleChange('author', e.target.value)}
              placeholder="Dr. John Smith"
            />
            <label>Bio</label>
            <textarea
              value={post.authorBio}
              onChange={(e) => handleChange('authorBio', e.target.value)}
              placeholder="Short bio..."
              rows={3}
            />
            <label>Avatar Initials (auto if empty)</label>
            <input
              type="text"
              value={post.authorAvatar}
              onChange={(e) => handleChange('authorAvatar', e.target.value.toUpperCase().slice(0, 2))}
              placeholder="JS"
              maxLength={2}
            />
          </div>

          {/* Read time (auto) */}
          <div className="editor-block">
            <h4>Auto-Calculated</h4>
            <p style={{ fontSize: '13px', color: '#374151', margin: '4px 0' }}>
              ⏱ <strong>{post.readTime} min</strong> read
            </p>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
              Based on ~200 words/min
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

export default AdminPostEditor
