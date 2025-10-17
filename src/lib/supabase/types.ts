/**
 * Database types for CircuitSnips
 * These match the Supabase schema defined in supabase/schema.sql
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          avatar_url: string | null
          bio: string | null
          website: string | null
          github_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          avatar_url?: string | null
          bio?: string | null
          website?: string | null
          github_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          avatar_url?: string | null
          bio?: string | null
          website?: string | null
          github_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      circuits: {
        Row: {
          id: string
          slug: string
          title: string
          description: string
          user_id: string
          file_path: string
          raw_sexpr: string
          component_count: number
          wire_count: number
          net_count: number
          category: string | null
          tags: string[]
          license: string
          view_count: number
          copy_count: number
          favorite_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          title: string
          description: string
          user_id: string
          file_path: string
          raw_sexpr: string
          component_count?: number
          wire_count?: number
          net_count?: number
          category?: string | null
          tags?: string[]
          license?: string
          view_count?: number
          copy_count?: number
          favorite_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          title?: string
          description?: string
          user_id?: string
          file_path?: string
          raw_sexpr?: string
          component_count?: number
          wire_count?: number
          net_count?: number
          category?: string | null
          tags?: string[]
          license?: string
          view_count?: number
          copy_count?: number
          favorite_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      circuit_components: {
        Row: {
          id: string
          circuit_id: string
          reference: string
          value: string
          footprint: string | null
          lib_id: string
          uuid: string
          position_x: number | null
          position_y: number | null
          rotation: number
        }
        Insert: {
          id?: string
          circuit_id: string
          reference: string
          value: string
          footprint?: string | null
          lib_id: string
          uuid: string
          position_x?: number | null
          position_y?: number | null
          rotation?: number
        }
        Update: {
          id?: string
          circuit_id?: string
          reference?: string
          value?: string
          footprint?: string | null
          lib_id?: string
          uuid?: string
          position_x?: number | null
          position_y?: number | null
          rotation?: number
        }
      }
      favorites: {
        Row: {
          id: string
          user_id: string
          circuit_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          circuit_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          circuit_id?: string
          created_at?: string
        }
      }
      circuit_copies: {
        Row: {
          id: string
          circuit_id: string
          user_id: string | null
          copied_at: string
        }
        Insert: {
          id?: string
          circuit_id: string
          user_id?: string | null
          copied_at?: string
        }
        Update: {
          id?: string
          circuit_id?: string
          user_id?: string | null
          copied_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_circuit_views: {
        Args: { circuit_id: string }
        Returns: void
      }
      search_circuits: {
        Args: { search_query: string }
        Returns: {
          id: string
          slug: string
          title: string
          description: string
          rank: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
