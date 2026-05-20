import { useState, useEffect } from 'react'
import StudentLayout from './StudentLayout'
import { useAuth } from '../../contexts/AuthContext'
import { buildStudentData } from '../../data/student'
import { updatePassword, signInWithEmail, updateProfile } from '../../lib/auth'
import { getOrCreateProfile } from '../../lib/profile'

function Profile() {
  const { user } = useAuth()
  const data = buildStudentData(user)
  const [studentId, setStudentId] = useState('')

  useEffect(() => {
    getOrCreateProfile().then(p => { if (p?.student_id) setStudentId(p.student_id) })
  }, [user?.id])
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMessage, setPwMessage] = useState({ type: '', text: '' })
  const [isEditing, setIsEditing] = useState(false)
  const [profileForm, setProfileForm] = useState({ phone: '', country: '' })
  const [profileLoading, setProfileLoading] = useState(false)

  const startEditing = () => {
    setProfileForm({ phone: data.profile?.phone || '', country: data.profile?.country || '' })
    setIsEditing(true)
  }

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setProfileLoading(true)
    const result = await updateProfile({ phone: profileForm.phone, country: profileForm.country })
    if (result.success) {
      setIsEditing(false)
    } else {
      alert(result.error)
    }
    setProfileLoading(false)
  }

  const handlePwChange = async (e) => {
    e.preventDefault()
    setPwMessage({ type: '', text: '' })

    if (!pwForm.current) {
      return setPwMessage({ type: 'error', text: 'Please enter your current password' })
    }
    if (pwForm.newPw !== pwForm.confirm) {
      return setPwMessage({ type: 'error', text: 'New passwords do not match' })
    }
    if (pwForm.newPw.length < 8) {
      return setPwMessage({ type: 'error', text: 'Password must be at least 8 characters' })
    }

    setPwLoading(true)

    try {
      // Verify current password first
      const verifyResult = await signInWithEmail(user.email, pwForm.current)
      if (!verifyResult.success) {
        setPwLoading(false)
        return setPwMessage({ type: 'error', text: 'Incorrect current password' })
      }

      const result = await updatePassword(pwForm.newPw)
      if (result.success) {
        setPwMessage({ type: 'success', text: '✅ Password updated successfully!' })
        setPwForm({ current: '', newPw: '', confirm: '' })
      } else {
        setPwMessage({ type: 'error', text: result.error || 'Failed to update password' })
      }
    } catch (err) {
      setPwMessage({ type: 'error', text: 'Something went wrong. Please try again.' })
    } finally {
      setPwLoading(false)
    }
  }

  // Format date nicely
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <StudentLayout title="My Profile">
      {/* Profile header card */}
      <div className="sp-profile-header-card">
        <div className="sp-profile-avatar-large">{data.profile?.avatar}</div>
        <div className="sp-profile-info">
          <h2 style={{ color: 'white' }}>{data.profile?.name}</h2>
          <p>{data.profile?.email}</p>
          <div className="sp-profile-tags">
            <span className="sp-profile-tag">🆔 {studentId || '…'}</span>
            {data.profile?.verified ? (
              <span className="sp-profile-tag green">✓ Email Verified</span>
            ) : (
              <span className="sp-profile-tag" style={{ background: 'rgba(245,158,11,0.2)', borderColor: 'rgba(245,158,11,0.4)', color: '#fbbf24' }}>⚠️ Email Not Verified</span>
            )}
            <span className="sp-profile-tag">🎓 Student Account</span>
          </div>
        </div>
      </div>

      <div className="sp-profile-grid">
        {/* Profile details (read-only for now) */}
        <div className="sp-card" style={{ marginBottom: 0 }}>
          <div className="sp-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="sp-card-title">👤 Account Information</h3>
            {!isEditing && (
              <button onClick={startEditing} className="sp-btn sp-btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                ✏️ Edit Profile
              </button>
            )}
          </div>
          <div className="sp-card-body">
            {isEditing ? (
              <form onSubmit={handleProfileSubmit}>
                <div className="sp-profile-row">
                  <span className="sp-profile-row-label">👤 Name</span>
                  <span className="sp-profile-row-value">{data.profile?.name || '—'}</span>
                </div>
                <div className="sp-profile-row">
                  <span className="sp-profile-row-label">✉️ Email</span>
                  <span className="sp-profile-row-value">{data.profile?.email}</span>
                </div>
                <div className="sp-form-group" style={{ marginBottom: '12px' }}>
                  <label className="sp-form-label">📞 Phone</label>
                  <input
                    type="text"
                    className="sp-form-input"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="sp-form-group" style={{ marginBottom: '16px' }}>
                  <label className="sp-form-label">🌍 Country</label>
                  <input
                    type="text"
                    className="sp-form-input"
                    value={profileForm.country}
                    onChange={(e) => setProfileForm({...profileForm, country: e.target.value})}
                    placeholder="Enter country"
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={() => setIsEditing(false)} className="sp-btn sp-btn-secondary" style={{ flex: 1 }}>
                    Cancel
                  </button>
                  <button type="submit" className="sp-btn sp-btn-primary" style={{ flex: 1 }} disabled={profileLoading}>
                    {profileLoading ? 'Saving...' : '💾 Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="sp-profile-row">
                  <span className="sp-profile-row-label">👤 Name</span>
                  <span className="sp-profile-row-value">{data.profile?.name || '—'}</span>
                </div>
                <div className="sp-profile-row">
                  <span className="sp-profile-row-label">✉️ Email</span>
                  <span className="sp-profile-row-value">{data.profile?.email}</span>
                </div>
                <div className="sp-profile-row">
                  <span className="sp-profile-row-label">📞 Phone</span>
                  <span className="sp-profile-row-value" style={{ color: data.profile?.phone ? 'inherit' : 'var(--sp-muted)', fontWeight: data.profile?.phone ? '600' : 400 }}>
                    {data.profile?.phone || 'Not set'}
                  </span>
                </div>
                <div className="sp-profile-row">
                  <span className="sp-profile-row-label">🌍 Country</span>
                  <span className="sp-profile-row-value" style={{ color: data.profile?.country ? 'inherit' : 'var(--sp-muted)', fontWeight: data.profile?.country ? '600' : 400 }}>
                    {data.profile?.country || 'Not set'}
                  </span>
                </div>
                <div className="sp-profile-row">
                  <span className="sp-profile-row-label">🛡️ Email Verified</span>
                  <span className="sp-profile-row-value" style={{ color: data.profile?.verified ? 'var(--sp-green)' : 'var(--sp-amber)' }}>
                    {data.profile?.verified ? '✓ Verified' : '⚠️ Not verified'}
                  </span>
                </div>
                <div className="sp-profile-row">
                  <span className="sp-profile-row-label">🆔 Student ID</span>
                  <span className="sp-profile-row-value" style={{ color: 'var(--sp-amber)' }}>{studentId || '…'}</span>
                </div>
                <div className="sp-profile-row">
                  <span className="sp-profile-row-label">📅 Member Since</span>
                  <span className="sp-profile-row-value">{formatDate(data.profile?.memberSince)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Change Password (REAL Supabase!) */}
        <div className="sp-card" style={{ marginBottom: 0 }}>
          <div className="sp-card-header">
            <h3 className="sp-card-title">🔒 Change Password</h3>
          </div>
          <form className="sp-card-body" onSubmit={handlePwChange}>
            {pwMessage.text && (
              <div style={{
                padding: '12px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '16px',
                background: pwMessage.type === 'success' ? '#dcf5e4' : '#fef2f2',
                color: pwMessage.type === 'success' ? '#128a3d' : '#991b1b',
                border: `1px solid ${pwMessage.type === 'success' ? '#16A34A' : '#fecaca'}`
              }}>
                {pwMessage.text}
              </div>
            )}

            <div className="sp-form-group">
              <label className="sp-form-label">Current Password</label>
              <input
                type={showPw ? 'text' : 'password'}
                className="sp-form-input"
                placeholder="Enter current password"
                value={pwForm.current}
                onChange={(e) => setPwForm({...pwForm, current: e.target.value})}
                required
              />
            </div>

            <div className="sp-form-group">
              <label className="sp-form-label">New Password</label>
              <input
                type={showPw ? 'text' : 'password'}
                className="sp-form-input"
                placeholder="Min 8 characters"
                value={pwForm.newPw}
                onChange={(e) => setPwForm({...pwForm, newPw: e.target.value})}
                minLength={8}
                required
              />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Confirm New Password</label>
              <input
                type={showPw ? 'text' : 'password'}
                className="sp-form-input"
                placeholder="Repeat new password"
                value={pwForm.confirm}
                onChange={(e) => setPwForm({...pwForm, confirm: e.target.value})}
                required
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--sp-charcoal)', marginBottom: '16px' }}>
              <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} />
              Show passwords
            </label>

            <button type="submit" className="sp-btn sp-btn-primary sp-btn-block" disabled={pwLoading}>
              {pwLoading ? '🔄 Updating...' : '🔒 Update Password'}
            </button>

            <p style={{ fontSize: '12px', color: 'var(--sp-muted)', marginTop: '14px', textAlign: 'center' }}>
              🛡️ Your password is securely stored using industry-standard encryption.
            </p>
          </form>
        </div>
      </div>
    </StudentLayout>
  )
}

export default Profile
