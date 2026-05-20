// ============================================================
// FILE UPLOAD HELPER
// Handles uploads to Supabase Storage + tracking in order_files table
// ============================================================

import { supabase } from './supabase'

const BUCKET = 'order-files'
const SITE_ID = 1
const MAX_FILE_SIZE = 50 * 1024 * 1024  // 50 MB

// Allowlist: maps every permitted MIME type to its valid extensions.
// Any file whose MIME type OR extension is not in this map is rejected.
const ALLOWED_MIME_TO_EXTENSIONS = {
  'application/pdf':     ['pdf'],
  'application/msword':  ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':   ['docx'],
  'application/vnd.ms-excel':  ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':         ['xlsx'],
  'application/vnd.ms-powerpoint': ['ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
  'text/plain':          ['txt'],
  'text/csv':            ['csv'],
  'image/jpeg':          ['jpg', 'jpeg'],
  'image/png':           ['png'],
  'image/gif':           ['gif'],
  'image/webp':          ['webp'],
  'application/zip':             ['zip'],
  'application/x-zip-compressed': ['zip'],
  'application/x-rar-compressed': ['rar'],
}

// Flat set of all allowed MIME types used for quick lookup
const ALLOWED_TYPES = new Set(Object.keys(ALLOWED_MIME_TO_EXTENSIONS))

// ============================================================
export function dataURLtoFile(dataurl, filename, mime) {
  var arr = dataurl.split(','),
      bstr = atob(arr[arr.length - 1]), 
      n = bstr.length, 
      u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, {type:mime});
}

export function loadPendingFilesFromIDB() {
  return new Promise((resolve) => {
    const req = indexedDB.open('ea_pending', 1)
    req.onupgradeneeded = e => e.target.result.createObjectStore('files')
    req.onsuccess = e => {
      const tx = e.target.result.transaction('files', 'readonly')
      const get = tx.objectStore('files').get('pendingFiles')
      get.onsuccess = () => {
        const result = get.result || []
        if (result.length > 0 && result[0].data) {
          const files = result.map(f => dataURLtoFile(f.data, f.name, f.type))
          resolve(files)
        } else {
          resolve(result)
        }
      }
      get.onerror   = () => resolve([])
    }
    req.onerror = () => resolve([])
  })
}

export function clearPendingFilesIDB() {
  return new Promise((resolve) => {
    const req = indexedDB.open('ea_pending', 1)
    req.onsuccess = e => {
      try {
        const tx = e.target.result.transaction('files', 'readwrite')
        tx.objectStore('files').delete('pendingFiles')
        tx.oncomplete = resolve
      } catch { resolve() }
    }
    req.onerror = resolve
  })
}

// VALIDATE FILE
// Returns { valid: true } or { valid: false, error: '...' }
// Uses an allowlist both MIME type AND extension must be permitted.
// ============================================================
export function validateFile(file) {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File "${file.name}" is too large. Max 50 MB.` }
  }

  if (file.size === 0) {
    return { valid: false, error: `File "${file.name}" is empty.` }
  }

  // 1. Check MIME type against the allowlist
  if (!ALLOWED_TYPES.has(file.type)) {
    return {
      valid: false,
      error: `File type "${file.type || 'unknown'}" is not allowed. Please upload a PDF, Word, Excel, PowerPoint, text, image, or zip file.`
    }
  }

  // 2. Check extension matches the declared MIME type
  // Prevents renaming attacks (e.g. script.php → script.pdf)
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const allowedExts = ALLOWED_MIME_TO_EXTENSIONS[file.type]
  if (!allowedExts.includes(ext)) {
    return {
      valid: false,
      error: `File extension ".${ext}" does not match the file type. Please do not rename files before uploading.`
    }
  }

  return { valid: true }
}

// ============================================================
// UPLOAD A SINGLE FILE
// Returns the storage path on success, or throws error
// ============================================================
export async function uploadFile(file, orderId = null) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('You must be logged in to upload files')
  }

  // Validate
  const validation = validateFile(file)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  // Generate unique filename to avoid conflicts
  // Format: user_id/timestamp_originalname
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filePath = `${user.id}/${timestamp}_${safeName}`

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) {
    console.error('Upload error:', error)
    throw new Error(error.message)
  }

  return {
    path: data.path,
    name: file.name,
    size: file.size,
    type: file.type
  }
}

// ============================================================
// UPLOAD MULTIPLE FILES + LINK TO ORDER
// Used when placing a new order with attachments
// ============================================================
export async function uploadOrderFiles(files, orderId, category = 'instruction') {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('You must be logged in')
  }

  const uploadedFiles = []
  const errors = []

  for (const file of files) {
    try {
      // Upload to storage
      const uploaded = await uploadFile(file, orderId)

      // Save reference in order_files table
      const { data: dbRecord, error: dbError } = await supabase
        .from('order_files')
        .insert({
          order_id:     orderId,
          user_id:      user.id,
          site_id:      SITE_ID,
          file_name:    uploaded.name,
          file_path:    uploaded.path,
          file_size:    uploaded.size,
          file_type:    uploaded.type,
          category:     category,
          uploaded_by:  'student'
        })
        .select()
        .single()

      if (dbError) {
        console.error('DB insert error:', dbError)
        errors.push(`${file.name}: ${dbError.message}`)
        // Try to clean up storage
        await supabase.storage.from(BUCKET).remove([uploaded.path])
      } else {
        uploadedFiles.push(dbRecord)
      }
    } catch (err) {
      console.error(`Failed to upload ${file.name}:`, err)
      errors.push(`${file.name}: ${err.message}`)
    }
  }

  return {
    success: errors.length === 0,
    uploaded: uploadedFiles,
    errors: errors
  }
}

// ============================================================
// GET FILES FOR AN ORDER
// ============================================================
export async function getOrderFiles(orderId) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, files: [], error: 'Not logged in' }

    const { data, error } = await supabase
      .from('order_files')
      .select('*')
      .eq('order_id', orderId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return { success: false, files: [], error: error.message }
    }

    return { success: true, files: data || [] }
  } catch (err) {
    return { success: false, files: [], error: err.message }
  }
}

// ============================================================
// GET DOWNLOAD URL FOR A FILE
// Creates a signed URL that's valid for 1 hour
// ============================================================
export async function getFileUrl(filePath) {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 3600)  // 1 hour expiry

    if (error) {
      throw error
    }

    return { success: true, url: data.signedUrl }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ============================================================
// DELETE A FILE
// ============================================================
export async function deleteFile(fileId, filePath) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not logged in' }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([filePath])

    if (storageError) {
      console.warn('Storage delete error:', storageError)
    }

    // Delete from DB only if this file belongs to the current user
    const { error: dbError } = await supabase
      .from('order_files')
      .delete()
      .eq('id', fileId)
      .eq('user_id', user.id)

    if (dbError) {
      throw dbError
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ============================================================
// FORMAT FILE SIZE FOR DISPLAY
// 1024 → "1 KB", 1048576 → "1 MB"
// ============================================================
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// ============================================================
// GET FILE ICON BY TYPE
// ============================================================
export function getFileIcon(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const icons = {
    pdf:  '📕',
    doc:  '📘', docx: '📘',
    xls:  '📗', xlsx: '📗', csv: '📗',
    ppt:  '📙', pptx: '📙',
    txt:  '📄',
    jpg:  '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️',
    zip:  '🗜️', rar: '🗜️',
    mp4:  '🎬', mov: '🎬',
    mp3:  '🎵', wav: '🎵'
  }
  return icons[ext] || '📎'
}
