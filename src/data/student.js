// ============================================
// STUDENT PANEL DATA LAYER
// Now reads REAL user data from Supabase auth
// Returns EMPTY state for new users (no fake data)
// Will connect to Supabase tables in next phase
// ============================================

const STUDENT_KEY = 'assignpro_student_data'

// Empty default data - no fake John Smith anymore!
// New users start with completely empty dashboard
const EMPTY_DATA = {
  profile: {
    name: '',
    email: '',
    phone: '',
    country: '',
    countryCode: '',
    studentId: '',
    memberSince: '',
    verified: false,
    avatar: ''
  },
  walletBalance: 0,
  orders: [],          // Empty - new user has no orders
  notifications: [],    // Empty - no notifications yet
  messages: [],         // Empty - no messages yet
  files: [],            // Empty - no files yet
  transactions: [],     // Empty - no transactions yet
  achievements: [
    { id: 1, title: 'First Order', description: 'Place your first order', earned: false, icon: '🎯' },
    { id: 2, title: 'Top Student', description: 'Score 90%+ on 3 assignments', earned: false, icon: '🏆' },
    { id: 3, title: 'Loyal Customer', description: 'Complete 5+ orders', earned: false, progress: '0/5', icon: '💎' },
    { id: 4, title: 'Early Bird', description: 'Order 7+ days before deadline', earned: false, icon: '⚡' },
    { id: 5, title: 'Big Spender', description: 'Spend $500+ total', earned: false, progress: '$0/500', icon: '💰' },
    { id: 6, title: 'Reviewer', description: 'Write 3+ reviews', earned: false, progress: '0/3', icon: '⭐' }
  ],
  spending: {
    monthly: [
      { month: 'Nov', amount: 0 },
      { month: 'Dec', amount: 0 },
      { month: 'Jan', amount: 0 },
      { month: 'Feb', amount: 0 },
      { month: 'Mar', amount: 0 },
      { month: 'Apr', amount: 0 }
    ],
    totalSpent: 0,
    avgOrderValue: 0,
    topSubject: 'None yet'
  },
  referral: {
    code: '',           // Will be generated when user logs in
    referred: 0,
    earned: 0,
    pending: 0
  },
  installmentPlans: []
}

// Generate a unique referral code from user's name/email
const generateReferralCode = (user) => {
  if (!user) return ''
  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'USER'
  const cleanName = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 6)
  const year = new Date().getFullYear()
  return `${cleanName}${year}`
}

// Generate a student ID (numbers only, unique per user)
const generateStudentId = (user) => {
  if (!user?.id) return ''
  // Convert first 8 hex chars of UUID to a decimal number (0–4,294,967,295)
  // This uses ALL hex digits (not just 0-9), so collisions are extremely unlikely
  const hexPart = user.id.replace(/-/g, '').slice(0, 8)
  const num = parseInt(hexPart, 16) % 100000000
  return String(num).padStart(8, '0')
}

// Get initials from name
const getInitials = (name) => {
  if (!name) return 'U'
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || 'U'
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ===== MAIN FUNCTION: Build student data from Supabase user =====
// Pass in the user object from useAuth() hook
// Returns clean, empty data for new users
export const buildStudentData = (user) => {
  if (!user) return EMPTY_DATA

  const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'

  return {
    ...EMPTY_DATA,
    profile: {
      name: fullName,
      email: user.email || '',
      phone: user.user_metadata?.phone || user.phone || '',
      country: user.user_metadata?.country || '',
      countryCode: '',
      studentId: generateStudentId(user),
      memberSince: user.created_at || new Date().toISOString(),
      verified: !!user.email_confirmed_at,
      avatar: getInitials(fullName)
    },
    referral: {
      code: generateReferralCode(user),
      referred: 0,
      earned: 0,
      pending: 0
    }
  }
}

// ===== LEGACY FUNCTIONS (still used by existing components) =====
// These will work but return empty data
// We'll replace these with Supabase queries in next phase

const initStorage = () => {
  if (typeof window === 'undefined') return
  if (!localStorage.getItem(STUDENT_KEY)) {
    localStorage.setItem(STUDENT_KEY, JSON.stringify(EMPTY_DATA))
  }
}

export const getStudentData = () => {
  initStorage()
  if (typeof window === 'undefined') return EMPTY_DATA
  try {
    return JSON.parse(localStorage.getItem(STUDENT_KEY) || JSON.stringify(EMPTY_DATA))
  } catch {
    return EMPTY_DATA
  }
}

export const updateStudentData = (updates) => {
  const current = getStudentData()
  const updated = { ...current, ...updates }
  localStorage.setItem(STUDENT_KEY, JSON.stringify(updated))
  return updated
}

export const resetStudentData = () => {
  localStorage.removeItem(STUDENT_KEY)
  initStorage()
}

export const addOrder = (order) => {
  const data = getStudentData()
  const newOrder = {
    id: `EA-${Date.now()}`,
    status: 'pending',
    paymentStatus: 'unpaid',
    progress: 0,
    createdAt: new Date().toISOString(),
    ...order
  }
  data.orders.unshift(newOrder)
  localStorage.setItem(STUDENT_KEY, JSON.stringify(data))
  return newOrder
}

export const markNotificationRead = (id) => {
  const data = getStudentData()
  data.notifications = data.notifications.map(n =>
    n.id === id ? { ...n, read: true } : n
  )
  localStorage.setItem(STUDENT_KEY, JSON.stringify(data))
}

export const markAllNotificationsRead = () => {
  const data = getStudentData()
  data.notifications = data.notifications.map(n => ({ ...n, read: true }))
  localStorage.setItem(STUDENT_KEY, JSON.stringify(data))
}

export const updateWalletBalance = (amount, description) => {
  const data = getStudentData()
  data.walletBalance = (data.walletBalance || 0) + amount
  data.transactions.unshift({
    id: Date.now(),
    date: new Date().toISOString().split('T')[0],
    type: amount > 0 ? 'credit' : 'debit',
    description,
    amount,
    balance: data.walletBalance,
    status: 'completed',
    method: 'Wallet'
  })
  localStorage.setItem(STUDENT_KEY, JSON.stringify(data))
  return data
}
