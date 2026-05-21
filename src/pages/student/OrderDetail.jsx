// ============================================================
// ORDER DETAIL Redesigned with Payment / Discount / Transactions
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { AlertCircle, X, Upload, FileText, Trash2 } from 'lucide-react'
import StudentLayout from './StudentLayout'
import { supabase } from '../../lib/supabase'
import { uploadFile, getOrderFiles, getFileUrl, formatFileSize, getFileIcon } from '../../lib/uploads'

const SITE_ID = 1

function parsePlanKey(key) {
  if (!key) return { type: 'full', count: 1 }
  const m = key.match(/^(weekly|biweekly)(\d+)$/)
  if (m) return { type: m[1], count: parseInt(m[2], 10) }
  if (key === 'weekly') return { type: 'weekly', count: 4 }
  if (key === 'biweekly') return { type: 'biweekly', count: 2 }
  if (key === 'splithalf') return { type: 'splithalf', count: 2 }
  return { type: 'full', count: 1 }
}

function OrderDetail() {
  const { orderId } = useParams()
  const navigate = useNavigate()

  const [order, setOrder]               = useState(null)
  const [orderFiles, setOrderFiles]     = useState([])
  const [orderLoading, setOrderLoading] = useState(true)
  const [txList, setTxList]             = useState([])
  const [isInfoOpen, setIsInfoOpen]     = useState(false)
  const [isBoostOpen, setIsBoostOpen]   = useState(true)
  const [isReworkOpen, setIsReworkOpen]     = useState(false)
  const [selectedServices, setSelectedServices] = useState(new Set())
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const [isEditOpen, setIsEditOpen]     = useState(false)
  const [editForm, setEditForm]         = useState({})
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError]       = useState('')

  const [reworkHover, setReworkHover]   = useState(false)
  const [feedbackHover, setFeedbackHover] = useState(false)
  const [serviceHover, setServiceHover] = useState(null)
  const [purchasedAddons, setPurchasedAddons] = useState(new Set())

  useEffect(() => { if (orderId) loadOrder() }, [orderId])

  async function loadOrder() {
    setOrderLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); setOrderLoading(false); return }

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      navigate('/dashboard/orders')
      setOrderLoading(false)
      return
    }

    setOrder(data)
    if (data.price > 0) loadTransactions(data)
    const { files } = await getOrderFiles(orderId)
    setOrderFiles(files || [])
    const { data: addons } = await supabase
      .from('order_addons')
      .select('addon_type')
      .eq('order_id', orderId)
      .eq('status', 'completed')
    if (addons) setPurchasedAddons(new Set(addons.map(a => a.addon_type)))
    setOrderLoading(false)
  }

  async function loadTransactions(ord) {
    const orderRef = ord.order_number || ''
    const idStr    = String(ord.id)
    const numOnly  = orderRef.replace(/^[A-Z]+-/i, '')

    const { data } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', ord.user_id)
      .eq('type', 'debit')
      .eq('status', 'completed')
      .order('created_at', { ascending: true })

    const relevant = (data || []).filter(t => {
      const desc = t.description || ''
      return (orderRef && desc.includes(orderRef)) || desc.includes(idStr) || (numOnly && desc.includes(numOnly))
    })
    const deduped = relevant.filter((t, i) => {
      if (i === 0) return true
      return Math.abs(new Date(t.created_at) - new Date(relevant[i - 1].created_at)) > 60_000
    })
    setTxList(deduped)
  }

  function fmt(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function fmtShort(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function addDays(base, days) {
    if (!base) return null
    const d = new Date(base)
    d.setDate(d.getDate() + days)
    return d
  }

  // ── Payment helpers ──────────────────────────────────────────
  function getInstallments() {
    if (!order || !order.price) return []
    const total   = order.price
    const paid    = order.paid_amount || 0
    let planKey = order.payment_plan
    if (!planKey && paid > 0 && paid < total) {
      const stored = localStorage.getItem(`payment_plan_${order.id}`)
      if (stored) planKey = stored
    }

    const { type: planType, count: planCount } = parsePlanKey(planKey)
    const anchor = txList[0] ? new Date(txList[0].created_at) : (order.updated_at ? new Date(order.updated_at) : null)

    if (planType === 'splithalf') {
      const h  = Math.round(total / 2 * 100) / 100
      const p1 = paid >= h - 0.01
      const p2 = paid >= total - 0.01
      return [
        { label: 'Before Work Starts', sub: '50%', amount: h, paid: p1, paidAt: p1 ? (txList[0]?.created_at || anchor) : null, dueDate: null },
        { label: 'Before Submission',  sub: '50%', amount: h, paid: p2, paidAt: p2 ? (txList[1]?.created_at || null)  : null, dueDate: null }
      ]
    }
    if (planType === 'biweekly' || planType === 'weekly') {
      const part = Math.round(total / planCount * 100) / 100
      const pct  = Math.round(100 / planCount)
      return Array.from({ length: planCount }, (_, i) => {
        const n = i + 1
        const paidN = paid >= part * n - 0.01
        const label = planType === 'weekly' ? `Week ${n}` : n === 1 ? 'Payment 1' : n === planCount ? 'Final Payment' : `Payment ${n}`
        const dueOffset = planType === 'weekly' ? (n - 1) * 7 : (n - 1) * 14
        return {
          label, sub: `${pct}%`, amount: part, paid: paidN,
          paidAt: paidN ? (txList[i]?.created_at || anchor) : null,
          dueDate: !paidN && n > 1 && anchor ? addDays(anchor, dueOffset) : null,
        }
      })
    }
    const isPaid = paid >= total - 0.01
    return [{ label: 'Full Payment', sub: '100%', amount: total, paid: isPaid, paidAt: isPaid ? (txList[0]?.created_at || anchor) : null, dueDate: null }]
  }

  const installments  = getInstallments()
  const statusColors  = { pending: ['#fef3c7','#d97706'], active: ['#dcfce7','#16a34a'], completed: ['#dbeafe','#2563eb'], cancelled: ['#fee2e2','#dc2626'] }
  const [statusBg, statusFg] = statusColors[order?.status?.toLowerCase()] || ['#f1f5f9','#64748b']

  const planLabels = { full: 'Full Payment', splithalf: 'Split Half', biweekly: 'Bi-Weekly', weekly: '4-Week Plan' }
  const planLabel  = planLabels[order?.payment_plan] || 'Full Payment'

  if (orderLoading) {
    return (
      <StudentLayout title="Order Details">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#94a3b8', fontSize: 16 }}>
          Loading order details...
        </div>
      </StudentLayout>
    )
  }

  if (!order) {
    return (
      <StudentLayout title="Order Details">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#94a3b8', fontSize: 16 }}>
          Order not found.
        </div>
      </StudentLayout>
    )
  }

  const total     = order.price || 0
  const paid      = order.paid_amount || 0
  const remaining = Math.max(0, total - paid)
  const pct       = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
  const hasDiscount  = order.original_price > order.price
  const discountPct  = hasDiscount ? Math.round((1 - order.price / order.original_price) * 100) : 0
  const isPaid       = order.payment_status === 'paid'

  const status   = order.status?.toLowerCase()
  const isActive = status === 'active'
  const isCompleted = status === 'completed'
  const hoursElapsed = isCompleted ? (Date.now() - new Date(order.updated_at).getTime()) / 3_600_000 : 0
  const reworkEnabled = isActive || (isCompleted && hoursElapsed < 96)
  
  const isEditable = status === 'pending' || status === 'in review'

  function handleOpenEdit() {
    if (!isEditable) return
    setEditForm({
      subject: order.subject || '',
      type: order.type || '',
      title: order.title || '',
      word_count: order.word_count || '',
      pages: order.pages || '',
      formatting_style: order.formatting_style || 'Not Required',
      academic_level: order.academic_level || 'Undergraduate',
      deadline: order.deadline ? new Date(order.deadline).toISOString().slice(0, 16) : ''
    })
    setEditError('')
    setIsEditOpen(true)
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    setIsSavingEdit(true)
    setEditError('')
    
    // Ensure deadline is parsed correctly
    let parsedDeadline = null
    if (editForm.deadline) {
      const d = new Date(editForm.deadline)
      if (!isNaN(d.getTime())) parsedDeadline = d.toISOString()
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setEditError('Not logged in'); setIsSavingEdit(false); return }

    const { error } = await supabase.from('orders').update({
      subject: editForm.subject,
      type: editForm.type,
      title: editForm.title,
      word_count: parseInt(editForm.word_count) || null,
      pages: parseInt(editForm.pages) || null,
      formatting_style: editForm.formatting_style,
      academic_level: editForm.academic_level,
      deadline: parsedDeadline
    }).eq('id', orderId).eq('user_id', user.id)

    if (error) {
      setEditError(error.message)
      setIsSavingEdit(false)
    } else {
      await loadOrder()
      setIsEditOpen(false)
      setIsSavingEdit(false)
    }
  }

  const SERVICES = [
    { key: 'revision',   emoji: '🔄', label: 'Revision Guarantee', price: 20, color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe', selBg: '#dbeafe', grad: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', desc: 'Get full revision support on your completed work until you are satisfied.' },
    { key: 'plagiarism', emoji: '📄', label: 'Plagiarism Check',    price: 8,  color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe', selBg: '#ede9fe', grad: 'linear-gradient(135deg,#7c3aed,#6d28d9)', desc: 'Full Turnitin originality report included with your submission.' },
    { key: 'priority',   emoji: '🛡️', label: 'Priority Support',    price: 12, color: '#be185d', bg: '#fdf4ff', border: '#fbcfe8', selBg: '#fce7f3', grad: 'linear-gradient(135deg,#ec4899,#be185d)', desc: '30-day dedicated support with callbacks & doubt resolution.', tooltip: 'We will provide complete support for 30 days which includes revision assistance, expert callback and doubt resolution.' },
  ]
  function toggleService(key) {
    setSelectedServices(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next })
  }
  const selectedServiceItems = SERVICES.filter(s => selectedServices.has(s.key) && !purchasedAddons.has(s.key))
  const servicesTotal = selectedServiceItems.reduce((sum, s) => sum + s.price, 0)

  return (
    <StudentLayout title="Order Details">
      <style>{`
        .od-hero { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); border-radius: 20px; padding: 28px 32px; margin-bottom: 24px; color: white; }
        .od-stat-chip { background: rgba(255,255,255,0.09); border-radius: 10px; padding: 8px 12px; flex: 1; min-width: 0; }
        .od-stat-label { font-size: 9px; opacity: 0.55; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
        .od-stat-value { font-weight: 700; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .od-grid { display: grid; grid-template-columns: 1fr 380px; gap: 20px; align-items: start; }
        .od-card { background: white; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden; }
        .od-card-header { padding: 16px 20px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 10px; }
        .od-card-title { font-size: 14px; font-weight: 700; color: #0f172a; }
        .od-info-row { display: flex; justify-content: space-between; align-items: center; padding: 11px 0; border-bottom: 1px solid #f8fafc; font-size: 13px; }
        .od-info-row:last-child { border-bottom: none; }
        .od-action-btn { width: 100%; padding: 13px; border-radius: 11px; font-weight: 600; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.2s; border: none; text-decoration: none; }
        .od-inst-row { display: flex; align-items: center; gap: 12px; padding: 13px 16px; border-bottom: 1px solid #f3f4f6; }
        .od-inst-row:last-child { border-bottom: none; }
        .od-hero-stats { display: flex; gap: 8px; }
        .od-hero-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 12px; }
        .od-hero-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0; }
        .od-hero-btns { display: flex; gap: 8px; }
        @media (max-width: 1024px) { .od-grid { grid-template-columns: 1fr; } }
        @media (max-width: 560px) {
          .od-hero-top { flex-direction: column; align-items: stretch; gap: 10px; }
          .od-hero-actions { flex-direction: row; align-items: flex-start; justify-content: space-between; gap: 12px; }
          .od-hero-btns { flex-direction: column; flex: 1; gap: 8px; }
          .od-hero-btns a { justify-content: center; width: 100%; box-sizing: border-box; }
        }
        @media (max-width: 640px) {
          .od-hero { padding: 20px 16px; border-radius: 14px; margin-bottom: 16px; }
          .od-hero-stats { flex-wrap: wrap; gap: 6px; }
          .od-stat-chip { flex: 1 1 calc(50% - 6px); padding: 8px 10px; }
          .od-stat-value { font-size: 12px; }
          .od-grid { gap: 14px; }
          .od-card-header { padding: 14px 16px; }
          .od-info-row { font-size: 12px; padding: 10px 0; }
          .od-action-btn { padding: 12px; font-size: 13px; }
        }
        @media (max-width: 420px) {
          .od-hero { padding: 16px 12px; }
          .od-hero-stats { gap: 5px; }
          .od-stat-chip { padding: 7px 8px; border-radius: 8px; }
          .od-stat-label { font-size: 9px; }
          .od-stat-value { font-size: 11px; }
        }
        .od-boost-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 580px) { .od-boost-grid { grid-template-columns: 1fr; } }
        .od-boost-card { border-radius: 16px; padding: 22px 20px; display: flex; flex-direction: column; gap: 0; position: relative; overflow: hidden; }
        .od-boost-feature { display: flex; align-items: center; gap: 9px; font-size: 13px; font-weight: 600; color: #374151; padding: 6px 0; }
        .od-boost-btn { width: 100%; padding: 12px; border: none; border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer; margin-top: 18px; transition: opacity 0.18s, transform 0.18s; }
        .od-boost-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .od-services-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        @media (max-width: 700px) { .od-services-grid { grid-template-columns: 1fr; } }
      `}</style>

      <Link to="/dashboard/orders" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13, marginBottom: 16, textDecoration: 'none', fontWeight: 600 }}>
        ← Back to My Orders
      </Link>

      {/* ── HERO BANNER ── */}
      <div className="od-hero">
        <div className="od-hero-top">
          <div>
            <div style={{ fontSize: 10, opacity: 0.55, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Order Details</div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{order.order_number || order.id}</div>
            <div style={{ fontSize: 13, opacity: 0.65, marginTop: 3 }}>{order.title || `${order.subject} ${order.type}`}</div>
          </div>
          <div className="od-hero-actions">
            <span style={{ background: statusBg, color: statusFg, fontWeight: 800, fontSize: 11, padding: '5px 14px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
              ● {order.status}
            </span>
            <div className="od-hero-btns">
              <Link to={`/dashboard/messages?orderId=${order.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#16a34a', border: '1px solid #15803d', color: 'white', textDecoration: 'none', padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700, boxShadow: '0 4px 12px rgba(22,163,74,0.35)' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                Chat
              </Link>
              <Link to={`/dashboard/files?order=${orderId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', textDecoration: 'none', padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600 }}>
                📥 Download Files
              </Link>
            </div>
          </div>
        </div>
        <div className="od-hero-stats">
          {[
            ['📚', 'Subject', order.subject],
            ['📝', 'Type', order.type],
            ['📄', 'Words', order.word_count ? `${order.word_count.toLocaleString()} words` : '—'],
            ['⏰', 'Deadline', fmtShort(order.deadline)]
          ].map(([icon, label, val]) => (
            <div key={label} className="od-stat-chip">
              <div className="od-stat-label">{icon} {label}</div>
              <div className="od-stat-value">{val || '—'}</div>
            </div>
          ))}
          {order.coupon_code && (
            <div className="od-stat-chip" style={{ background: 'rgba(22,163,74,0.18)', border: '1px solid rgba(74,222,128,0.35)' }}>
              <div className="od-stat-label">🎟️ Coupon</div>
              <div className="od-stat-value" style={{ fontFamily: 'monospace', letterSpacing: '0.08em', color: '#4ade80' }}>
                {order.coupon_code}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MODALS ── */}
      
      {/* ── EDIT ORDER MODAL ── */}
      {isEditOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 500, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>✏️</span> Edit Order Details
              </h2>
              <button onClick={() => setIsEditOpen(false)} style={{ background: 'white', border: '1px solid #e2e8f0', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer', transition: 'all 0.2s' }}>
                <X size={16} />
              </button>
            </div>
            
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              {editError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <AlertCircle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                  <div>{editError}</div>
                </div>
              )}
              
              <form id="editOrderForm" onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Subject</label>
                    <input type="text" value={editForm.subject} onChange={e => setEditForm(f => ({...f, subject: e.target.value}))} required style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Type</label>
                    <input type="text" value={editForm.type} onChange={e => setEditForm(f => ({...f, type: e.target.value}))} required style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Title</label>
                  <input type="text" value={editForm.title} onChange={e => setEditForm(f => ({...f, title: e.target.value}))} required style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Words</label>
                    <input type="number" value={editForm.word_count} onChange={e => setEditForm(f => ({...f, word_count: e.target.value}))} required style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Pages</label>
                    <input type="number" value={editForm.pages} onChange={e => setEditForm(f => ({...f, pages: e.target.value}))} required style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Formatting Style</label>
                  <select value={editForm.formatting_style} onChange={e => setEditForm(f => ({...f, formatting_style: e.target.value}))} required style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }}>
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

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Academic Level</label>
                  <select value={editForm.academic_level} onChange={e => setEditForm(f => ({...f, academic_level: e.target.value}))} required style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }}>
                    <option>High School</option>
                    <option>Undergraduate</option>
                    <option>Masters</option>
                    <option>PhD</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Deadline</label>
                  <input type="datetime-local" value={editForm.deadline} onChange={e => setEditForm(f => ({...f, deadline: e.target.value}))} required style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }} />
                </div>
              </form>
            </div>
            
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="button" onClick={() => setIsEditOpen(false)} style={{ padding: '10px 18px', background: 'white', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" form="editOrderForm" disabled={isSavingEdit} style={{ padding: '10px 24px', background: '#3b82f6', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, color: 'white', cursor: isSavingEdit ? 'not-allowed' : 'pointer', opacity: isSavingEdit ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TWO-COLUMN GRID ── */}
      <div className="od-grid">

        {/* ═══ LEFT COLUMN ═══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Order Info card */}
          <div className="od-card">
            <div className="od-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>📦</span>
                <span className="od-card-title">Order Information</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isEditable && (
                  <button
                    onClick={handleOpenEdit}
                    style={{
                      background: '#eff6ff',
                      color: '#3b82f6',
                      border: '1px solid #bfdbfe',
                      padding: '4px 10px', borderRadius: '6px', fontSize: '12px',
                      fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    Edit Order
                  </button>
                )}
                <button
                  onClick={() => setIsInfoOpen(v => !v)}
                  style={{
                    width: 28, height: 28, borderRadius: '6px',
                    background: '#f1f5f9', border: '1px solid #e2e8f0',
                    color: '#475569', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 700, lineHeight: 1, flexShrink: 0
                  }}
                  aria-label={isInfoOpen ? 'Collapse' : 'Expand'}
                >
                  {isInfoOpen ? '−' : '+'}
                </button>
              </div>
            </div>
            {isInfoOpen && <div style={{ padding: '4px 20px 12px' }}>
              {[
                ['Order ID',   order.order_number || order.id],
                ['Subject',    order.subject],
                ['Type',       order.type],
                ['Title',      order.title],
                ['Words',      order.word_count ? `${order.word_count.toLocaleString()} words` : '—'],
                ['Pages',      order.pages ? `${order.pages} pages` : '—'],
                ['Style',      order.formatting_style],
                ['Level',      order.academic_level],
                ['Deadline',   fmt(order.deadline)],
                ['Created',    fmt(order.created_at)],
              ].filter(([, v]) => v && v !== '—').map(([label, val]) => (
                <div key={label} className="od-info-row">
                  <span style={{ color: '#64748b', fontWeight: 600 }}>{label}</span>
                  <span style={{ fontWeight: 700, color: '#0f172a', maxWidth: '55%', textAlign: 'right' }}>{val}</span>
                </div>
              ))}
              {order.description && (
                <div style={{ paddingTop: 12, borderTop: '1px solid #f1f5f9', marginTop: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Description</div>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{order.description}</div>
                </div>
              )}
              {orderFiles.length > 0 && (
                <div style={{ paddingTop: 12, borderTop: '1px solid #f1f5f9', marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Attached Files</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {orderFiles.map(file => (
                      <div key={file.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <span style={{ fontSize: 20 }}>{getFileIcon(file.file_name)}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{file.file_name}</div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{formatFileSize(file.file_size)} • {file.uploaded_by}</div>
                          </div>
                        </div>
                        <button onClick={async () => {
                          const res = await getFileUrl(file.file_path)
                          if (res.success) window.open(res.url, '_blank')
                        }} style={{ padding: '6px 12px', background: 'white', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>}
          </div>

          {/* ── BOOST YOUR ORDER ── */}
          <div className="od-card" style={{ overflow: 'visible' }}>
            <div className="od-card-header" style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a5f)', borderRadius: '16px 16px 0 0', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>🚀</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'white', letterSpacing: '-0.01em' }}>Boost Your Order</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Optional add-ons</span>
              </div>
              <button
                onClick={() => setIsBoostOpen(v => !v)}
                style={{ width: 28, height: 28, borderRadius: '6px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, lineHeight: 1, flexShrink: 0 }}
                aria-label={isBoostOpen ? 'Collapse' : 'Expand'}
              >
                {isBoostOpen ? '−' : '+'}
              </button>
            </div>
            {isBoostOpen && <div style={{ padding: '20px 20px' }}>
              <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px', lineHeight: 1.6 }}>
                Enhance your order with premium features for a better experience and guaranteed quality.
              </p>

              {/* FREE features banner */}
              <div style={{
                background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                border: '1.5px solid #86efac',
                borderRadius: 14,
                padding: '16px 20px',
                marginBottom: 20,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 16 }}>🎁</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Included Free with Every Order</span>
                  <span style={{ marginLeft: 'auto', background: '#16a34a', color: 'white', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 999, letterSpacing: '0.06em' }}>FREE</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px 20px' }}>
                  {[
                    ['📱', 'SMS Updates'],
                    ['🔒', 'Secure File Upload'],
                    ['📊', 'Order Progress Tracking'],
                    ['✅', 'Basic Quality Check'],
                    ['✏️', 'Minor Revision Window'],
                  ].map(([icon, label]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#166534' }}>
                      <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="od-boost-grid">
                {/* Standard Boost */}
                {(() => {
                  const boughtStd = purchasedAddons.has('standard')
                  return (
                    <div className="od-boost-card" style={{ border: `2px solid ${boughtStd ? '#86efac' : '#16a34a'}`, background: boughtStd ? '#f0fdf4' : '#f0fdf4', position: 'relative', opacity: boughtStd ? 0.85 : 1 }}
                      onMouseEnter={() => boughtStd && setServiceHover('standard')}
                      onMouseLeave={() => setServiceHover(null)}
                    >
                      {boughtStd && serviceHover === 'standard' && (
                        <div style={{ position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#f1f5f9', fontSize: 12, padding: '10px 14px', borderRadius: 10, whiteSpace: 'nowrap', zIndex: 20, pointerEvents: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', fontWeight: 600 }}>
                          ✅ Already purchased active on your account
                          <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '7px solid #1e293b' }} />
                        </div>
                      )}
                      {boughtStd && <div style={{ position: 'absolute', top: 10, right: 10, background: '#16a34a', color: 'white', fontSize: 9, fontWeight: 800, padding: '3px 9px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.08em' }}>✓ Purchased</div>}
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Standard</div>
                      <div style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', lineHeight: 1, marginBottom: 14 }}>
                        $12 USD <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>one-time</span>
                      </div>
                      <div style={{ borderTop: '1px solid #bbf7d0', paddingTop: 14, display: 'flex', flexDirection: 'column', flex: 1 }}>
                        {[['⭐','Expert Level: 4 Star'],['🔁','Revision Window: 48 Hours'],['📞','Expert Callback'],['🛡️','Priority Access: 20 Days'],['✅','Quality Review']].map(([icon, text]) => (
                          <div key={text} className="od-boost-feature"><span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span><span>{text}</span></div>
                        ))}
                      </div>
                      <button className="od-boost-btn"
                        disabled={boughtStd}
                        style={boughtStd
                          ? { background: '#d1fae5', color: '#6b7280', cursor: 'not-allowed', boxShadow: 'none', border: '1.5px solid #86efac' }
                          : { background: 'linear-gradient(135deg,#16A34A,#15803d)', color: 'white', boxShadow: '0 4px 12px rgba(22,163,74,0.3)' }}
                        onClick={() => !boughtStd && navigate(`/dashboard/checkout?orderId=${order.id}&addon=standard&addonAmount=12&addonLabel=${encodeURIComponent('Standard Boost')}`)}>
                        {boughtStd ? '✓ Already Purchased' : 'Upgrade $12 USD'}
                      </button>
                    </div>
                  )
                })()}

                {/* Elite Boost */}
                {(() => {
                  const boughtElite = purchasedAddons.has('elite')
                  return (
                    <div className="od-boost-card" style={{ border: `2px solid ${boughtElite ? '#fde68a' : '#f59e0b'}`, background: '#fffbeb', position: 'relative', opacity: boughtElite ? 0.85 : 1 }}
                      onMouseEnter={() => boughtElite && setServiceHover('elite')}
                      onMouseLeave={() => setServiceHover(null)}
                    >
                      {boughtElite && serviceHover === 'elite' && (
                        <div style={{ position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#f1f5f9', fontSize: 12, padding: '10px 14px', borderRadius: 10, whiteSpace: 'nowrap', zIndex: 20, pointerEvents: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', fontWeight: 600 }}>
                          ✅ Already purchased active on your account
                          <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '7px solid #1e293b' }} />
                        </div>
                      )}
                      {!boughtElite && <div style={{ position: 'absolute', top: 12, right: 12, background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white', fontSize: 9, fontWeight: 800, padding: '3px 9px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Best Value</div>}
                      {boughtElite && <div style={{ position: 'absolute', top: 10, right: 10, background: '#d97706', color: 'white', fontSize: 9, fontWeight: 800, padding: '3px 9px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.08em' }}>✓ Purchased</div>}
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Elite</div>
                      <div style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', lineHeight: 1, marginBottom: 14 }}>
                        $27 USD <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>one-time</span>
                      </div>
                      <div style={{ borderTop: '1px solid #fde68a', paddingTop: 14, display: 'flex', flexDirection: 'column', flex: 1 }}>
                        {[['🏆','Expert Level: 5 Star'],['🔁','Revision Window: 24 Hours'],['📞','Expert Callback'],['🛡️','Priority Access: 30 Days'],['📄','Plagiarism Report'],['🔄','Writer Swap Option'],['✅','Quality Review']].map(([icon, text]) => (
                          <div key={text} className="od-boost-feature"><span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span><span>{text}</span></div>
                        ))}
                      </div>
                      <button className="od-boost-btn"
                        disabled={boughtElite}
                        style={boughtElite
                          ? { background: '#fef3c7', color: '#6b7280', cursor: 'not-allowed', boxShadow: 'none', border: '1.5px solid #fde68a' }
                          : { background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}
                        onClick={() => !boughtElite && navigate(`/dashboard/checkout?orderId=${order.id}&addon=elite&addonAmount=27&addonLabel=${encodeURIComponent('Elite Boost')}`)}>
                        {boughtElite ? '✓ Already Purchased' : 'Upgrade $27 USD'}
                      </button>
                    </div>
                  )
                })()}
              </div>
              <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Individual Services Select & Pay</div>
                <div className="od-services-grid">
                  {SERVICES.map(svc => {
                    const isSelected = selectedServices.has(svc.key)
                    const isBought   = purchasedAddons.has(svc.key)
                    return (
                      <div key={svc.key}
                        onClick={() => !isBought && toggleService(svc.key)}
                        style={{ border: `2px solid ${isBought ? '#94a3b8' : isSelected ? svc.color : svc.border}`, background: isBought ? '#f1f5f9' : isSelected ? svc.selBg : svc.bg, borderRadius: 14, padding: '14px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 7, cursor: isBought ? 'not-allowed' : 'pointer', position: 'relative', transition: 'all 0.18s', opacity: isBought ? 0.75 : 1 }}
                        onMouseEnter={() => setServiceHover(svc.key)}
                        onMouseLeave={() => setServiceHover(null)}
                      >
                        {/* Tooltip: "already purchased" takes priority, then regular tooltip */}
                        {serviceHover === svc.key && (isBought || svc.tooltip) && (
                          <div style={{ position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#f1f5f9', fontSize: 12, padding: '10px 16px', borderRadius: 10, width: isBought ? 220 : 250, textAlign: 'center', zIndex: 20, pointerEvents: 'none', lineHeight: 1.6, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', fontWeight: isBought ? 600 : 400 }}>
                            {isBought ? '✅ Already purchased active on your account' : svc.tooltip}
                            <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '7px solid #1e293b' }} />
                          </div>
                        )}
                        {/* Purchased badge */}
                        {isBought && (
                          <div style={{ position: 'absolute', top: 9, right: 9, width: 20, height: 20, borderRadius: '50%', background: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                        )}
                        {/* Selected (unpurchased) checkmark */}
                        {!isBought && isSelected && (
                          <div style={{ position: 'absolute', top: 9, right: 9, width: 20, height: 20, borderRadius: '50%', background: svc.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                        )}
                        <div style={{ fontSize: 26 }}>{svc.emoji}</div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: isBought ? '#94a3b8' : svc.color }}>{svc.label}</div>
                        <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5, flex: 1 }}>{svc.desc}</div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: isBought ? '#94a3b8' : svc.color, marginTop: 2 }}>
                          {isBought ? '✓ Purchased' : `$${svc.price} USD`}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <button
                  disabled={servicesTotal === 0}
                  onClick={() => {
                    const label = selectedServiceItems.map(s => s.label).join(' + ')
                    navigate(`/dashboard/checkout?orderId=${order.id}&addon=services&addonAmount=${servicesTotal}&addonLabel=${encodeURIComponent(label)}`)
                  }}
                  style={{ width: '100%', marginTop: 14, padding: '12px', border: 'none', borderRadius: 11, fontWeight: 700, fontSize: 14, cursor: servicesTotal > 0 ? 'pointer' : 'not-allowed', background: servicesTotal > 0 ? 'linear-gradient(135deg,#0f172a,#1e3a5f)' : '#e2e8f0', color: servicesTotal > 0 ? 'white' : '#94a3b8', transition: 'all 0.18s', boxShadow: servicesTotal > 0 ? '0 4px 14px rgba(15,23,42,0.25)' : 'none' }}
                >
                  {servicesTotal > 0
                    ? `Pay $${servicesTotal} USD ${selectedServiceItems.map(s => s.label).join(' + ')}`
                    : 'Select at least one service above'}
                </button>
              </div>
            </div>}
          </div>

        </div>

        {/* ═══ RIGHT COLUMN ═══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Payment & Transactions card (only if price is set) */}
          {total > 0 && (
            <div className="od-card" style={{ overflow: 'visible' }}>
              {/* Dark header */}
              <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a5f)', color: 'white', padding: '20px 20px 16px', borderRadius: '16px 16px 0 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>💳 Payment Summary</div>
                  <span style={{ background: isPaid ? '#16a34a' : '#f59e0b', color: 'white', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {isPaid ? '✓ Paid' : 'Pending'}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                  {[
                    ['Paid',      `$${paid.toFixed(2)} USD`,      '#4ade80'],
                    ['Remaining', `$${remaining.toFixed(2)} USD`, '#fbbf24'],
                    ['Total',     `$${total.toFixed(2)} USD`,     'white']
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, opacity: 0.6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontWeight: 800, fontSize: 16, color }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#22c55e,#4ade80)', borderRadius: 999, transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, opacity: 0.6, marginTop: 5 }}>
                  <span>{pct}% paid</span>
                  <span>{planLabel}</span>
                </div>
              </div>

              {/* Discount banner */}
              {hasDiscount && (
                <div style={{ background: 'linear-gradient(135deg,#064e3b,#065f46)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, color: 'white' }}>
                  <div style={{ fontSize: 24, flexShrink: 0 }}>🎉</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>Special Offer {discountPct}% OFF!</div>
                    <div style={{ fontSize: 12, opacity: 0.85, display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <span style={{ textDecoration: 'line-through', color: '#fca5a5', opacity: 0.9, fontWeight: 500 }}>${order.original_price.toFixed(2)} USD</span>
                      <span style={{ fontWeight: 800, color: '#fde047', fontSize: 18 }}>${total.toFixed(2)} USD</span>
                      <span style={{ background: 'rgba(253,224,71,0.15)', border: '1px solid rgba(253,224,71,0.3)', borderRadius: 5, padding: '2px 8px', fontSize: 10, fontWeight: 800, color: '#fde047', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        Save ${(order.original_price - total).toFixed(2)} USD
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Installment breakdown */}
              <div style={{ padding: '14px 20px 4px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Payment Breakdown</div>
                <div style={{ border: '1px solid #f1f5f9', borderRadius: 12, overflow: 'hidden' }}>
                  {installments.map((inst, i) => {
                    const isNext = !inst.paid && installments.slice(0, i).every(x => x.paid)
                    return (
                      <div key={i} className="od-inst-row" style={{ background: inst.paid ? '#f0fdf4' : isNext ? '#fffbeb' : 'white' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 14, background: inst.paid ? '#dcfce7' : isNext ? '#fef3c7' : '#f3f4f6' }}>
                          {inst.paid ? '✅' : isNext ? '⏳' : '⬜'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: inst.paid ? '#16a34a' : '#0f172a' }}>
                            {inst.label} <span style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8' }}>({inst.sub})</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                            {inst.paid && inst.paidAt
                              ? <span style={{ color: '#16a34a', fontWeight: 600 }}>🕒 {fmt(inst.paidAt)}</span>
                              : inst.dueDate
                              ? <span style={{ color: '#d97706', fontWeight: 600 }}>📅 Due {fmtShort(inst.dueDate)}</span>
                              : isNext ? 'Due now' : 'Upcoming'}
                          </div>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: inst.paid ? '#16a34a' : isNext ? '#d97706' : '#94a3b8', textDecoration: inst.paid ? 'line-through' : 'none' }}>
                          ${inst.amount.toFixed(2)} USD
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Pay Now footer */}
              {!isPaid && (
                <div style={{ padding: '14px 20px 18px' }}>
                  <Link to={`/dashboard/payments?orderId=${order.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px', background: 'linear-gradient(135deg,#16A34A,#15803d)', color: 'white', borderRadius: 11, fontWeight: 700, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 12px rgba(22,163,74,0.3)' }}>
                    💳 Pay Now ${remaining.toFixed(2)} USD remaining
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Expert card */}
          <div className="od-card">
            <div className="od-card-header">
              <span style={{ fontSize: 18 }}>👨‍💻</span>
              <span className="od-card-title">Your Expert</span>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {order.expert_name ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1.5px solid #86efac', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img src={order.expert_avatar} alt={order.expert_name} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid #16a34a' }}
                      onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
                    <div style={{ display: 'none', width: 52, height: 52, borderRadius: '50%', background: '#16a34a', color: 'white', fontSize: 18, fontWeight: 700, alignItems: 'center', justifyContent: 'center' }}>
                      {(order.expert_name || 'E')[0]}
                    </div>
                    <span style={{ position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: '50%', background: '#22c55e', border: '2px solid white' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>✅ Assigned Expert</div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{order.expert_name}</div>
                    {order.status === 'pending'   && <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, marginTop: 1 }}>Getting ready for your order</div>}
                    {order.status === 'in_review' && <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600, marginTop: 1 }}>Reviewing your requirements</div>}
                    {order.status === 'active'    && <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 1 }}>Working on your order</div>}
                    {order.status === 'completed' && <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 600, marginTop: 1 }}>Order completed</div>}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#e2e8f0,#cbd5e1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🔍</div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Expert Pending</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#374151' }}>Admin will assign your expert</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>Once payment is confirmed, we'll match you with the best expert.</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons card */}
          <div className="od-card">
            <div className="od-card-header">
              <span style={{ fontSize: 18 }}>⚡</span>
              <span className="od-card-title">Quick Actions</span>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to={`/dashboard/messages?orderId=${order.id}`} className="od-action-btn"
                style={{ background: 'linear-gradient(135deg,#16A34A,#15803d)', color: 'white', boxShadow: '0 4px 12px rgba(22,163,74,0.25)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                Chat about this Order
              </Link>

              {total > 0 && !isPaid && (
                <Link to={`/dashboard/payments?orderId=${order.id}`} className="od-action-btn"
                  style={{ background: 'linear-gradient(135deg,#1d4ed8,#1e40af)', color: 'white', boxShadow: '0 4px 12px rgba(29,78,216,0.25)' }}>
                  💳 Pay Now ${remaining.toFixed(2)} USD Remaining
                </Link>
              )}

              {/* Rework */}
              <div style={{ position: 'relative' }} onMouseEnter={() => setReworkHover(true)} onMouseLeave={() => setReworkHover(false)}>
                <button onClick={() => reworkEnabled && setIsReworkOpen(true)} disabled={!reworkEnabled} className="od-action-btn"
                  style={{ background: reworkEnabled ? 'white' : '#f8fafc', color: reworkEnabled ? '#f59e0b' : '#94a3b8', border: `1.5px solid ${reworkEnabled ? '#f59e0b' : '#e2e8f0'}`, cursor: reworkEnabled ? 'pointer' : 'not-allowed' }}>
                  <AlertCircle size={18} /> Request Rework
                </button>
                {reworkHover && !reworkEnabled && (
                  <div style={{ position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#f1f5f9', fontSize: 12, padding: '10px 14px', borderRadius: 10, width: 270, textAlign: 'center', zIndex: 10, pointerEvents: 'none' }}>
                    {isCompleted && !reworkEnabled ? `⏰ Rework window closed (${Math.floor(hoursElapsed)}h elapsed 96h limit).` : '🔒 Available once your order is active or completed.'}
                    <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '7px solid #1e293b' }} />
                  </div>
                )}
              </div>

              {/* Feedback */}
              <div style={{ position: 'relative' }} onMouseEnter={() => setFeedbackHover(true)} onMouseLeave={() => setFeedbackHover(false)}>
                <button onClick={() => isCompleted && setIsFeedbackOpen(true)} disabled={!isCompleted} className="od-action-btn"
                  style={{ background: isCompleted ? 'white' : '#f8fafc', color: isCompleted ? '#7c3aed' : '#94a3b8', border: `1.5px solid ${isCompleted ? '#7c3aed' : '#e2e8f0'}`, cursor: isCompleted ? 'pointer' : 'not-allowed' }}>
                  ⭐ Give Feedback
                </button>
                {feedbackHover && !isCompleted && (
                  <div style={{ position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#f1f5f9', fontSize: 12, padding: '10px 14px', borderRadius: 10, width: 260, textAlign: 'center', zIndex: 10, pointerEvents: 'none' }}>
                    ✨ Unlocks when your order is completed.
                    <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '7px solid #1e293b' }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tip for Writer only after order is completed */}
          {isCompleted && <TipForWriter orderLoading={orderLoading} />}

        </div>
      </div>


      {order && <ReworkModal isOpen={isReworkOpen} onClose={() => setIsReworkOpen(false)} order={order} />}
      {order && <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} order={order} />}
    </StudentLayout>
  )
}

// ============================================================
// REWORK MODAL
// ============================================================
function ReworkModal({ isOpen, onClose, order }) {
  const [description, setDescription] = useState('')
  const [files, setFiles]             = useState([])
  const [submitting, setSubmitting]   = useState(false)
  const [success, setSuccess]         = useState(false)
  const fileInputRef = useRef(null)

  if (!isOpen) return null

  function handleFileSelect(e) {
    if (e.target.files?.length > 0) setFiles(prev => [...prev, ...Array.from(e.target.files)])
  }
  function removeFile(idx) { setFiles(prev => prev.filter((_, i) => i !== idx)) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!description.trim() && files.length === 0) return
    setSubmitting(true)
    try {
      let fileTags = []
      for (const file of files) {
        try { const up = await uploadFile(file, order.id); fileTags.push(`[FILE:::${up.path}:::${up.name}]`) }
        catch (err) { alert(`Upload failed for ${file.name}: ` + err.message) }
      }
      const { data: sessions } = await supabase.from('chat_sessions').select('*').eq('order_id', order.id).order('created_at', { ascending: false }).limit(1)
      const { data: { user } } = await supabase.auth.getUser()
      let sessionId
      if (sessions?.length > 0) {
        sessionId = sessions[0].id
      } else {
        const { data: ns } = await supabase.from('chat_sessions').insert({ site_id: 1, chat_type: 'order', order_id: order.id, visitor_name: user.user_metadata?.full_name || 'Student', visitor_email: user.email, user_id: user.id, status: 'active', last_message: '🚨 REWORK REQUEST 🚨', unread_count: 1 }).select().single()
        sessionId = ns.id
      }
      const msgText = `[REWORK_REQ] ${JSON.stringify({ description, files: fileTags })}`
      await supabase.from('chat_messages').insert({ session_id: sessionId, sender_type: 'visitor', sender_name: user.user_metadata?.full_name || 'Student', message: msgText })
      await supabase.from('chat_sessions').update({ last_message: '🚨 REWORK REQUEST 🚨', unread_count: 1, status: 'active', updated_at: new Date().toISOString() }).eq('id', sessionId)
      // Try to set order back to Active (admin ReworksPage will enforce this if RLS blocks it here)
      supabase.from('orders').update({ status: 'active' }).eq('id', order.id).then(() => {})
      setSuccess(true)
    } catch (err) { alert('Error: ' + err.message) }
    finally { setSubmitting(false) }
  }

  function closeAndReset() { setSuccess(false); setDescription(''); setFiles([]); onClose() }

  if (success) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 16, width: '90%', maxWidth: 400, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>✅</div>
        <h3 style={{ margin: '0 0 8px', color: '#0f172a' }}>Rework Requested!</h3>
        <p style={{ color: '#64748b', margin: '0 0 24px', fontSize: 14, lineHeight: 1.5 }}>Your rework request has been sent. Track progress in the order chat.</p>
        <button onClick={closeAndReset} style={{ width: '100%', padding: '13px', background: '#16A34A', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Done</button>
      </div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 16, width: '90%', maxWidth: 500, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffbeb' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: '#b45309', fontSize: 16 }}><AlertCircle size={18} /> Request Rework</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 22, overflowY: 'auto' }}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#374151' }}>What needs to be changed?</label>
            <textarea className="sp-form-textarea" placeholder="Describe specifically what needs to be reworked..." value={description} onChange={e => setDescription(e.target.value)} rows={5} required />
          </div>
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 13, color: '#374151' }}>Attach Files (Optional)</label>
            <div style={{ border: '2px dashed #cbd5e1', borderRadius: 12, padding: 22, textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }} onClick={() => fileInputRef.current?.click()}>
              <Upload size={22} color="#94a3b8" style={{ margin: '0 auto 6px' }} />
              <div style={{ fontSize: 13, color: '#64748b' }}>Click to upload files</div>
            </div>
            <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} />
            {files.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {files.map((file, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: '#f1f5f9', borderRadius: 8, fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={15} color="#64748b" /><span style={{ color: '#334155', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span></div>
                    <button type="button" onClick={() => removeFile(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
            <button type="button" className="sp-btn sp-btn-outline" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" style={{ padding: '10px 20px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: submitting ? 0.7 : 1 }} disabled={submitting || (!description.trim() && files.length === 0)}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// TIP FOR WRITER
// ============================================================
const PRESET_TIPS = [5, 10, 20, 50]

function TipForWriter({ orderLoading }) {
  const [selectedPreset, setSelectedPreset] = useState(null)
  const [customAmount, setCustomAmount]     = useState('')
  const [message, setMessage]               = useState('')
  const [sent, setSent]                     = useState(false)
  const [sending, setSending]               = useState(false)

  const tipAmount = selectedPreset !== null ? selectedPreset : (customAmount !== '' ? parseFloat(customAmount) || 0 : 0)

  function handlePreset(val) { setSelectedPreset(val); setCustomAmount('') }
  function handleCustom(e)   { setCustomAmount(e.target.value.replace(/[^0-9.]/g, '')); setSelectedPreset(null) }

  async function handleSend() {
    if (!tipAmount || tipAmount <= 0) return
    setSending(true)
    await new Promise(r => setTimeout(r, 1300))
    setSending(false)
    setSent(true)
  }

  function handleReset() { setSent(false); setSelectedPreset(null); setCustomAmount(''); setMessage('') }

  return (
    <div className="od-card sp-tip-card">
      <div className="od-card-header" style={{ background: '#fefce8' }}>
        <span style={{ fontSize: 18 }}>⭐</span>
        <span className="od-card-title">Tip for Writer</span>
        <span style={{ marginLeft: 'auto', background: '#fef3c7', color: '#d97706', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Optional</span>
      </div>

      {sent ? (
        <div className="sp-tip-success">
          <div className="sp-tip-success-icon">🎉</div>
          <h4>Tip Sent!</h4>
          <p>Your <strong>${tipAmount.toFixed(2)}</strong> tip is on its way to your writer!</p>
          <button className="sp-btn sp-btn-outline sp-btn-sm" onClick={handleReset} style={{ marginTop: 12 }}>Send Another Tip</button>
        </div>
      ) : (
        <div className="sp-tip-body">
          <div className="sp-tip-intro"><p>Did your writer go above and beyond? Show some appreciation 100% of the tip goes directly to them. 💚</p></div>
          <p className="sp-tip-section-label">Choose an amount</p>
          <div className="sp-tip-presets">
            {PRESET_TIPS.map(v => (
              <button key={v} className={`sp-tip-preset-btn${selectedPreset === v ? ' active' : ''}`} onClick={() => handlePreset(v)}>${v}</button>
            ))}
          </div>
          <p className="sp-tip-section-label" style={{ marginTop: 16 }}>Or enter a custom amount</p>
          <div className="sp-tip-custom-wrap">
            <span className="sp-tip-dollar">$</span>
            <input type="text" inputMode="decimal" placeholder="0.00" value={customAmount} onChange={handleCustom} className="sp-tip-custom-input" />
          </div>
          <p className="sp-tip-section-label" style={{ marginTop: 16 }}>Personal message <span style={{ opacity: 0.5, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></p>
          <textarea className="sp-form-textarea sp-tip-message" placeholder="e.g. Amazing work, thank you so much! The paper was perfect 🙌" value={message} onChange={e => setMessage(e.target.value)} rows={3} />
          {tipAmount > 0 && (
            <div className="sp-tip-summary">
              <div className="sp-tip-summary-row"><span>Tip amount</span><strong>${tipAmount.toFixed(2)}</strong></div>
              <div className="sp-tip-summary-row"><span>Processing fee</span><strong style={{ color: 'var(--sp-green)' }}>Free</strong></div>
              <div className="sp-tip-summary-row sp-tip-summary-total"><span>Total charged</span><strong>${tipAmount.toFixed(2)}</strong></div>
            </div>
          )}
          <button className={`sp-tip-send-btn${sending ? ' loading' : ''}${!tipAmount ? ' disabled' : ''}`} onClick={handleSend} disabled={!tipAmount || sending || orderLoading}>
            {sending ? <><span className="sp-tip-spinner" />Sending…</> : <><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>{tipAmount > 0 ? `Send $${tipAmount.toFixed(2)} Tip` : 'Select an Amount'}</>}
          </button>
          <p className="sp-tip-note">🔒 Payments are processed securely. Your writer receives 100% of the tip.</p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// FEEDBACK MODAL
// ============================================================
function FeedbackModal({ isOpen, onClose, order }) {
  const [rating, setRating]           = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment]         = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [success, setSuccess]         = useState(false)

  if (!isOpen) return null

  async function handleSubmit(e) {
    e.preventDefault()
    if (rating === 0) return
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('feedback').insert({ user_id: user?.id, user_name: user?.user_metadata?.full_name || null, user_email: user?.email || null, order_id: order.id, order_number: order.order_number, subject: order.subject, rating, comment: comment.trim() || null, site_id: SITE_ID })
      await supabase.from('notifications').insert({ user_id: user?.id, site_id: SITE_ID, type: 'order', title: 'Feedback Received Thank You!', message: `We received your ${rating}-star review for order ${order.order_number}. Your feedback helps us improve every day. 💜`, read: false })
      setSuccess(true)
    } catch (err) { console.error(err) }
    finally { setSubmitting(false) }
  }

  function closeAndReset() { setSuccess(false); setRating(0); setHoverRating(0); setComment(''); onClose() }
  const starLabels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent']

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#faf5ff' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: '#6d28d9', fontSize: 16, fontWeight: 700 }}>⭐ Share Your Experience</h3>
          <button onClick={closeAndReset} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>
        {success ? (
          <div style={{ padding: '44px 30px', textAlign: 'center' }}>
            <div style={{ fontSize: 50, marginBottom: 14 }}>🎉</div>
            <h4 style={{ fontSize: 19, fontWeight: 700, color: '#1e293b', margin: '0 0 10px' }}>Thank You So Much!</h4>
            <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>Your feedback motivates our experts to keep delivering outstanding work. 💜</p>
            <button onClick={closeAndReset} style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 10, padding: '12px 32px', fontWeight: 600, fontSize: 14, cursor: 'pointer', width: '100%' }}>Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: '24px 22px' }}>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 18px', textAlign: 'center' }}>Reviewing <strong style={{ color: '#475569' }}>{order.order_number}</strong> · {order.subject}</p>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px', textAlign: 'center' }}>How would you rate your experience?</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 8 }}>
              {[1,2,3,4,5].map(star => (
                <button key={star} type="button" onClick={() => setRating(star)} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: 50, height: 50, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 32, lineHeight: 1, display: 'block', filter: (hoverRating || rating) >= star ? 'none' : 'grayscale(1) opacity(0.3)', transform: (hoverRating || rating) >= star ? 'scale(1.25)' : 'scale(1)', transition: 'transform 0.15s, filter 0.15s' }}>⭐</span>
                </button>
              ))}
            </div>
            <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#7c3aed', height: 20, margin: '4px 0 18px' }}>{starLabels[hoverRating || rating] || ''}</p>
            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Tell us more <span style={{ fontWeight: 400, textTransform: 'none', color: '#94a3b8' }}>(optional)</span></label>
              <textarea className="sp-form-textarea" rows={4} placeholder="What did you love? What could be better? 🙏" value={comment} onChange={e => setComment(e.target.value)} style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={closeAndReset} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={rating === 0 || submitting} style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: rating > 0 ? '#7c3aed' : '#e2e8f0', color: rating > 0 ? 'white' : '#94a3b8', fontWeight: 700, fontSize: 14, cursor: rating > 0 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.2s' }}>
                {submitting ? 'Submitting…' : '💜 Submit Feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default OrderDetail
