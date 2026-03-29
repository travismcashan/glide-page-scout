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
          ga4_data: Json | null
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
          lookback_days: number
          nav_structure: Json | null
          observations_data: Json | null
          observatory_data: Json | null
          ocean_data: Json | null
          page_tags: Json | null
          prospect_domain: string | null
          psi_data: Json | null
          readable_data: Json | null
          schema_data: Json | null
          search_console_data: Json | null
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
          ga4_data?: Json | null
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
          lookback_days?: number
          nav_structure?: Json | null
          observations_data?: Json | null
          observatory_data?: Json | null
          ocean_data?: Json | null
          page_tags?: Json | null
          prospect_domain?: string | null
          psi_data?: Json | null
          readable_data?: Json | null
          schema_data?: Json | null
          search_console_data?: Json | null
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
          ga4_data?: Json | null
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
          lookback_days?: number
          nav_structure?: Json | null
          observations_data?: Json | null
          observatory_data?: Json | null
          ocean_data?: Json | null
          page_tags?: Json | null
          prospect_domain?: string | null
          psi_data?: Json | null
          readable_data?: Json | null
          schema_data?: Json | null
          search_console_data?: Json | null
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
      estimate_tasks: {
        Row: {
          created_at: string
          display_order: number
          estimate_id: string
          formula_config: Json | null
          hourly_rate: number
          hours: number
          hours_per_person: number
          id: string
          is_required: boolean
          is_selected: boolean
          master_task_id: string | null
          phase_name: string | null
          roles: string | null
          task_name: string
          task_type: string
          team_role_abbreviation: string | null
          team_role_name: string | null
          variable_label: string | null
          variable_qty: number | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          estimate_id: string
          formula_config?: Json | null
          hourly_rate?: number
          hours?: number
          hours_per_person?: number
          id?: string
          is_required?: boolean
          is_selected?: boolean
          master_task_id?: string | null
          phase_name?: string | null
          roles?: string | null
          task_name: string
          task_type?: string
          team_role_abbreviation?: string | null
          team_role_name?: string | null
          variable_label?: string | null
          variable_qty?: number | null
        }
        Update: {
          created_at?: string
          display_order?: number
          estimate_id?: string
          formula_config?: Json | null
          hourly_rate?: number
          hours?: number
          hours_per_person?: number
          id?: string
          is_required?: boolean
          is_selected?: boolean
          master_task_id?: string | null
          phase_name?: string | null
          roles?: string | null
          task_name?: string
          task_type?: string
          team_role_abbreviation?: string | null
          team_role_name?: string | null
          variable_label?: string | null
          variable_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_tasks_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "project_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_tasks_master_task_id_fkey"
            columns: ["master_task_id"]
            isOneToOne: false
            referencedRelation: "master_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      global_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          rag_documents: Json | null
          role: string
          sources: string[] | null
          thread_id: string
          web_citations: Json | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          rag_documents?: Json | null
          role: string
          sources?: string[] | null
          thread_id: string
          web_citations?: Json | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          rag_documents?: Json | null
          role?: string
          sources?: string[] | null
          thread_id?: string
          web_citations?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "global_chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "global_chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      global_chat_sources: {
        Row: {
          created_at: string
          id: string
          session_id: string
          thread_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          thread_id: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_chat_sources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "crawl_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_chat_sources_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "global_chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      global_chat_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      integration_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          integration_key: string
          session_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          integration_key: string
          session_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          integration_key?: string
          session_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_runs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "crawl_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      master_tasks: {
        Row: {
          created_at: string
          default_hours: number
          default_included: boolean
          default_variable_qty: number | null
          display_order: number
          formula_config: Json | null
          hours_per_person: number
          id: string
          is_required: boolean
          name: string
          phase_id: string | null
          roles: string | null
          task_type: string
          team_role_id: string | null
          variable_label: string | null
        }
        Insert: {
          created_at?: string
          default_hours?: number
          default_included?: boolean
          default_variable_qty?: number | null
          display_order?: number
          formula_config?: Json | null
          hours_per_person?: number
          id?: string
          is_required?: boolean
          name: string
          phase_id?: string | null
          roles?: string | null
          task_type?: string
          team_role_id?: string | null
          variable_label?: string | null
        }
        Update: {
          created_at?: string
          default_hours?: number
          default_included?: boolean
          default_variable_qty?: number | null
          display_order?: number
          formula_config?: Json | null
          hours_per_person?: number
          id?: string
          is_required?: boolean
          name?: string
          phase_id?: string | null
          roles?: string | null
          task_type?: string
          team_role_id?: string | null
          variable_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_tasks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_tasks_team_role_id_fkey"
            columns: ["team_role_id"]
            isOneToOne: false
            referencedRelation: "team_roles"
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
          provider_config: Json | null
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
          provider_config?: Json | null
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
          provider_config?: Json | null
          provider_email?: string | null
          refresh_token?: string
          scopes?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_estimates: {
        Row: {
          bulk_import_amount: string | null
          client_name: string | null
          complexity_score: number | null
          content_pages: number | null
          content_tier: string | null
          created_at: string
          custom_posts: number | null
          description: string | null
          design_layouts: number | null
          form_count: number | null
          form_count_l: number | null
          form_count_m: number | null
          form_count_s: number | null
          forms_tier: string | null
          id: string
          integration_count: number | null
          name: string
          page_tier: string | null
          pages_for_integration: number | null
          paid_discovery: string | null
          pm_percentage: number
          post_launch_services: number | null
          project_complexity: string | null
          project_size: string | null
          qa_percentage: number
          session_id: string | null
          site_builder_acf: boolean | null
          status: string | null
          tech_tier: string | null
          template_tier: string | null
          third_party_integrations: number | null
          updated_at: string
          user_personas: number | null
        }
        Insert: {
          bulk_import_amount?: string | null
          client_name?: string | null
          complexity_score?: number | null
          content_pages?: number | null
          content_tier?: string | null
          created_at?: string
          custom_posts?: number | null
          description?: string | null
          design_layouts?: number | null
          form_count?: number | null
          form_count_l?: number | null
          form_count_m?: number | null
          form_count_s?: number | null
          forms_tier?: string | null
          id?: string
          integration_count?: number | null
          name: string
          page_tier?: string | null
          pages_for_integration?: number | null
          paid_discovery?: string | null
          pm_percentage?: number
          post_launch_services?: number | null
          project_complexity?: string | null
          project_size?: string | null
          qa_percentage?: number
          session_id?: string | null
          site_builder_acf?: boolean | null
          status?: string | null
          tech_tier?: string | null
          template_tier?: string | null
          third_party_integrations?: number | null
          updated_at?: string
          user_personas?: number | null
        }
        Update: {
          bulk_import_amount?: string | null
          client_name?: string | null
          complexity_score?: number | null
          content_pages?: number | null
          content_tier?: string | null
          created_at?: string
          custom_posts?: number | null
          description?: string | null
          design_layouts?: number | null
          form_count?: number | null
          form_count_l?: number | null
          form_count_m?: number | null
          form_count_s?: number | null
          forms_tier?: string | null
          id?: string
          integration_count?: number | null
          name?: string
          page_tier?: string | null
          pages_for_integration?: number | null
          paid_discovery?: string | null
          pm_percentage?: number
          post_launch_services?: number | null
          project_complexity?: string | null
          project_size?: string | null
          qa_percentage?: number
          session_id?: string | null
          site_builder_acf?: boolean | null
          status?: string | null
          tech_tier?: string | null
          template_tier?: string | null
          third_party_integrations?: number | null
          updated_at?: string
          user_personas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_estimates_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "crawl_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_phases: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      site_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          notes: string | null
          priority: number | null
          session_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          notes?: string | null
          priority?: number | null
          session_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          notes?: string | null
          priority?: number | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "site_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      site_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_formulas: {
        Row: {
          base_hours: number
          created_at: string
          description: string | null
          display_order: number
          hours_per_unit: number
          id: string
          is_active: boolean
          task_name_pattern: string
          variable_name: string
        }
        Insert: {
          base_hours?: number
          created_at?: string
          description?: string | null
          display_order?: number
          hours_per_unit?: number
          id?: string
          is_active?: boolean
          task_name_pattern: string
          variable_name: string
        }
        Update: {
          base_hours?: number
          created_at?: string
          description?: string | null
          display_order?: number
          hours_per_unit?: number
          id?: string
          is_active?: boolean
          task_name_pattern?: string
          variable_name?: string
        }
        Relationships: []
      }
      team_roles: {
        Row: {
          abbreviation: string
          created_at: string
          display_order: number
          hourly_rate: number
          id: string
          name: string
        }
        Insert: {
          abbreviation: string
          created_at?: string
          display_order?: number
          hourly_rate?: number
          id?: string
          name: string
        }
        Update: {
          abbreviation?: string
          created_at?: string
          display_order?: number
          hourly_rate?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          category: string
          created_at: string
          description: string | null
          effort_estimate: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          effort_estimate?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          effort_estimate?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_integrations: {
        Args: { session_ids: string[] }
        Returns: {
          integration_count: number
          session_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
      match_knowledge_chunks_multi: {
        Args: {
          p_embedding: string
          p_match_count?: number
          p_match_threshold?: number
          p_session_ids: string[]
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
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
