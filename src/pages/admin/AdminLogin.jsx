import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signInWithEmail } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import '../../styles/admin.css'

function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await signInWithEmail(email, password)

    if (!result.success) {
      setError(result.error || 'Invalid email or password')
      setLoading(false)
      return
    }

    // Verify the logged-in user actually has an admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', result.user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'manager') {
      await supabase.auth.signOut()
      setError('Access denied. Admin privileges required.')
      setLoading(false)
      return
    }

    navigate('/admin')
  }

  return (
    <div className="admin-login-page">
      <Link to="/" className="admin-back-link">← Back to website</Link>

      <div className="admin-login-card">
        <div className="admin-login-logo">
          <span className="logo-mark">A</span>
          <span>AssignPro</span>
        </div>

        <h2>Admin Login</h2>
        <p className="login-sub">Sign in to manage your blog posts</p>

        <form onSubmit={handleSubmit}>
          {error && <div className="admin-error">{error}</div>}

          <div className="admin-form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@assignpro.com"
              required
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="admin-form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AdminLogin
