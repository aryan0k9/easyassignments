import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://odjmdfgsitpzohllmbrg.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kam1kZmdzaXRwem9obGxtYnJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0ODI0MTcsImV4cCI6MjA5MzA1ODQxN30.k-j8-DhPw3W2hXPUvY4QeZCoVbGkNhXTTmE53g_9yN0'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase.from('chat_sessions').insert({
    site_id: 1,
    chat_type: 'guest',
    visitor_name: 'test',
    visitor_email: 'test@example.com',
    user_id: null,
    status: 'active',
    last_message: 'hello',
    unread_count: 1
  }).select()
  console.log('Error:', error)
  console.log('Data:', data)
}
test()
