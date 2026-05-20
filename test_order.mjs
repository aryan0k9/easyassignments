import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://odjmdfgsitpzohllmbrg.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kam1kZmdzaXRwem9obGxtYnJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0ODI0MTcsImV4cCI6MjA5MzA1ODQxN30.k-j8-DhPw3W2hXPUvY4QeZCoVbGkNhXTTmE53g_9yN0'

const supabase = createClient(supabaseUrl, supabaseKey)

async function test(email) {
  console.log(`\n--- Testing with email: ${email} ---`)
  
  const tempPassword = 'Password123'
  
  // 1. Sign up
  console.log('Signing up...')
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password: tempPassword,
    options: { data: { full_name: 'Test User' } },
  })
  
  if (signUpError) {
    console.error('Sign up error:', signUpError)
    return
  }
  console.log('Sign up successful, user ID:', signUpData.user?.id)
  
  // 2. Sign in
  console.log('Signing in...')
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: tempPassword,
  })
  
  if (signInError) {
    console.error('Sign in error:', signInError)
    return
  }
  console.log('Sign in successful, session:', !!signInData.session)
  
  // 3. Create order simulating orders.js createOrder logic
  const orderData = {
    title: `Test Subject Test Type`, subject: 'Test', type: 'Test Type',
    wordCount: 1000, pages: 4, academicLevel: 'Undergraduate',
    description: 'Test description', deadline: '2026-05-20T10:00:00', formattingStyle: 'APA'
  }
  const SITE_ID = 1
  const orderNumber = `EA-${Date.now()}`
  
  console.log('Inserting order into DB...')
  const { data: insertData, error: insertError } = await supabase
    .from('orders')
    .insert({
      order_number:    orderNumber,
      user_id:         signUpData.user.id,
      site_id:         SITE_ID,
      title:           orderData.title,
      subject:         orderData.subject,
      type:            orderData.type,
      word_count:      orderData.wordCount,
      pages:           Math.ceil(orderData.wordCount / 275),
      academic_level:  orderData.academicLevel,
      description:     orderData.description,
      formatting_style: orderData.formattingStyle,
      deadline:        orderData.deadline,
      status:          'pending',
      payment_status:  'unpaid',
      progress:        0,
    })
    .select()
    .single()
    
  if (insertError) {
    console.error('Order insertion error:', insertError)
  } else {
    console.log('Order inserted successfully! ID:', insertData.id)
  }
  
  // 4. Send email
  console.log('Invoking Edge Function send-welcome-email...')
  const { data: funcData, error: funcError } = await supabase.functions.invoke('send-welcome-email', {
    body: {
      email,
      fullName: 'Test User',
      tempPassword,
      orderDetails: {
        subject: orderData.subject,
        serviceType: orderData.type,
        pages: 4,
        wordCount: 1000,
        academicLevel: orderData.academicLevel,
        deadline: orderData.deadline,
        orderNumber: orderNumber,
      },
    },
  })
  
  if (funcError) {
    console.error('Edge Function error:', funcError)
  } else {
    console.log('Edge Function successful:', funcData)
  }
}

async function run() {
  await test('namikil853@gcervera.com')
  await test('tagowe9786@imashr.com')
}

run()
