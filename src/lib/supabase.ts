import { createClient } from '@supabase/supabase-js'

// Retrieve environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Dev warning logs if missing
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[WARNING] Supabase credentials are missing. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  )
}

// Graceful fallback to dummy values to prevent app compilation and bundle crashes
const finalUrl = supabaseUrl || 'https://placeholder-url.supabase.co'
const finalKey = supabaseAnonKey || 'placeholder-anon-key'

export const supabase = createClient(finalUrl, finalKey)
