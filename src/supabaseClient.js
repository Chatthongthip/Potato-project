import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cogpzkhkdXizrjczccuv.supabase.co'
const supabaseAnonKey = 'sb_publishable_JWq_KZKsxrxy5N06cK8ccQ_s0sDKYjG'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)