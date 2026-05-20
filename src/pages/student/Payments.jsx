import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import StudentLayout from './StudentLayout'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

import PaymentConfirmingOverlay from '../../components/PaymentConfirmingOverlay'

// Returns Wednesday of the calendar week AFTER the week containing `date`.
// Weeks run Mon–Sun. Any payment day in week N → due on Wed of week N+1.
function nextWeekWednesday(date) {
  if (!date) return null
  const d = new Date(date)
  const day = d.getDay() // 0=Sun, 1=Mon … 6=Sat
  // Days until next Monday (start of following week).
  // Sunday (0) is the tail of the current week, so +1 to reach Mon.
  const toNextMonday = day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + toNextMonday + 2) // +2 Mon → Wed
  return d
}

function parsePlanKey(key) {
  if (!key) return { type: 'full', count: 1 }
  const m = key.match(/^(weekly|biweekly)(\d+)$/)
  if (m) return { type: m[1], count: parseInt(m[2], 10) }
  if (key === 'weekly') return { type: 'weekly', count: 4 }
  if (key === 'biweekly') return { type: 'biweekly', count: 2 }
  if (key === 'splithalf') return { type: 'splithalf', count: 2 }
  return { type: 'full', count: 1 }
}

function isValidPlanKey(key) {
  if (!key) return false
  return key === 'full' || key === 'splithalf' || key === 'weekly' || key === 'biweekly' ||
    /^(weekly|biweekly)\d+$/.test(key)
}

function Payments() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialOrderId = searchParams.get('orderId') || ''

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrderId, setSelectedOrderId] = useState(initialOrderId)
  const makePaymentRef = useRef(null)
  const [paymentPlan, setPaymentPlan] = useState('full')
  const [successMsg, setSuccessMsg] = useState('')
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [overlayStatus, setOverlayStatus] = useState('verifying')
  const [overlayAmount, setOverlayAmount] = useState(0)
  const [txnOrder, setTxnOrder] = useState(null) // order shown in transaction modal
  const [boostAddons, setBoostAddons] = useState([])

  const selectedOrder = orders.find(o => String(o.id) === selectedOrderId)

  // Calculate installment preview each item has a `paid` flag based on order.paid_amount
  const getInstallmentInfo = () => {
    if (!selectedOrder) return []
    const total   = selectedOrder.price || 0
    const paidAmt = selectedOrder.paid_amount || 0

    const addDays = (base, days) => {
      if (!base) return null
      const d = new Date(base)
      d.setDate(d.getDate() + days)
      return d
    }
    const lastPaidAt  = selectedOrder.updated_at ? new Date(selectedOrder.updated_at) : null
    const storedFirst = localStorage.getItem(`first_payment_at_${selectedOrder.id}`)
    const anchor      = storedFirst ? new Date(storedFirst) : lastPaidAt
    const instAt = (n) => {
      const s = localStorage.getItem(`inst_paid_at_${selectedOrder.id}_${n}`)
      return s ? new Date(s) : null
    }

    const { type: planType, count: planCount } = parsePlanKey(paymentPlan)
    const firstWed = anchor ? nextWeekWednesday(anchor) : null

    if (planType === 'full') {
      const remaining = Math.max(0, Math.round((total - paidAmt) * 100) / 100)
      const isPaid = paidAmt >= total - 0.01
      return [{ label: 'Full Payment', amount: remaining, dueLabel: 'Due Now', paid: isPaid, paidAt: isPaid ? (instAt(1) || lastPaidAt) : null, dueDate: null }]
    }
    if (planType === 'splithalf') {
      const half = Math.round(total / 2 * 100) / 100
      const p1   = paidAmt >= half - 0.01
      const p2   = paidAmt >= total - 0.01
      return [
        { label: 'Payment 1 Before Work Starts (50%)', amount: half, dueLabel: 'Due Now',            paid: p1, paidAt: p1 ? (instAt(1) || anchor)     : null, dueDate: null },
        { label: 'Payment 2 Before Submission (50%)',  amount: half, dueLabel: 'Due before delivery', paid: p2, paidAt: p2 ? (instAt(2) || lastPaidAt) : null, dueDate: null }
      ]
    }
    if (planType === 'biweekly' || planType === 'weekly') {
      const part = Math.round(total / planCount * 100) / 100
      const pct  = Math.round(100 / planCount)
      return Array.from({ length: planCount }, (_, i) => {
        const n = i + 1
        const paidN = paidAmt >= part * n - 0.01
        const label = planType === 'weekly'
          ? `Week ${n} (${pct}%)`
          : n === 1 ? `First Payment (${pct}%)` : n === planCount ? `Final Payment (${pct}%)` : `Payment ${n} (${pct}%)`
        const dueDate = n === 1 ? null
          : planType === 'weekly'
          ? (!paidN && firstWed ? addDays(firstWed, (n - 2) * 7) : null)
          : (!paidN && firstWed ? addDays(firstWed, 7 + (n - 2) * 14) : null)
        return {
          label,
          amount: part,
          dueLabel: n === 1 ? 'Due Now' : 'Due on Wednesday',
          paid: paidN,
          paidAt: paidN ? (instAt(n) || (n === 1 ? anchor : lastPaidAt)) : null,
          dueDate,
        }
      })
    }
    return []
  }

  const installments = getInstallmentInfo()
  const nextUnpaid = installments.find(i => !i.paid)
  const dueNow = nextUnpaid?.amount || 0

  // Detect which instalment plan the user already started paying with.
  // Priority: DB (orders.payment_plan) → localStorage → ambiguous math fallback.
  const detectActivePlan = () => {
    if (!selectedOrder) return null
    const paid = selectedOrder.paid_amount || 0
    const total = selectedOrder.price || 0
    if (paid <= 0 || paid >= total) return null
    // 1. DB is the authoritative source (set by verify-payment Edge Function)
    if (isValidPlanKey(selectedOrder.payment_plan)) {
      const { type } = parsePlanKey(selectedOrder.payment_plan)
      if (type !== 'full') return selectedOrder.payment_plan
    }
    // 2. localStorage fallback (for payments made before the DB column was added)
    const stored = localStorage.getItem(`payment_plan_${selectedOrder.id}`)
    if (isValidPlanKey(stored)) {
      const { type } = parsePlanKey(stored)
      if (type !== 'full') return stored
    }
    // 3. Math inference only for unambiguous amounts
    const quarter = total / 4
    const half = total / 2
    if (Math.abs(paid % half) < 0.01 && Math.abs(paid % quarter) >= 0.01) return 'biweekly'
    if (Math.abs(paid % quarter) < 0.01 && Math.abs(paid % half) >= 0.01) return 'weekly'
    return null
  }
  const activePlan = detectActivePlan()

  // Compute upcoming installment reminders only orders within 24 hrs of next due date
  const upcomingAlerts = orders.flatMap(order => {
    const paid  = order.paid_amount || 0
    const total = order.price || 0
    if (paid <= 0 || order.payment_status === 'paid' || paid >= total - 0.01) return []

    let planKey = order.payment_plan || localStorage.getItem(`payment_plan_${order.id}`)
    if (!planKey && paid > 0 && paid < total) {
      const q = total / 4, h = total / 2
      if (Math.abs(paid % q) < 0.01 && Math.abs(paid % h) >= 0.01) planKey = 'weekly'
      else if (Math.abs(paid % h) < 0.01) planKey = 'biweekly'
    }
    const { type: planType, count: planCount } = parsePlanKey(planKey)
    if (planType !== 'weekly' && planType !== 'biweekly') return []

    const addDays = (base, days) => { const d = new Date(base); d.setDate(d.getDate() + days); return d }
    const storedFirst = localStorage.getItem(`first_payment_at_${order.id}`)
    const lastPaidAt  = order.updated_at ? new Date(order.updated_at) : null
    const anchor      = storedFirst ? new Date(storedFirst) : lastPaidAt
    if (!anchor) return []

    const firstWed = nextWeekWednesday(anchor)
    const part = Math.round(total / planCount * 100) / 100
    const pct  = Math.round(100 / planCount)
    let nextDue = null, nextAmount = 0, installmentLabel = ''
    for (let n = 2; n <= planCount; n++) {
      const prevPaid = paid >= part * (n - 1) - 0.01
      const curPaid  = paid >= part * n - 0.01
      if (prevPaid && !curPaid) {
        nextAmount = part
        installmentLabel = planType === 'weekly'
          ? `Week ${n} (${pct}%)`
          : n === planCount ? `Final Payment (${pct}%)` : `Payment ${n} (${pct}%)`
        nextDue = planType === 'weekly'
          ? addDays(firstWed, (n - 2) * 7)
          : addDays(firstWed, 7 + (n - 2) * 14)
        break
      }
    }
    if (!nextDue) return []

    const diffMs  = nextDue - new Date()
    const diffHrs = diffMs / (1000 * 60 * 60)
    if (diffHrs > 24) return [] // only alert within 24 hours

    return [{ order, nextDue, nextAmount, installmentLabel, diffHrs, isOverdue: diffMs < 0 }]
  })

  // Determine which plans admin has allowed for this order
  const allowedByAdmin = (() => {
    if (!selectedOrder?.allowed_payment_plans) return ['full', 'biweekly', 'weekly']
    return selectedOrder.allowed_payment_plans.split(',').map(s => s.trim()).filter(Boolean)
  })()

  // Fade only if user already started a different instalment plan
  const isPlanFaded = (planKey) => {
    if (!planKey || planKey === 'full') return false
    const { type } = parsePlanKey(planKey)
    const { type: activeType } = parsePlanKey(activePlan || '')
    if (!activeType || activeType === 'full') return false
    if (activeType === 'biweekly'  && (type === 'weekly' || type === 'splithalf')) return true
    if (activeType === 'weekly'    && (type === 'biweekly' || type === 'splithalf')) return true
    if (activeType === 'splithalf' && (type === 'biweekly' || type === 'weekly')) return true
    return false
  }

  useEffect(() => {
    loadData()
  }, [user?.id])

  // Persist per-installment payment timestamps whenever orders data is fresh.
  // first_payment_at anchors due-date calculations; inst_paid_at_N records each installment's date.
  useEffect(() => {
    orders.forEach(order => {
      const paid  = order.paid_amount || 0
      const total = order.price || 0
      if (paid <= 0 || !order.updated_at) return

      // Save anchor (first payment date) once never overwrite
      const firstKey = `first_payment_at_${order.id}`
      if (!localStorage.getItem(firstKey)) localStorage.setItem(firstKey, order.updated_at)

      // Detect plan
      let planKey = order.payment_plan || localStorage.getItem(`payment_plan_${order.id}`)
      if (!planKey && paid > 0 && paid < total) {
        const q = total / 4, h = total / 2
        if (Math.abs(paid % q) < 0.01 && Math.abs(paid % h) >= 0.01) planKey = 'weekly'
        else if (Math.abs(paid % h) < 0.01) planKey = 'biweekly'
      }

      // Save per-installment timestamp for the most recently paid installment
      const saveInst = (n) => {
        const k = `inst_paid_at_${order.id}_${n}`
        if (!localStorage.getItem(k)) localStorage.setItem(k, order.updated_at)
      }
      const { type: instType, count: instCount } = parsePlanKey(planKey)
      if (instType === 'weekly' || instType === 'biweekly') {
        const part = total / instCount
        let lastN = 1
        for (let n = instCount; n >= 1; n--) {
          if (paid >= part * n - 0.01) { lastN = n; break }
        }
        saveInst(lastN)
      } else {
        saveInst(1)
      }
    })
  }, [orders])

  // When selected order changes, auto-restore the plan the user chose for it
  useEffect(() => {
    if (!selectedOrder) return
    const paid = selectedOrder.paid_amount || 0
    const total = selectedOrder.price || 0
    if (paid <= 0 || paid >= total) { setPaymentPlan('full'); return }
    // 1. DB is truth (set by Edge Function on first payment)
    if (isValidPlanKey(selectedOrder.payment_plan)) {
      const { type } = parsePlanKey(selectedOrder.payment_plan)
      if (type !== 'full') {
        setPaymentPlan(selectedOrder.payment_plan)
        localStorage.setItem(`payment_plan_${selectedOrder.id}`, selectedOrder.payment_plan)
        return
      }
    }
    // 2. localStorage (set when user clicks plan card or Review & Pay)
    const stored = localStorage.getItem(`payment_plan_${selectedOrder.id}`)
    if (isValidPlanKey(stored)) {
      const { type } = parsePlanKey(stored)
      if (type !== 'full') {
        setPaymentPlan(stored)
        // Backfill to Supabase so admin panel can see the plan too
        supabase.from('orders').update({ payment_plan: stored }).eq('id', selectedOrder.id)
          .then(() => {
            setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, payment_plan: stored } : o))
          })
      }
    }
  }, [selectedOrder?.id, selectedOrder?.payment_plan, selectedOrder?.paid_amount])

  // Restore success message + auto-select order after full-page reload post-payment
  useEffect(() => {
    const msg = sessionStorage.getItem('payment_success_msg')
    const orderId = sessionStorage.getItem('payment_success_orderId')
    if (msg) {
      setSuccessMsg(msg)
      if (orderId) {
        setSelectedOrderId(orderId)
        // Restore the exact plan the user chose (localStorage is set in handlePay)
        const storedPlan = localStorage.getItem(`payment_plan_${orderId}`)
        if (storedPlan) setPaymentPlan(storedPlan)
      }
      sessionStorage.removeItem('payment_success_msg')
      sessionStorage.removeItem('payment_success_orderId')
      setTimeout(() => setSuccessMsg(''), 7000)
    }
  }, [])

  async function loadData() {
    if (!user?.id) return
    setLoading(true)
    const [{ data, error }, { data: addons }] = await Promise.all([
      supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('order_addons').select('*').eq('user_id', user.id).eq('status', 'completed').order('created_at', { ascending: false }),
    ])
    if (!error) setOrders(data || [])
    setBoostAddons(addons || [])
    setLoading(false)
  }

  // Handle Stripe return verify with server, never trust URL params
  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    const cancelled = searchParams.get('cancelled')
    const type = searchParams.get('type')

    if (sessionId) {
      // Guard against React 18 StrictMode double-invoke and page refreshes
      const key = `stripe_verified_${sessionId}`
      if (sessionStorage.getItem(key)) {
        navigate('/dashboard/payments', { replace: true })
        return
      }
      sessionStorage.setItem(key, '1')
      setOverlayVisible(true)
      setOverlayStatus('verifying')
      navigate('/dashboard/payments', { replace: true })
      verifyAndConfirm(sessionId, type)
    } else if (cancelled) {
      setSuccessMsg('Payment cancelled.')
      setTimeout(() => setSuccessMsg(''), 4000)
    }
  }, [])

  async function verifyAndConfirm(sessionId, type) {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authSession?.access_token ?? ''}`,
          },
          body: JSON.stringify({ sessionId }),
        }
      )
      const json = await res.json()
      if (json.verified) {
        const label = type === 'topup' ? 'Wallet top-up' : 'Payment'
        const msg = `✅ ${label} of $${json.amount?.toFixed(2)} confirmed by Stripe!`

        // Record boost addon purchase if this was an addon payment
        const pendingAddonRaw = sessionStorage.getItem('pending_addon')
        if (pendingAddonRaw) {
          try {
            const addon = JSON.parse(pendingAddonRaw)
            await supabase.from('order_addons').insert({
              order_id:          addon.orderId,
              user_id:           addon.userId,
              addon_type:        addon.addonType,
              addon_label:       addon.addonLabel,
              amount:            addon.amount,
              stripe_session_id: sessionId,
              status:            'completed',
            })
          } catch {}
          sessionStorage.removeItem('pending_addon')
        }

        // Show success overlay for 2.5s then reload so all data fetches fresh from DB
        setOverlayAmount(json.amount || 0)
        setOverlayStatus('success')
        sessionStorage.setItem('payment_success_msg', msg)
        if (json.orderId) sessionStorage.setItem('payment_success_orderId', String(json.orderId))
        setTimeout(() => { window.location.href = '/dashboard/payments' }, 2500)
      } else {
        setOverlayStatus('error')
        setTimeout(() => {
          setOverlayVisible(false)
          setSuccessMsg(`⚠️ Could not verify payment: ${json.reason || json.error}`)
          setTimeout(() => setSuccessMsg(''), 6000)
        }, 2000)
      }
    } catch (err) {
      setOverlayStatus('error')
      setTimeout(() => {
        setOverlayVisible(false)
        setSuccessMsg('⚠️ Verification error: ' + err.message)
        setTimeout(() => setSuccessMsg(''), 5000)
      }, 2000)
    }
  }

  // Build transaction rows for the modal based on plan + paid_amount
  function getTxnRows(order) {
    if (!order) return []
    const total = order.price || 0
    const paid  = order.paid_amount || 0

    // Plan detection: DB → localStorage → math inference
    let planKey = order.payment_plan
    if (!planKey || planKey === 'full') {
      const stored = localStorage.getItem(`payment_plan_${order.id}`)
      if (isValidPlanKey(stored)) planKey = stored
    }
    if (!planKey && paid > 0 && paid < total) {
      const quarter = total / 4, half = total / 2
      if (Math.abs(paid % quarter) < 0.01 && Math.abs(paid % half) >= 0.01) planKey = 'weekly'
      else if (Math.abs(paid % half) < 0.01 && paid < total) planKey = 'biweekly'
    }

    const { type: planType, count: planCount } = parsePlanKey(planKey)

    const addDays = (base, days) => {
      if (!base) return null
      const d = new Date(base)
      d.setDate(d.getDate() + days)
      return d
    }
    const lastPaidAt  = order.updated_at ? new Date(order.updated_at) : null
    const storedFirst = localStorage.getItem(`first_payment_at_${order.id}`)
    const anchor      = storedFirst ? new Date(storedFirst) : lastPaidAt
    const instAt = (n) => {
      const s = localStorage.getItem(`inst_paid_at_${order.id}_${n}`)
      return s ? new Date(s) : null
    }

    if (planType === 'splithalf') {
      const half = Math.round(total / 2 * 100) / 100
      const p1   = paid >= half - 0.01
      const p2   = paid >= total - 0.01
      return [
        { label: 'Payment 1 Before Work Starts (50%)', amount: half, paid: p1, pct: 50, paidAt: p1 ? (instAt(1) || anchor)     : null, dueDate: null },
        { label: 'Payment 2 Before Submission (50%)',  amount: half, paid: p2, pct: 50, paidAt: p2 ? (instAt(2) || lastPaidAt) : null, dueDate: null }
      ]
    }
    if (planType === 'biweekly' || planType === 'weekly') {
      const part = Math.round(total / planCount * 100) / 100
      const pct  = Math.round(100 / planCount)
      const firstWed = anchor ? nextWeekWednesday(anchor) : null
      return Array.from({ length: planCount }, (_, i) => {
        const n = i + 1
        const paidN = paid >= part * n - 0.01
        const label = planType === 'weekly'
          ? `Week ${n} ${pct}%`
          : n === 1 ? `Payment 1 ${pct}%` : n === planCount ? `Final Payment ${pct}%` : `Payment ${n} ${pct}%`
        const dueDate = n === 1 ? null
          : planType === 'weekly' ? (firstWed ? addDays(firstWed, (n - 2) * 7) : null)
          : (firstWed ? addDays(firstWed, 7 + (n - 2) * 14) : null)
        return {
          label, amount: part, paid: paidN, pct,
          paidAt: paidN ? (instAt(n) || (n === 1 ? anchor : lastPaidAt)) : null,
          dueDate: !paidN ? dueDate : null,
        }
      })
    }

    return [{ label: 'Full Payment', amount: total, paid: paid >= total - 0.01, pct: 100, paidAt: paid >= total - 0.01 ? (instAt(1) || lastPaidAt) : null, dueDate: null }]
  }

  function handlePay(e) {
    e.preventDefault()
    if (!selectedOrder) return
    // Save the chosen plan so detectActivePlan can be unambiguous after payment
    if (paymentPlan !== 'full') {
      localStorage.setItem(`payment_plan_${selectedOrder.id}`, paymentPlan)
    }
    navigate(`/dashboard/checkout?orderId=${selectedOrder.id}&plan=${paymentPlan}`)
  }

  return (
    <StudentLayout title="Payments">
      <PaymentConfirmingOverlay visible={overlayVisible} status={overlayStatus} amount={overlayAmount} />
      <style>{`
        .payment-hero {
          background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
          border-radius: 20px;
          padding: 32px;
          margin-bottom: 28px;
          color: white;
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 24px;
        }
        .payment-plan-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 4px;
        }
        .plan-card {
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
          background: white;
          text-align: center;
        }
        .plan-card:hover { border-color: #16A34A; transform: translateY(-2px); }
        .plan-card.selected { border-color: #16A34A; background: #f0fdf4; }
        .plan-card-icon { font-size: 28px; margin-bottom: 8px; }
        .plan-card-title { font-weight: 700; font-size: 14px; color: #111; }
        .plan-card-desc { font-size: 12px; color: #6b7280; margin-top: 4px; }
        .installment-preview {
          background: #f8fafc;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #e5e7eb;
        }
        .installment-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 13px;
        }
        .installment-row:last-child { border-bottom: none; }
        .installment-row.due-now { background: #f0fdf4; }
        .pending-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #fef3c7;
          color: #d97706;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 999px;
          text-transform: uppercase;
        }
        @keyframes pulse-border {
          0%, 100% { border-color: #fbbf24; }
          50% { border-color: #f59e0b; }
        }
        .payment-alert {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        @media (max-width: 768px) {
          .payment-plan-grid { grid-template-columns: 1fr; }
          .payment-alert {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }
          .payment-alert-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>

      {/* === UPCOMING INSTALLMENT ALERTS (within 24 hrs of next due date) === */}
      {upcomingAlerts.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {upcomingAlerts.map(({ order, nextDue, nextAmount, installmentLabel, diffHrs, isOverdue }) => {
            const fmtDue = nextDue.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
            const hoursLeft = Math.abs(Math.round(diffHrs))
            return (
              <div key={order.id} style={{
                background: isOverdue
                  ? 'linear-gradient(135deg, #fff1f2, #ffe4e6)'
                  : 'linear-gradient(135deg, #fff7ed, #ffedd5)',
                border: `2px solid ${isOverdue ? '#f87171' : '#fb923c'}`,
                borderRadius: 14,
                padding: '16px 20px',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 14,
                flexWrap: 'wrap',
                boxShadow: isOverdue ? '0 0 0 3px rgba(239,68,68,0.12)' : '0 0 0 3px rgba(251,146,60,0.12)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 28, flexShrink: 0,
                    animation: isOverdue ? 'pulse-border 1.5s infinite' : undefined
                  }}>
                    {isOverdue ? '🚨' : '⏰'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontWeight: 800, fontSize: 14,
                      color: isOverdue ? '#991b1b' : '#9a3412',
                      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'
                    }}>
                      {isOverdue ? 'Payment Overdue!' : 'Payment Due Soon'}
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: isOverdue ? '#fee2e2' : '#ffedd5',
                        color: isOverdue ? '#dc2626' : '#ea580c'
                      }}>
                        {isOverdue ? `${hoursLeft}h overdue` : hoursLeft === 0 ? 'Due in < 1 hour' : `Due in ${hoursLeft}h`}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: isOverdue ? '#b91c1c' : '#c2410c', marginTop: 3 }}>
                      <strong>{installmentLabel}</strong> · Order {order.order_number} · {order.subject}
                    </div>
                    <div style={{ fontSize: 12, color: isOverdue ? '#b91c1c' : '#c2410c', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                      📅 Due: <strong>{fmtDue}</strong>
                      &nbsp;·&nbsp;
                      Amount: <strong>${nextAmount.toFixed(2)} USD</strong>
                    </div>
                  </div>
                </div>
                <button
                  className="sp-btn sp-btn-primary"
                  style={{
                    fontSize: 13, padding: '10px 18px', whiteSpace: 'nowrap', flexShrink: 0,
                    background: isOverdue ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : 'linear-gradient(135deg,#ea580c,#c2410c)',
                    boxShadow: isOverdue ? '0 4px 12px rgba(220,38,38,0.35)' : '0 4px 12px rgba(234,88,12,0.35)'
                  }}
                  onClick={() => {
                    setSelectedOrderId(String(order.id))
                    setTimeout(() => {
                      makePaymentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }, 50)
                  }}
                >
                  Pay ${nextAmount.toFixed(2)} USD Now →
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* === SUCCESS TOAST === */}
      {successMsg && (
        <div style={{
          background: '#ecfdf5', border: '1px solid #6ee7b7',
          borderRadius: 10, padding: '14px 18px',
          marginBottom: 20, color: '#065f46', fontSize: 14,
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          🎉 {successMsg}
        </div>
      )}

      <div className="sp-payments-grid">
        {/* ===== LEFT: MAKE PAYMENT ===== */}
        <div className="sp-card" style={{ margin: 0 }} ref={makePaymentRef}>
          <div className="sp-card-header">
            <h3 className="sp-card-title">💳 Make a Payment</h3>
          </div>
          <form onSubmit={handlePay} style={{ padding: '20px 24px' }}>
            {loading ? (
              <p style={{ color: 'var(--sp-muted)', textAlign: 'center', padding: 24 }}>Loading orders...</p>
            ) : (
              <>
                {/* Order Select */}
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>
                    Select Order
                  </label>
                  <select
                    value={selectedOrderId}
                    onChange={e => setSelectedOrderId(e.target.value)}
                    required
                    style={{
                      width: '100%', padding: '10px 14px',
                      border: '2px solid #e5e7eb', borderRadius: 10,
                      fontSize: 14, outline: 'none', background: '#f9fafb',
                      color: '#111'
                    }}
                  >
                    <option value="">-- Select an order --</option>
                    {orders.filter(o => o.price > 0 && o.payment_status !== 'paid').map(o => (
                      <option key={o.id} value={String(o.id)}>
                        {o.order_number?.replace('EA-', '') || o.id} {o.subject} (${(o.price || 0).toFixed(2)} USD)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Offer / Discount banner */}
                {selectedOrder && selectedOrder.original_price > selectedOrder.price && (() => {
                  const orig = selectedOrder.original_price
                  const offer = selectedOrder.price
                  const pct = Math.round((1 - offer / orig) * 100)
                  const saved = (orig - offer).toFixed(2)
                  return (
                    <div style={{
                      background: 'linear-gradient(135deg, #064e3b, #065f46)',
                      borderRadius: 12, padding: '14px 16px', marginBottom: 18,
                      display: 'flex', alignItems: 'center', gap: 14, color: 'white'
                    }}>
                      <div style={{ fontSize: 32, flexShrink: 0 }}>🎉</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>
                          Special Offer {pct}% OFF!
                        </div>
                        <div style={{ fontSize: 13, opacity: 0.85, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>${orig.toFixed(2)} USD</span>
                          <span style={{ fontSize: 18, fontWeight: 800, color: '#4ade80' }}>${offer.toFixed(2)} USD</span>
                          <span style={{ background: 'rgba(74,222,128,0.2)', border: '1px solid rgba(74,222,128,0.4)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: '#4ade80' }}>
                            Save ${saved} USD
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Payment Plan */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#374151' }}>
                    Payment Plan
                  </label>
                  {(() => {
                    const allPlanDefs = [
                      { baseKey: 'full',      icon: '⚡',  title: 'Full',       getDesc: ()    => 'Pay everything now' },
                      { baseKey: 'splithalf', icon: '✂️',  title: 'Split Half', getDesc: ()    => '50% upfront, 50% before delivery' },
                      { baseKey: 'biweekly',  icon: '📅',  title: 'Bi-Weekly',  getDesc: (c)   => `${c} equal payments` },
                      { baseKey: 'weekly',    icon: '🗓️', title: 'Weekly',     getDesc: (c)   => `${c} weekly payments` },
                    ]
                    const getAllowedFullKey = (baseType) => {
                      if (allowedByAdmin.includes(baseType)) return baseType
                      return allowedByAdmin.find(k => parsePlanKey(k).type === baseType) || null
                    }
                    // When an order is selected, show only admin-allowed plans; otherwise show all
                    const visiblePlans = selectedOrderId
                      ? allPlanDefs.filter(p =>
                          p.baseKey === 'full' || p.baseKey === 'splithalf'
                            ? allowedByAdmin.includes(p.baseKey)
                            : getAllowedFullKey(p.baseKey) !== null
                        )
                      : allPlanDefs
                    const noOrder = !selectedOrderId
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${visiblePlans.length}, 1fr)`, gap: 12, marginTop: 4 }}>
                        {visiblePlans.map(planDef => {
                          const effectiveKey = (planDef.baseKey === 'weekly' || planDef.baseKey === 'biweekly') && selectedOrderId
                            ? (getAllowedFullKey(planDef.baseKey) || planDef.baseKey)
                            : planDef.baseKey
                          const { count } = parsePlanKey(effectiveKey)
                          const desc = planDef.getDesc(count)
                          const faded = isPlanFaded(effectiveKey)
                          return (
                            <div
                              key={planDef.baseKey}
                              className={`plan-card ${!noOrder && paymentPlan === effectiveKey ? 'selected' : ''}`}
                              onClick={() => {
                                if (faded || noOrder) return
                                setPaymentPlan(effectiveKey)
                                if (selectedOrderId && effectiveKey !== 'full') {
                                  localStorage.setItem(`payment_plan_${selectedOrderId}`, effectiveKey)
                                }
                              }}
                              style={
                                noOrder
                                  ? { opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none', filter: 'grayscale(1)', userSelect: 'none' }
                                  : faded
                                  ? { opacity: 0.35, cursor: 'not-allowed', pointerEvents: 'none', filter: 'grayscale(0.6)' }
                                  : {}
                              }
                            >
                              <div className="plan-card-icon">{planDef.icon}</div>
                              <div className="plan-card-title">{planDef.title}</div>
                              <div className="plan-card-desc">{faded ? 'Not available' : desc}</div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>

                {/* Installment Preview */}
                {selectedOrder && installments.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#374151' }}>
                      Payment Schedule
                    </div>
                    <div className="installment-preview">
                      {installments.map((inst, i) => {
                        const isNextDue = !inst.paid && installments.slice(0, i).every(x => x.paid)
                        return (
                          <div
                            key={i}
                            className={`installment-row ${isNextDue ? 'due-now' : ''}`}
                            style={inst.paid ? { opacity: 0.55, background: '#f3f4f6' } : {}}
                          >
                            <div>
                              <div style={{ fontWeight: 600, color: inst.paid ? '#9ca3af' : '#111' }}>{inst.label}</div>
                              <div style={{ fontSize: 11, color: inst.paid ? '#9ca3af' : '#6b7280' }}>
                                {inst.paid ? 'Completed' : inst.dueLabel}
                              </div>
                              {inst.paid && inst.paidAt && (
                                <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, marginTop: 2 }}>
                                  🕒 {new Date(inst.paidAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                                </div>
                              )}
                              {!inst.paid && inst.dueDate && (
                                <div style={{ fontSize: 10, color: '#d97706', fontWeight: 600, marginTop: 2 }}>
                                  📅 {new Date(inst.dueDate).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {inst.paid && (
                                <span style={{
                                  background: '#dcfce7', color: '#16a34a',
                                  fontSize: 10, fontWeight: 800, padding: '2px 8px',
                                  borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.04em'
                                }}>✓ Paid</span>
                              )}
                              <div style={{
                                fontWeight: 700,
                                color: inst.paid ? '#9ca3af' : isNextDue ? '#16A34A' : '#111',
                                textDecoration: inst.paid ? 'line-through' : 'none'
                              }}>
                                ${inst.amount.toFixed(2)} USD
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!selectedOrderId || dueNow <= 0}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: dueNow <= 0 && selectedOrderId ? '#6ee7b7' : 'linear-gradient(135deg, #16A34A, #15803d)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: (selectedOrderId && dueNow > 0) ? 'pointer' : 'not-allowed',
                    opacity: selectedOrderId ? 1 : 0.6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8
                  }}
                >
                  {!selectedOrder ? '💳 Select an Order' : dueNow > 0 ? `Review & Pay $${dueNow.toFixed(2)} USD` : '✅ All Instalments Paid'}
                </button>
              </>
            )}
          </form>
        </div>

        {/* ===== RIGHT: ORDERS PAYMENT STATUS ===== */}
        <div className="sp-card" style={{ margin: 0 }}>
          <div className="sp-card-header">
            <h3 className="sp-card-title">📊 Payment Status</h3>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--sp-muted)' }}>Loading...</div>
          ) : orders.filter(o => o.price > 0).length === 0 ? (
            <div className="sp-empty" style={{ padding: '40px 24px' }}>
              <div className="sp-empty-icon">📋</div>
              <h4>No payment requests yet</h4>
              <p>When an admin sends you a payment request, it will appear here.</p>
            </div>
          ) : (
            <div style={{ padding: '0 24px 16px' }}>
              {orders.filter(o => o.price > 0).map(order => {
                const total = order.price || 0
                const paid = order.paid_amount || 0
                const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
                const isPaid = order.payment_status === 'paid'
                const isPending = order.payment_status !== 'paid' && order.price > 0
                return (
                  <div
                    key={order.id}
                    onClick={() => setTxnOrder(order)}
                    style={{ padding: '16px 0', borderBottom: '1px solid var(--sp-surface)', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>
                          {order.order_number || order.id}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--sp-muted)', marginTop: 2 }}>{order.subject}</div>
                      </div>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                        background: isPaid ? '#dcfce7' : isPending ? '#fef3c7' : '#f1f5f9',
                        color: isPaid ? '#16A34A' : isPending ? '#d97706' : '#64748b',
                        textTransform: 'uppercase'
                      }}>● {isPaid ? 'PAID' : isPending ? 'PENDING' : (order.payment_status || 'UNPAID')}</span>
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: isPaid ? '#16A34A' : 'linear-gradient(90deg, #16A34A, #4ade80)', borderRadius: 999, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span style={{ color: 'var(--sp-muted)' }}>Paid: <strong style={{ color: '#16A34A' }}>${paid.toFixed(2)} USD</strong></span>
                      <span style={{ color: 'var(--sp-muted)' }}>
                        Total:{' '}
                        {order.original_price > order.price && (
                          <strong style={{ textDecoration: 'line-through', color: '#9ca3af', marginRight: 4 }}>${order.original_price.toFixed(2)} USD</strong>
                        )}
                        <strong style={{ color: order.original_price > order.price ? '#16a34a' : 'inherit' }}>${total.toFixed(2)} USD</strong>
                        {order.original_price > order.price && (
                          <span style={{ marginLeft: 6, background: '#dcfce7', color: '#16a34a', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 4 }}>
                            -{Math.round((1 - order.price / order.original_price) * 100)}%
                          </span>
                        )}
                      </span>
                    </div>
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>Click to view transaction details →</div>
                      {order.coupon_code && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '2px 8px' }}>
                          <span style={{ fontSize: 10 }}>🎟️</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d', fontFamily: 'monospace', letterSpacing: '0.04em' }}>{order.coupon_code}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===== BOOST YOUR ORDER HISTORY ===== */}
      <div className="sp-card" style={{ margin: '24px 0 0' }}>
        <div className="sp-card-header" style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a5f)', borderRadius: '16px 16px 0 0', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🚀</span>
          <h3 className="sp-card-title" style={{ margin: 0, color: 'white', fontSize: 14 }}>Boost Your Order Purchase History</h3>
        </div>
        <div style={{ padding: '16px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13 }}>Loading…</div>
          ) : boostAddons.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 16px', background: '#f8fafc', borderRadius: 12, border: '1.5px dashed #e2e8f0' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🛒</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>No boost purchases yet</div>
              <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>Boost add-ons you buy will appear here.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {boostAddons.map(addon => {
                const EMOJI = { revision: '🔄', plagiarism: '📄', priority: '🛡️', standard: '⚡', elite: '👑', services: '🎯' }
                const icon = EMOJI[addon.addon_type] || '✨'
                const linkedOrder = orders.find(o => String(o.id) === String(addon.order_id))
                const orderRef = linkedOrder?.order_number || `#${String(addon.order_id).slice(0, 8)}`
                return (
                  <div key={addon.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                      {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{addon.addon_label}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <span style={{ background: '#dbeafe', color: '#1d4ed8', fontWeight: 700, padding: '1px 7px', borderRadius: 5, fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.03em' }}>{orderRef}</span>
                        <span>· Boost Your Order · ✓ Paid · {new Date(addon.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#16a34a', flexShrink: 0 }}>
                      ${Number(addon.amount).toFixed(2)}
                    </div>
                  </div>
                )
              })}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Total spent on boosts: </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginLeft: 6 }}>
                  ${boostAddons.reduce((s, a) => s + Number(a.amount), 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== TRANSACTION DETAIL MODAL ===== */}
      {txnOrder && (() => {
        const total         = txnOrder.price || 0
        const isPaid        = txnOrder.payment_status === 'paid'
        const rows          = getTxnRows(txnOrder)
        const basePaid      = rows.filter(r => r.paid).reduce((s, r) => s + r.amount, 0)
        const baseRemaining = rows.filter(r => !r.paid).reduce((s, r) => s + r.amount, 0)
        const pct           = total > 0 ? Math.min(100, Math.round((basePaid / total) * 100)) : 0
        const planLabelMap = { full: '⚡ Full Payment', splithalf: '✂️ Split Half', biweekly: '📅 Bi-Weekly (2 parts)', weekly: '🗓️ Weekly (4 parts)' }
        const planLabel = planLabelMap[txnOrder.payment_plan] || (() => {
          const { type: pt, count: pc } = parsePlanKey(txnOrder.payment_plan)
          if (pt === 'weekly')   return `🗓️ Weekly (${pc} parts)`
          if (pt === 'biweekly') return `📅 Bi-Weekly (${pc} parts)`
          return '⚡ Full Payment'
        })()
        const fmt    = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
        const fmtTs  = d => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : null

        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={() => setTxnOrder(null)}
          >
            <div
              style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', color: 'white', borderRadius: '20px 20px 0 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 11, opacity: 0.65, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 4 }}>TRANSACTION DETAILS</div>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{txnOrder.order_number || txnOrder.id}</div>
                    <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>{txnOrder.subject} · {txnOrder.type}</div>
                  </div>
                  <button onClick={() => setTxnOrder(null)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', width: 32, height: 32, borderRadius: '50%', fontSize: 16, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>✕</button>
                </div>

                {/* Progress */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                    <span>Paid: <strong style={{ color: '#4ade80' }}>${basePaid.toFixed(2)}</strong></span>
                    <span>Remaining: <strong>${baseRemaining.toFixed(2)}</strong></span>
                    <span>Total: <strong>${total.toFixed(2)}</strong></span>
                  </div>
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.2)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#4ade80', borderRadius: 999, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11, opacity: 0.7, marginTop: 4 }}>{pct}% complete</div>
                </div>
              </div>

              {/* Body */}
              <div style={{ overflowY: 'auto', flex: 1, padding: 24 }}>
                {/* Summary pills */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                  <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700 }}>
                    {planLabel}
                  </span>
                  <span style={{ background: isPaid ? '#dcfce7' : '#fef3c7', color: isPaid ? '#16a34a' : '#d97706', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700 }}>
                    ● {isPaid ? 'Fully Paid' : 'Payment Pending'}
                  </span>
                  <span style={{ background: '#f1f5f9', color: '#64748b', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600 }}>
                    🕒 Order: {fmt(txnOrder.created_at)}
                  </span>
                  {txnOrder.coupon_code && (
                    <span style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      🎟️ <span style={{ fontFamily: 'monospace', letterSpacing: '0.06em' }}>{txnOrder.coupon_code}</span>
                      {txnOrder.coupon_discount_value && (
                        <span style={{ background: '#dcfce7', borderRadius: 4, padding: '1px 6px', fontSize: 10 }}>
                          {txnOrder.coupon_discount_type === 'percentage' ? `${txnOrder.coupon_discount_value}% OFF` : `$${txnOrder.coupon_discount_value} OFF`}
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {/* Installment table */}
                <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>Payment Breakdown</div>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                  {rows.map((row, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '14px 18px', borderBottom: i < rows.length - 1 ? '1px solid #f3f4f6' : 'none',
                      background: row.paid ? '#f0fdf4' : i === rows.findIndex(r => !r.paid) ? '#fffbeb' : 'white'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 14,
                          background: row.paid ? '#dcfce7' : i === rows.findIndex(r => !r.paid) ? '#fef3c7' : '#f3f4f6'
                        }}>
                          {row.paid ? '✅' : i === rows.findIndex(r => !r.paid) ? '⏳' : '⬜'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: row.paid ? '#16a34a' : '#374151' }}>{row.label}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                            {row.paid ? (
                              <>
                                ✓ Paid
                                {fmtTs(row.paidAt) && (
                                  <span style={{ display: 'block', color: '#16a34a', fontWeight: 600, marginTop: 2 }}>
                                    🕒 {fmtTs(row.paidAt)}
                                  </span>
                                )}
                              </>
                            ) : row.dueDate ? (
                              <span style={{ color: '#d97706', fontWeight: 600 }}>
                                📅 Due: {fmtTs(row.dueDate)}
                              </span>
                            ) : 'Next payment due'}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: row.paid ? '#16a34a' : '#0f172a' }}>
                          ${row.amount.toFixed(2)}
                        </div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{row.pct}% of total</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order meta */}
                <div style={{ marginTop: 20, background: '#f8fafc', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    ['Order ID', txnOrder.order_number || txnOrder.id],
                    ['Subject', txnOrder.subject],
                    ['Type', txnOrder.type],
                    ['Words', txnOrder.word_count ? `${txnOrder.word_count.toLocaleString()} words` : '—'],
                    ['Deadline', fmt(txnOrder.deadline)],
                    ['Order Status', txnOrder.status],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{val || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              {txnOrder.payment_status !== 'paid' && (
                <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb' }}>
                  <button
                    onClick={() => { setTxnOrder(null); setSelectedOrderId(String(txnOrder.id)) }}
                    style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #16A34A, #15803d)', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                  >
                    💳 Pay Now ${baseRemaining.toFixed(2)} remaining
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </StudentLayout>
  )
}

export default Payments
