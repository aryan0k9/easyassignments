import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import StudentLayout from './StudentLayout'
import { useAuth } from '../../contexts/AuthContext'
import { getMyOrders } from '../../lib/orders'
import { uploadFile, getFileUrl, formatFileSize, getFileIcon } from '../../lib/uploads'
import { supabase } from '../../lib/supabase'

const SITE_ID = 1

function MyFiles() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [selectedOrder, setSelectedOrder] = useState(searchParams.get('order') || '')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [orders, setOrders] = useState([])
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState(null)

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadOrder, setUploadOrder] = useState('')
  const [uploadMessage, setUploadMessage] = useState('')
  const [uploadFiles, setUploadFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!user?.id) return
    getMyOrders().then(result => {
      if (result.success) setOrders(result.orders)
    })
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    loadFiles()
  }, [user?.id, selectedOrder, selectedCategory])

  async function loadFiles() {
    setLoading(true)
    const { data: userOrders } = await supabase
      .from('orders').select('id').eq('user_id', user.id)

    if (!userOrders || userOrders.length === 0) {
      setFiles([]); setLoading(false); return
    }

    const orderIds = userOrders.map(o => o.id)
    let query = supabase
      .from('order_files')
      .select('*, orders(order_number, subject)')
      .in('order_id', orderIds)
      .order('created_at', { ascending: false })

    if (selectedOrder) query = query.eq('order_id', selectedOrder)
    if (selectedCategory !== 'all') query = query.eq('uploaded_by', selectedCategory)

    const { data, error } = await query
    if (!error && data) setFiles(data)
    setLoading(false)
  }

  async function handleDownload(file) {
    setDownloadingId(file.id)
    const { url, success } = await getFileUrl(file.file_path)
    setDownloadingId(null)
    if (success && url) window.open(url, '_blank')
    else alert('File has expired or is unavailable.')
  }

  // ===== UPLOAD MODAL SUBMIT =====
  async function handleUploadSubmit(e) {
    e.preventDefault()
    if (!uploadOrder) { setUploadError('Please select an order.'); return }
    if (uploadFiles.length === 0) { setUploadError('Please select at least one file.'); return }

    setUploading(true)
    setUploadError('')

    try {
      // Upload each file to storage + order_files table
      const fileTags = []
      for (const file of uploadFiles) {
        const uploaded = await uploadFile(file, uploadOrder)
        await supabase.from('order_files').insert({
          order_id: uploadOrder,
          user_id: user.id,
          site_id: SITE_ID,
          file_name: uploaded.name,
          file_path: uploaded.path,
          file_size: uploaded.size,
          file_type: uploaded.type,
          category: 'reference',
          uploaded_by: 'student',
          notes: uploadMessage.trim() || null
        })
        fileTags.push(`[FILE:::${uploaded.path}:::${uploaded.name}]`)
      }

      // Find or create a chat session for this order
      let sessionId = null
      const { data: existing } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('order_id', uploadOrder)
        .eq('user_id', user.id)
        .eq('chat_type', 'order')
        .maybeSingle()

      if (existing) {
        sessionId = existing.id
      } else {
        const { data: created } = await supabase
          .from('chat_sessions')
          .insert({ order_id: uploadOrder, user_id: user.id, site_id: SITE_ID, chat_type: 'order', status: 'open' })
          .select('id').single()
        sessionId = created?.id
      }

      // Send message in chat with file tags + optional text
      if (sessionId) {
        const fileTagStr = fileTags.join('\n')
        const message = uploadMessage.trim()
          ? `${fileTagStr}\n\n${uploadMessage.trim()}`
          : fileTagStr

        const userName = user.user_metadata?.full_name || user.email

        await supabase.from('chat_messages').insert({
          session_id: sessionId,
          sender_type: 'visitor',
          sender_name: userName,
          message
        })

        // Update session's last_message preview
        await supabase.from('chat_sessions').update({
          last_message: uploadFiles.length > 1 ? `📎 ${uploadFiles.length} files` : `📎 ${uploadFiles[0]?.name}`,
          updated_at: new Date().toISOString()
        }).eq('id', sessionId)
      }

      // Reset and close modal
      setShowUploadModal(false)
      setUploadFiles([])
      setUploadMessage('')
      setUploadOrder('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      loadFiles()

    } catch (err) {
      setUploadError(err.message || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function openUploadModal() {
    setUploadOrder(selectedOrder || '')
    setUploadMessage('')
    setUploadFiles([])
    setUploadError('')
    setShowUploadModal(true)
  }

  const fmtOrderOption = (order) => {
    const num = order.order_number || ''
    const sub = order.subject || ''
    // at ~7.5px/char, 320px select has ~38 usable chars
    const full = `${num} · ${sub}`
    return full.length > 36 ? `${num} · ${sub.slice(0, 36 - num.length - 3)}…` : full
  }

  const truncateName = (name, maxLen = 40) => {
    if (!name || name.length <= maxLen) return name
    const dotIndex = name.lastIndexOf('.')
    const ext = dotIndex !== -1 ? name.slice(dotIndex) : ''
    return name.slice(0, maxLen - ext.length - 3) + '...' + ext
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <StudentLayout title="My Files">
      <style>{`
        .mf-filters { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
        .mf-filters select { flex: 1 1 180px; }
        .mf-filters .mf-upload-btn { margin-left: auto; white-space: nowrap; }
        .mf-item { display: flex; align-items: center; gap: 14px; padding: 14px 24px; border-bottom: 1px solid var(--sp-surface); overflow: hidden; }
        .mf-item-top { display: flex; gap: 14px; align-items: center; flex: 1; min-width: 0; }
        .mf-item-info { flex: 1; min-width: 0; overflow: hidden; }
        .mf-meta { display: flex; flex-direction: column; gap: 3px; }
        .mf-download { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border-radius: 8px; border: 1.5px solid #e5e7eb; background: white; color: #374151; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; }
        .mf-download:disabled { cursor: not-allowed; opacity: 0.6; }
        @media (max-width: 640px) {
          .mf-filters { flex-direction: column; align-items: stretch; }
          .mf-filters select { flex: 1 1 100%; max-width: 100%; }
          .mf-filters .mf-upload-btn { margin-left: 0; width: 100%; justify-content: center; }
          .mf-item { flex-direction: column; align-items: stretch; padding: 14px 16px; gap: 10px; }
          .mf-item-top { align-items: flex-start; }
          .mf-download { width: 100%; justify-content: center; }
        }
        @media (max-width: 420px) {
          .mf-item { padding: 12px; }
        }
      `}</style>

      {/* ===== UPLOAD MODAL ===== */}
      {showUploadModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !uploading && setShowUploadModal(false)}
        >
          <div
            style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 520, overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>📁 Upload File</h3>
              <button onClick={() => !uploading && setShowUploadModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleUploadSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Order selector */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Select Order *</label>
                <select
                  value={uploadOrder}
                  onChange={e => setUploadOrder(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none' }}
                >
                  <option value="">Choose an order</option>
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>{fmtOrderOption(o)}</option>
                  ))}
                </select>
              </div>

              {/* File picker */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Attach Files *</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #d1d5db', borderRadius: 10, padding: '28px 16px',
                    textAlign: 'center', cursor: 'pointer', background: uploadFiles.length > 0 ? '#f0fdf4' : '#f9fafb',
                    borderColor: uploadFiles.length > 0 ? '#16a34a' : '#d1d5db'
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{uploadFiles.length > 0 ? '✅' : '📎'}</div>
                  {uploadFiles.length > 0 ? (
                    <div>
                      {uploadFiles.map((f, i) => (
                        <div key={i} style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>{f.name}</div>
                      ))}
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Click to change</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Click to browse files</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>PDF, Word, Excel, Images, ZIP max 50 MB</div>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={e => setUploadFiles(Array.from(e.target.files || []))}
                />
              </div>

              {/* Message field */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  Message <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span>
                </label>
                <textarea
                  value={uploadMessage}
                  onChange={e => setUploadMessage(e.target.value)}
                  placeholder="Add a note about this file, e.g. 'Here are my reference materials for Chapter 3'"
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>

              {uploadError && (
                <div style={{ background: '#fef2f2', color: '#991b1b', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                  ⚠️ {uploadError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                  style={{ padding: '10px 20px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: uploading ? '#86efac' : '#16a34a', color: 'white', fontSize: 14, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer' }}
                >
                  {uploading ? 'Uploading...' : '📤 Upload & Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="sp-card">
        <div className="sp-card-body mf-filters">
          <select
            className="sp-form-input"
            value={selectedOrder}
            onChange={(e) => setSelectedOrder(e.target.value)}
          >
            <option value="">All Orders</option>
            {orders.map(order => (
              <option key={order.id} value={order.id}>{fmtOrderOption(order)}</option>
            ))}
          </select>

          <select
            className="sp-form-input"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="student">Sent by You</option>
            <option value="admin">From Admin</option>
          </select>

          <button onClick={openUploadModal} className="sp-btn sp-btn-primary mf-upload-btn">
            📁 Upload Files
          </button>
        </div>
      </div>

      {/* File List */}
      <div className="sp-card" style={{ overflowX: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--sp-muted)' }}>Loading files...</div>
        ) : files.length === 0 ? (
          selectedOrder ? (
            <div className="sp-empty">
              <div className="sp-empty-icon">📭</div>
              <h4>No files for this order</h4>
              <p style={{ maxWidth: 420, margin: '0 auto 8px' }}>
                No files have been shared for <strong>{orders.find(o => o.id === selectedOrder)?.order_number}</strong> yet.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
                <Link to={`/dashboard/orders/${selectedOrder}`} className="sp-btn sp-btn-primary">💬 Chat about this Order</Link>
                <button onClick={() => setSelectedOrder('')} className="sp-btn sp-btn-secondary">← View All Files</button>
              </div>
            </div>
          ) : (
            <div className="sp-empty">
              <div className="sp-empty-icon">📁</div>
              <h4>No files yet</h4>
              <p>Files you send or receive in order chats will automatically appear here.</p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
                <button onClick={openUploadModal} className="sp-btn sp-btn-secondary">📁 Upload File</button>
                <Link to="/dashboard/new-order" className="sp-btn sp-btn-primary">Place First Order →</Link>
              </div>
            </div>
          )
        ) : (
          <>
            <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--sp-surface)', fontSize: 13, color: 'var(--sp-muted)' }}>
              {files.length} file{files.length !== 1 ? 's' : ''} found
            </div>
            {files.map((file) => (
              <div key={file.id} className="mf-item">
                {/* icon + info always side by side; download button moves below on mobile */}
                <div className="mf-item-top">
                  <div style={{ width: '44px', height: '44px', background: 'rgba(99,102,241,0.08)', borderRadius: '10px', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: '22px' }}>
                    {getFileIcon(file.file_name)}
                  </div>
                  <div className="mf-item-info">
                    <div title={file.file_name} style={{ fontWeight: 700, color: 'var(--sp-charcoal)', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '5px' }}>
                      {truncateName(file.file_name, 30)}
                    </div>
                    {file.notes && (
                      <div style={{ fontSize: 12, color: '#374151', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 8px', marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        title={file.notes}
                      >
                        💬 {file.notes}
                      </div>
                    )}
                    <div className="mf-meta">
                      {/* Row 1: order badge + subject + sender badge */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                        <span style={{ background: '#fef3c7', borderRadius: 4, padding: '2px 7px', fontWeight: 700, color: '#92400e', fontSize: 11, whiteSpace: 'nowrap' }}>
                          {file.orders?.order_number || 'Unknown'}
                        </span>
                        {file.orders?.subject && (
                          <span style={{ fontSize: 11, color: 'var(--sp-muted)', whiteSpace: 'nowrap' }}>
                            {file.orders.subject}
                          </span>
                        )}
                        <span style={{ background: file.uploaded_by === 'admin' ? '#eff6ff' : '#f0fdf4', color: file.uploaded_by === 'admin' ? '#1d4ed8' : '#16a34a', borderRadius: 4, padding: '2px 7px', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' }}>
                          {file.uploaded_by === 'admin' ? '👨‍💼 From Admin' : '🎓 Sent by You'}
                        </span>
                      </div>
                      {/* Row 2: size + short date */}
                      <div style={{ fontSize: 11, color: 'var(--sp-muted)', marginTop: 3, whiteSpace: 'nowrap' }}>
                        {formatFileSize(file.file_size)} · {new Date(file.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  className="mf-download"
                  onClick={() => handleDownload(file)}
                  disabled={downloadingId === file.id}
                >
                  ⬇️ {downloadingId === file.id ? 'Opening...' : 'Download'}
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </StudentLayout>
  )
}

export default MyFiles
