import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getPublishedPosts, BLOG_CATEGORIES } from '../data/blog'
import '../styles/blog.css'

function Blog() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedTag, setSelectedTag] = useState(null)
  const [allPosts, setAllPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPosts = async () => {
      const posts = await getPublishedPosts()
      setAllPosts(posts)
      setLoading(false)
    }
    fetchPosts()
  }, [])

  // Get all unique tags from posts
  const allTags = useMemo(() => {
    const tagCounts = {}
    allPosts.forEach(p => {
      (p.tags || []).forEach(t => {
        tagCounts[t] = (tagCounts[t] || 0) + 1
      })
    })
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag, count]) => ({ tag, count }))
  }, [allPosts])

  // Apply filters
  const filteredPosts = useMemo(() => {
    let result = allPosts

    if (selectedCategory !== 'all') {
      result = result.filter(p => p.category === selectedCategory)
    }

    if (selectedTag) {
      result = result.filter(p => p.tags.includes(selectedTag))
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      )
    }

    return result
  }, [allPosts, selectedCategory, selectedTag, searchQuery])

  // Find the featured post (first 'featured: true', or first post)
  const featuredPost = filteredPosts.find(p => p.featured) || filteredPosts[0]
  const otherPosts = filteredPosts.filter(p => p.id !== featuredPost?.id)

  // Posts per category for filter chips
  const categoryCount = useMemo(() => {
    const counts = { all: allPosts.length }
    BLOG_CATEGORIES.forEach(c => {
      counts[c.name] = allPosts.filter(p => p.category === c.name).length
    })
    return counts
  }, [allPosts])

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    })
  }

  const popularPosts = allPosts.slice(0, 4)

  return (
    <>
      {/* HERO */}
      <section className="blog-hero">
        <div className="container">
          <div className="blog-hero-content">
            <span className="eyebrow">The AssignPro Blog</span>
            <h1>Insights, tips & guides for ambitious students</h1>
            <p className="blog-hero-sub">
              Expert advice on writing, programming, productivity, and academic success straight from PhDs and top scholars.
            </p>
            <div className="blog-search-wrap">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles, topics, tags..."
                className="blog-search-input"
              />
              <button className="blog-search-btn" aria-label="Search">🔍</button>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORY FILTER CHIPS */}
      <section className="blog-categories">
        <div className="container">
          <div className="blog-cat-list">
            <button
              className={`blog-cat-chip ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => { setSelectedCategory('all'); setSelectedTag(null) }}
            >
              All Posts <span className="blog-cat-chip-count">{categoryCount.all}</span>
            </button>
            {BLOG_CATEGORIES.map((cat) => (
              <button
                key={cat.slug}
                className={`blog-cat-chip ${selectedCategory === cat.name ? 'active' : ''}`}
                onClick={() => { setSelectedCategory(cat.name); setSelectedTag(null) }}
              >
                {cat.name} <span className="blog-cat-chip-count">{categoryCount[cat.name] || 0}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* MAIN CONTENT */}
      <section className="blog-main">
        <div className="container">
          <div className="blog-layout">
            <div>
              {filteredPosts.length === 0 ? (
                <div className="blog-empty">
                  <div className="blog-empty-icon">📰</div>
                  <h3>No posts found</h3>
                  <p>Try adjusting your search or category filters.</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setSearchQuery('')
                      setSelectedCategory('all')
                      setSelectedTag(null)
                    }}
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <>
                  {/* FEATURED POST */}
                  {featuredPost && (
                    <Link to={`/blog/${featuredPost.slug}`} className="featured-post">
                      <div className="featured-post-image">
                        <div className="featured-badge">Featured</div>
                        <img src={featuredPost.coverImage} alt={featuredPost.title} />
                      </div>
                      <div className="featured-post-body">
                        <span className="post-category-tag">{featuredPost.category}</span>
                        <h2 className="featured-post-title">{featuredPost.title}</h2>
                        <p className="featured-post-excerpt">{featuredPost.excerpt}</p>
                        <div className="post-meta">
                          <div className="post-meta-author">
                            <div className="post-meta-avatar">{featuredPost.authorAvatar}</div>
                            <span className="post-meta-name">{featuredPost.author}</span>
                          </div>
                          <span className="post-meta-sep">•</span>
                          <span>{formatDate(featuredPost.publishedAt)}</span>
                          <span className="post-meta-sep">•</span>
                          <span>{featuredPost.readTime} min read</span>
                        </div>
                      </div>
                    </Link>
                  )}

                  {/* GRID OF POSTS */}
                  {otherPosts.length > 0 && (
                    <>
                      <h2 className="posts-section-title">Latest Articles</h2>
                      <div className="posts-grid">
                        {otherPosts.map((post) => (
                          <Link key={post.id} to={`/blog/${post.slug}`} className="post-card">
                            <div className="post-card-image">
                              <img src={post.coverImage} alt={post.title} />
                            </div>
                            <div className="post-card-body">
                              <span className="post-category-tag">{post.category}</span>
                              <h3 className="post-card-title">{post.title}</h3>
                              <p className="post-card-excerpt">{post.excerpt}</p>
                              <div className="post-card-tags">
                                {post.tags.slice(0, 3).map((t, i) => (
                                  <span key={i} className="post-tag">#{t}</span>
                                ))}
                              </div>
                              <div className="post-meta">
                                <div className="post-meta-author">
                                  <div className="post-meta-avatar">{post.authorAvatar}</div>
                                  <span className="post-meta-name">{post.author}</span>
                                </div>
                                <span className="post-meta-sep">•</span>
                                <span>{post.readTime} min</span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* SIDEBAR */}
            <aside className="blog-sidebar">
              {/* Newsletter */}
              <div className="sidebar-block newsletter-block">
                <h3>Newsletter</h3>
                <h4>Stay in the loop</h4>
                <p>Get the best study tips, writing guides, and academic news delivered to your inbox weekly.</p>
                <form className="newsletter-form" onSubmit={(e) => {
                  e.preventDefault()
                  alert('Thanks! You\'re subscribed.')
                  e.target.reset()
                }}>
                  <input type="email" placeholder="Your email" className="newsletter-input" required />
                  <button type="submit" className="newsletter-btn">Join</button>
                </form>
              </div>

              {/* Tags Cloud */}
              <div className="sidebar-block">
                <h3>Popular Tags</h3>
                <div className="tag-cloud">
                  {allTags.map(({ tag, count }) => (
                    <button
                      key={tag}
                      className={`tag-cloud-tag ${selectedTag === tag ? 'active' : ''}`}
                      onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    >
                      #{tag} <span style={{ opacity: 0.5 }}>({count})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Popular Posts */}
              <div className="sidebar-block">
                <h3>Most Read</h3>
                <div className="popular-list">
                  {popularPosts.map((post, i) => (
                    <Link key={post.id} to={`/blog/${post.slug}`} className="popular-item">
                      <div className="popular-num">0{i + 1}</div>
                      <div className="popular-info">
                        <h4>{post.title}</h4>
                        <span>{post.readTime} min read</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  )
}

export default Blog
