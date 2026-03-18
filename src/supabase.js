import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'YOUR_SUPABASE_URL'       // 나중에 교체
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'  // 나중에 교체

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)