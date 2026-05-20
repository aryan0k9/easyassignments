import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPostBySlug, getRelatedPosts } from '../data/blog'
import '../styles/blog.css'

function BlogPost() {
  const { slug } = useParams()
  const [post, setPost] = useState(null)
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const p = await getPostBySlug(slug)
      setPost(p)
      if (p) {
        const r = await getRelatedPosts(slug, 3)
        setRelated(r)
      }
      setLoading(false)
    }
    fetchData()
  }, [slug])

  if (loading) {
    return (
      <section className="blog-post-hero" style={{ minHeight: '60vh' }}>
        <div className="container" style={{ textAlign: 'center', padding: '60px 0' }}>
          <p style={{ color: '#6b7280' }}>Loading article...</p>
        </div>
      </section>
    )
  }

  if (!post) {
    return (
      <section className="blog-post-hero" style={{ minHeight: '60vh' }}>
        <div className="container" style={{ textAlign: 'center', padding: '60px 0' }}>
          <span className="eyebrow">404 Not Found</span>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '40px', marginTop: '12px' }}>Post Not Found</h1>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>The article you're looking for doesn't exist.</p>
          <Link to="/blog" className="btn btn-primary">← Back to Blog</Link>
        </div>
      </section>
    )
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    })
  }

  const shareUrl = encodeURIComponent(window.location.href)
  const shareTitle = encodeURIComponent(post.title)

  return (
    <>
      {/* HERO */}
      <section className="blog-post-hero">
        <div className="container">
          <div className="blog-post-container">
            <div className="post-breadcrumb">
              <Link to="/">Home</Link>
              <span>/</span>
              <Link to="/blog">Blog</Link>
              <span>/</span>
              <span>{post.category}</span>
            </div>

            <div className="post-header">
              <span className="post-category-tag">{post.category}</span>
              <h1>{post.title}</h1>
              <p className="post-header-excerpt">{post.excerpt}</p>

              <div className="post-header-meta">
                <div className="post-meta-author">
                  <div className="post-meta-avatar">{post.authorAvatar}</div>
                  <span className="post-meta-name">{post.author}</span>
                </div>
                <span className="post-meta-sep">•</span>
                <span>{formatDate(post.publishedAt)}</span>
                <span className="post-meta-sep">•</span>
                <span>{post.readTime} min read</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTENT */}
      <section style={{ padding: '40px 0 0' }}>
        <div className="container">
          <div className="blog-post-container">
            <div className="post-cover">
              <img src={post.coverImage} alt={post.title} />
            </div>

            <div
              className="post-content"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Tags */}
            <div className="post-tags-list">
              {post.tags.map((tag, i) => (
                <Link key={i} to={`/blog?tag=${tag}`} className="post-tag" style={{ textDecoration: 'none' }}>
                  #{tag}
                </Link>
              ))}
            </div>

            {/* Share buttons */}
            <div className="share-buttons">
              <span className="share-label">Share:</span>
              <a
                href={`https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="share-btn"
                aria-label="Share on Twitter"
              >𝕏</a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="share-btn"
                aria-label="Share on Facebook"
              >f</a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="share-btn"
                aria-label="Share on LinkedIn"
              >in</a>
              <a
                href={`https://wa.me/?text=${shareTitle}%20${shareUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="share-btn"
                aria-label="Share on WhatsApp"
              >💬</a>
              <button
                className="share-btn"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href)
                  alert('Link copied!')
                }}
                aria-label="Copy link"
              >🔗</button>
            </div>

            {/* Author bio */}
            <div className="author-bio">
              <div className="author-bio-avatar">{post.authorAvatar}</div>
              <div className="author-bio-content">
                <h4>Written by</h4>
                <h3>{post.author}</h3>
                <p>{post.authorBio}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RELATED POSTS */}
      {related.length > 0 && (
        <section className="related-posts-section">
          <div className="container">
            <h2>You might also like</h2>
            <div className="related-posts-grid">
              {related.map((rp) => (
                <Link key={rp.id} to={`/blog/${rp.slug}`} className="post-card">
                  <div className="post-card-image">
                    <img src={rp.coverImage} alt={rp.title} />
                  </div>
                  <div className="post-card-body">
                    <span className="post-category-tag">{rp.category}</span>
                    <h3 className="post-card-title">{rp.title}</h3>
                    <p className="post-card-excerpt">{rp.excerpt}</p>
                    <div className="post-meta">
                      <div className="post-meta-author">
                        <div className="post-meta-avatar">{rp.authorAvatar}</div>
                        <span className="post-meta-name">{rp.author}</span>
                      </div>
                      <span className="post-meta-sep">•</span>
                      <span>{rp.readTime} min</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}

export default BlogPost
