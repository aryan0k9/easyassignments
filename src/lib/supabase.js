// ============================================================
// MOCK SUPABASE — No network calls. All data stored in localStorage.
// ============================================================

function genId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}
const ts = () => new Date().toISOString()

function getTable(name) {
  try { return JSON.parse(localStorage.getItem(`ea_${name}`) || '[]') } catch { return [] }
}
function saveTable(name, rows) {
  localStorage.setItem(`ea_${name}`, JSON.stringify(rows))
}

// ── Seed data on first run ────────────────────────────────────
;(function seed() {
  if (localStorage.getItem('ea_seeded_v2')) return

  const adminId  = genId()
  const studentId = genId()

  localStorage.setItem('ea_auth_users', JSON.stringify([
    { id: adminId,   email: 'admin@demo.com',   password: 'admin123', user_metadata: { full_name: 'Admin User' },   created_at: ts() },
    { id: studentId, email: 'student@demo.com',  password: 'demo123',  user_metadata: { full_name: 'Demo Student' }, created_at: ts() },
  ]))

  saveTable('profiles', [
    { id: adminId,   email: 'admin@demo.com',  full_name: 'Admin User',   role: 'admin',   site_id: 1, student_id: 'EA-ADM001', created_at: ts() },
    { id: studentId, email: 'student@demo.com', full_name: 'Demo Student', role: 'student', site_id: 1, student_id: 'EA-STU001', created_at: ts() },
  ])

  const o1 = genId(), o2 = genId(), o3 = genId()
  saveTable('orders', [
    { id: o1, order_number: 'EA-260101001', user_id: studentId, site_id: 1, title: 'Computer Science Assignment', subject: 'Computer Science', type: 'Assignment',  word_count: 2000, pages: 8,  academic_level: 'Undergraduate', description: 'Data structures and algorithms homework',  deadline: new Date(Date.now() + 3*86400000).toISOString(),  status: 'pending',   payment_status: 'unpaid', price: 0,   paid_amount: 0,   progress: 0,   created_at: new Date(Date.now() - 2*3600000).toISOString() },
    { id: o2, order_number: 'EA-260101002', user_id: studentId, site_id: 1, title: 'Nursing Case Study',          subject: 'Nursing',          type: 'Case Study',  word_count: 3000, pages: 12, academic_level: 'Undergraduate', description: 'Patient care scenario analysis',          deadline: new Date(Date.now() + 5*86400000).toISOString(),  status: 'active',    payment_status: 'paid',   price: 120, paid_amount: 120, progress: 40,  created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: o3, order_number: 'EA-260101003', user_id: studentId, site_id: 1, title: 'Finance Essay',               subject: 'Finance',          type: 'Essay',       word_count: 1500, pages: 6,  academic_level: 'Masters',       description: 'Financial markets analysis paper',       deadline: new Date(Date.now() - 86400000).toISOString(),    status: 'completed', payment_status: 'paid',   price: 95,  paid_amount: 95,  progress: 100, created_at: new Date(Date.now() - 7*86400000).toISOString() },
  ])

  saveTable('coupons', [
    { id: genId(), code: 'SAVE50',    discount_type: 'percentage', discount_value: 50, min_order_value: 0,  max_uses: 100, used_count: 5,  is_active: true, expires_at: null, restricted_to_user_id: null, restricted_to_order_id: null, created_at: ts() },
    { id: genId(), code: 'WELCOME20', discount_type: 'percentage', discount_value: 20, min_order_value: 0,  max_uses: 100, used_count: 10, is_active: true, expires_at: null, restricted_to_user_id: null, restricted_to_order_id: null, created_at: ts() },
    { id: genId(), code: 'FLAT10',    discount_type: 'fixed',      discount_value: 10, min_order_value: 50, max_uses: 50,  used_count: 2,  is_active: true, expires_at: null, restricted_to_user_id: null, restricted_to_order_id: null, created_at: ts() },
  ])

  saveTable('chat_sessions',   [])
  saveTable('chat_messages',   [])
  saveTable('notifications',   [
    { id: genId(), user_id: studentId, site_id: 1, type: 'order', title: 'Welcome!', message: 'Your account is ready. Place your first order to get started.', link: '/dashboard/new-order', read: false, created_at: ts() }
  ])
  saveTable('order_files',     [])
  saveTable('coupon_user_usage', [])
  saveTable('wallet_transactions', [
    { id: genId(), user_id: studentId, site_id: 1, type: 'credit', amount: 0, description: 'Welcome bonus', created_at: ts() }
  ])

  localStorage.setItem('ea_seeded_v2', '1')
})()

// ── Auth listener registry ────────────────────────────────────
const _listeners = []
function _notify(event, session) {
  _listeners.forEach(cb => { try { cb(event, session) } catch {} })
}

// ── Auth implementation ───────────────────────────────────────
const mockAuth = {
  getSession() {
    const s = JSON.parse(localStorage.getItem('ea_session') || 'null')
    return Promise.resolve({ data: { session: s }, error: null })
  },

  getUser() {
    const s = JSON.parse(localStorage.getItem('ea_session') || 'null')
    return Promise.resolve({ data: { user: s?.user ?? null }, error: null })
  },

  signInWithPassword({ email, password }) {
    return new Promise(resolve => {
      const users = JSON.parse(localStorage.getItem('ea_auth_users') || '[]')
      const found = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password)
      if (!found) return resolve({ data: { user: null, session: null }, error: { message: 'Invalid email or password' } })
      const { password: _pw, ...user } = found
      const session = { access_token: 'mock-' + genId(), user, expires_at: Date.now() + 86400000 }
      localStorage.setItem('ea_session', JSON.stringify(session))
      setTimeout(() => _notify('SIGNED_IN', session), 0)
      resolve({ data: { user, session }, error: null })
    })
  },

  signUp({ email, password, options = {} }) {
    return new Promise(resolve => {
      const users = JSON.parse(localStorage.getItem('ea_auth_users') || '[]')
      const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase())
      if (existing) {
        // Supabase returns identities:[] for existing emails (no error thrown)
        const { password: _pw, ...user } = existing
        return resolve({ data: { user: { ...user, identities: [] }, session: null }, error: null })
      }
      const newUser = {
        id: genId(), email, password,
        user_metadata: options.data || {},
        identities: [{ id: genId() }],
        created_at: ts()
      }
      users.push(newUser)
      localStorage.setItem('ea_auth_users', JSON.stringify(users))

      // Auto-create profile row
      const profiles = getTable('profiles')
      if (!profiles.find(p => p.id === newUser.id)) {
        profiles.push({
          id: newUser.id, email,
          full_name: options.data?.full_name || email.split('@')[0],
          role: 'student', site_id: 1,
          student_id: 'EA-' + Date.now().toString().slice(-6),
          created_at: ts()
        })
        saveTable('profiles', profiles)
      }

      const { password: _pw, ...user } = newUser
      // No email confirmation in offline mode — create session immediately
      const session = { access_token: 'mock-' + genId(), user, expires_at: Date.now() + 86400000 }
      localStorage.setItem('ea_session', JSON.stringify(session))
      resolve({ data: { user, session }, error: null })
    })
  },

  signOut() {
    localStorage.removeItem('ea_session')
    setTimeout(() => _notify('SIGNED_OUT', null), 0)
    return Promise.resolve({ error: null })
  },

  signInWithOAuth({ provider }) {
    alert(`${provider} login is not available in offline mode.\n\nUse email/password instead:\nEmail:    student@demo.com\nPassword: demo123`)
    return Promise.resolve({ data: null, error: { message: 'OAuth unavailable offline' } })
  },

  resetPasswordForEmail(email) {
    alert(`[Offline Mode] Password reset email would be sent to: ${email}\n\nNo emails are sent in offline mode.\nDemo login:\nEmail: student@demo.com\nPassword: demo123`)
    return Promise.resolve({ error: null })
  },

  updateUser(updates) {
    const s = JSON.parse(localStorage.getItem('ea_session') || 'null')
    if (!s) return Promise.resolve({ data: null, error: { message: 'Not logged in' } })
    if (updates.password) {
      const users = JSON.parse(localStorage.getItem('ea_auth_users') || '[]')
      const idx = users.findIndex(u => u.id === s.user.id)
      if (idx >= 0) { users[idx].password = updates.password; localStorage.setItem('ea_auth_users', JSON.stringify(users)) }
    }
    if (updates.data) {
      s.user.user_metadata = { ...s.user.user_metadata, ...updates.data }
      localStorage.setItem('ea_session', JSON.stringify(s))
    }
    return Promise.resolve({ data: { user: s.user }, error: null })
  },

  onAuthStateChange(callback) {
    _listeners.push(callback)
    const s = JSON.parse(localStorage.getItem('ea_session') || 'null')
    if (s) setTimeout(() => callback('SIGNED_IN', s), 0)
    return {
      data: {
        subscription: {
          unsubscribe() {
            const i = _listeners.indexOf(callback)
            if (i >= 0) _listeners.splice(i, 1)
          }
        }
      }
    }
  }
}

// ── Query Builder ─────────────────────────────────────────────
class QB {
  constructor(table) {
    this._t = table
    this._f = []      // filters
    this._ord = null
    this._lim = null
    this._single = false
    this._maybe  = false
    this._ins = null
    this._upd = null
    this._del = false
    this._ups = false
    this._cnt = null
    this._head = false
  }

  select(fields = '*', opts = {}) {
    if (opts.count) this._cnt  = opts.count
    if (opts.head)  this._head = opts.head
    return this
  }

  insert(data)  { this._ins = data; return this }
  update(data)  { this._upd = data; return this }
  upsert(data)  { this._ins = data; this._ups = true; return this }
  delete()      { this._del = true; return this }

  eq(f, v)      { this._f.push({ t: 'eq',   f, v  }); return this }
  neq(f, v)     { this._f.push({ t: 'neq',  f, v  }); return this }
  gt(f, v)      { this._f.push({ t: 'gt',   f, v  }); return this }
  gte(f, v)     { this._f.push({ t: 'gte',  f, v  }); return this }
  lt(f, v)      { this._f.push({ t: 'lt',   f, v  }); return this }
  lte(f, v)     { this._f.push({ t: 'lte',  f, v  }); return this }
  like(f, p)    { this._f.push({ t: 'like', f, p  }); return this }
  ilike(f, p)   { this._f.push({ t: 'ilike',f, p  }); return this }
  in(f, vs)     { this._f.push({ t: 'in',   f, vs }); return this }
  not(f, op, v) { this._f.push({ t: 'not',  f, op, v }); return this }
  or(expr)      { this._f.push({ t: 'or',   expr  }); return this }

  order(f, opts = {}) { this._ord = { f, asc: opts.ascending !== false }; return this }
  limit(n) { this._lim = n; return this }

  single()      { this._single = true; return this._run() }
  maybeSingle() { this._maybe  = true; return this._run() }
  then(res, rej) { return this._run().then(res, rej) }

  _match(row) {
    return this._f.every(fi => {
      const v = row[fi.f]
      switch (fi.t) {
        case 'eq':    return String(v) === String(fi.v) || v === fi.v
        case 'neq':   return v !== fi.v
        case 'gt':    return v > fi.v
        case 'gte':   return v >= fi.v
        case 'lt':    return v < fi.v
        case 'lte':   return v <= fi.v
        case 'like':  { const re = fi.p.replace(/%/g,'.*').replace(/_/g,'.'); return new RegExp(`^${re}$`).test(String(v ?? '')) }
        case 'ilike': { const re = fi.p.replace(/%/g,'.*').replace(/_/g,'.'); return new RegExp(`^${re}$`,'i').test(String(v ?? '')) }
        case 'in':    return fi.vs.includes(v)
        case 'not':   return fi.op === 'in' ? !fi.v?.includes(v) : true
        case 'or': {
          return fi.expr.split(',').some(part => {
            const bits = part.trim().split('.')
            const field = bits[0], op = bits[1], val = bits.slice(2).join('.')
            const rv = row[field]
            if (op === 'is'  && val === 'null') return rv == null
            if (op === 'gt')  return rv > val
            if (op === 'lt')  return rv < val
            if (op === 'gte') return rv >= val
            return true
          })
        }
        default: return true
      }
    })
  }

  _run() {
    return new Promise(resolve => {
      try {
        let rows = getTable(this._t)

        // INSERT
        if (this._ins && !this._ups) {
          const arr = Array.isArray(this._ins) ? this._ins : [this._ins]
          const ins = arr.map(r => ({ id: genId(), created_at: ts(), updated_at: ts(), ...r }))
          saveTable(this._t, [...rows, ...ins])
          if (this._single) return resolve({ data: ins[0],        error: null })
          if (this._maybe)  return resolve({ data: ins[0] ?? null, error: null })
          return resolve({ data: ins, error: null })
        }

        // UPSERT
        if (this._ins && this._ups) {
          const arr = Array.isArray(this._ins) ? this._ins : [this._ins]
          let all = [...rows]; const out = []
          arr.forEach(item => {
            const i = all.findIndex(r => r.id === item.id)
            if (i >= 0) { all[i] = { ...all[i], ...item, updated_at: ts() }; out.push(all[i]) }
            else        { const m = { id: genId(), created_at: ts(), ...item, updated_at: ts() }; all.push(m); out.push(m) }
          })
          saveTable(this._t, all)
          if (this._single) return resolve({ data: out[0] ?? null, error: null })
          return resolve({ data: out, error: null })
        }

        // UPDATE
        if (this._upd) {
          const ids = new Set(rows.filter(r => this._match(r)).map(r => r.id))
          const updated = []
          rows = rows.map(r => { if (ids.has(r.id)) { const n = { ...r, ...this._upd, updated_at: ts() }; updated.push(n); return n } return r })
          saveTable(this._t, rows)
          if (this._single) return resolve({ data: updated[0] ?? null, error: null })
          return resolve({ data: updated, error: null })
        }

        // DELETE
        if (this._del) {
          const matched = rows.filter(r => this._match(r))
          saveTable(this._t, rows.filter(r => !new Set(matched.map(x => x.id)).has(r.id)))
          return resolve({ data: matched, error: null })
        }

        // SELECT
        let result = rows.filter(r => this._match(r))
        if (this._ord) {
          const { f, asc } = this._ord
          result.sort((a, b) => (a[f] < b[f] ? -1 : a[f] > b[f] ? 1 : 0) * (asc ? 1 : -1))
        }
        if (this._lim != null) result = result.slice(0, this._lim)

        if (this._cnt) {
          if (this._head) return resolve({ data: null, count: result.length, error: null })
          return resolve({ data: result, count: result.length, error: null })
        }
        if (this._single) {
          if (!result[0]) return resolve({ data: null, error: { message: 'Row not found', code: 'PGRST116' } })
          return resolve({ data: result[0], error: null })
        }
        if (this._maybe) return resolve({ data: result[0] ?? null, error: null })
        return resolve({ data: result, error: null })
      } catch (err) {
        resolve({ data: null, error: { message: err.message } })
      }
    })
  }
}

// ── No-op realtime channel ────────────────────────────────────
class MockChannel {
  on()         { return this }
  subscribe(cb){ if (cb) setTimeout(() => cb('SUBSCRIBED'), 0); return this }
  async track(){}
  presenceState(){ return {} }
  unsubscribe() {}
}

// ── No-op storage ─────────────────────────────────────────────
const mockStorage = {
  from() {
    return {
      upload(path)         { return Promise.resolve({ data: { path }, error: null }) },
      createSignedUrl()    { return Promise.resolve({ data: { signedUrl: '#' }, error: null }) },
      getPublicUrl()       { return { data: { publicUrl: '#' } } },
      remove()             { return Promise.resolve({ data: {}, error: null }) },
      list()               { return Promise.resolve({ data: [], error: null }) },
    }
  }
}

// ── Exported mock client ──────────────────────────────────────
export const supabase = {
  from:          (table) => new QB(table),
  auth:          mockAuth,
  storage:       mockStorage,
  channel:       () => new MockChannel(),
  removeChannel: () => {},
  rpc(fn, args) {
    if (fn === 'increment_coupon_usage' && args?.coupon_id) {
      const coupons = getTable('coupons')
      const idx = coupons.findIndex(c => c.id === args.coupon_id)
      if (idx >= 0) { coupons[idx].used_count = (coupons[idx].used_count || 0) + 1; saveTable('coupons', coupons) }
    }
    return Promise.resolve({ data: null, error: null })
  }
}

// ── Helper exports used by this app ──────────────────────────
export function getCurrentUser() {
  const s = JSON.parse(localStorage.getItem('ea_session') || 'null')
  return Promise.resolve(s?.user ?? null)
}

export function onAuthChange(callback) {
  _listeners.push(callback)
  const s = JSON.parse(localStorage.getItem('ea_session') || 'null')
  if (s) setTimeout(() => callback('SIGNED_IN', s), 0)
  return () => {
    const i = _listeners.indexOf(callback)
    if (i >= 0) _listeners.splice(i, 1)
  }
}
