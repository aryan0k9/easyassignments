// ============================================================
// COUPON HELPERS  (used by Checkout + CouponBanner)
// ============================================================

import { supabase } from './supabase'

/**
 * Validate a coupon code against the database.
 * Returns { valid, coupon, error }
 */
export async function validateCoupon(code, orderAmount = 0, userId = null) {
  const clean = code.trim().toUpperCase()
  if (!clean) return { valid: false, error: 'Please enter a coupon code.' }

  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', clean)
    .single()

  if (error || !data) return { valid: false, error: 'Invalid coupon code.' }
  if (!data.is_active)  return { valid: false, error: 'This coupon is no longer active.' }

  if (data.expires_at && new Date(data.expires_at) < new Date())
    return { valid: false, error: 'This coupon has expired.' }

  if (data.max_uses != null && data.used_count >= data.max_uses)
    return { valid: false, error: 'This coupon has reached its usage limit.' }

  if (data.min_order_value != null && orderAmount < data.min_order_value)
    return { valid: false, error: `Minimum order value of $${data.min_order_value} required.` }

  // User-restricted: only the specified user can use this coupon
  if (data.restricted_to_user_id) {
    if (!userId) return { valid: false, error: 'This coupon is not available for your account.' }
    if (data.restricted_to_user_id !== userId) return { valid: false, error: 'This coupon is not available for your account.' }
  }

  // Per-user: check if this user has already used this coupon
  if (userId) {
    const { data: existing } = await supabase
      .from('coupon_user_usage')
      .select('id')
      .eq('coupon_id', data.id)
      .eq('user_id', userId)
      .maybeSingle()
    if (existing) return { valid: false, error: 'You have already used this coupon.' }
  }

  return { valid: true, coupon: data }
}

/**
 * Calculate the dollar discount for a given coupon and base price.
 */
export function calcDiscount(coupon, basePrice) {
  if (!coupon) return 0
  if (coupon.discount_type === 'percentage')
    return Math.round(basePrice * coupon.discount_value / 100 * 100) / 100
  return Math.min(coupon.discount_value, basePrice)
}

/**
 * Increment the used_count for a coupon after successful payment.
 */
export async function incrementCouponUsage(couponId) {
  await supabase.rpc('increment_coupon_usage', { coupon_id: couponId })
}

/**
 * Record that a user has used a coupon after successful payment.
 * Also increments used_count and auto-deactivates user/order-restricted coupons.
 */
export async function recordCouponUsage(couponId, couponCode, userId, orderId = null) {
  // Insert usage record (UNIQUE constraint prevents duplicates)
  await supabase.from('coupon_user_usage').insert({
    coupon_id:   couponId,
    coupon_code: couponCode,
    user_id:     userId,
    order_id:    orderId,
  })

  // Fetch coupon to check if it's user/order-restricted
  const { data: coupon } = await supabase
    .from('coupons')
    .select('used_count, max_uses, restricted_to_user_id, restricted_to_order_id')
    .eq('id', couponId)
    .single()

  if (!coupon) return

  const newCount = (coupon.used_count || 0) + 1
  const updates = { used_count: newCount }

  // Auto-deactivate if it's user-restricted or order-restricted (single-use by design)
  // or if max_uses is now reached
  const isRestricted = coupon.restricted_to_user_id || coupon.restricted_to_order_id
  const maxReached   = coupon.max_uses != null && newCount >= coupon.max_uses
  if (isRestricted || maxReached) {
    updates.is_active = false
  }

  await supabase.from('coupons').update(updates).eq('id', couponId)
}

/**
 * Fetch active, non-expired coupons, filtering out ones the user already used.
 */
export async function getActiveCoupons(userId = null) {
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('coupons')
    .select('id, code, description, discount_type, discount_value, expires_at, restricted_to_user_id, restricted_to_order_id')
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })

  if (!data?.length) return []

  // Order-restricted coupons are pre-applied to a specific order never show in banner
  let filtered = data.filter(c => !c.restricted_to_order_id)

  // User-restricted: only show to the matching user; public coupons show to everyone
  if (userId) {
    filtered = filtered.filter(c => !c.restricted_to_user_id || c.restricted_to_user_id === userId)

    const { data: used } = await supabase
      .from('coupon_user_usage')
      .select('coupon_id')
      .eq('user_id', userId)
    const usedIds = new Set((used || []).map(u => u.coupon_id))
    return filtered.filter(c => !usedIds.has(c.id))
  }

  // No userId only show fully public coupons
  return filtered.filter(c => !c.restricted_to_user_id)
}
