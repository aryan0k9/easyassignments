import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import '../../styles/admin.css'

function AdminLayout({ children, title }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true

    async function checkAccess() {
      const { data: { user: currentUser } } = await supabase.auth.getUser()

      if (!currentUser) {
        navigate('/admin/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, email, full_name')
        .eq('id', currentUser.id)
        .single()

      if (!active) return

      if (profile?.role !== 'admin' && profile?.role !== 'manager') {
        await supabase.auth.signOut()
        navigate('/admin/login')
        return
      }

      setUser({ ...currentUser, profile })
      setChecking(false)
    }

    checkAccess()
    return () => { active = false }
  }, [navigate])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  if (checking) return null
  if (!user) return null

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <span className="logo-mark">A</span>
          <span>AssignPro</span>
        </div>

        <div className="admin-sidebar-section">
          <h4>Main</h4>
          <Link
            to="/admin"
            className={`admin-sidebar-link ${location.pathname === '/admin' ? 'active' : ''}`}
          >
            📊 Dashboard
          </Link>
          <Link
            to="/admin/new"
            className={`admin-sidebar-link ${location.pathname === '/admin/new' ? 'active' : ''}`}
          >
            ✏️ New Post
          </Link>
        </div>

        <div className="admin-sidebar-section">
          <h4>Site</h4>
          <Link to="/blog" className="admin-sidebar-link" target="_blank">
            🌐 View Blog
          </Link>
          <Link to="/" className="admin-sidebar-link" target="_blank">
            🏠 View Site
          </Link>
        </div>

        <div className="admin-sidebar-section">
          <h4>Account</h4>
          <button onClick={handleLogout} className="admin-sidebar-link" style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
            🚪 Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-topbar">
          <h1>{title}</h1>
          <div className="admin-topbar-actions">
            <span className="admin-user-info">👤 {user.profile?.full_name || user.email}</span>
          </div>
        </div>
        {children}
      </main>
    </div>
  )
}

export default AdminLayout
