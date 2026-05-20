export function VisaIcon({ width = 52, height = 33 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 52 33" style={{ display: 'block', borderRadius: 4, border: '1px solid #d1d5db' }}>
      <rect width="52" height="33" fill="#1A1F71" rx="3" />
      <text
        x="26" y="23"
        fill="white"
        fontSize="15"
        fontWeight="900"
        fontStyle="italic"
        textAnchor="middle"
        fontFamily="Arial Black, Arial, sans-serif"
        letterSpacing="0.5"
      >VISA</text>
    </svg>
  )
}

export function MastercardIcon({ width = 52, height = 33 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 52 33" style={{ display: 'block', borderRadius: 4, border: '1px solid #d1d5db' }}>
      <rect width="52" height="33" fill="#1C1C1C" rx="3" />
      <circle cx="19" cy="16.5" r="11" fill="#EB001B" />
      <circle cx="33" cy="16.5" r="11" fill="#F79E1B" opacity="0.88" />
    </svg>
  )
}

export function AmexIcon({ width = 52, height = 33 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 52 33" style={{ display: 'block', borderRadius: 4, border: '1px solid #d1d5db' }}>
      <defs>
        <linearGradient id="amex-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#005EB8" />
          <stop offset="100%" stopColor="#007BC1" />
        </linearGradient>
      </defs>
      <rect width="52" height="33" fill="url(#amex-grad)" rx="3" />
      <text
        x="26" y="20"
        fill="white"
        fontSize="10"
        fontWeight="800"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        letterSpacing="2"
      >AMEX</text>
      <text
        x="26" y="27"
        fill="rgba(255,255,255,0.7)"
        fontSize="5.5"
        fontWeight="600"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        letterSpacing="0.8"
      >AMERICAN EXPRESS</text>
    </svg>
  )
}

export function StripeIcon({ width = 52, height = 33 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 52 33" style={{ display: 'block', borderRadius: 4, border: '1px solid #d1d5db' }}>
      <defs>
        <linearGradient id="stripe-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6772E5" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>
      </defs>
      <rect width="52" height="33" fill="url(#stripe-grad)" rx="3" />
      <text
        x="26" y="21"
        fill="white"
        fontSize="12"
        fontWeight="800"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        letterSpacing="1"
      >stripe</text>
    </svg>
  )
}

export function PaymentCardIcons({ gap = 6, width = 52, height = 33 }) {
  return (
    <div style={{ display: 'flex', gap, alignItems: 'center' }}>
      <VisaIcon width={width} height={height} />
      <MastercardIcon width={width} height={height} />
      <AmexIcon width={width} height={height} />
      <StripeIcon width={width} height={height} />
    </div>
  )
}
