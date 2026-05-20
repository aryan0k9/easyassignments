import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://odjmdfgsitpzohllmbrg.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kam1kZmdzaXRwem9obGxtYnJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0ODI0MTcsImV4cCI6MjA5MzA1ODQxN30.k-j8-DhPw3W2hXPUvY4QeZCoVbGkNhXTTmE53g_9yN0'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase.from('chat_sessions').select('*').limit(1)
  console.log('Select Error:', error)

  const { data: qData, error: qError } = await supabase.rpc('get_policies')
  console.log('RPC get_policies Error:', qError)
}
test()
