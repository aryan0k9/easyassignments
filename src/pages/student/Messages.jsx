// ============================================================
// STUDENT MESSAGES Dashboard Chat Panel
// Supports General Support (user) and Order Chats (order)
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import StudentLayout from './StudentLayout'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { uploadFile, getFileUrl } from '../../lib/uploads'

const SITE_ID = 1

function Messages() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Student'

  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [adminOnline, setAdminOnline] = useState(false)
  const [adminTyping, setAdminTyping] = useState(false)
  const [orderNumbers, setOrderNumbers] = useState({})
  const [managerName, setManagerName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [mobileView, setMobileView] = useState('list')

  const messagesEndRef = useRef(null)
  const channelRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const autoCreateRef = useRef(false)
  const fileInputRef = useRef(null)
  const audioCtxRef = useRef(null)
  const activeSessionRef = useRef(null)

  function getAudioCtx() {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext()
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }
    return audioCtxRef.current
  }

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  useEffect(() => { scrollToBottom() }, [messages])

  // ===== LOAD ASSIGNED MANAGER =====
  // Uses an RPC instead of querying the managers table directly so
  // students can't fetch internal_name (admin-only alias).
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.rpc('get_my_manager_name')
      if (cancelled) return
      if (error) { setManagerName(''); return }
      setManagerName(typeof data === 'string' ? data : '')
    })()
    return () => { cancelled = true }
  }, [user?.id])

  // ===== LOAD SESSIONS =====
  useEffect(() => {
    if (!user?.id) return
    loadSessions()

    // TEMPORARY CLEANUP FOR DUPLICATES
    async function cleanupDuplicates() {
      const { data: userSessions } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('chat_type', 'user')
        .order('created_at', { ascending: false });

      if (userSessions && userSessions.length > 1) {
        const keepSession = userSessions[0];
        const removeSessions = userSessions.slice(1);

        for (const old of removeSessions) {
          await supabase.from('chat_messages').update({ session_id: keepSession.id }).eq('session_id', old.id);
          await supabase.from('chat_sessions').delete().eq('id', old.id);
        }
        console.log('Cleaned up duplicate user sessions.');
      }
    }
    cleanupDuplicates()
  }, [user?.id])

  async function loadSessions() {
    setLoading(true)
    const { data: sessionList } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('chat_type', 'order')
      .or(`site_id.eq.${SITE_ID},site_id.is.null`)
      .order('updated_at', { ascending: false })

    if (sessionList) {
      // Deduplicate by order_id prefer session that has a last_message (the original with auto-welcome)
      const seen = new Map()
      for (const s of sessionList) {
        const key = s.order_id || s.id
        if (!seen.has(key)) {
          seen.set(key, s)
        } else if (!seen.get(key).last_message && s.last_message) {
          seen.set(key, s)
        }
      }
      const deduped = [...seen.values()].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))

      // Compute per-session unread admin count on the fly from chat_messages.read.
      // We can't trust chat_sessions.unread_count because it's shared with the
      // admin side when the admin opens a chat to read student messages, that
      // column is reset to 0, which would wrongly clear the student's badge.
      const sessionIds = deduped.map(s => s.id)
      const counts = {}
      if (sessionIds.length > 0) {
        const { data: unreadMsgs } = await supabase
          .from('chat_messages')
          .select('session_id')
          .eq('sender_type', 'admin')
          .eq('read', false)
          .in('session_id', sessionIds)
        for (const m of unreadMsgs || []) {
          counts[m.session_id] = (counts[m.session_id] || 0) + 1
        }
      }
      const withCounts = deduped.map(s => ({ ...s, studentUnreadCount: counts[s.id] || 0 }))
      setSessions(withCounts)

      const orderIds = deduped.filter(s => s.order_id).map(s => s.order_id)
      if (orderIds.length > 0) {
        const { data: orders } = await supabase.from('orders').select('id, order_number, subject').in('id', orderIds)
        if (orders) {
          const map = {}
          orders.forEach(o => { map[o.id] = { number: o.order_number, subject: o.subject } })
          setOrderNumbers(map)
        }
      }
    }
    setLoading(false)
  }

  // ===== AUTO-SELECT / CREATE FROM URL =====
  useEffect(() => {
    async function checkTarget() {
      const targetOrderId = searchParams.get('orderId')
      if (loading || autoCreateRef.current) return

      if (targetOrderId) {
        // Pick the session with messages (last_message set) if multiple exist for same order
        const matchingSessions = sessions.filter(s => s.order_id === targetOrderId)
        let targetSession = matchingSessions.find(s => s.last_message) || matchingSessions[0]
        if (!targetSession) {
          autoCreateRef.current = true
          const { data: order } = await supabase.from('orders').select('*').eq('id', targetOrderId).single()
          if (order) {
            const newSession = {
              site_id: SITE_ID,
              chat_type: 'order',
              user_id: user.id,
              order_id: targetOrderId,
              visitor_name: userName,
              visitor_email: user.email,
              status: 'active',
              unread_count: 0
            }
            const { data: inserted } = await supabase.from('chat_sessions').insert(newSession).select().single()
            if (inserted) {
              targetSession = inserted
              setSessions(prev => [inserted, ...prev])
              setOrderNumbers(prev => ({ ...prev, [targetOrderId]: { number: order.order_number, subject: order.subject } }))
            }
          }
          autoCreateRef.current = false
        }
        if (targetSession && (!activeSession || activeSession.id !== targetSession.id)) {
          loadChat(targetSession)
          setMobileView('chat')
          setSearchParams(prev => { const p = new URLSearchParams(prev); p.delete('orderId'); return p }, { replace: true })
        }
      } else if (!activeSession && sessions.length > 0) {
        loadChat(sessions[0])
      }
    }
    checkTarget()
  }, [loading, searchParams, activeSession, sessions])

  // ===== SELECT SESSION =====
  async function loadChat(session) {
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    setActiveSession(session)
    setNewMessage('')
    setAdminTyping(false)
    setAdminOnline(false)

    const { data } = await supabase.from('chat_messages').select('*')
      .eq('session_id', session.id).order('created_at', { ascending: true })
    setMessages(data || [])

    // Mark admin messages as read
    await supabase.from('chat_messages').update({ read: true })
      .eq('session_id', session.id).eq('sender_type', 'admin').eq('read', false)

    // Clear unread in session
    if (session.unread_count > 0) {
      await supabase.from('chat_sessions').update({ unread_count: 0 }).eq('id', session.id)
    }
    // Clear the per-chat badge locally; the actual marker is chat_messages.read,
    // which we've already updated above for this session.
    setSessions(prev => prev.map(s =>
      s.id === session.id ? { ...s, unread_count: 0, studentUnreadCount: 0 } : s
    ))

    activeSessionRef.current = session

    // Sub typing + presence only (messages handled in global channel)
    const channelPrefix = session.chat_type === 'order' ? 'orderchat' : 'userchat'
    const channel = supabase.channel(`${channelPrefix}-${session.id}`, { config: { presence: { key: 'student' } } })

    channel.on('broadcast', { event: 'typing' }, (payload) => {
      if (payload.payload?.sender === 'admin') {
        setAdminTyping(true)
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => setAdminTyping(false), 2000)
      }
    })

    // Admin is "online" from the student's perspective whenever an admin
    // is present in THIS specific chat's channel. Reflect both true and
    // false transitions on every sync so the indicator updates when the
    // admin opens/closes the chat.
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const hasAdmin = Object.values(state).flat().some(p => p.role === 'admin')
      setAdminOnline(hasAdmin)
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await channel.track({ role: 'student', name: userName })
    })

    channelRef.current = channel
  }

  // ===== CLEANUP CHANNEL ON UNMOUNT =====
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [])

  // ===== GLOBAL REALTIME FOR ALL SESSIONS =====
  useEffect(() => {
    if (!user?.id) return
    const ch = supabase.channel('student-msgs-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions', filter: `user_id=eq.${user.id}` }, () => {
        loadSessions()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        if (payload.new.sender_type !== 'admin') return
        const current = activeSessionRef.current
        // If this message belongs to the active chat, append + mark read
        if (current && String(payload.new.session_id) === String(current.id)) {
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
          supabase.from('chat_messages').update({ read: true }).eq('id', payload.new.id).then(() => { })
          playSound()
        } else {
          // Otherwise, just refresh sessions so the per-chat badge appears
          loadSessions()
          playSound()
        }
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user?.id])

  // ===== POLLING FALLBACK (catches messages if realtime is not enabled) =====
  useEffect(() => {
    if (!activeSession?.id) return
    const sessionId = activeSession.id
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
      if (!data) return
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => String(m.id)))
        const newMsgs = data.filter(m => !existingIds.has(String(m.id)))
        if (newMsgs.length === 0) return prev
        const hasNewAdmin = newMsgs.some(m => m.sender_type === 'admin')
        if (hasNewAdmin) {
          playSound()
          newMsgs.filter(m => m.sender_type === 'admin').forEach(m => {
            supabase.from('chat_messages').update({ read: true }).eq('id', m.id).then(() => { })
          })
        }
        return [...prev, ...newMsgs]
      })
    }, 3000)
    return () => clearInterval(poll)
  }, [activeSession?.id])

  const sendTypingEvent = useCallback(() => {
    channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { sender: 'visitor' } })
  }, [activeSession])

  // ===== SEND MESSAGE =====
  async function handleSend(e) {
    e.preventDefault()
    if ((!newMessage.trim() && selectedFiles.length === 0) || sending || uploading || !activeSession) return

    setSending(true)
    let msgText = newMessage.trim()
    setNewMessage('')

    let finalMsgText = msgText
    let lastMsgPreview = msgText

    // If files are selected, upload them first
    if (selectedFiles.length > 0) {
      setUploading(true)
      let fileTags = []
      let lastFileName = ''

      for (const file of selectedFiles) {
        try {
          const uploaded = await uploadFile(file, activeSession.order_id)
          if (activeSession.order_id) {
            await supabase.from('order_files').insert({
              order_id: activeSession.order_id,
              user_id: user.id,
              site_id: SITE_ID,
              file_name: uploaded.name,
              file_path: uploaded.path,
              file_size: uploaded.size,
              file_type: uploaded.type,
              category: 'reference',
              uploaded_by: 'student',
              notes: msgText || null
            })
          }
          fileTags.push(`[FILE:::${uploaded.path}:::${uploaded.name}]`)
          lastFileName = uploaded.name
        } catch (err) {
          alert(`Upload failed for ${file.name}: ` + err.message)
        }
      }

      if (fileTags.length > 0) {
        const fileTagStr = fileTags.join('\n')
        finalMsgText = msgText ? `${fileTagStr}\n\n${msgText}` : fileTagStr
        lastMsgPreview = selectedFiles.length > 1
          ? `📎 ${selectedFiles.length} files${msgText ? ' + text' : ''}`
          : `📎 ${lastFileName}${msgText ? ' + text' : ''}`
      }

      setSelectedFiles([])
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }

    if (!finalMsgText) {
      setSending(false)
      return
    }

    const tempId = `temp-${Date.now()}`
    setMessages(prev => [...prev, {
      id: tempId, session_id: activeSession.id,
      sender_type: 'visitor', sender_name: userName,
      message: finalMsgText, created_at: new Date().toISOString()
    }])

    try {
      const { data: inserted } = await supabase.from('chat_messages').insert({
        session_id: activeSession.id, sender_type: 'visitor',
        sender_name: userName, message: finalMsgText
      }).select().single()
      // Replace temp message with real DB row so polling doesn't add it again
      if (inserted) {
        setMessages(prev => prev.map(m => m.id === tempId ? inserted : m))
      }
      await supabase.from('chat_sessions').update({
        last_message: lastMsgPreview,
        unread_count: (sessions.find(s => s.id === activeSession.id)?.unread_count || 0) + 1,
        updated_at: new Date().toISOString()
      }).eq('id', activeSession.id)
      playSound('send')
    } catch (err) { console.error('Send error:', err) }
    finally { setSending(false) }
  }

  // ===== FILE SELECTION =====
  function handleFileSelect(e) {
    if (e.target.files?.length > 0) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files)])
    }
  }

  function removeFile(index) {
    setSelectedFiles(prev => {
      const newFiles = prev.filter((_, i) => i !== index)
      if (newFiles.length === 0 && fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return newFiles
    })
  }

  function playSound(type = 'receive') {
    try {
      const ctx = getAudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      if (type === 'send') {
        osc.frequency.setValueAtTime(600, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.12)
        gain.gain.setValueAtTime(0.08, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.15)
      } else {
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1)
        gain.gain.setValueAtTime(0.1, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.35)
      }
    } catch { }
  }

  function formatTime(d) {
    if (!d) return ''
    const diff = Date.now() - new Date(d)
    if (diff < 86400000) return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function renderMessageText(text) {
    const fileRegex = /\[FILE:::(.*?):::(.*?)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = fileRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
      }
      parts.push(
        <FileAttachment key={`file-${match.index}`} filePath={match[1]} fileName={match[2]} />
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
    }

    return parts.length > 0 ? parts : text;
  }

  // Check if student already submitted a DETAIL_RESPONSE in this chat
  const alreadySubmittedDetails = messages.some(m => m.sender_type === 'visitor' && m.message.startsWith('[DETAIL_RESPONSE:::'))

  async function handleDetailSubmit(website, email, password) {
    if (!activeSession) return
    const msg = `[DETAIL_RESPONSE:::website=${website}|email=${email}|password=${password}]`
    const tempId = `temp-${Date.now()}`
    setMessages(prev => [...prev, { id: tempId, session_id: activeSession.id, sender_type: 'visitor', sender_name: userName, message: msg, created_at: new Date().toISOString() }])
    const { data: inserted } = await supabase.from('chat_messages').insert({
      session_id: activeSession.id, sender_type: 'visitor',
      sender_name: userName, message: msg
    }).select().single()
    if (inserted) setMessages(prev => prev.map(m => m.id === tempId ? inserted : m))
    await supabase.from('chat_sessions').update({
      last_message: '📋 Details submitted', updated_at: new Date().toISOString()
    }).eq('id', activeSession.id)
  }

  return (
    <StudentLayout title="Messages">
      <div className="sp-card msg-layout">

        {/* LEFT PANEL - Sidebar */}
        <div className={`msg-sessions${mobileView === 'chat' ? ' msg-hidden' : ''}`}>
          <div className="msg-sessions-header">
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>💬</span> Your Chats
            </h3>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--sp-muted)' }}>Loading...</div>
            ) : sessions.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--sp-muted)' }}>No chats found</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {sessions.map(s => {
                  const isActive = activeSession?.id === s.id
                  const orderInfo = orderNumbers[s.order_id]

                  return (
                    <button
                      key={s.id}
                      onClick={() => { loadChat(s); setMobileView('chat') }}
                      className="msg-session-btn"
                      style={{
                        border: 'none', borderBottom: '1px solid var(--sp-surface)',
                        background: isActive ? '#f8fafc' : 'white', cursor: 'pointer', textAlign: 'left',
                        position: 'relative', display: 'flex', gap: '12px', transition: 'all 0.2s',
                        width: '100%'
                      }}
                    >
                      {isActive && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'var(--sp-primary)', borderRadius: '0 2px 2px 0' }}></div>}

                      <div style={{
                        width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                        background: '#f0fdf4', color: '#16A34A', display: 'grid', placeItems: 'center',
                        fontWeight: 700, fontSize: '14px', border: '1px solid #dcfce7'
                      }}>
                        📦
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--sp-charcoal)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
                            {orderInfo?.number || `Order #${String(s.order_id).slice(0, 8)}`}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--sp-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>{formatTime(s.updated_at)}</span>
                        </div>

                        {orderInfo?.subject && (
                          <div style={{ fontSize: '12px', color: 'var(--sp-primary)', fontWeight: 600, marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {orderInfo.subject}
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--sp-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
                            {s.last_message || 'No messages'}
                          </div>
                          {s.studentUnreadCount > 0 && (
                            <span style={{
                              flexShrink: 0,
                              minWidth: '20px', height: '20px', padding: '0 6px',
                              borderRadius: '10px',
                              background: '#16a34a', color: 'white',
                              fontSize: '11px', fontWeight: 700,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              {s.studentUnreadCount > 99 ? '99+' : s.studentUnreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL - Chat Window */}
        <div className={`msg-chat${mobileView === 'list' ? ' msg-hidden' : ''}`}>
          {!activeSession ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--sp-muted)' }}>
              <span style={{ fontSize: '48px', marginBottom: '16px' }}>💬</span>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--sp-charcoal)' }}>Select a conversation</h3>
              <p style={{ fontSize: '14px' }}>Choose a chat from the left panel</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="msg-chat-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                  <button
                    className="msg-back-btn"
                    onClick={() => setMobileView('list')}
                    style={{ background: 'none', border: 'none', padding: '4px 6px', color: 'var(--sp-charcoal)', fontSize: '20px', lineHeight: 1, flexShrink: 0 }}
                    aria-label="Back to chats"
                  >←</button>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                    color: '#22c55e', display: 'grid', placeItems: 'center',
                    fontWeight: 800, fontSize: '13px'
                  }}>EA</div>
                  <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{
                        fontWeight: 700, fontSize: '13px', color: 'var(--sp-charcoal)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        flex: 1, minWidth: 0, display: 'block'
                      }}>
                        {orderNumbers[activeSession.order_id]?.number || 'Order Chat'}
                      </span>
                      <span style={{
                        width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                        background: adminOnline ? '#22c55e' : '#9ca3af', display: 'block'
                      }}></span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--sp-muted)', marginTop: '1px' }}>
                      {adminTyping ? (
                        <span style={{ color: '#22c55e' }}>Typing...</span>
                      ) : managerName ? (
                        <span>Manager: <strong style={{ color: 'var(--sp-charcoal)' }}>{managerName}</strong>{adminOnline ? ' · Online' : ''}</span>
                      ) : adminOnline ? 'Online' : "We'll reply soon"}
                    </div>
                  </div>
                </div>

                <Link to={`/dashboard/orders/${activeSession.order_id}`} className="msg-order-link">
                  View Order
                </Link>
              </div>

              {/* Messages */}
              <div className="msg-messages-area">
                <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--sp-muted)', padding: '8px 0' }}>
                  💬 Chat about this order with our support team.
                </div>

                {messages.map(msg => {
                  // ── [DETAIL_REQUEST] show interactive form or submitted state ──
                  if (msg.message.trim() === '[DETAIL_REQUEST]' && msg.sender_type === 'admin') {
                    return (
                      <div key={msg.id} style={{ display:'flex', gap:10, maxWidth:'85%', alignSelf:'flex-start' }}>
                        <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#0f172a,#1e293b)', color:'#22c55e', display:'grid', placeItems:'center', fontSize:10, fontWeight:800, flexShrink:0 }}>EA</div>
                        <div style={{ flex:1 }}>
                          {alreadySubmittedDetails
                            ? (
                              <div style={{ padding:'14px 16px', borderRadius:14, borderBottomLeftRadius:4, background:'white', border:'1px solid #e5e7eb' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:8, color:'#16A34A', fontWeight:700, fontSize:13 }}>
                                  <span style={{ fontSize:18 }}>✅</span> Details submitted thank you!
                                </div>
                              </div>
                            )
                            : <DetailRequestForm onSubmit={handleDetailSubmit} />
                          }
                          <div style={{ fontSize:11, color:'#9ca3af', padding:'2px 4px', marginTop:2 }}>
                            Support · {new Date(msg.created_at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // ── [DETAIL_RESPONSE] show as sent confirmation (student side) ──
                  if (msg.message.startsWith('[DETAIL_RESPONSE:::') && msg.sender_type === 'visitor') {
                    return (
                      <div key={msg.id} style={{ display:'flex', justifyContent:'flex-end' }}>
                        <div style={{ maxWidth:'80%' }}>
                          <div style={{ padding:'12px 16px', borderRadius:18, borderBottomRightRadius:4, background:'linear-gradient(135deg,#16A34A,#15803d)', color:'white' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, fontWeight:700, fontSize:13 }}>
                              <span>📋</span> Account details sent to support
                            </div>
                            <div style={{ fontSize:12, opacity:0.85, marginTop:4 }}>Our team will use these to complete your assignment.</div>
                          </div>
                          <div style={{ fontSize:11, color:'#9ca3af', padding:'2px 4px', textAlign:'right' }}>
                            You · {new Date(msg.created_at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // ── Intercept rework messages show clean alert, hide raw JSON ──
                  const isRework = msg.message.startsWith('[REWORK_REQ') || msg.message.startsWith('[REWORK_DONE]')
                  if (isRework && msg.sender_type === 'visitor') {
                    return (
                      <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ maxWidth: '80%' }}>
                          <div style={{
                            padding: '12px 18px', borderRadius: '18px', borderBottomRightRadius: '6px',
                            background: '#fef2f2', border: '2px solid #fca5a5',
                            color: '#b91c1c', fontWeight: 700, fontSize: '14px', textAlign: 'center'
                          }}>
                            🚨 REWORK REQUEST SUBMITTED 🚨
                          </div>
                          <div style={{ fontSize: '11px', color: '#9ca3af', padding: '2px 4px', textAlign: 'right' }}>
                            You · {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={msg.id} style={{
                      display: 'flex', gap: '10px', maxWidth: '80%',
                      flexDirection: msg.sender_type === 'visitor' ? 'row-reverse' : 'row',
                      alignSelf: msg.sender_type === 'visitor' ? 'flex-end' : 'flex-start'
                    }}>
                      {msg.sender_type === 'admin' && (
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                          color: '#22c55e', display: 'grid', placeItems: 'center',
                          fontSize: '10px', fontWeight: 800, flexShrink: 0
                        }}>EA</div>
                      )}
                      <div>
                        <div style={{
                          padding: '12px 16px', borderRadius: '18px', fontSize: '14px', lineHeight: 1.5,
                          wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                          ...(msg.sender_type === 'visitor'
                            ? { background: 'linear-gradient(135deg, #16A34A, #15803d)', color: 'white', borderBottomRightRadius: '6px' }
                            : { background: 'white', color: '#111827', border: '1px solid #e5e7eb', borderBottomLeftRadius: '6px' })
                        }}>
                          {renderMessageText(msg.message)}

                          {/* Payment CTA button */}
                          {msg.sender_type === 'admin' && msg.message.includes('PAYMENT REQUEST') && (
                            <div style={{ marginTop: '14px' }}>
                              <Link
                                to={`/dashboard/payments?orderId=${activeSession.order_id}`}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                  padding: '11px 20px',
                                  background: 'linear-gradient(135deg, #16A34A, #15803d)',
                                  color: 'white', borderRadius: '10px', textDecoration: 'none',
                                  fontWeight: 700, fontSize: '14px',
                                  boxShadow: '0 4px 12px rgba(22,163,74,0.35)'
                                }}
                              >
                                💳 Pay Now →
                              </Link>
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#9ca3af', padding: '2px 4px', textAlign: msg.sender_type === 'visitor' ? 'right' : 'left' }}>
                          {msg.sender_type === 'admin' ? 'Support' : 'You'} · {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  )
                })}


                {adminTyping && (
                  <div style={{ display: 'flex', gap: '10px', alignSelf: 'flex-start' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                      color: '#22c55e', display: 'grid', placeItems: 'center',
                      fontSize: '10px', fontWeight: 800
                    }}>EA</div>
                    <div style={{
                      padding: '14px 20px', background: 'white', border: '1px solid #e5e7eb',
                      borderRadius: '18px', borderBottomLeftRadius: '6px', display: 'flex', gap: '5px'
                    }}>
                      <span className="lc-typing-indicator"><span></span><span></span><span></span></span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Manager label above reply bar */}
              {managerName && (
                <div style={{
                  padding: '6px 16px', background: '#f0fdf4', borderTop: '1px solid #dcfce7',
                  fontSize: '12px', color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  <span style={{
                    display: 'inline-grid', placeItems: 'center',
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: '#16a34a', color: 'white', fontSize: '10px', fontWeight: 700
                  }}>👤</span>
                  <span>Your Manager: <strong>{managerName}</strong></span>
                </div>
              )}

              {/* Reply */}
              <form onSubmit={handleSend} className="msg-input-form">
                {selectedFiles.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        background: '#f1f5f9', padding: '6px 12px', borderRadius: '16px',
                        fontSize: '13px', fontWeight: 600, color: '#334155'
                      }}>
                        <span>📎 {file.name}</span>
                        <button type="button" onClick={() => removeFile(idx)} disabled={uploading} style={{
                          background: 'none', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer',
                          color: '#94a3b8', display: 'flex', alignItems: 'center', padding: '0 4px'
                        }} title="Remove file">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={{
                      width: '40px', height: '40px', border: 'none', background: 'transparent',
                      color: 'var(--sp-muted)', cursor: uploading ? 'not-allowed' : 'pointer',
                      display: 'grid', placeItems: 'center', opacity: uploading ? 0.5 : 1, flexShrink: 0
                    }}
                    title="Attach files"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                  <input
                    type="text" placeholder={uploading ? `Uploading ${selectedFiles.length} file(s)...` : "Type a message..."}
                    value={newMessage}
                    onChange={(e) => { setNewMessage(e.target.value); sendTypingEvent() }}
                    disabled={uploading}
                    style={{
                      flex: 1, padding: '12px 18px', border: '2px solid #e5e7eb',
                      borderRadius: '24px', fontSize: '14px', fontFamily: 'inherit',
                      outline: 'none', background: '#f9fafb', color: '#111827'
                    }}
                    autoFocus
                  />
                  <button type="submit" disabled={(!newMessage.trim() && selectedFiles.length === 0) || sending || uploading} style={{
                    width: '44px', height: '44px', border: 'none',
                    background: 'linear-gradient(135deg, #16A34A, #15803d)',
                    color: 'white', borderRadius: '50%', display: 'grid', placeItems: 'center',
                    cursor: (newMessage.trim() || selectedFiles.length > 0) && !sending && !uploading ? 'pointer' : 'not-allowed',
                    opacity: (newMessage.trim() || selectedFiles.length > 0) && !sending && !uploading ? 1 : 0.4, flexShrink: 0
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </StudentLayout>
  )
}

function DetailRequestForm({ onSubmit }) {
  const [website, setWebsite]   = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!website.trim() || !email.trim() || !password.trim()) return
    setSubmitting(true)
    await onSubmit(website.trim(), email.trim(), password.trim())
    setSubmitted(true)
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <div style={{ padding:'14px 16px', borderRadius:14, borderBottomLeftRadius:4, background:'white', border:'1px solid #e5e7eb' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, color:'#16A34A', fontWeight:700, fontSize:13 }}>
          <span style={{ fontSize:18 }}>✅</span> Details submitted thank you!
        </div>
      </div>
    )
  }

  const inputStyle = {
    width:'100%', padding:'10px 12px', border:'1.5px solid #e2e8f0',
    borderRadius:10, fontSize:13, fontFamily:'inherit', outline:'none',
    background:'#f8fafc', color:'#0f172a', boxSizing:'border-box',
    transition:'border-color .15s'
  }

  return (
    <div style={{ padding:'16px 18px', borderRadius:14, borderBottomLeftRadius:4, background:'white', border:'1px solid #e5e7eb', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, paddingBottom:12, borderBottom:'1px solid #f1f5f9' }}>
        <div style={{ width:34, height:34, borderRadius:9, background:'linear-gradient(135deg,#4c1d95,#6d28d9)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>📋</div>
        <div>
          <div style={{ fontWeight:700, fontSize:13.5, color:'#0f172a' }}>Account Details Request</div>
          <div style={{ fontSize:11.5, color:'#64748b', marginTop:1 }}>Please fill in your portal credentials below</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {/* Website */}
        <div>
          <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>
            🌐 Portal Link
          </label>
          <input
            type="url" value={website} onChange={e => setWebsite(e.target.value)}
            placeholder="https://yourportal.edu" required style={inputStyle}
            onFocus={e => e.target.style.borderColor='#7c3aed'}
            onBlur={e => e.target.style.borderColor='#e2e8f0'}
          />
        </div>

        {/* Email */}
        <div>
          <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>
            📧 Email Address / User Name
          </label>
          <input
            type="text" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@university.edu or username" required style={inputStyle}
            onFocus={e => e.target.style.borderColor='#7c3aed'}
            onBlur={e => e.target.style.borderColor='#e2e8f0'}
          />
        </div>

        {/* Password */}
        <div>
          <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>
            🔒 Password
          </label>
          <div style={{ position:'relative' }}>
            <input
              type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Your portal password" required style={{ ...inputStyle, paddingRight:42 }}
              onFocus={e => e.target.style.borderColor='#7c3aed'}
              onBlur={e => e.target.style.borderColor='#e2e8f0'}
            />
            <button type="button" onClick={() => setShowPw(!showPw)} style={{
              position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
              background:'none', border:'none', cursor:'pointer', fontSize:16, lineHeight:1, color:'#94a3b8'
            }}>{showPw ? '🙈' : '👁️'}</button>
          </div>
        </div>

        {/* Notice */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'9px 11px', background:'#fefce8', borderRadius:8, border:'1px solid #fde68a', marginTop:2 }}>
          <span style={{ fontSize:14, flexShrink:0 }}>🔐</span>
          <p style={{ fontSize:11.5, color:'#92400e', margin:0, lineHeight:1.5 }}>
            Your credentials are sent securely only to our support team and used exclusively to complete your assignment.
          </p>
        </div>

        {/* Submit */}
        <button type="submit" disabled={submitting || !website.trim() || !email.trim() || !password.trim()} style={{
          marginTop:4, padding:'12px', borderRadius:10, border:'none',
          background: (submitting || !website.trim() || !email.trim() || !password.trim())
            ? '#c4b5fd' : 'linear-gradient(135deg,#7c3aed,#6d28d9)',
          color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer',
          boxShadow:'0 4px 12px rgba(109,40,217,0.3)', transition:'all .15s'
        }}>
          {submitting ? 'Sending…' : '📤 Submit Details'}
        </button>
      </form>
    </div>
  )
}

function FileAttachment({ filePath, fileName }) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    const { url, success } = await getFileUrl(filePath)
    setLoading(false)
    if (success && url) {
      window.open(url, '_blank')
    } else {
      alert('File has expired or is unavailable.')
    }
  }

  return (
    <div
      onClick={handleDownload}
      style={{
        marginTop: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.15)',
        border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
        display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
        fontSize: '13px', fontWeight: 600
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
      </svg>
      {loading ? 'Opening...' : fileName}
    </div>
  )
}

export default Messages
