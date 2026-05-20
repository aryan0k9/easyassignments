import { useState, useRef } from 'react'
import { PaymentCardIcons } from './PaymentIcons'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { createOrder } from '../lib/orders'
import { uploadOrderFiles } from '../lib/uploads'

// 8-char random alphanumeric (excludes confusing chars: 0 O 1 l I)
function generateTempPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// IndexedDB helper persists File objects across page navigation
async function savePendingFilesToIDB(files) {
  if (!files.length) return

  const fileDataArray = await Promise.all(files.map(file => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        data: reader.result
      })
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }))

  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ea_pending', 1)
    req.onupgradeneeded = e => e.target.result.createObjectStore('files')
    req.onsuccess = e => {
      const tx = e.target.result.transaction('files', 'readwrite')
      tx.objectStore('files').put(fileDataArray, 'pendingFiles')
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    }
    req.onerror = () => reject(req.error)
  })
}

function default7DayDeadline() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  const hour = 9 + Math.floor(Math.random() * 13)
  const minute = [0, 15, 30, 45][Math.floor(Math.random() * 4)]
  d.setHours(hour, minute, 0, 0)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const SERVICE_MAP = {
  'Assignment Writing': 'Assignment',
  'Essay Help': 'Essay',
  'Dissertation & Thesis': 'Dissertation',
  'Programming Help': 'Programming',
  'Coursework Help': 'Coursework',
  'Case Study Analysis': 'Case Study',
  'Research Paper': 'Research Paper',
  'Proofreading & Editing': 'Proofreading & Editing',
  'Homework Help': 'Homework Help',
  'Business Writing': 'Business Writing',
  'Lab Reports': 'Lab Report',
  'Exam & Online Class Help': 'Online Test',
}

function QuoteForm({
  title = "Get an Instant Free Quote",
  subtitle = "Fill in the details we'll reply in 4 minutes.",
  defaultService = '',
  expertName = '',
  expertAvatar = ''
}) {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [step, setStep] = useState(1)
  const [countMode, setCountMode] = useState('pages')
  const [selectedFiles, setSelectedFiles] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    subject: '',
    serviceType: SERVICE_MAP[defaultService] || '',
    pages: '2',
    wordCount: '550',
    academicLevel: 'Undergraduate',
    deadline: default7DayDeadline(),
    requirements: '',
    formattingStyle: 'Not Required',
  })

  const handleChange = (e) => {
    setFormData(f => ({ ...f, [e.target.name]: e.target.value }))
    if (error) setError('')
  }


  const handleFiles = (files) => {
    const valid = Array.from(files).filter(f => f.size <= 20 * 1024 * 1024)
    setSelectedFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size))
      return [...prev, ...valid.filter(f => !existing.has(f.name + f.size))]
    })
  }

  const getMinDateTime = () => {
    const now = new Date()
    now.setHours(now.getHours() + 1)
    const pad = n => String(n).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
  }

  // Step 1 → Step 2 validation
  const handleNext = (e) => {
    e.preventDefault()
    const { subject, serviceType, deadline } = formData
    const count = countMode === 'pages' ? parseInt(formData.pages) : parseInt(formData.wordCount)
    if (!subject.trim()) return setError('Please enter a subject.')
    if (!serviceType) return setError('Please select a service type.')
    if (!deadline) return setError('Please pick a deadline.')
    if (!count || count < 1) return setError('Please enter a valid page / word count.')
    setError('')
    setStep(2)
  }

  // Step 2 → Submit
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { fullName, email, subject, serviceType, pages, wordCount, academicLevel, deadline, requirements, formattingStyle } = formData

    const finalWordCount = countMode === 'pages' ? (parseInt(pages) || 1) * 275 : parseInt(wordCount) || 1000
    const finalPages = countMode === 'words' ? Math.ceil((parseInt(wordCount) || 0) / 275) : parseInt(pages) || 1

    const fileNames = selectedFiles.map(f => f.name).join(', ')
    const descWithFiles = requirements + (fileNames ? `\n\n📎 Attached files: ${fileNames}` : '')

    const orderPayload = {
      title: `${subject} ${serviceType}`, subject, type: serviceType,
      wordCount: finalWordCount, pages: finalPages, academicLevel,
      description: descWithFiles, deadline, formattingStyle
    }

    // Generate secure 8-char alphanumeric temp password
    const tempPassword = generateTempPassword()

    // ── Sign up the user ──
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password: tempPassword,
      options: { data: { full_name: fullName } },
    })

    if (signUpError) {
      console.log('[QuoteForm] signUpError:', signUpError.message)
      // If Supabase is configured to throw an error for existing emails
      if (signUpError.message.toLowerCase().includes('already registered')) {
        const { data: { session: existingSession } } = await supabase.auth.getSession()
        console.log('[QuoteForm] existing-user path. session?', !!existingSession)
        if (existingSession) {
          // Already logged in create order directly, no login redirect needed
          console.log('[QuoteForm] already-logged-in: calling createOrder directly with payload:', orderPayload)
          const result = await createOrder(orderPayload)
          console.log('[QuoteForm] already-logged-in createOrder result:', result)
          if (!result.success) {
            setLoading(false)
            setError(`Could not create order: ${result.error}`)
            alert(`Order creation failed: ${result.error}`)
            return
          }
          if (result.order?.id && selectedFiles.length > 0) {
            await uploadOrderFiles(selectedFiles, result.order.id, 'instruction').catch(() => {})
          }
          setLoading(false)
          navigate('/dashboard')
          return
        }
        sessionStorage.setItem('pendingOrder', JSON.stringify({ ...orderPayload, intendedEmail: email.trim().toLowerCase() }))
        if (selectedFiles.length > 0) await savePendingFilesToIDB(selectedFiles)
        setLoading(false)
        navigate('/login', { state: { existingUser: true, email, message: 'You already have an account. Log in below and your order will be placed automatically.' } })
        return
      }
      setLoading(false)
      setError(signUpError.message)
      return
    }

    // If Supabase is configured to return identities instead of throwing an error
    const isExistingUser = data.user?.identities?.length === 0
    console.log('[QuoteForm] signUp returned. isExistingUser?', isExistingUser, 'data.session?', !!data.session)

    // ── Existing user ──
    if (isExistingUser) {
      const { data: { session: existingSession } } = await supabase.auth.getSession()
      console.log('[QuoteForm] isExistingUser path. session?', !!existingSession)
      if (existingSession) {
        // Already logged in create order directly, no login redirect needed
        console.log('[QuoteForm] isExistingUser+session: calling createOrder directly with payload:', orderPayload)
        const result = await createOrder(orderPayload)
        console.log('[QuoteForm] isExistingUser+session createOrder result:', result)
        if (!result.success) {
          setLoading(false)
          setError(`Could not create order: ${result.error}`)
          alert(`Order creation failed: ${result.error}`)
          return
        }
        if (result.order?.id && selectedFiles.length > 0) {
          await uploadOrderFiles(selectedFiles, result.order.id, 'instruction').catch(() => {})
        }
        setLoading(false)
        navigate('/dashboard')
        return
      }
      sessionStorage.setItem('pendingOrder', JSON.stringify({ ...orderPayload, intendedEmail: email.trim().toLowerCase() }))
      if (selectedFiles.length > 0) await savePendingFilesToIDB(selectedFiles)
      setLoading(false)
      navigate('/login', { state: { existingUser: true, email, message: 'You already have an account. Log in below and your order will be placed automatically.' } })
      return
    }

    // ── New user ──
    const newUserId = data.user?.id
    if (!newUserId) {
      setLoading(false)
      setError('Account creation failed. Please try again.')
      return
    }

    // Store order in sessionStorage so AuthContext SIGNED_IN handler creates it.
    // This is the single reliable mechanism: it works whether signInWithPassword
    // fires immediately or after email confirmation, and is not affected by
    // PublicRoute unmounting this component mid-flight.
    console.log('[QuoteForm] Storing pendingOrder:', orderPayload)
    sessionStorage.setItem('pendingOrder', JSON.stringify({ ...orderPayload, intendedEmail: email.trim().toLowerCase() }))
    if (selectedFiles.length > 0) await savePendingFilesToIDB(selectedFiles)

    // If signUp already created a session (email confirmation disabled),
    // guarantee the profile row exists NOW so that when SIGNED_IN fires inside
    // signInWithPassword the order INSERT doesn't hit a FK violation.
    console.log('[QuoteForm] data.session present:', !!data.session, 'newUserId:', newUserId)
    if (data.session) {
      const { data: existingProfile, error: profileSelectError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', newUserId)
        .maybeSingle()
      console.log('[QuoteForm] profile lookup:', { existingProfile, profileSelectError })

      if (!existingProfile) {
        const { error: profileInsertError } = await supabase.from('profiles').insert({
          id: newUserId,
          email: email,
          full_name: fullName || email.split('@')[0],
          site_id: 1,
          student_id: 'EA-' + Date.now().toString().slice(-6),
        })
        console.log('[QuoteForm] profile insert error:', profileInsertError)
      }
    }

    // Explicitly sign in this fires SIGNED_IN inside signInWithPassword so
    // AuthContext picks up the pendingOrder and creates the order automatically.
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: tempPassword,
    })

    if (signInError || !signInData?.session) {
      // Sign-in failed (e.g. email confirmation required).
      // pendingOrder stays in sessionStorage it will be processed by AuthContext
      // the next time the user signs in (after confirming email).
      setLoading(false)
      navigate('/login', { state: { newUser: true, email, tempPassword, message: 'Account created! Use the password below to log in and your order will be placed automatically.' } })
      return
    }

    // signInWithPassword succeeded SIGNED_IN has already fired and AuthContext
    // is creating the order from sessionStorage in the background.
    // Send ONE combined email: verification link + temp password
    // so the user has their auto-generated password for future logins.
    try {
      const { data: { session } } = await supabase.auth.getSession()
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-verification-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          appOrigin: window.location.origin,
          tempPassword,
        }),
      }).catch(() => {})
    } catch (_) {}

    setLoading(false)
    navigate('/dashboard')
  }

  return (
    <div className="quote-card">
      <style>{`
        .qf-toggle { display: inline-flex; background: #f1f5f9; border-radius: 999px; padding: 3px; gap: 2px; }
        .qf-toggle-btn { padding: 6px 16px; border-radius: 999px; border: none; cursor: pointer; font-size: 13px; font-weight: 700; transition: all 0.18s; background: transparent; color: #64748b; }
        .qf-toggle-btn.active { background: #16a34a; color: white; box-shadow: 0 2px 8px rgba(22,163,74,0.28); }
        .qf-toggle-btn:hover:not(.active) { color: #374151; }
        .qf-step-bar { display: flex; align-items: center; gap: 0; margin-bottom: 20px; }
        .qf-step { display: flex; align-items: center; gap: 8px; flex: 1; }
        .qf-step-dot { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 800; flex-shrink: 0; transition: all 0.2s; }
        .qf-step-dot.done { background: #16a34a; color: white; }
        .qf-step-dot.active { background: #16a34a; color: white; box-shadow: 0 0 0 3px rgba(22,163,74,0.2); }
        .qf-step-dot.idle { background: #e2e8f0; color: #94a3b8; }
        .qf-step-label { font-size: 12px; font-weight: 700; }
        .qf-step-label.active { color: #16a34a; }
        .qf-step-label.idle { color: #94a3b8; }
        .qf-step-label.done { color: #16a34a; }
        .qf-step-line { flex: 1; height: 2px; background: #e2e8f0; margin: 0 8px; border-radius: 2px; position: relative; overflow: hidden; }
        .qf-step-line.done::after { content: ''; position: absolute; inset: 0; background: #16a34a; }
        .qf-drop-zone { border: 2px dashed #d1d5db; border-radius: 10px; padding: 16px; cursor: pointer; transition: all 0.18s; background: #fafafa; text-align: center; }
        .qf-drop-zone:hover { border-color: #94a3b8; background: #f8fafc; }
        .qf-drop-zone.drag-active { border-color: #16a34a; background: #f0fdf4; }
        .qf-file-chip { display: inline-flex; align-items: center; gap: 6px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 4px 10px; font-size: 12px; color: #15803d; font-weight: 600; max-width: 100%; overflow: hidden; }
        .qf-file-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .qf-remove-file { background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 16px; line-height: 1; padding: 0; flex-shrink: 0; }
        .qf-remove-file:hover { color: #ef4444; }
        .qf-count-hint { font-size: 11px; color: #94a3b8; margin-top: 4px; padding-left: 2px; }
        .qf-back-btn { flex: 1; padding: 13px; background: #f1f5f9; color: #374151; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; transition: background 0.15s; }
        .qf-back-btn:hover { background: #e2e8f0; }
        .qf-summary-chip { display: inline-flex; align-items: center; gap: 5px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 4px 10px; font-size: 12px; color: #15803d; font-weight: 600; }
      `}</style>

      <div className="quote-card-head">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>

      {expertName && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
          {expertAvatar && <img src={expertAvatar} alt={expertName} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />}
          <div>
            <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selected Expert</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{expertName}</div>
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="qf-step-bar">
        <div className="qf-step">
          <div className={`qf-step-dot ${step === 1 ? 'active' : 'done'}`}>{step > 1 ? '✓' : '1'}</div>
          <span className={`qf-step-label ${step === 1 ? 'active' : 'done'}`}>Order Details</span>
        </div>
        <div className={`qf-step-line ${step > 1 ? 'done' : ''}`} />
        <div className="qf-step">
          <div className={`qf-step-dot ${step === 2 ? 'active' : 'idle'}`}>2</div>
          <span className={`qf-step-label ${step === 2 ? 'active' : 'idle'}`}>Your Info</span>
        </div>
      </div>

      {/* ── STEP 1: Order Details ── */}
      {step === 1 && (
        <form className="quote-form" onSubmit={handleNext}>
          {/* Subject + Service Type */}
          <div className="form-row two">
            <input type="text" name="subject" value={formData.subject} onChange={handleChange} placeholder="Subject" required />
            <select name="serviceType" value={formData.serviceType} onChange={handleChange} required>
              <option value="" disabled>Service Type</option>
              <option>Assignment</option>
              <option>Essay</option>
              <option>Dissertation</option>
              <option>Coursework</option>
              <option>Case Study</option>
              <option>Programming</option>
              <option>Research Paper</option>
              <option>Proofreading &amp; Editing</option>
              <option>Homework Help</option>
              <option>Business Writing</option>
              <option>Lab Report</option>
              <option>Online Test</option>
            </select>
          </div>

          {/* Academic Level + Deadline */}
          <div className="form-row two">
            <select name="academicLevel" value={formData.academicLevel} onChange={handleChange}>
              <option>High School</option>
              <option>Undergraduate</option>
              <option>Masters</option>
              <option>PhD</option>
            </select>
            <div className="datetime-wrap" style={{ position: 'relative' }}>
              <input type="datetime-local" name="deadline" value={formData.deadline} onChange={handleChange} min={getMinDateTime()} required className="datetime-input" style={{ width: '100%' }} />
            </div>
          </div>

          {/* Count Stepper & Toggle */}
          <div className="qty-section" style={{ marginBottom: 16 }}>
            <div className="qty-header">
              <label className="sp-form-label" style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 0, display: 'block' }}>Quantity</label>
              <span className="qty-approx">
                {countMode === 'pages'
                  ? `≈ ${(parseInt(formData.pages) || 0) * 275} words`
                  : `≈ ${Math.ceil((parseInt(formData.wordCount) || 0) / 275)} pages`}
              </span>
            </div>
            <div className="qty-controls">
              <div className="sp-stepper">
                <button type="button" onClick={() => {
                  if (countMode === 'pages') {
                    setFormData(f => ({ ...f, pages: Math.max(1, (parseInt(f.pages) || 1) - 1) }))
                  } else {
                    setFormData(f => ({ ...f, wordCount: Math.max(275, (parseInt(f.wordCount) || 275) - 275) }))
                  }
                }}>-</button>
                <input
                  type="number"
                  value={countMode === 'pages' ? formData.pages : formData.wordCount}
                  onChange={(e) => {
                    const val = e.target.value
                    if (countMode === 'pages') {
                      setFormData(f => ({ ...f, pages: val }))
                    } else {
                      setFormData(f => ({ ...f, wordCount: val }))
                    }
                  }}
                  onBlur={(e) => {
                    let val = parseInt(e.target.value)
                    if (countMode === 'pages') {
                      if (isNaN(val) || val < 1) val = 1
                      setFormData(f => ({ ...f, pages: val }))
                    } else {
                      if (isNaN(val) || val < 275) val = 275
                      setFormData(f => ({ ...f, wordCount: val }))
                    }
                  }}
                />
                <button type="button" onClick={() => {
                  if (countMode === 'pages') {
                    setFormData(f => ({ ...f, pages: (parseInt(f.pages) || 0) + 1 }))
                  } else {
                    setFormData(f => ({ ...f, wordCount: (parseInt(f.wordCount) || 0) + 275 }))
                  }
                }}>+</button>
              </div>

              <div className="sp-mode-toggle" style={{ gap: 8 }}>
                <span style={{ color: countMode === 'pages' ? '#0f172a' : '#64748b', fontSize: 14 }}>Pages</span>
                <label className="sp-switch">
                  <input
                    type="checkbox"
                    checked={countMode === 'words'}
                    onChange={(e) => {
                      const isWords = e.target.checked
                      setCountMode(isWords ? 'words' : 'pages')
                      if (isWords) {
                        setFormData(f => ({ ...f, wordCount: (parseInt(f.pages) || 1) * 275 }))
                      } else {
                        setFormData(f => ({ ...f, pages: Math.ceil((parseInt(f.wordCount) || 0) / 275) || 1 }))
                      }
                    }}
                  />
                  <span className="sp-slider"></span>
                </label>
                <span style={{ color: countMode === 'words' ? '#0f172a' : '#64748b', fontSize: 14 }}>Words</span>
              </div>
            </div>
          </div>

          {/* Formatting Style */}
          <div className="form-row">
            <label className="sp-form-label" style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
              Formatting Style
            </label>
            <select name="formattingStyle" value={formData.formattingStyle} onChange={handleChange} required style={{ width: '100%', padding: '11px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }}>
              <option>Not Required</option>
              <option>APA 7th Edition</option>
              <option>MLA 9th Edition</option>
              <option>Chicago 17th Edition</option>
              <option>Harvard</option>
              <option>Vancouver</option>
              <option>IEEE</option>
              <option>Turabian</option>
              <option>AMA</option>
              <option>Oxford</option>
              <option>OSCOLA</option>
              <option>ASA</option>
            </select>
          </div>

          {/* Requirements */}
          <div className="form-row">
            <textarea name="requirements" value={formData.requirements} onChange={handleChange} rows="3" placeholder="Brief requirements (optional)" />
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14, marginBottom: 4 }}>
              ⚠️ {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-block">
            Next &nbsp;→
          </button>
          <p className="form-note">🔒 100% Secure · No spam · Free quote in 4 mins</p>

          <div className="quote-trust-badges">
            <div className="money-back-badge">
              <span className="badge-icon">🛡️</span>
              <span><strong>100% Money-Back</strong> Guarantee</span>
            </div>
            <PaymentCardIcons width={44} height={28} gap={8} />
          </div>
        </form>
      )}

      {/* ── STEP 2: Your Info ── */}
      {step === 2 && (
        <form className="quote-form" onSubmit={handleSubmit}>

          {/* Order summary pill row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {formData.subject && <span className="qf-summary-chip">📚 {formData.subject}</span>}
            {formData.serviceType && <span className="qf-summary-chip">🖊 {formData.serviceType}</span>}
            <span className="qf-summary-chip">
              {countMode === 'pages' ? `📄 ${formData.pages} pages` : `📝 ${formData.wordCount} words`}
            </span>
            {formData.academicLevel && <span className="qf-summary-chip">🎓 {formData.academicLevel}</span>}
          </div>

          {/* Full Name */}
          <div className="form-row">
            <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} placeholder="Full Name" required />
          </div>

          {/* Email */}
          <div className="form-row">
            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email address" required />
          </div>

          {/* File Upload */}
          <div className="form-row">
            <div
              className={`qf-drop-zone${dragOver ? ' drag-active' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>📎</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{dragOver ? 'Drop files here' : 'Attach Files (optional)'}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Click or drag &amp; drop · Max 20 MB per file</div>
              <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
            </div>
            {selectedFiles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {selectedFiles.map((f, i) => (
                  <div key={i} className="qf-file-chip">
                    <span title={f.name}>{f.name}</span>
                    <span style={{ color: '#94a3b8', fontSize: 11, flexShrink: 0 }}>({formatBytes(f.size)})</span>
                    <button type="button" className="qf-remove-file" onClick={e => { e.stopPropagation(); setSelectedFiles(p => p.filter((_, idx) => idx !== i)) }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14, marginBottom: 4 }}>
              ⚠️ {error}
            </div>
          )}

          {/* Back + Submit */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="qf-back-btn" onClick={() => { setStep(1); setError('') }}>← Back</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Processing...
                </span>
              ) : 'Get Free Quote →'}
            </button>
          </div>

          <p className="form-note">🔒 100% Secure · No spam · Free quote in 4 mins</p>

          <div className="quote-trust-badges">
            <div className="money-back-badge">
              <span className="badge-icon">🛡️</span>
              <span><strong>100% Money-Back</strong> Guarantee</span>
            </div>
            <PaymentCardIcons width={44} height={28} gap={8} />
          </div>
        </form>
      )}
    </div>
  )
}

export default QuoteForm
