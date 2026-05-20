// ============================================================
// LIVE CHAT WIDGET v2
// Features: Feedback emoji, typing indicator, online status,
// chat persistence by email
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { uploadFile, getFileUrl } from '../lib/uploads'
import '../styles/livechat.css'

const SITE_ID = 1

function LiveChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState('form') // 'form' | 'chat' | 'feedback'
  const [loading, setLoading] = useState(false)

  const { user, getUserName, isAuthenticated } = useAuth()

  // Which chat to show? (null = general user chat, string = order chat)
  const [currentOrderId, setCurrentOrderId] = useState(null)
  const [currentOrderNumber, setCurrentOrderNumber] = useState(null)

  // Pre-chat form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [firstMessage, setFirstMessage] = useState('')

  // Chat state
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])

  // Typing & presence
  const [adminOnline, setAdminOnline] = useState(false)
  const [adminTyping, setAdminTyping] = useState(false)
  const typingTimeoutRef = useRef(null)
  const channelRef = useRef(null)
  const fileInputRef = useRef(null)

  // Feedback
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSending, setFeedbackSending] = useState(false)

  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => { scrollToBottom() }, [messages])

  // ===== GLOBAL EVENT LISTENER TO OPEN CHAT =====
  useEffect(() => {
    const openChat = (e) => {
      setIsOpen(true)
      const targetOrderId = e.detail?.orderId || null
      const targetOrderNumber = e.detail?.orderNumber || null

      // If we are switching contexts, update state to trigger re-fetch
      setCurrentOrderId(targetOrderId)
      setCurrentOrderNumber(targetOrderNumber)
    }
    window.addEventListener('open-live-chat', openChat)
    return () => window.removeEventListener('open-live-chat', openChat)
  }, [])

  // ===== RESTORE SESSION OR USE AUTH USER =====
  useEffect(() => {
    if (isAuthenticated && user) {
      // User is logged in, use their details and skip form
      setName(getUserName())
      setEmail(user.email)

      const checkUserSession = async () => {
        let query = supabase
          .from('chat_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('site_id', SITE_ID)
          .order('created_at', { ascending: false })

        // Filter by context
        if (currentOrderId) {
          query = query.eq('chat_type', 'order').eq('order_id', currentOrderId)
        } else {
          query = query.eq('chat_type', 'user')
        }

        const { data } = await query

        if (data && data.length > 0) {
          // Cleanup duplicates if they exist
          if (data.length > 1) {
            const keepSession = data[0];
            const removeSessions = data.slice(1);
            for (const old of removeSessions) {
              await supabase.from('chat_messages').update({ session_id: keepSession.id }).eq('session_id', old.id);
              await supabase.from('chat_sessions').delete().eq('id', old.id);
            }
          }

          setSessionId(data[0].id)
          setStep('chat')
          loadMessages(data[0].id)
        } else {
          setSessionId(null)
          setMessages([])
          setStep('chat') // Skip form, we will create session on first send
        }
      }
      checkUserSession()
    } else {
      // Guest: Check local storage
      const saved = localStorage.getItem('livechat_session')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setSessionId(parsed.sessionId)
          setName(parsed.name)
          setEmail(parsed.email)
          setStep('chat')
          loadMessages(parsed.sessionId)
        } catch {
          localStorage.removeItem('livechat_session')
        }
      } else {
        // No guest session found (e.g. user just logged out)
        // Clear the chat state and close the widget
        setSessionId(null)
        setMessages([])
        setName('')
        setEmail('')
        setStep('form')
        setIsOpen(false)
        setCurrentOrderId(null)
        setCurrentOrderNumber(null)
      }
    }
  }, [isAuthenticated, user, currentOrderId])

  // ===== REALTIME: Messages, Typing, Presence =====
  useEffect(() => {
    if (!sessionId) return

    // Clean up old channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase.channel(`livechat-${sessionId}`, {
      config: { presence: { key: 'visitor' } }
    })

    // Listen for new messages
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `session_id=eq.${sessionId}` },
      (payload) => {
        if (payload.new.sender_type === 'admin') {
          setMessages(prev => [...prev, payload.new])
          playReceiveSound()
        }
      }
    )

    // Listen for chat session closed by admin
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'chat_sessions', filter: `id=eq.${sessionId}` },
      (payload) => {
        if (payload.new.status === 'closed') {
          // If admin closed the chat, transition user to feedback screen
          setStep('feedback')
          setFeedbackRating(0)
          setFeedbackText('')
        }
      }
    )

    // Listen for typing broadcasts
    channel.on('broadcast', { event: 'typing' }, (payload) => {
      if (payload.payload?.sender === 'admin') {
        setAdminTyping(true)
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => setAdminTyping(false), 2000)
      }
    })

    // Listen for presence on specific chat (admin online/offline in this session)
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const hasAdmin = Object.values(state).flat().some(p => p.role === 'admin')
      if (hasAdmin) setAdminOnline(true)
    })

    // Also listen to global admin presence
    const globalChannel = supabase.channel('student-global-notif-guest')
    globalChannel.on('presence', { event: 'sync' }, () => {
      const state = globalChannel.presenceState()
      const hasGlobalAdmin = Object.values(state).flat().some(p => p.role === 'admin')
      setAdminOnline(hasGlobalAdmin)
    })
    globalChannel.subscribe()

    // Track visitor presence
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ role: 'visitor', name })
      }
    })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(globalChannel)
      channelRef.current = null
    }
  }, [sessionId])

  // ===== SEND TYPING EVENT =====
  const sendTypingEvent = useCallback(() => {
    if (channelRef.current && sessionId) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { sender: 'visitor' }
      })
    }
  }, [sessionId])

  // ===== LOAD MESSAGES =====
  async function loadMessages(sid) {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sid)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  // ===== CHECK EXISTING SESSION BY EMAIL =====
  async function findExistingSession(visitorEmail) {
    const { data } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('visitor_email', visitorEmail.trim().toLowerCase())
      .eq('site_id', SITE_ID)
      .order('created_at', { ascending: false })
      .limit(1)

    return data?.[0] || null
  }

  // ===== START CHAT =====
  async function handleStartChat(e) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !firstMessage.trim()) return
    setLoading(true)

    try {
      const trimmedEmail = email.trim().toLowerCase()

      // Check for existing session
      let existing = null;
      if (user) {
        // If logged in, maybe try to find active user session, though handleStartChat shouldn't be called if logged in
      } else {
        existing = await findExistingSession(trimmedEmail)
      }

      let session
      if (existing) {
        // Reopen if closed, or resume if active
        if (existing.status === 'closed') {
          await supabase
            .from('chat_sessions')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        }
        session = existing
      } else {
        // Create new session
        const { data, error } = await supabase
          .from('chat_sessions')
          .insert({
            site_id: SITE_ID,
            chat_type: user?.id ? 'user' : 'guest',
            visitor_name: name.trim(),
            visitor_email: trimmedEmail,
            user_id: user?.id || null,
            status: 'active',
            last_message: firstMessage.trim(),
            unread_count: 1
          })
          .select()
          .single()
        if (error) throw error
        session = data
      }

      // Send the message
      await supabase.from('chat_messages').insert({
        session_id: session.id,
        sender_type: 'visitor',
        sender_name: name.trim(),
        message: firstMessage.trim()
      })

      // Update session
      await supabase
        .from('chat_sessions')
        .update({
          last_message: firstMessage.trim(),
          unread_count: (existing?.unread_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id)

      // Save to localStorage
      localStorage.setItem('livechat_session', JSON.stringify({
        sessionId: session.id,
        name: name.trim(),
        email: trimmedEmail
      }))

      setSessionId(session.id)
      setFirstMessage('')
      setStep('chat')

      // Load all messages (including old history for returning users)
      await loadMessages(session.id)

    } catch (err) {
      console.error('Chat start error:', err)
      alert(`Failed to start chat: ${err.message || err.toString()}`)
    } finally {
      setLoading(false)
    }
  }

  // ===== SEND MESSAGE =====
  async function handleSendMessage(e) {
    e.preventDefault()
    if ((!newMessage.trim() && selectedFiles.length === 0) || sending || uploading) return

    setSending(true)
    let msgText = newMessage.trim()
    setNewMessage('')

    let currentSessionId = sessionId

    let finalMsgText = msgText
    let lastMsgPreview = msgText

    // If logged in user sends first message and no session exists yet
    if (!currentSessionId) {
      try {
        const { data, error } = await supabase
          .from('chat_sessions')
          .insert({
            site_id: SITE_ID,
            chat_type: currentOrderId ? 'order' : (user?.id ? 'user' : 'guest'),
            order_id: currentOrderId || null,
            visitor_name: isAuthenticated ? getUserName() : name,
            visitor_email: isAuthenticated ? user.email : email,
            user_id: user?.id || null,
            status: 'active',
            last_message: lastMsgPreview || 'New message',
            unread_count: 1
          })
          .select()
          .single()

        if (error) throw error
        currentSessionId = data.id
        setSessionId(data.id)
      } catch (err) {
        console.error('Failed to create session:', err)
        setSending(false)
        return
      }
    }

    if (selectedFiles.length > 0) {
      setUploading(true)
      let fileTags = []
      let lastFileName = ''

      for (const file of selectedFiles) {
        try {
          const uploaded = await uploadFile(file, currentOrderId)
          if (currentOrderId) {
            await supabase.from('order_files').insert({
              order_id: currentOrderId,
              user_id: user?.id || null,
              site_id: SITE_ID,
              file_name: uploaded.name,
              file_path: uploaded.path,
              file_size: uploaded.size,
              file_type: uploaded.type,
              category: 'reference',
              uploaded_by: 'student'
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

    const tempMsg = {
      id: `temp-${Date.now()}`,
      session_id: currentSessionId,
      sender_type: 'visitor',
      sender_name: isAuthenticated ? getUserName() : name,
      message: finalMsgText,
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempMsg])

    try {
      await supabase.from('chat_messages').insert({
        session_id: currentSessionId,
        sender_type: 'visitor',
        sender_name: isAuthenticated ? getUserName() : name,
        message: finalMsgText
      })
      await supabase.from('chat_sessions').update({
        status: 'active', // Ensure it reopens if it was closed
        last_message: lastMsgPreview,
        unread_count: messages.filter(m => m.sender_type === 'visitor' && !m.read).length + 1,
        updated_at: new Date().toISOString()
      }).eq('id', currentSessionId)
    } catch (err) {
      console.error('Send error:', err)
    } finally {
      setSending(false)
    }
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

  // ===== END CHAT → SHOW FEEDBACK =====
  function handleEndChat() {
    setStep('feedback')
    setFeedbackRating(0)
    setFeedbackText('')
  }

  // ===== SUBMIT FEEDBACK =====
  async function handleSubmitFeedback() {
    setFeedbackSending(true)
    try {
      await supabase
        .from('chat_sessions')
        .update({
          status: 'closed',
          rating: feedbackRating || null,
          feedback_text: feedbackText.trim() || null
        })
        .eq('id', sessionId)
    } catch (err) {
      console.error('Feedback error:', err)
    }
    // Clean up
    localStorage.removeItem('livechat_session')
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    setSessionId(null)
    setMessages([])
    if (!isAuthenticated) {
      setName('')
      setEmail('')
      setStep('form')
    } else {
      setStep('chat')
    }
    setIsOpen(false)
    setFeedbackSending(false)
  }

  function skipFeedback() {
    supabase.from('chat_sessions').update({ status: 'closed' }).eq('id', sessionId).then(() => { })
    localStorage.removeItem('livechat_session')
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    setSessionId(null)
    setMessages([])
    if (!isAuthenticated) {
      setName('')
      setEmail('')
      setStep('form')
    } else {
      setStep('chat')
    }
    setIsOpen(false)
  }

  function playReceiveSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3)
    } catch { }
  }

  function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const feedbackEmojis = [
    { score: 1, emoji: '😞', label: 'Terrible' },
    { score: 2, emoji: '😐', label: 'Bad' },
    { score: 3, emoji: '🙂', label: 'Okay' },
    { score: 4, emoji: '😄', label: 'Good' },
    { score: 5, emoji: '😍', label: 'Loved it' }
  ]

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

  return (
    <>
      <div className={`lc-panel ${isOpen ? 'open' : ''}`}>
        {/* HEADER */}
        <div className="lc-header">
          <button className="lc-back" onClick={() => setIsOpen(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div className="lc-header-info">
            <div className="lc-header-title">
              {currentOrderId ? `Order ${currentOrderNumber ? '#' + currentOrderNumber : 'Chat'}` : 'EasyAssignments Help'}
              <span className={`lc-status-dot ${adminOnline ? 'online' : 'offline'}`}></span>
            </div>
            <div className="lc-header-sub">
              {adminTyping ? (
                <span className="lc-typing-text">Support is typing<span className="lc-typing-dots"><span>.</span><span>.</span><span>.</span></span></span>
              ) : adminOnline ? 'Online ready to help' : 'Offline we\'ll reply soon'}
            </div>
          </div>
          {step === 'chat' && !currentOrderId && (
            <button className="lc-end-btn" onClick={handleEndChat} title="End chat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}
        </div>

        {/* BODY */}
        <div className="lc-body">
          {(!isAuthenticated && step === 'form') ? (
            <form className="lc-form" onSubmit={handleStartChat}>
              <p className="lc-form-intro">We need a few details to assist you better.</p>
              <div className="lc-field">
                <label className="lc-label">Full Name</label>
                <div className="lc-input-wrap">
                  <span className="lc-input-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg></span>
                  <input type="text" className="lc-input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              </div>
              <div className="lc-field">
                <label className="lc-label">Email Address</label>
                <div className="lc-input-wrap">
                  <span className="lc-input-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg></span>
                  <input type="email" className="lc-input" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>
              <div className="lc-field">
                <label className="lc-label">Message</label>
                <textarea className="lc-textarea" placeholder="How can we help you today?" value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} required rows={3} />
              </div>
              <button type="submit" className="lc-start-btn" disabled={loading}>
                {loading ? (<><span className="lc-spinner"></span>Starting...</>) : (
                  <>Start Conversation <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg></>
                )}
              </button>
            </form>

          ) : step === 'feedback' ? (
            /* FEEDBACK SCREEN */
            <div className="lc-feedback">
              <div className="lc-feedback-card">
                <p className="lc-feedback-title">Please rate the conversation</p>
                <div className="lc-feedback-emojis">
                  {feedbackEmojis.map(item => (
                    <button
                      key={item.score}
                      className={`lc-feedback-emoji ${feedbackRating === item.score ? 'selected' : ''}`}
                      onClick={() => setFeedbackRating(item.score)}
                      title={item.label}
                      type="button"
                    >
                      <span>{item.emoji}</span>
                    </button>
                  ))}
                </div>
                <div className="lc-feedback-input-row">
                  <input
                    type="text"
                    className="lc-feedback-input"
                    placeholder="Tell us more..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                  />
                  <button
                    className="lc-feedback-submit"
                    onClick={handleSubmitFeedback}
                    disabled={feedbackSending}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                  </button>
                </div>
                <button className="lc-feedback-skip" onClick={skipFeedback}>Skip & close</button>
              </div>
            </div>

          ) : (
            /* CHAT MESSAGES */
            <>
              <div className="lc-messages">
                <div className="lc-msg lc-msg-admin">
                  <div className="lc-msg-avatar">EA</div>
                  <div className="lc-msg-content">
                    <div className="lc-msg-bubble">Hi {name}! 👋 Thanks for reaching out. A support agent will reply shortly.</div>
                    <div className="lc-msg-time">EasyAssignments</div>
                  </div>
                </div>

                {messages.map((msg) => {
                  if (msg.message.startsWith('[REWORK_REQ]') || msg.message.startsWith('[REWORK_REQ_READ]')) {
                    return (
                      <div key={msg.id} className="lc-msg lc-msg-visitor">
                        <div className="lc-msg-content" style={{ width: '100%' }}>
                          <div className="lc-msg-bubble" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: 600, textAlign: 'center' }}>
                            🚨 REWORK REQUEST SUBMITTED 🚨
                          </div>
                          <div className="lc-msg-time" style={{ textAlign: 'center' }}>{formatTime(msg.created_at)}</div>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div key={msg.id} className={`lc-msg ${msg.sender_type === 'visitor' ? 'lc-msg-visitor' : 'lc-msg-admin'}`}>
                      {msg.sender_type === 'admin' && <div className="lc-msg-avatar">EA</div>}
                      <div className="lc-msg-content">
                        <div className="lc-msg-bubble">{renderMessageText(msg.message)}</div>
                        <div className="lc-msg-time">{msg.sender_type === 'admin' ? 'Support' : 'You'} · {formatTime(msg.created_at)}</div>
                      </div>
                    </div>
                  )
                })}

                {adminTyping && (
                  <div className="lc-msg lc-msg-admin">
                    <div className="lc-msg-avatar">EA</div>
                    <div className="lc-msg-content">
                      <div className="lc-msg-bubble lc-typing-bubble">
                        <span className="lc-typing-indicator"><span></span><span></span><span></span></span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <div style={{ background: 'white', borderTop: '1px solid #e5e7eb', padding: '12px 16px', display: 'flex', flexDirection: 'column' }}>
                {selectedFiles.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        background: '#f1f5f9', padding: '6px 12px', borderRadius: '12px',
                        fontSize: '12px', fontWeight: 600, color: '#334155'
                      }}>
                        <span>📎 {file.name}</span>
                        <button type="button" onClick={() => removeFile(idx)} disabled={uploading} style={{
                          background: 'none', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer', color: '#94a3b8',
                          display: 'flex', alignItems: 'center', padding: '0 4px'
                        }} title="Remove file">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <form className="lc-reply" onSubmit={handleSendMessage} style={{ padding: 0, borderTop: 'none' }}>
                  {isAuthenticated && (
                    <>
                      <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} />
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ width: '40px', height: '40px', background: 'transparent', border: 'none', color: '#9ca3af', display: 'grid', placeItems: 'center', cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.5 : 1 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                      </button>
                    </>
                  )}
                  <input
                    type="text"
                    className="lc-reply-input"
                    placeholder={uploading ? `Uploading ${selectedFiles.length} file(s)...` : "Type a message..."}
                    value={newMessage}
                    disabled={uploading}
                    onChange={(e) => {
                      setNewMessage(e.target.value)
                      sendTypingEvent()
                    }}
                    autoFocus
                  />
                  <button type="submit" className="lc-reply-btn" disabled={(!newMessage.trim() && selectedFiles.length === 0) || sending || uploading}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      {/* FAB BUTTON */}
      <button className={`lc-fab ${isOpen ? 'lc-fab-hidden' : ''}`} onClick={() => setIsOpen(true)} aria-label="Open live chat">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
        <span className="lc-fab-pulse"></span>
      </button>
    </>
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
        marginTop: 8, padding: '8px 12px', background: 'rgba(0,0,0,0.08)',
        border: '1px solid rgba(0,0,0,0.05)', borderRadius: 8,
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

export default LiveChat
