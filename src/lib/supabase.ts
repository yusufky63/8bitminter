import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our database
export interface Coin {
  id: string
  name: string
  symbol: string
  description: string
  contract_address: string
  image_url: string
  category: string
  creator_address: string
  creator_name?: string
  tx_hash: string
  chain_id: number
  currency: string
  platform_referrer?: string
  total_supply?: string
  current_price?: string
  volume_24h?: string
  holders: number
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      coins: {
        Row: Coin
        Insert: Omit<Coin, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Coin, 'id' | 'created_at' | 'updated_at'>>
      }
    }
  }
} 