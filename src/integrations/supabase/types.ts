export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      chat_threads: {
        Row: {
          created_at: string
          id: string
          session_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "crawl_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_pages: {
        Row: {
          ai_outline: string | null
          created_at: string
          gtmetrix_grade: string | null
          gtmetrix_pdf_url: string | null
          gtmetrix_scores: Json | null
          gtmetrix_test_id: string | null
          id: string
          raw_content: string | null
          screenshot_url: string | null
          session_id: string
          status: string
          title: string | null
          url: string
        }
        Insert: {
          ai_outline?: string | null
          created_at?: string
          gtmetrix_grade?: string | null
          gtmetrix_pdf_url?: string | null
          gtmetrix_scores?: Json | null
          gtmetrix_test_id?: string | null
          id?: string
          raw_content?: string | null
          screenshot_url?: string | null
          session_id: string
          status?: string
          title?: string | null
          url: string
        }
        Update: {
          ai_outline?: string | null
          created_at?: string
          gtmetrix_grade?: string | null
          gtmetrix_pdf_url?: string | null
          gtmetrix_scores?: Json | null
          gtmetrix_test_id?: string | null
          id?: string
          raw_content?: string | null
          screenshot_url?: string | null
          session_id?: string
          status?: string
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "crawl_pages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "crawl_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_screenshots: {
        Row: {
          created_at: string
          id: string
          screenshot_url: string | null
          session_id: string
          status: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          screenshot_url?: string | null
          session_id: string
          status?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          screenshot_url?: string | null
          session_id?: string
          status?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "crawl_screenshots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "crawl_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_sessions: {
        Row: {
          apollo_data: Json | null
          apollo_team_data: Json | null
          avoma_data: Json | null
          base_url: string
          builtwith_data: Json | null
          carbon_data: Json | null
          content_types_data: Json | null
          created_at: string
          crux_data: Json | null
          deep_research_data: Json | null
          detectzestack_data: Json | null
          discovered_urls: Json | null
          domain: string
          forms_data: Json | null
          forms_tiers: Json | null
          gmail_data: Json | null
          gtmetrix_grade: string | null
          gtmetrix_scores: Json | null
          gtmetrix_test_id: string | null
          httpstatus_data: Json | null
          hubspot_data: Json | null
          id: string
          integration_durations: Json | null
          integration_timestamps: Json | null
          linkcheck_data: Json | null
          nav_structure: Json | null
          observations_data: Json | null
          observatory_data: Json | null
          ocean_data: Json | null
          page_tags: Json | null
          prospect_domain: string | null
          psi_data: Json | null
          readable_data: Json | null
          schema_data: Json | null
          semrush_data: Json | null
          sitemap_data: Json | null
          ssllabs_data: Json | null
          status: string
          tech_analysis_data: Json | null
          template_tiers: Json | null
          updated_at: string
          w3c_data: Json | null
          wappalyzer_data: Json | null
          wave_data: Json | null
          yellowlab_data: Json | null
        }
        Insert: {
          apollo_data?: Json | null
          apollo_team_data?: Json | null
          avoma_data?: Json | null
          base_url: string
          builtwith_data?: Json | null
          carbon_data?: Json | null
          content_types_data?: Json | null
          created_at?: string
          crux_data?: Json | null
          deep_research_data?: Json | null
          detectzestack_data?: Json | null
          discovered_urls?: Json | null
          domain: string
          forms_data?: Json | null
          forms_tiers?: Json | null
          gmail_data?: Json | null
          gtmetrix_grade?: string | null
          gtmetrix_scores?: Json | null
          gtmetrix_test_id?: string | null
          httpstatus_data?: Json | null
          hubspot_data?: Json | null
          id?: string
          integration_durations?: Json | null
          integration_timestamps?: Json | null
          linkcheck_data?: Json | null
          nav_structure?: Json | null
          observations_data?: Json | null
          observatory_data?: Json | null
          ocean_data?: Json | null
          page_tags?: Json | null
          prospect_domain?: string | null
          psi_data?: Json | null
          readable_data?: Json | null
          schema_data?: Json | null
          semrush_data?: Json | null
          sitemap_data?: Json | null
          ssllabs_data?: Json | null
          status?: string
          tech_analysis_data?: Json | null
          template_tiers?: Json | null
          updated_at?: string
          w3c_data?: Json | null
          wappalyzer_data?: Json | null
          wave_data?: Json | null
          yellowlab_data?: Json | null
        }
        Update: {
          apollo_data?: Json | null
          apollo_team_data?: Json | null
          avoma_data?: Json | null
          base_url?: string
          builtwith_data?: Json | null
          carbon_data?: Json | null
          content_types_data?: Json | null
          created_at?: string
          crux_data?: Json | null
          deep_research_data?: Json | null
          detectzestack_data?: Json | null
          discovered_urls?: Json | null
          domain?: string
          forms_data?: Json | null
          forms_tiers?: Json | null
          gmail_data?: Json | null
          gtmetrix_grade?: string | null
          gtmetrix_scores?: Json | null
          gtmetrix_test_id?: string | null
          httpstatus_data?: Json | null
          hubspot_data?: Json | null
          id?: string
          integration_durations?: Json | null
          integration_timestamps?: Json | null
          linkcheck_data?: Json | null
          nav_structure?: Json | null
          observations_data?: Json | null
          observatory_data?: Json | null
          ocean_data?: Json | null
          page_tags?: Json | null
          prospect_domain?: string | null
          psi_data?: Json | null
          readable_data?: Json | null
          schema_data?: Json | null
          semrush_data?: Json | null
          sitemap_data?: Json | null
          ssllabs_data?: Json | null
          status?: string
          tech_analysis_data?: Json | null
          template_tiers?: Json | null
          updated_at?: string
          w3c_data?: Json | null
          wappalyzer_data?: Json | null
          wave_data?: Json | null
          yellowlab_data?: Json | null
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          id: string
          paused: boolean
          updated_at: string
        }
        Insert: {
          id: string
          paused?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          paused?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          chunk_text: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          session_id: string
        }
        Insert: {
          chunk_index: number
          chunk_text: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          session_id: string
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "crawl_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          char_count: number
          chunk_count: number
          content_hash: string | null
          created_at: string
          error_message: string | null
          id: string
          name: string
          session_id: string
          source_key: string | null
          source_type: string
          status: string
          updated_at: string
        }
        Insert: {
          char_count?: number
          chunk_count?: number
          content_hash?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          name: string
          session_id: string
          source_key?: string | null
          source_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          char_count?: number
          chunk_count?: number
          content_hash?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          name?: string
          session_id?: string
          source_key?: string | null
          source_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "crawl_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_favorites: {
        Row: {
          content: string
          created_at: string
          id: string
          message_id: string | null
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          message_id?: string | null
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          message_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_favorites_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "knowledge_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_favorites_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "crawl_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          rag_documents: Json | null
          role: string
          session_id: string
          sources: string[] | null
          thread_id: string | null
          web_citations: Json | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          rag_documents?: Json | null
          role: string
          session_id: string
          sources?: string[] | null
          thread_id?: string | null
          web_citations?: Json | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          rag_documents?: Json | null
          role?: string
          session_id?: string
          sources?: string[] | null
          thread_id?: string | null
          web_citations?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "crawl_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_connections: {
        Row: {
          access_token: string
          created_at: string
          id: string
          provider: string
          provider_email: string | null
          refresh_token: string
          scopes: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          provider: string
          provider_email?: string | null
          refresh_token: string
          scopes?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          provider?: string
          provider_email?: string | null
          refresh_token?: string
          scopes?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_knowledge_chunks: {
        Args: {
          p_embedding: string
          p_match_count?: number
          p_match_threshold?: number
          p_session_id: string
        }
        Returns: {
          chunk_index: number
          chunk_text: string
          document_id: string
          document_name: string
          id: string
          similarity: number
          source_type: string
        }[]
      }
      match_knowledge_chunks_by_source: {
        Args: {
          p_embedding: string
          p_match_count?: number
          p_match_threshold?: number
          p_session_id: string
          p_source_types: string[]
        }
        Returns: {
          chunk_index: number
          chunk_text: string
          document_id: string
          document_name: string
          id: string
          similarity: number
          source_type: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
