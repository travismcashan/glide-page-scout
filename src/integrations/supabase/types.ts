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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_usage_log: {
        Row: {
          completion_tokens: number | null
          created_at: string
          duration_ms: number | null
          edge_function: string
          error: string | null
          id: string
          is_streaming: boolean | null
          model: string
          prompt_tokens: number | null
          provider: string
          session_id: string | null
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string
          duration_ms?: number | null
          edge_function: string
          error?: string | null
          id?: string
          is_streaming?: boolean | null
          model: string
          prompt_tokens?: number | null
          provider: string
          session_id?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string
          duration_ms?: number | null
          edge_function?: string
          error?: string | null
          id?: string
          is_streaming?: boolean | null
          model?: string
          prompt_tokens?: number | null
          provider?: string
          session_id?: string | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
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
      companies: {
        Row: {
          annual_revenue: string | null
          created_at: string
          description: string | null
          domain: string | null
          employee_count: string | null
          enrichment_data: Json | null
          hubspot_company_id: string | null
          id: string
          industry: string | null
          location: string | null
          logo_url: string | null
          name: string
          notes: string | null
          status: string
          tags: string[] | null
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          annual_revenue?: string | null
          created_at?: string
          description?: string | null
          domain?: string | null
          employee_count?: string | null
          enrichment_data?: Json | null
          hubspot_company_id?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          name: string
          notes?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Update: {
          annual_revenue?: string | null
          created_at?: string
          description?: string | null
          domain?: string | null
          employee_count?: string | null
          enrichment_data?: Json | null
          hubspot_company_id?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          logo_url?: string | null
          name?: string
          notes?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: []
      }
      contact_photos: {
        Row: {
          company: string | null
          created_at: string | null
          email: string
          hubspot_contact_id: string | null
          name: string | null
          photo_url: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email: string
          hubspot_contact_id?: string | null
          name?: string | null
          photo_url?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string
          hubspot_contact_id?: string | null
          name?: string | null
          photo_url?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          apollo_person_id: string | null
          company_id: string | null
          created_at: string
          department: string | null
          email: string | null
          enrichment_data: Json | null
          first_name: string | null
          hubspot_contact_id: string | null
          id: string
          is_primary: boolean
          last_name: string | null
          linkedin_url: string | null
          notes: string | null
          phone: string | null
          photo_url: string | null
          role_type: string | null
          seniority: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          apollo_person_id?: string | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          enrichment_data?: Json | null
          first_name?: string | null
          hubspot_contact_id?: string | null
          id?: string
          is_primary?: boolean
          last_name?: string | null
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          role_type?: string | null
          seniority?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          apollo_person_id?: string | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          enrichment_data?: Json | null
          first_name?: string | null
          hubspot_contact_id?: string | null
          id?: string
          is_primary?: boolean
          last_name?: string | null
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          role_type?: string | null
          seniority?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "crawl_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          amount: number | null
          close_date: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          deal_type: string | null
          hubspot_deal_id: string | null
          id: string
          name: string
          pipeline: string | null
          priority: string | null
          properties: Json | null
          stage: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          close_date?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_type?: string | null
          hubspot_deal_id?: string | null
          id?: string
          name: string
          pipeline?: string | null
          priority?: string | null
          properties?: Json | null
          stage?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number | null
          close_date?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_type?: string | null
          hubspot_deal_id?: string | null
          id?: string
          name?: string
          pipeline?: string | null
          priority?: string | null
          properties?: Json | null
          stage?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      engagements: {
        Row: {
          body_preview: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          direction: string | null
          engagement_type: string
          hubspot_engagement_id: string | null
          id: string
          metadata: Json | null
          occurred_at: string | null
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body_preview?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          direction?: string | null
          engagement_type: string
          hubspot_engagement_id?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string | null
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          body_preview?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          direction?: string | null
          engagement_type?: string
          hubspot_engagement_id?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string | null
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
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
          search_text: unknown
          session_id: string
        }
        Insert: {
          chunk_index: number
          chunk_text: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          search_text?: unknown
          session_id: string
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          search_text?: unknown
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
      model_pricing: {
        Row: {
          id: string
          input_per_1m: number
          model: string
          notes: string | null
          output_per_1m: number
          pricing_url: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          id?: string
          input_per_1m?: number
          model: string
          notes?: string | null
          output_per_1m?: number
          pricing_url?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          id?: string
          input_per_1m?: number
          model?: string
          notes?: string | null
          output_per_1m?: number
          pricing_url?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "project_estimates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
      proposal_case_studies: {
        Row: {
          company: string
          created_at: string | null
          description: string | null
          id: string
          metrics: Json | null
          raw_content: string | null
          screenshot_url: string | null
          session_id: string
          sort_order: number
          sources: Json | null
          tagline: string | null
          updated_at: string | null
          why_it_matters: string | null
        }
        Insert: {
          company?: string
          created_at?: string | null
          description?: string | null
          id?: string
          metrics?: Json | null
          raw_content?: string | null
          screenshot_url?: string | null
          session_id: string
          sort_order?: number
          sources?: Json | null
          tagline?: string | null
          updated_at?: string | null
          why_it_matters?: string | null
        }
        Update: {
          company?: string
          created_at?: string | null
          description?: string | null
          id?: string
          metrics?: Json | null
          raw_content?: string | null
          screenshot_url?: string | null
          session_id?: string
          sort_order?: number
          sources?: Json | null
          tagline?: string | null
          updated_at?: string | null
          why_it_matters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_case_studies_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "crawl_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          company_id: string | null
          company_name: string | null
          contact_email: string | null
          contact_name: string | null
          contact_title: string | null
          created_at: string | null
          id: string
          proposal_data: Json | null
          session_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_title?: string | null
          created_at?: string | null
          id?: string
          proposal_data?: Json | null
          session_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_title?: string | null
          created_at?: string | null
          id?: string
          proposal_data?: Json | null
          session_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "crawl_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_items: {
        Row: {
          billing_type: string | null
          created_at: string
          custom_name: string | null
          discount_type: string | null
          discount_value: number | null
          duration: number
          estimated_ad_spend: number | null
          id: string
          is_recurring: boolean
          roadmap_id: string
          sku: number
          sort_order: number
          start_month: number
          unit_price: number | null
        }
        Insert: {
          billing_type?: string | null
          created_at?: string
          custom_name?: string | null
          discount_type?: string | null
          discount_value?: number | null
          duration?: number
          estimated_ad_spend?: number | null
          id?: string
          is_recurring?: boolean
          roadmap_id: string
          sku: number
          sort_order?: number
          start_month?: number
          unit_price?: number | null
        }
        Update: {
          billing_type?: string | null
          created_at?: string
          custom_name?: string | null
          discount_type?: string | null
          discount_value?: number | null
          duration?: number
          estimated_ad_spend?: number | null
          id?: string
          is_recurring?: boolean
          roadmap_id?: string
          sku?: number
          sort_order?: number
          start_month?: number
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_items_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "roadmaps"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmaps: {
        Row: {
          client_name: string
          company_id: string | null
          created_at: string
          id: string
          ideal_end_date: string | null
          ideal_start_date: string | null
          outcomes_data: Json | null
          session_id: string
          start_month: number
          total_months: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          client_name?: string
          company_id?: string | null
          created_at?: string
          id?: string
          ideal_end_date?: string | null
          ideal_start_date?: string | null
          outcomes_data?: Json | null
          session_id: string
          start_month?: number
          total_months?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          client_name?: string
          company_id?: string | null
          created_at?: string
          id?: string
          ideal_end_date?: string | null
          ideal_start_date?: string | null
          outcomes_data?: Json | null
          session_id?: string
          start_month?: number
          total_months?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roadmaps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmaps_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "crawl_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      service_steps: {
        Row: {
          code: string
          frequency: string | null
          id: string
          is_onramp: boolean
          name: string
          service_id: string
          sort_order: number
          step_type: string
        }
        Insert: {
          code: string
          frequency?: string | null
          id?: string
          is_onramp?: boolean
          name: string
          service_id: string
          sort_order?: number
          step_type: string
        }
        Update: {
          code?: string
          frequency?: string | null
          id?: string
          is_onramp?: boolean
          name?: string
          service_id?: string
          sort_order?: number
          step_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_steps_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          avg_duration_high_weeks: number | null
          avg_duration_low_weeks: number | null
          billing_type: string | null
          case_study_url: string | null
          category: string | null
          created_at: string
          default_duration_months: number
          deliverables: Json | null
          description: string | null
          discovery_questions: Json | null
          frequency: string | null
          has_faq: boolean
          has_one_pager: boolean
          has_outcomes: boolean
          has_sow: boolean
          has_testimonials: boolean
          hourly_rate_external: number | null
          hourly_rate_internal: number | null
          id: string
          ideal_for: string | null
          internal_notes: string | null
          max_duration_months: number | null
          max_fixed: number | null
          max_hourly: number | null
          max_retainer: number | null
          min_duration_months: number | null
          min_fixed: number | null
          min_hourly: number | null
          min_retainer: number | null
          min_term_months: number | null
          name: string
          not_included: string | null
          onboarding_cost: string | null
          phase: string | null
          phase_eligible: boolean
          pillar: string | null
          priority: string | null
          proposal_language: string | null
          roadmap_grade: boolean
          short_description: string | null
          sku: number | null
          sort_order: number
          teams_involved: string | null
          type_of_engagement: string | null
          typical_team: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean
          avg_duration_high_weeks?: number | null
          avg_duration_low_weeks?: number | null
          billing_type?: string | null
          case_study_url?: string | null
          category?: string | null
          created_at?: string
          default_duration_months?: number
          deliverables?: Json | null
          description?: string | null
          discovery_questions?: Json | null
          frequency?: string | null
          has_faq?: boolean
          has_one_pager?: boolean
          has_outcomes?: boolean
          has_sow?: boolean
          has_testimonials?: boolean
          hourly_rate_external?: number | null
          hourly_rate_internal?: number | null
          id?: string
          ideal_for?: string | null
          internal_notes?: string | null
          max_duration_months?: number | null
          max_fixed?: number | null
          max_hourly?: number | null
          max_retainer?: number | null
          min_duration_months?: number | null
          min_fixed?: number | null
          min_hourly?: number | null
          min_retainer?: number | null
          min_term_months?: number | null
          name: string
          not_included?: string | null
          onboarding_cost?: string | null
          phase?: string | null
          phase_eligible?: boolean
          pillar?: string | null
          priority?: string | null
          proposal_language?: string | null
          roadmap_grade?: boolean
          short_description?: string | null
          sku?: number | null
          sort_order?: number
          teams_involved?: string | null
          type_of_engagement?: string | null
          typical_team?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean
          avg_duration_high_weeks?: number | null
          avg_duration_low_weeks?: number | null
          billing_type?: string | null
          case_study_url?: string | null
          category?: string | null
          created_at?: string
          default_duration_months?: number
          deliverables?: Json | null
          description?: string | null
          discovery_questions?: Json | null
          frequency?: string | null
          has_faq?: boolean
          has_one_pager?: boolean
          has_outcomes?: boolean
          has_sow?: boolean
          has_testimonials?: boolean
          hourly_rate_external?: number | null
          hourly_rate_internal?: number | null
          id?: string
          ideal_for?: string | null
          internal_notes?: string | null
          max_duration_months?: number | null
          max_fixed?: number | null
          max_hourly?: number | null
          max_retainer?: number | null
          min_duration_months?: number | null
          min_fixed?: number | null
          min_hourly?: number | null
          min_retainer?: number | null
          min_term_months?: number | null
          name?: string
          not_included?: string | null
          onboarding_cost?: string | null
          phase?: string | null
          phase_eligible?: boolean
          pillar?: string | null
          priority?: string | null
          proposal_language?: string | null
          roadmap_grade?: boolean
          short_description?: string | null
          sku?: number | null
          sort_order?: number
          teams_involved?: string | null
          type_of_engagement?: string | null
          typical_team?: string | null
          user_id?: string | null
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
          integration_overrides: Json | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          integration_overrides?: Json | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          integration_overrides?: Json | null
          name?: string
          slug?: string
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
      user_settings: {
        Row: {
          about_me: Json | null
          created_at: string | null
          custom_instructions: string | null
          id: string
          location_data: Json | null
          my_role: string | null
          personal_bio: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          about_me?: Json | null
          created_at?: string | null
          custom_instructions?: string | null
          id?: string
          location_data?: Json | null
          my_role?: string | null
          personal_bio?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          about_me?: Json | null
          created_at?: string | null
          custom_instructions?: string | null
          id?: string
          location_data?: Json | null
          my_role?: string | null
          personal_bio?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wishlist_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          source: string | null
          uploaded_by: string | null
          wishlist_item_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          source?: string | null
          uploaded_by?: string | null
          wishlist_item_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          source?: string | null
          uploaded_by?: string | null
          wishlist_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_attachments_wishlist_item_id_fkey"
            columns: ["wishlist_item_id"]
            isOneToOne: false
            referencedRelation: "wishlist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          user_id: string | null
          wishlist_item_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          user_id?: string | null
          wishlist_item_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          user_id?: string | null
          wishlist_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_comments_wishlist_item_id_fkey"
            columns: ["wishlist_item_id"]
            isOneToOne: false
            referencedRelation: "wishlist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          category: string
          cover_image_url: string | null
          created_at: string
          description: string | null
          effort_estimate: string | null
          element_selector: string | null
          id: string
          page_url: string | null
          priority: string
          source: string | null
          status: string
          submitted_by: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          effort_estimate?: string | null
          element_selector?: string | null
          id?: string
          page_url?: string | null
          priority?: string
          source?: string | null
          status?: string
          submitted_by?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          effort_estimate?: string | null
          element_selector?: string | null
          id?: string
          page_url?: string | null
          priority?: string
          source?: string | null
          status?: string
          submitted_by?: string | null
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
      get_usage_summary: {
        Args: { p_end_date: string; p_start_date: string; p_user_id?: string }
        Returns: {
          day: string
          edge_function: string
          error_count: number
          model: string
          provider: string
          sum_completion_tokens: number
          sum_duration_ms: number
          sum_prompt_tokens: number
          sum_total_tokens: number
          total_calls: number
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
      match_knowledge_chunks_hybrid: {
        Args: {
          p_embedding: string
          p_match_count?: number
          p_match_threshold?: number
          p_query: string
          p_rrf_k?: number
          p_session_id: string
          p_text_weight?: number
          p_vector_weight?: number
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
      match_knowledge_chunks_hybrid_by_source: {
        Args: {
          p_embedding: string
          p_match_count?: number
          p_match_threshold?: number
          p_query: string
          p_rrf_k?: number
          p_session_id: string
          p_source_types: string[]
          p_text_weight?: number
          p_vector_weight?: number
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
      match_knowledge_chunks_hybrid_multi: {
        Args: {
          p_embedding: string
          p_match_count?: number
          p_match_threshold?: number
          p_query: string
          p_rrf_k?: number
          p_session_ids: string[]
          p_text_weight?: number
          p_vector_weight?: number
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
      owns_roadmap: { Args: { _roadmap_id: string }; Returns: boolean }
      slugify: { Args: { "": string }; Returns: string }
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
