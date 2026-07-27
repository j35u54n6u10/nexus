import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL o Anon Key no están definidas. Por favor configura el archivo .env con tus credenciales.'
  )
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')
