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
      crawl_sessions: {
        Row: {
          base_url: string
          builtwith_data: Json | null
          carbon_data: Json | null
          created_at: string
          crux_data: Json | null
          deep_research_data: Json | null
          domain: string
          gtmetrix_grade: string | null
          gtmetrix_scores: Json | null
          gtmetrix_test_id: string | null
          httpstatus_data: Json | null
          id: string
          linkcheck_data: Json | null
          observations_data: Json | null
          observatory_data: Json | null
          ocean_data: Json | null
          psi_data: Json | null
          readable_data: Json | null
          schema_data: Json | null
          semrush_data: Json | null
          ssllabs_data: Json | null
          status: string
          updated_at: string
          w3c_data: Json | null
          wappalyzer_data: Json | null
          wave_data: Json | null
          yellowlab_data: Json | null
        }
        Insert: {
          base_url: string
          builtwith_data?: Json | null
          carbon_data?: Json | null
          created_at?: string
          crux_data?: Json | null
          deep_research_data?: Json | null
          domain: string
          gtmetrix_grade?: string | null
          gtmetrix_scores?: Json | null
          gtmetrix_test_id?: string | null
          httpstatus_data?: Json | null
          id?: string
          linkcheck_data?: Json | null
          observations_data?: Json | null
          observatory_data?: Json | null
          ocean_data?: Json | null
          psi_data?: Json | null
          readable_data?: Json | null
          schema_data?: Json | null
          semrush_data?: Json | null
          ssllabs_data?: Json | null
          status?: string
          updated_at?: string
          w3c_data?: Json | null
          wappalyzer_data?: Json | null
          wave_data?: Json | null
          yellowlab_data?: Json | null
        }
        Update: {
          base_url?: string
          builtwith_data?: Json | null
          carbon_data?: Json | null
          created_at?: string
          crux_data?: Json | null
          deep_research_data?: Json | null
          domain?: string
          gtmetrix_grade?: string | null
          gtmetrix_scores?: Json | null
          gtmetrix_test_id?: string | null
          httpstatus_data?: Json | null
          id?: string
          linkcheck_data?: Json | null
          observations_data?: Json | null
          observatory_data?: Json | null
          ocean_data?: Json | null
          psi_data?: Json | null
          readable_data?: Json | null
          schema_data?: Json | null
          semrush_data?: Json | null
          ssllabs_data?: Json | null
          status?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
