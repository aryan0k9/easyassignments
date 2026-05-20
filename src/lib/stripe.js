import { supabase } from './supabase'

const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`

export async function redirectToCheckout({ amount = 0, description, orderId = '', type = 'payment', plan = 'full', addonType = '', promoCode = '', useWallet = true, successPath = '/dashboard/payments', cancelPath = '/dashboard/payments' }) {
  const origin = window.location.origin
  // {CHECKOUT_SESSION_ID} is replaced by Stripe with the real session ID cannot be faked
  const successUrl = `${origin}${successPath}?session_id={CHECKOUT_SESSION_ID}&type=${type}`
  const cancelUrl  = `${origin}${cancelPath}?cancelled=1`

  const { data: { session } } = await supabase.auth.getSession()

  const res = await fetch(EDGE_FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token ?? ''}`,
    },
    // For type='payment' the edge function ignores `amount` and computes it server-side from the order.
    // For type='topup' the edge function clamps `amount` to a safe range ($1–$1000) before charging.
    body: JSON.stringify({ amount, description, orderId, type, plan, addonType, promoCode, useWallet, successUrl, cancelUrl }),
  })

  const json = await res.json()
  if (json.error) throw new Error(json.error)
  window.location.href = json.url
}
