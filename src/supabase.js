import { createClient } from '@supabase/supabase-js'

///const SUPABASE_URL = 'https://rcndxmbvnyuzxjdhqeug.supabase.co'       // 나중에 교체
///const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjbmR4bWJ2bnl1enhqZGhxZXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzY0NzcsImV4cCI6MjA4OTQxMjQ3N30.nWt3tH4BUIxXMnNOeyXoLlZDvEBK0G3kbKIqCiDcLlE'  // 나중에 교체
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)