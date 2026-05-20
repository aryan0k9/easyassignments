// ============================================================
// ORDERS HELPER - All order-related Supabase queries
// ============================================================
// Note: Price is NOT shown to students. Admin sets price after
// reviewing the order and discussing with the customer.
// ============================================================

import { supabase } from './supabase'

// SITE_ID for this app (easyassignments = 1)
// Change to 2, 3, 4 when building other sites
const SITE_ID = 1

// ============================================================
// GENERATE ORDER NUMBER
// Format: EA-{YY}{MM}{DD}{RRRRRRRR}
// Example: EA-260501470082341
//
// Breakdown:
//   YY       = 2-digit year   e.g. "26"
//   MM       = 2-digit month  e.g. "05"
//   DD       = 2-digit day    e.g. "01"
//   RRRRRRRR = 8-digit random e.g. "47008234"
// ============================================================
function generateOrderNumber() {
  const now = new Date()
  const year  = String(now.getFullYear()).slice(2)
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day   = String(now.getDate()).padStart(2, '0')
  const rand  = Math.floor(10000000 + Math.random() * 90000000)   // 8-digit random

  return `EA-${year}${month}${day}${rand}`
}

// ============================================================
// CREATE ORDER
// Saves order WITHOUT price - admin sets price after review
// ============================================================
export async function createOrder(orderData, overrideUserId = null) {
  try {
    // Use the passed-in userId if available (avoids a getUser() network call
    // right after signUp() which can race before the session is fully propagated)
    let user = null
    if (overrideUserId) {
      user = { id: overrideUserId }
    } else {
      const { data: authData } = await supabase.auth.getUser()
      user = authData?.user
    }
    if (!user?.id) {
      return { success: false, error: 'You must be logged in to place an order' }
    }

    // Fetch profile details to embed in order number and use for chat session.
    // Use maybeSingle so missing-row doesn't error; we self-heal below.
    let { data: profile, error: profileFetchError } = await supabase
      .from('profiles')
      .select('student_id, email, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (profileFetchError) {
      console.error('[createOrder] profile fetch error:', profileFetchError)
    }

    // Self-heal: if profile is missing (handle_new_user trigger crashed), create it.
    // The orders FK to profiles would otherwise reject the INSERT with a 409.
    if (!profile) {
      console.warn('[createOrder] No profile row found for user', user.id, 'creating one.')
      const fallbackEmail = user.email || (overrideUserId ? null : null)
      const fallbackName = user.user_metadata?.full_name || fallbackEmail?.split('@')[0] || 'Student'
      const { data: createdProfile, error: profileCreateError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: fallbackEmail,
          full_name: fallbackName,
          site_id: SITE_ID,
          student_id: 'EA-' + Date.now().toString().slice(-6),
        })
        .select('student_id, email, full_name')
        .maybeSingle()
      if (profileCreateError) {
        console.error('[createOrder] profile self-heal INSERT failed:', profileCreateError)
        return { success: false, error: `Profile setup failed: ${profileCreateError.message}` }
      }
      profile = createdProfile
    }

    const orderNumber = generateOrderNumber()
    const wordCount = parseInt(orderData.wordCount) || 1000

    // Insert order into database (NO price set!)
    const { data, error } = await supabase
      .from('orders')
      .insert({
        order_number:    orderNumber,
        user_id:         user.id,
        site_id:         SITE_ID,
        title:           orderData.title || `${orderData.subject} Assignment`,
        subject:         orderData.subject,
        type:            orderData.type,
        word_count:      wordCount,
        pages:           Math.ceil(wordCount / 275),
        academic_level:  orderData.academicLevel,
        description:     orderData.description || '',
        formatting_style: orderData.formattingStyle || 'Not Required',
        // price NOT set - admin will set it later (defaults to 0.00)
        deadline:        orderData.deadline,
        status:          orderData.status || 'pending',
        payment_status:  'unpaid',
        progress:        0,
        expert_name:     orderData.expertName  || null,
        expert_avatar:   orderData.expertAvatar || null,
        coupon_code:     orderData.couponCode   || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Order creation error:', error)
      return { success: false, error: error.message }
    }

    // Create notification for user
    await supabase.from('notifications').insert({
      user_id: user.id,
      site_id: SITE_ID,
      type:    'order',
      title:   'Order Received',
      message: `Your order ${orderNumber} has been received. Our team will review it and contact you with a quote shortly.`,
      link:    `/dashboard/orders`,
      read:    false
    })

    const visitorName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || profile?.email?.split('@')[0] || 'Student'

    // Create a chat session for this order (welcome message inserted by DB trigger)
    const { error: sessionError } = await supabase
      .from('chat_sessions')
      .insert({
        user_id:      user.id,
        order_id:     data.id,
        order_number: orderNumber,
        chat_type:    'order',
        site_id:      SITE_ID,
        visitor_name: visitorName,
        visitor_email: profile?.email || user.email,
        status:       'active',
        last_message: '👋 Thank you for your order! We\'ll get back to you shortly.',
        unread_count: 1,
        updated_at:   new Date().toISOString()
      })
      .select('id')
      .single()

    if (sessionError) {
      console.error('Error creating chat session:', sessionError)
    }

    // Welcome message is now inserted by the trg_order_welcome_message DB trigger
    // (SECURITY DEFINER), so sender_type='admin' works without client privileges.

    // Fire-and-forget order-placed email via Brevo. Server-side lookup
    // in the edge function ensures email content can't be spoofed.
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-order-placed-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            orderId: data.id,
            appOrigin: window.location.origin,
          }),
        }).catch(err => console.error('Order-placed email failed (non-critical):', err.message))
      }
    } catch (_) { /* never block order success on email */ }

    return { success: true, order: data }
  } catch (err) {
    console.error('Unexpected error:', err)
    return { success: false, error: err.message || 'Something went wrong' }
  }
}

// ============================================================
// GET ALL ORDERS FOR CURRENT USER
// ============================================================
export async function getMyOrders() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, orders: [], error: 'Not logged in' }

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .eq('site_id', SITE_ID)
      .order('created_at', { ascending: false })

    if (error) {
      return { success: false, orders: [], error: error.message }
    }

    return { success: true, orders: data || [] }
  } catch (err) {
    return { success: false, orders: [], error: err.message }
  }
}

// ============================================================
// GET ORDER BY ID
// ============================================================
export async function getOrderById(orderId) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, order: null, error: 'Not logged in' }

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single()

    if (error) {
      return { success: false, order: null, error: error.message }
    }

    return { success: true, order: data }
  } catch (err) {
    return { success: false, order: null, error: err.message }
  }
}

// ============================================================
// GET ORDER STATS FOR DASHBOARD
// Returns counts only - no money values
// ============================================================
export async function getOrderStats() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { total: 0, active: 0, completed: 0, pending: 0 }

    const { data, error } = await supabase
      .from('orders')
      .select('status')
      .eq('user_id', user.id)
      .eq('site_id', SITE_ID)

    if (error || !data) {
      return { total: 0, active: 0, completed: 0, pending: 0 }
    }

    return {
      total:     data.length,
      pending:   data.filter(o => o.status === 'pending').length,
      active:    data.filter(o => o.status === 'active' || o.status === 'in_review').length,
      completed: data.filter(o => o.status === 'completed').length,
      cancelled: data.filter(o => o.status === 'cancelled').length
    }
  } catch (err) {
    return { total: 0, active: 0, completed: 0, pending: 0 }
  }
}

// ============================================================
// SUBSCRIBE TO REAL-TIME ORDER UPDATES
// ============================================================
export function subscribeToMyOrders(userId, callback) {
  const subscription = supabase
    .channel('orders-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        callback(payload)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(subscription)
  }
}
