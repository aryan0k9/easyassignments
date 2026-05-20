import Stripe from 'https://esm.sh/stripe@14?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sessionId } = await req.json()
    if (!sessionId) throw new Error('Missing sessionId')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Get user from auth header
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    ).auth.getUser()

    // ── Idempotency check using description (no extra column needed) ──
    const idempotencyDesc = `session:${sessionId}`
    const { data: alreadyProcessed } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id, amount')
      .eq('description', idempotencyDesc)
      .maybeSingle()

    if (alreadyProcessed) {
      return new Response(JSON.stringify({
        verified: true,
        already_processed: true,
        amount: alreadyProcessed.amount,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Verify with Stripe cannot be faked
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      return new Response(JSON.stringify({ verified: false, reason: 'Payment not completed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const orderId         = session.metadata?.orderId ?? ''
    const type            = session.metadata?.type ?? 'payment'
    const plan            = session.metadata?.plan ?? 'full'
    const walletAmountUsed = parseFloat(session.metadata?.walletAmountUsed ?? '0')
    const cardAmount      = session.amount_total ? session.amount_total / 100 : 0
    const totalAmount     = cardAmount + walletAmountUsed

    // ── Update order if this is an order payment ──
    let orderNumber = orderId
    if (type === 'payment' && orderId) {
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('price, paid_amount, order_number')
        .eq('id', orderId)
        .single()

      if (order) {
        orderNumber = order.order_number ?? orderId
        const newPaid = (order.paid_amount || 0) + totalAmount
        const isFullyPaid = newPaid >= (order.price || 0)
        await supabaseAdmin.from('orders').update({
          paid_amount: newPaid,
          payment_status: isFullyPaid ? 'paid' : 'partial',
          status: 'active',
          payment_plan: plan,
        }).eq('id', orderId)
      }
    }

    // ── Record transactions ──
    if (user) {
      if (type === 'topup') {
        // Credit the wallet use idempotency key in description
        const { error: insertErr } = await supabaseAdmin.from('wallet_transactions').insert({
          user_id: user.id,
          amount: cardAmount,
          type: 'credit',
          status: 'completed',
          balance_after: 0,
          description: idempotencyDesc,
        })
        if (insertErr) throw new Error('Failed to record topup: ' + insertErr.message)

        // Update the description to be human-readable (second update avoids race condition on insert)
        await supabaseAdmin.from('wallet_transactions')
          .update({ description: `Wallet top-up via Stripe` })
          .eq('description', idempotencyDesc)
          .eq('user_id', user.id)

      } else {
        // Debit/credit for order payment
        const { error: cardErr } = await supabaseAdmin.from('wallet_transactions').insert({
          user_id: user.id,
          amount: cardAmount,
          type: 'debit',
          status: 'completed',
          balance_after: 0,
          description: idempotencyDesc,
        })
        if (cardErr) throw new Error('Failed to record card payment: ' + cardErr.message)

        await supabaseAdmin.from('wallet_transactions')
          .update({ description: `Card payment for Order ${orderNumber}` })
          .eq('description', idempotencyDesc)
          .eq('user_id', user.id)

        // Debit wallet portion if used
        if (walletAmountUsed > 0) {
          await supabaseAdmin.from('wallet_transactions').insert({
            user_id: user.id,
            amount: walletAmountUsed,
            type: 'debit',
            status: 'completed',
            balance_after: 0,
            description: `Wallet payment for Order ${orderNumber}`,
          })
        }
      }
    }

    return new Response(JSON.stringify({ verified: true, amount: totalAmount, orderId, type }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(JSON.stringify({ verified: false, error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
