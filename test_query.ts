import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)
async function run() {
  const { data, error } = await supabase.from('collected_cards').select('*, staff:staff_id(nickname, profile_pic_url)').limit(1)
  console.log("Error:", error?.message)
  console.log("Data:", data)
}
run()
