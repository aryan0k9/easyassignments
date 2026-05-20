import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import AdminLayout from './AdminLayout'
import { getAllPosts, deletePost } from '../../data/blog'

function AdminDashboard() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState(getAllPosts())

  const handleDelete = (id, title) => {
    if (window.confirm(`Delete "${title}"? This cannot be undone.`)) {
      deletePost(id)
      setPosts(getAllPosts())
    }
  }

  const totalPosts = posts.length
  const publishedCount = posts.filter(p => p.status === 'published').length
  const draftsCount = posts.filter(p => p.status === 'draft').length
  const totalReadTime = posts.reduce((sum, p) => sum + (p.readTime || 0), 0)

  return (
    <AdminLayout title="Dashboard">
      {/* Stats */}
      <div className="admin-stats">
        <div className="admin-stat">
          <div className="admin-stat-label">Total Posts</div>
          <div className="admin-stat-value">{totalPosts}</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-label">Published</div>
          <div className="admin-stat-value green">{publishedCount}</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-label">Drafts</div>
          <div className="admin-stat-value amber">{draftsCount}</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-label">Total Read Time</div>
          <div className="admin-stat-value">{totalReadTime} min</div>
        </div>
      </div>

      {/* Posts table */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h3>All Posts</h3>
          <Link to="/admin/new" className="btn btn-primary btn-sm">
            + New Post
          </Link>
        </div>

        {posts.length === 0 ? (
          <div className="empty-posts">
            <div style={{ fontSize: '48px', opacity: 0.3 }}>📝</div>
            <h3>No posts yet</h3>
            <p>Create your first blog post to get started.</p>
            <Link to="/admin/new" className="btn btn-primary" style={{ marginTop: '16px' }}>
              + Create First Post
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <div className="post-title-cell">
                        {post.coverImage && <img src={post.coverImage} alt="" />}
                        <span>{post.title}</span>
                      </div>
                    </td>
                    <td>{post.category}</td>
                    <td>
                      <span className={`status-badge status-${post.status}`}>
                        {post.status}
                      </span>
                    </td>
                    <td>{post.publishedAt}</td>
                    <td>
                      <div className="action-buttons">
                        <Link to={`/blog/${post.slug}`} className="action-btn" target="_blank">
                          👁 View
                        </Link>
                        <Link to={`/admin/edit/${post.id}`} className="action-btn">
                          ✏️ Edit
                        </Link>
                        <button
                          className="action-btn danger"
                          onClick={() => handleDelete(post.id, post.title)}
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

export default AdminDashboard
