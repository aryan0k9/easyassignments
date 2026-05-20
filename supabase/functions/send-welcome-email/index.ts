// ============================================================
// SEND WELCOME EMAIL Supabase Edge Function
// Triggered after a new user registers via the QuoteForm.
// Sends a branded email via Brevo with their temp password
// and a summary of their order.
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Brevo Transactional Email API ──────────────────────────
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') ?? ''
const FROM_EMAIL    = Deno.env.get('FROM_EMAIL')    ?? 'hello@easyassignments.net'
const FROM_NAME     = Deno.env.get('FROM_NAME')     ?? 'easyassignments'
const SITE_URL      = Deno.env.get('SITE_URL')      ?? 'https://easyassignments.net'

// ── Helpers ────────────────────────────────────────────────
function formatDeadline(isoString: string): string {
  if (!isoString) return 'Not specified'
  try {
    return new Date(isoString).toLocaleString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short',
      day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

// ── Email HTML Template ────────────────────────────────────
function buildEmailHTML(opts: {
  fullName: string
  email: string
  tempPassword: string
  orderDetails: {
    subject: string
    serviceType: string
    pages: number
    wordCount: number
    academicLevel: string
    deadline: string
    orderNumber?: string
  }
}): string {
  const { fullName, tempPassword, orderDetails } = opts
  const firstName = fullName?.split(' ')[0] || 'there'
  const dl = formatDeadline(orderDetails.deadline)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to easyassignments</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- ── HEADER ── -->
          <tr>
            <td style="background:linear-gradient(135deg,#16a34a 0%,#15803d 100%);border-radius:16px 16px 0 0;padding:36px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:16px;">
                <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#fff;font-family:Georgia,serif;line-height:1;">E</div>
                <span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">easyassignments</span>
              </div>
              <div style="font-size:48px;line-height:1;margin-bottom:12px;">🎉</div>
              <h1 style="margin:0;font-size:26px;font-weight:800;color:#fff;line-height:1.3;">
                Welcome, ${firstName}!<br />
                <span style="font-size:18px;font-weight:500;opacity:0.9;">Your account &amp; order are ready.</span>
              </h1>
            </td>
          </tr>

          <!-- ── BODY ── -->
          <tr>
            <td style="background:#fff;padding:40px;">

              <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
                Hi <strong>${firstName}</strong>, thank you for placing your order with easyassignments! 🎓<br />
                We've created your account and your order has been submitted to our team.
              </p>

              <!-- ── PASSWORD BOX ── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#f0fdf4;border:2px dashed #22c55e;border-radius:12px;padding:24px;text-align:center;">
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Your Login Email</p>
                    <p style="margin:0 0 18px;font-size:15px;font-weight:600;color:#15803d;">${opts.email}</p>
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Your Temporary Password</p>
                    <p style="margin:0;font-size:32px;font-weight:900;color:#15803d;letter-spacing:0.15em;font-family:'Courier New',monospace;">${tempPassword}</p>
                    <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;">You can change this password after logging in from your Profile page.</p>
                  </td>
                </tr>
              </table>

              <!-- ── LOGIN CTA ── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="${SITE_URL}/dashboard"
                       style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 40px;border-radius:10px;letter-spacing:0.02em;box-shadow:0 4px 14px rgba(22,163,74,0.35);">
                      Go to My Dashboard →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- ── ORDER SUMMARY ── -->
              <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">📋 Order Summary</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:28px;">
                ${orderDetails.orderNumber ? `
                <tr>
                  <td style="padding:12px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#6b7280;width:40%;">Order #</td>
                  <td style="padding:12px 16px;background:#fff;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:700;color:#15803d;">${orderDetails.orderNumber}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding:12px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#6b7280;">Subject</td>
                  <td style="padding:12px 16px;background:#fff;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">${orderDetails.subject}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#6b7280;">Type</td>
                  <td style="padding:12px 16px;background:#fff;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">${orderDetails.serviceType}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#6b7280;">Length</td>
                  <td style="padding:12px 16px;background:#fff;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">${orderDetails.pages} pages ≈ ${orderDetails.wordCount} words</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#6b7280;">Level</td>
                  <td style="padding:12px 16px;background:#fff;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">${orderDetails.academicLevel}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;background:#f9fafb;font-size:13px;font-weight:600;color:#6b7280;">Deadline</td>
                  <td style="padding:12px 16px;background:#fff;font-size:13px;color:#dc2626;font-weight:600;">📅 ${dl}</td>
                </tr>
              </table>

              <!-- ── WHAT HAPPENS NEXT ── -->
              <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">What happens next?</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                ${[
                  ['✅', 'Order Received', 'Your order is in our system and our specialists will review it now.'],
                  ['💰', 'Quote Coming', 'You\'ll receive a personalised price quote from our team shortly.'],
                  ['🎓', 'Expert Assigned', 'We\'ll match you with the best PhD expert for your subject.'],
                  ['📬', 'Delivery', 'Your completed work is delivered before your deadline.'],
                ].map(([icon, title, desc]) => `
                <tr>
                  <td style="padding:10px 0;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:36px;vertical-align:top;padding-top:2px;font-size:18px;">${icon}</td>
                        <td style="vertical-align:top;">
                          <strong style="font-size:14px;color:#111827;">${title}</strong><br />
                          <span style="font-size:13px;color:#6b7280;">${desc}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join('')}
              </table>

              <!-- ── SECURITY NOTE ── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 20px;">
                    <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.6;">
                      🔒 <strong>Security tip:</strong> Please change your temporary password as soon as you log in.
                      Go to <strong>Dashboard → Profile → Change Password</strong>.<br />
                      Never share your password with anyone.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:28px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#374151;">easyassignments</p>
              <p style="margin:0 0 16px;font-size:12px;color:#9ca3af;">
                Premium assignment help from verified PhD experts.<br />
                24/7 support · Plagiarism-free · Money-back guarantee
              </p>
              <p style="margin:0;font-size:11px;color:#d1d5db;">
                You received this email because you placed an order on easyassignments.<br />
                © ${new Date().getFullYear()} easyassignments. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Main Handler ───────────────────────────────────────────
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY secret is not set in Supabase Edge Function secrets.')
    }

    const { email, fullName, tempPassword, orderDetails } = await req.json()

    if (!email || !tempPassword) {
      throw new Error('Missing required fields: email or tempPassword')
    }

    const htmlContent = buildEmailHTML({ email, fullName: fullName || '', tempPassword, orderDetails: orderDetails || {} })

    // Call Brevo Transactional Email API
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email, name: fullName || 'Student' }],
        subject: `🎉 Welcome to easyassignments Your account & order are ready!`,
        htmlContent,
      }),
    })

    const brevoData = await brevoRes.json()

    if (!brevoRes.ok) {
      console.error('Brevo API error:', JSON.stringify(brevoData))
      throw new Error(`Brevo API error: ${brevoData.message || brevoRes.statusText}`)
    }

    console.log('Welcome email sent to:', email, '| Brevo messageId:', brevoData.messageId)

    return new Response(
      JSON.stringify({ success: true, messageId: brevoData.messageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (err) {
    console.error('send-welcome-email error:', err.message)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
