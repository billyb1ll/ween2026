const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.from('users').update({ immich_asset_id: 'test' }).eq('student_id', '660000000').select().single();
  if (error) console.error("Error:", error);
  else console.log("Success:", data.student_id);
}
test();
