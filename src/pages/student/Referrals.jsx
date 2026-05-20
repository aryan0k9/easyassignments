import { useState } from 'react'
import StudentLayout from './StudentLayout'
import { useAuth } from '../../contexts/AuthContext'
import { buildStudentData } from '../../data/student'

function Referrals() {
  const { user } = useAuth()
  const data = buildStudentData(user)
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const referralCode = data.referral?.code || ''
  const referralLink = `https://easyassignments.com/signup?ref=${referralCode}`

  const stats = {
    referred: data.referral?.referred || 0,
    earned: data.referral?.earned || 0,
    pending: data.referral?.pending || 0
  }

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const shareViaTwitter = () => {
    const text = `I'm using easyassignments for my assignment help get 20% off your first order with my code: ${referralCode}`
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(referralLink)}`
    window.open(url, '_blank')
  }

  const shareViaFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`
    window.open(url, '_blank')
  }

  const shareViaWhatsapp = () => {
    const text = `Hey! I'm using easyassignments for my assignments. Use my code ${referralCode} to get 20% off your first order: ${referralLink}`
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  const shareViaEmail = () => {
    const subject = 'Get 20% off your first easyassignments order'
    const body = `Hey!\n\nI've been using easyassignments and they're great. Use my referral code to get 20% off your first order:\n\nCode: ${referralCode}\nSign up: ${referralLink}\n\nEnjoy!`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <StudentLayout title="Refer & Earn">
      {/* Hero card */}
      <div style={{
        background: 'linear-gradient(135deg, #16A34A 0%, #128a3d 100%)',
        color: 'white',
        borderRadius: '16px',
        padding: '32px',
        marginBottom: '24px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '-30%',
          right: '-5%',
          fontSize: '220px',
          opacity: 0.1,
          pointerEvents: 'none'
        }}>🎁</div>

        <h2 style={{
          fontFamily: 'Fraunces, Georgia, serif',
          fontSize: '28px',
          fontWeight: 700,
          margin: '0 0 8px',
          letterSpacing: '-0.02em'
        }}>
          🎁 Earn $15 for every friend you refer
        </h2>
        <p style={{ fontSize: '15px', opacity: 0.9, margin: '0 0 24px', maxWidth: '700px' }}>
          Share easyassignments with your friends. They get 20% off their first order, you earn $15 in wallet credits when they make a purchase.
        </p>

        <div style={{
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          opacity: 0.85,
          marginBottom: '8px'
        }}>
          Your Referral Code
        </div>

        <div
          onClick={copyCode}
          style={{
            background: 'rgba(255,255,255,0.15)',
            padding: '20px 24px',
            borderRadius: '12px',
            fontFamily: 'var(--sp-font-display)',
            fontSize: '32px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'background 0.2s',
            border: '2px dashed rgba(255,255,255,0.3)',
            marginBottom: '20px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
        >
          {referralCode || 'CODE'} {copied ? '✅' : '📋'}
        </div>

        {/* Stats grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          paddingTop: '20px',
          borderTop: '1px solid rgba(255,255,255,0.2)'
        }}>
          <div>
            <div style={{ fontFamily: 'var(--sp-font-display)', fontSize: '32px', fontWeight: 700, lineHeight: 1 }}>
              {stats.referred}
            </div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.85, marginTop: '4px' }}>
              Friends Referred
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--sp-font-display)', fontSize: '32px', fontWeight: 700, lineHeight: 1 }}>
              ${stats.earned.toFixed(2)}
            </div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.85, marginTop: '4px' }}>
              Total Earned
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--sp-font-display)', fontSize: '32px', fontWeight: 700, lineHeight: 1 }}>
              ${stats.pending.toFixed(2)}
            </div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.85, marginTop: '4px' }}>
              Pending
            </div>
          </div>
        </div>
      </div>

      {/* Two-column: Share Link + How It Works */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="sp-card" style={{ marginBottom: 0 }}>
          <div className="sp-card-header">
            <h3 className="sp-card-title">📤 Share Your Link</h3>
          </div>
          <div className="sp-card-body">
            <div className="sp-form-group">
              <label className="sp-form-label">Your Referral Link</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="sp-form-input"
                  value={referralLink}
                  readOnly
                  style={{ flex: 1, fontSize: '13px' }}
                />
                <button onClick={copyLink} className="sp-btn sp-btn-secondary">
                  {linkCopied ? '✅ Copied' : '📋 Copy'}
                </button>
              </div>
            </div>

            <div style={{
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--sp-muted)',
              marginTop: '16px',
              marginBottom: '10px'
            }}>
              Share Via
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              <button onClick={shareViaTwitter} className="sp-btn sp-btn-secondary" style={{ fontSize: '13px' }}>
                𝕏 Twitter
              </button>
              <button onClick={shareViaFacebook} className="sp-btn sp-btn-secondary" style={{ fontSize: '13px' }}>
                f Facebook
              </button>
              <button onClick={shareViaWhatsapp} className="sp-btn sp-btn-secondary" style={{ fontSize: '13px' }}>
                💬 WhatsApp
              </button>
              <button onClick={shareViaEmail} className="sp-btn sp-btn-secondary" style={{ fontSize: '13px' }}>
                📧 Email
              </button>
            </div>
          </div>
        </div>

        <div className="sp-card" style={{ marginBottom: 0 }}>
          <div className="sp-card-header">
            <h3 className="sp-card-title">📋 How It Works</h3>
          </div>
          <div className="sp-card-body">
            {[
              { num: 1, title: 'Share Your Code', desc: 'Copy your unique code or link and share it with friends.' },
              { num: 2, title: 'Friend Signs Up', desc: 'They sign up using your code and get 20% off their first order.' },
              { num: 3, title: 'You Earn $15', desc: 'When they complete their first order, $15 is credited to your wallet.' }
            ].map(step => (
              <div key={step.num} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px',
                padding: '14px 0',
                borderBottom: step.num < 3 ? '1px solid var(--sp-surface)' : 'none'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  background: 'rgba(22,163,74,0.12)',
                  color: 'var(--sp-green)',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 700,
                  flexShrink: 0
                }}>
                  {step.num}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--sp-primary)', marginBottom: '4px' }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--sp-muted)', lineHeight: 1.5 }}>
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </StudentLayout>
  )
}

export default Referrals
