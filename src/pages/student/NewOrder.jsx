import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import StudentLayout from './StudentLayout'
import { useAuth } from '../../contexts/AuthContext'
import { createOrder } from '../../lib/orders'
import { uploadOrderFiles, validateFile, formatFileSize, getFileIcon } from '../../lib/uploads'
import { validateCoupon } from '../../lib/coupons'
import { supabase } from '../../lib/supabase'

function default7DayDeadline() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  // Random time between 9 AM and 9 PM, on a 15-min boundary
  const hour = 9 + Math.floor(Math.random() * 13)
  const minute = [0, 15, 30, 45][Math.floor(Math.random() * 4)]
  d.setHours(hour, minute, 0, 0)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function NewOrder() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const expertName = searchParams.get('expert') || ''
  const expertAvatar = searchParams.get('expertAvatar') || ''
  const { user } = useAuth()
  const fileInputRef = useRef(null)

  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState([])  // Files chosen but not uploaded yet
  const [dragOver, setDragOver] = useState(false)

  const [couponCode, setCouponCode] = useState('')
  const [couponStatus, setCouponStatus] = useState(null) // null | 'checking' | 'valid' | 'invalid'
  const [couponData, setCouponData] = useState(null)
  const [couponError, setCouponError] = useState('')

  // Auto-apply SAVE50 for first-time users (zero existing orders)
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
      if (cancelled || count !== 0) return
      setCouponCode('SAVE50')
      await applyCoupon('SAVE50')
    })()
    return () => { cancelled = true }
  }, [user?.id])

  async function applyCoupon(overrideCode) {
    const code = (typeof overrideCode === 'string' ? overrideCode : couponCode).trim().toUpperCase()
    if (!code) return
    setCouponStatus('checking')
    setCouponData(null)
    setCouponError('')

    const result = await validateCoupon(code, 0, user?.id)
    if (!result.valid) {
      setCouponStatus('invalid')
      setCouponError(result.error || 'Invalid or expired coupon code.')
      return
    }

    // Check if this coupon is already sitting on another unpaid order for this user
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', user.id)
      .eq('coupon_code', code)
      .neq('payment_status', 'paid')
      .limit(1)

    if (existing && existing.length > 0) {
      setCouponStatus('invalid')
      setCouponError('This coupon is already applied to one of your pending orders. Pay or delete that order first.')
      return
    }

    setCouponStatus('valid')
    setCouponData(result.coupon)
  }

  const [countMode, setCountMode] = useState('words') // 'words' | 'pages'
  const [customSubject, setCustomSubject] = useState('')
  const [customType, setCustomType] = useState('')
  const [form, setForm] = useState({
    type: '',
    subject: '',
    title: '',
    academicLevel: 'Undergraduate',
    deadline: default7DayDeadline(),
    description: '',
    wordCount: 1000,
    pages: 4,
    formattingStyle: 'Not Required'
  })

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  // ============================================================
  // FILE HANDLING
  // ============================================================
  const handleFileSelect = (files) => {
    const newFiles = Array.from(files)
    const validFiles = []
    const errors = []

    for (const file of newFiles) {
      const validation = validateFile(file)
      if (validation.valid) {
        validFiles.push(file)
      } else {
        errors.push(validation.error)
      }
    }

    if (errors.length > 0) {
      setError(errors.join(' '))
    }

    setSelectedFiles(prev => [...prev, ...validFiles])
  }

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files)
      e.target.value = ''  // Reset so same file can be selected again
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setDragOver(false)
  }

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  // ============================================================
  // SUBMIT ORDER
  // ============================================================
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.type || !form.subject || !form.deadline) {
      return setError('Please fill in all required fields (marked with *)')
    }
    if (form.type === 'Other' && !customType.trim()) {
      return setError('Please type your assignment type')
    }
    if (form.subject === 'Other' && !customSubject.trim()) {
      return setError('Please type your subject name')
    }
    if (countMode === 'words' && (!form.wordCount || form.wordCount < 275)) {
      return setError('Word count must be at least 275 words')
    }
    if (countMode === 'pages' && (!form.pages || form.pages < 1)) {
      return setError('Pages must be at least 1')
    }

    setSubmitting(true)

    try {
      // 1. Create the order first
      const finalWordCount = countMode === 'pages'
        ? (parseInt(form.pages) || 1) * 275
        : parseInt(form.wordCount) || 1000

      const resolvedSubject = form.subject === 'Other' ? customSubject.trim() : form.subject
      const resolvedType = form.type === 'Other' ? customType.trim() : form.type

      const result = await createOrder({
        title: form.title || `${resolvedSubject} ${resolvedType}`,
        subject: resolvedSubject,
        type: resolvedType,
        academicLevel: form.academicLevel,
        deadline: form.deadline,
        description: form.description,
        wordCount: finalWordCount,
        formattingStyle: form.formattingStyle,
        status: expertName ? 'in_review' : 'pending',
        expertName: expertName || null,
        expertAvatar: expertAvatar || null,
        couponCode: couponStatus === 'valid' && couponData ? couponData.code : null,
      })

      if (!result.success) {
        setError(result.error || 'Failed to place order. Please try again.')
        setSubmitting(false)
        return
      }

      // 2. Upload files (if any)
      let uploadedFileCount = 0
      if (selectedFiles.length > 0) {
        setUploading(true)
        const uploadResult = await uploadOrderFiles(
          selectedFiles,
          result.order.id,
          'instruction'
        )
        uploadedFileCount = uploadResult.uploaded.length
        if (uploadResult.errors.length > 0) {
          console.warn('Some files failed:', uploadResult.errors)
        }
        setUploading(false)
      }

      setSuccess({
        ...result.order,
        fileCount: uploadedFileCount
      })
      setSubmitting(false)

      setTimeout(() => {
        navigate('/dashboard/orders')
      }, 5000)
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      setSubmitting(false)
      setUploading(false)
    }
  }

  const minDateTime = () => {
    const d = new Date()
    d.setHours(d.getHours() + 1)
    return d.toISOString().slice(0, 16)
  }

  // ============================================================
  // SUCCESS SCREEN
  // ============================================================
  if (success) {
    return (
      <StudentLayout title="Order Received!">
        <div className="sp-card" style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
          <div className="sp-card-body" style={{ padding: '48px 24px' }}>
            <div style={{
              width: '88px', height: '88px',
              background: 'rgba(22,163,74,0.12)',
              borderRadius: '50%',
              display: 'grid', placeItems: 'center',
              margin: '0 auto 20px', fontSize: '42px'
            }}>✅</div>
            <h2 style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: '30px', color: 'var(--sp-primary)',
              marginBottom: '8px', letterSpacing: '-0.02em'
            }}>
              Order Received!
            </h2>
            <p style={{ color: 'var(--sp-muted)', maxWidth: '440px', margin: '0 auto 24px' }}>
              We've received your order details{success.fileCount > 0 && ` and ${success.fileCount} file${success.fileCount > 1 ? 's' : ''}`}. Our team will review your requirements and contact you with a custom quote shortly.
            </p>

            <div style={{
              background: 'var(--sp-surface)',
              padding: '24px', borderRadius: '12px',
              marginBottom: '20px', textAlign: 'left'
            }}>
              <div style={{ marginBottom: '16px', textAlign: 'center', borderBottom: '1px dashed var(--sp-border)', paddingBottom: '14px' }}>
                <span style={{ fontSize: '11px', color: 'var(--sp-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Your Order Number</span>
                <div style={{ fontFamily: 'monospace', fontSize: '17px', fontWeight: 700, color: 'var(--sp-amber)', marginTop: '6px', wordBreak: 'break-all' }}>
                  {success.order_number}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '14px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--sp-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Subject</span>
                  <div style={{ color: 'var(--sp-primary)', fontWeight: 600, marginTop: '2px' }}>{success.subject}</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--sp-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Type</span>
                  <div style={{ color: 'var(--sp-primary)', fontWeight: 600, marginTop: '2px' }}>{success.type}</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--sp-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Word Count</span>
                  <div style={{ color: 'var(--sp-primary)', fontWeight: 600, marginTop: '2px' }}>{success.word_count} words</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--sp-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                    {success.fileCount > 0 ? 'Files Attached' : 'Status'}
                  </span>
                  <div style={{
                    color: success.fileCount > 0 ? 'var(--sp-green)' : 'var(--sp-amber)',
                    fontWeight: 700, marginTop: '2px'
                  }}>
                    {success.fileCount > 0 ? `📎 ${success.fileCount} file${success.fileCount > 1 ? 's' : ''}` : `● ${success.status}`}
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              background: 'rgba(22,163,74,0.06)',
              border: '1px solid rgba(22,163,74,0.2)',
              padding: '16px 20px', borderRadius: '10px',
              marginBottom: '24px', textAlign: 'left'
            }}>
              <div style={{ fontWeight: 700, color: 'var(--sp-green)', marginBottom: '8px', fontSize: '14px' }}>
                📞 What happens next?
              </div>
              <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--sp-charcoal)', lineHeight: 1.7 }}>
                <li>Our team reviews your requirements{success.fileCount > 0 && ' and uploaded files'}</li>
                <li>We'll contact you within <strong>4 minutes</strong> with a quote</li>
                <li>Once you approve the quote, an expert is assigned</li>
                <li>You'll receive your completed work before the deadline</li>
              </ol>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="sp-btn sp-btn-primary" onClick={() => navigate('/dashboard/orders')}>
                View My Orders →
              </button>
              <button className="sp-btn sp-btn-secondary" onClick={() => {
                setSuccess(null)
                setSelectedFiles([])
                setForm({
                  type: '', subject: '', title: '',
                  academicLevel: 'Undergraduate', deadline: '',
                  description: '', wordCount: 1000
                })
              }}>
                Place Another Order
              </button>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--sp-muted)', marginTop: '20px' }}>
              Auto-redirecting in 5 seconds...
            </p>
          </div>
        </div>
      </StudentLayout>
    )
  }

  // ============================================================
  // MAIN FORM
  // ============================================================
  return (
    <StudentLayout title="Place New Order">
      <div className="sp-card" style={{ maxWidth: '880px' }}>
        <div className="sp-card-header">
          <h3 className="sp-card-title">+ Place New Order</h3>
        </div>

        <form className="sp-card-body" onSubmit={handleSubmit}>
          {expertName && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#f0fdf4', border: '1px solid #bbf7d0',
              borderRadius: 10, padding: '12px 16px', marginBottom: 20
            }}>
              {expertAvatar && (
                <img src={expertAvatar} alt={expertName} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              )}
              <div>
                <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selected Expert</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{expertName}</div>
              </div>
            </div>
          )}

          {error && (
            <div style={{
              padding: '14px 16px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              borderRadius: '10px',
              marginBottom: '20px',
              fontSize: '14px',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Type + Subject */}
          <div className="sp-form-row">
            <div className="sp-form-group">
              <label className="sp-form-label">Assignment Type *</label>
              {form.type === 'Other' ? (
                <>
                  <input
                    type="text"
                    className="sp-form-input"
                    placeholder="Type your assignment type..."
                    value={customType}
                    onChange={e => setCustomType(e.target.value)}
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => { setForm(f => ({ ...f, type: '' })); setCustomType('') }}
                    style={{ background: 'none', border: 'none', color: '#16a34a', fontSize: 12, cursor: 'pointer', marginTop: 4, padding: 0, fontWeight: 600 }}
                  >
                    ← Back to type list
                  </button>
                </>
              ) : (
                <select name="type" className="sp-form-input" value={form.type} onChange={handleChange} required>
                  <option value="">Select type</option>
                  <option>Essay</option>
                  <option>Research Paper</option>
                  <option>Case Study</option>
                  <option>Assignment</option>
                  <option>Dissertation</option>
                  <option>Thesis</option>
                  <option>Online Exam</option>
                  <option>Online Class</option>
                  <option>Lab Report</option>
                  <option>Coursework</option>
                  <option>Other</option>
                </select>
              )}
            </div>

            <div className="sp-form-group">
              <label className="sp-form-label">Subject *</label>
              {form.subject === 'Other' ? (
                <>
                  <input
                    type="text"
                    className="sp-form-input"
                    placeholder="Type your subject..."
                    value={customSubject}
                    onChange={e => setCustomSubject(e.target.value)}
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => { setForm(f => ({ ...f, subject: '' })); setCustomSubject('') }}
                    style={{ background: 'none', border: 'none', color: '#16a34a', fontSize: 12, cursor: 'pointer', marginTop: 4, padding: 0, fontWeight: 600 }}
                  >
                    ← Back to subject list
                  </button>
                </>
              ) : (
                <select name="subject" className="sp-form-input" value={form.subject} onChange={handleChange} required>
                  <option value="">Select subject</option>
                  <option>Computer Science</option>
                  <option>Nursing</option>
                  <option>Finance</option>
                  <option>Marketing</option>
                  <option>Business Management</option>
                  <option>Accounting</option>
                  <option>Economics</option>
                  <option>Mathematics</option>
                  <option>Statistics</option>
                  <option>Engineering</option>
                  <option>Psychology</option>
                  <option>Sociology</option>
                  <option>Literature</option>
                  <option>History</option>
                  <option>Law</option>
                  <option>Medicine</option>
                  <option>Biology</option>
                  <option>Chemistry</option>
                  <option>Physics</option>
                  <option>Other</option>
                </select>
              )}
            </div>
          </div>

          {/* Title + Coupon Code */}
          <div className="sp-form-row">
            <div className="sp-form-group">
              <label className="sp-form-label">Title / Topic (Optional)</label>
              <input
                type="text" name="title" className="sp-form-input"
                placeholder="e.g., Database Normalization Theory"
                value={form.title} onChange={handleChange}
              />
            </div>
            <div className="sp-form-group">
              <label className="sp-form-label">Coupon Code (Optional)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text" className="sp-form-input"
                  placeholder="e.g., WELCOME20"
                  value={couponCode}
                  onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponStatus(null); setCouponData(null) }}
                  onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                  style={{ borderColor: couponStatus === 'valid' ? '#16a34a' : couponStatus === 'invalid' ? '#ef4444' : undefined }}
                />
                <button
                  type="button"
                  onClick={() => applyCoupon()}
                  disabled={!couponCode.trim() || couponStatus === 'checking'}
                  style={{ flexShrink: 0, padding: '0 16px', background: '#0f172a', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: !couponCode.trim() ? 0.5 : 1 }}
                >
                  {couponStatus === 'checking' ? '...' : 'Apply'}
                </button>
              </div>
              {couponStatus === 'valid' && couponData && (
                <p style={{ margin: '5px 0 0', fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                  ✅ {couponData.discount_type === 'percentage' ? `${couponData.discount_value}% off applied!` : `$${couponData.discount_value} off applied!`}
                </p>
              )}
              {couponStatus === 'invalid' && (
                <p style={{ margin: '5px 0 0', fontSize: 12, color: '#ef4444', fontWeight: 600 }}>⚠️ {couponError || 'Invalid or expired coupon code.'}</p>
              )}
            </div>
          </div>

          {/* Deadline + Level */}
          <div className="sp-form-row">
            <div className="sp-form-group">
              <label className="sp-form-label">Deadline *</label>
              <input
                type="datetime-local" name="deadline" className="sp-form-input"
                value={form.deadline} onChange={handleChange}
                min={minDateTime()} required
              />
              <p style={{ fontSize: '12px', color: 'var(--sp-muted)', marginTop: '4px' }}>
                Minimum 3 hour from now. Tighter deadlines may have rush charges.
              </p>
            </div>

            <div className="sp-form-group">
              <label className="sp-form-label">Academic Level *</label>
              <select name="academicLevel" className="sp-form-input" value={form.academicLevel} onChange={handleChange} required>
                <option>High School</option>
                <option>Undergraduate</option>
                <option>Masters</option>
                <option>PhD</option>
              </select>
            </div>
          </div>

          {/* Formatting Style & Quantity (Side by Side) */}
          <div className="sp-form-row" style={{ alignItems: 'flex-start' }}>
            <div className="sp-form-group" style={{ marginBottom: 0 }}>
              <label className="sp-form-label">Formatting Style</label>
              <select name="formattingStyle" className="sp-form-input" value={form.formattingStyle} onChange={handleChange}>
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

            <div className="qty-section" style={{ marginBottom: 0 }}>
              <div className="qty-header">
                <label className="sp-form-label" style={{ marginBottom: 0 }}>Quantity</label>
                <span className="qty-approx">
                  {countMode === 'pages'
                    ? `≈ ${(parseInt(form.pages) || 0) * 275} words`
                    : `≈ ${Math.ceil((parseInt(form.wordCount) || 0) / 275)} pages`}
                </span>
              </div>
              <div className="qty-controls">
                <div className="sp-stepper">
                  <button type="button" onClick={() => {
                    if (countMode === 'pages') {
                      setForm(f => ({ ...f, pages: Math.max(1, (parseInt(f.pages) || 1) - 1) }))
                    } else {
                      setForm(f => ({ ...f, wordCount: Math.max(275, (parseInt(f.wordCount) || 275) - 275) }))
                    }
                  }}>-</button>
                  <input
                    type="number"
                    value={countMode === 'pages' ? form.pages : form.wordCount}
                    onChange={(e) => {
                      const val = e.target.value
                      if (countMode === 'pages') {
                        setForm(f => ({ ...f, pages: val }))
                      } else {
                        setForm(f => ({ ...f, wordCount: val }))
                      }
                    }}
                    onBlur={(e) => {
                      let val = parseInt(e.target.value)
                      if (countMode === 'pages') {
                        if (isNaN(val) || val < 1) val = 1
                        setForm(f => ({ ...f, pages: val }))
                      } else {
                        if (isNaN(val) || val < 275) val = 275
                        setForm(f => ({ ...f, wordCount: val }))
                      }
                    }}
                  />
                  <button type="button" onClick={() => {
                    if (countMode === 'pages') {
                      setForm(f => ({ ...f, pages: (parseInt(f.pages) || 0) + 1 }))
                    } else {
                      setForm(f => ({ ...f, wordCount: (parseInt(f.wordCount) || 0) + 275 }))
                    }
                  }}>+</button>
                </div>

                <div className="sp-mode-toggle">
                  <span style={{ color: countMode === 'pages' ? '#0f172a' : '#64748b' }}>Pages</span>
                  <label className="sp-switch">
                    <input
                      type="checkbox"
                      checked={countMode === 'words'}
                      onChange={(e) => {
                        const isWords = e.target.checked
                        setCountMode(isWords ? 'words' : 'pages')
                        if (isWords) {
                          setForm(f => ({ ...f, wordCount: (parseInt(f.pages) || 1) * 275 }))
                        } else {
                          setForm(f => ({ ...f, pages: Math.ceil((parseInt(f.wordCount) || 0) / 275) || 1 }))
                        }
                      }}
                    />
                    <span className="sp-slider"></span>
                  </label>
                  <span style={{ color: countMode === 'words' ? '#0f172a' : '#64748b' }}>Words</span>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="sp-form-group">
            <label className="sp-form-label">Instructions / Description</label>
            <textarea
              name="description" className="sp-form-input" rows="6"
              placeholder="Provide detailed instructions, rubric, formatting requirements, references needed, etc."
              value={form.description} onChange={handleChange}
              style={{ resize: 'vertical', minHeight: '120px' }}
            />
          </div>

          {/* ============================================ */}
          {/* FILE UPLOAD AREA */}
          {/* ============================================ */}
          <div className="sp-form-group">
            <label className="sp-form-label">📎 Attach Files (Optional)</label>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--sp-green)' : 'var(--sp-border)'}`,
                background: dragOver ? 'rgba(22,163,74,0.05)' : 'var(--sp-surface)',
                borderRadius: '12px',
                padding: '32px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>📁</div>
              <div style={{ fontWeight: 700, color: 'var(--sp-primary)', marginBottom: '4px' }}>
                {dragOver ? 'Drop files here' : 'Click to upload or drag & drop'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--sp-muted)' }}>
                PDF, DOC, DOCX, XLS, PPT, Images, ZIP Max 50MB per file
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,image/*"
              />
            </div>

            {/* Selected files list */}
            {selectedFiles.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--sp-muted)',
                  marginBottom: '10px'
                }}>
                  {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      background: 'var(--sp-surface)',
                      borderRadius: '10px',
                      border: '1px solid var(--sp-border)'
                    }}>
                      <div style={{ fontSize: '24px' }}>{getFileIcon(file.name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: 600,
                          fontSize: '14px',
                          color: 'var(--sp-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {file.name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--sp-muted)' }}>
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFile(idx)
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--sp-red)',
                          cursor: 'pointer',
                          fontSize: '20px',
                          width: '32px', height: '32px',
                          borderRadius: '6px'
                        }}
                        title="Remove file"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quote info banner */}
          <div className="sp-quote-banner" style={{
            background: 'linear-gradient(135deg, #16A34A 0%, #128a3d 100%)',
            color: 'white',
            padding: '20px 24px',
            borderRadius: '12px',
            marginBottom: '24px'
          }}>
            <div style={{ fontSize: '36px' }}>💬</div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: 'Fraunces, Georgia, serif',
                fontSize: '20px',
                fontWeight: 700,
                marginBottom: '4px'
              }}>
                Get Your Free Custom Quote
              </div>
              <p style={{ margin: 0, fontSize: '13px', opacity: 0.95, lineHeight: 1.5 }}>
                Place your order and our team will review your requirements and send you a custom quote within <strong>4 minutes</strong>. No obligation pay only when you approve.
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button" className="sp-btn sp-btn-secondary"
              onClick={() => navigate('/dashboard')}
              disabled={submitting || uploading}
            >
              Cancel
            </button>
            <button
              type="submit" className="sp-btn sp-btn-primary"
              disabled={submitting || uploading}
            >
              {uploading ? '📤 Uploading files...' :
                submitting ? '⏳ Submitting...' :
                  '🚀 Get Free Quote'}
            </button>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--sp-muted)', marginTop: '20px', textAlign: 'center' }}>
            🔒 Your order and files are secure. Free quote within 4 minutes.
          </p>
        </form>
      </div>
    </StudentLayout>
  )
}

export default NewOrder
