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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_categories: {
        Row: {
          areas: Database["public"]["Enums"]["level_area"][]
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          areas?: Database["public"]["Enums"]["level_area"][]
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          areas?: Database["public"]["Enums"]["level_area"][]
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      activity_time_tracking: {
        Row: {
          actual_end_time: string | null
          actual_start_time: string | null
          budget_item_id: string
          created_at: string
          google_event_id: string | null
          google_event_title: string | null
          id: string
          is_recurring: boolean | null
          notes: string | null
          recurrence_count: number | null
          recurrence_end_date: string | null
          recurrence_parent_id: string | null
          recurrence_type: string | null
          scheduled_date: string | null
          scheduled_end_time: string | null
          scheduled_start_time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          budget_item_id: string
          created_at?: string
          google_event_id?: string | null
          google_event_title?: string | null
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          recurrence_count?: number | null
          recurrence_end_date?: string | null
          recurrence_parent_id?: string | null
          recurrence_type?: string | null
          scheduled_date?: string | null
          scheduled_end_time?: string | null
          scheduled_start_time?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          budget_item_id?: string
          created_at?: string
          google_event_id?: string | null
          google_event_title?: string | null
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          recurrence_count?: number | null
          recurrence_end_date?: string | null
          recurrence_parent_id?: string | null
          recurrence_type?: string | null
          scheduled_date?: string | null
          scheduled_end_time?: string | null
          scheduled_start_time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_time_tracking_budget_item_id_fkey"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_time_tracking_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "activity_time_tracking"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      budget_audit_log: {
        Row: {
          action: string
          budget_id: string
          created_at: string
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          user_id: string
        }
        Insert: {
          action: string
          budget_id: string
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id: string
        }
        Update: {
          action?: string
          budget_id?: string
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_audit_log_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          activity_name: string
          assignee_id: string | null
          assignee_name: string | null
          budget_id: string | null
          category: string
          created_at: string
          created_from: string | null
          display_order: number
          duration_days: number | null
          hourly_rate: number
          hours_worked: number
          id: string
          is_custom_activity: boolean | null
          is_product: boolean | null
          parent_id: string | null
          payment_terms: string | null
          product_id: string | null
          project_id: string | null
          start_day_offset: number | null
          total_cost: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          activity_name: string
          assignee_id?: string | null
          assignee_name?: string | null
          budget_id?: string | null
          category: string
          created_at?: string
          created_from?: string | null
          display_order: number
          duration_days?: number | null
          hourly_rate: number
          hours_worked: number
          id?: string
          is_custom_activity?: boolean | null
          is_product?: boolean | null
          parent_id?: string | null
          payment_terms?: string | null
          product_id?: string | null
          project_id?: string | null
          start_day_offset?: number | null
          total_cost: number
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          activity_name?: string
          assignee_id?: string | null
          assignee_name?: string | null
          budget_id?: string | null
          category?: string
          created_at?: string
          created_from?: string | null
          display_order?: number
          duration_days?: number | null
          hourly_rate?: number
          hours_worked?: number
          id?: string
          is_custom_activity?: boolean | null
          is_product?: boolean | null
          parent_id?: string | null
          payment_terms?: string | null
          product_id?: string | null
          project_id?: string | null
          start_day_offset?: number | null
          total_cost?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items_audit_log: {
        Row: {
          action: string
          budget_id: string | null
          budget_item_id: string
          created_at: string
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          project_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          budget_id?: string | null
          budget_item_id: string
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          project_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          budget_id?: string | null
          budget_item_id?: string
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          project_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      budget_services: {
        Row: {
          budget_id: string
          created_at: string
          id: string
          service_id: string
        }
        Insert: {
          budget_id: string
          created_at?: string
          id?: string
          service_id: string
        }
        Update: {
          budget_id?: string
          created_at?: string
          id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_services_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_templates: {
        Row: {
          created_at: string
          description: string | null
          discipline: Database["public"]["Enums"]["discipline"]
          id: string
          name: string
          template_data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discipline: Database["public"]["Enums"]["discipline"]
          id?: string
          name: string
          template_data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discipline?: Database["public"]["Enums"]["discipline"]
          id?: string
          name?: string
          template_data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          account_user_id: string | null
          area: string | null
          assigned_user_id: string | null
          brief_link: string | null
          budget_template_id: string | null
          client_contact_id: string | null
          client_id: string | null
          created_at: string
          description: string | null
          discipline: Database["public"]["Enums"]["discipline"] | null
          discount_percentage: number | null
          drive_folder_id: string | null
          drive_folder_name: string | null
          expected_close_date: string | null
          id: string
          margin_percentage: number | null
          name: string
          objective: string | null
          payment_terms: string | null
          project_id: string | null
          project_type: string
          secondary_objective: string | null
          status: Database["public"]["Enums"]["budget_status"]
          status_changed_at: string | null
          total_budget: number | null
          total_hours: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_user_id?: string | null
          area?: string | null
          assigned_user_id?: string | null
          brief_link?: string | null
          budget_template_id?: string | null
          client_contact_id?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          discipline?: Database["public"]["Enums"]["discipline"] | null
          discount_percentage?: number | null
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          expected_close_date?: string | null
          id?: string
          margin_percentage?: number | null
          name: string
          objective?: string | null
          payment_terms?: string | null
          project_id?: string | null
          project_type?: string
          secondary_objective?: string | null
          status?: Database["public"]["Enums"]["budget_status"]
          status_changed_at?: string | null
          total_budget?: number | null
          total_hours?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_user_id?: string | null
          area?: string | null
          assigned_user_id?: string | null
          brief_link?: string | null
          budget_template_id?: string | null
          client_contact_id?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          discipline?: Database["public"]["Enums"]["discipline"] | null
          discount_percentage?: number | null
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          expected_close_date?: string | null
          id?: string
          margin_percentage?: number | null
          name?: string
          objective?: string | null
          payment_terms?: string | null
          project_id?: string | null
          project_type?: string
          secondary_objective?: string | null
          status?: Database["public"]["Enums"]["budget_status"]
          status_changed_at?: string | null
          total_budget?: number | null
          total_hours?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_budget_template_id_fkey"
            columns: ["budget_template_id"]
            isOneToOne: false
            referencedRelation: "budget_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_client_contact_id_fkey"
            columns: ["client_contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      changelog: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          title: string
          version: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          title: string
          version?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          title?: string
          version?: string | null
        }
        Relationships: []
      }
      client_contact_clients: {
        Row: {
          client_id: string | null
          contact_id: string
          created_at: string
          id: string
          is_primary: boolean
        }
        Insert: {
          client_id?: string | null
          contact_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
        }
        Update: {
          client_id?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "client_contact_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contact_clients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_primary: boolean
          last_name: string
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_primary?: boolean
          last_name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_primary?: boolean
          last_name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payment_splits: {
        Row: {
          client_id: string
          created_at: string
          display_order: number | null
          id: string
          payment_mode_id: string
          payment_term_id: string | null
          percentage: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          display_order?: number | null
          id?: string
          payment_mode_id: string
          payment_term_id?: string | null
          percentage: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          display_order?: number | null
          id?: string
          payment_mode_id?: string
          payment_term_id?: string | null
          percentage?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_payment_splits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_payment_splits_payment_mode_id_fkey"
            columns: ["payment_mode_id"]
            isOneToOne: false
            referencedRelation: "payment_modes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_payment_splits_payment_term_id_fkey"
            columns: ["payment_term_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_user_id: string | null
          created_at: string
          default_payment_terms: string | null
          drive_folder_id: string | null
          drive_folder_name: string | null
          email: string | null
          fic_id: number | null
          hubspot_id: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          strategic_level: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_user_id?: string | null
          created_at?: string
          default_payment_terms?: string | null
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          email?: string | null
          fic_id?: number | null
          hubspot_id?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          strategic_level?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_user_id?: string | null
          created_at?: string
          default_payment_terms?: string | null
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          email?: string | null
          fic_id?: number | null
          hubspot_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          strategic_level?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      discipline_area_mappings: {
        Row: {
          areas: string[]
          created_at: string
          discipline: string
          id: string
          updated_at: string
        }
        Insert: {
          areas?: string[]
          created_at?: string
          discipline: string
          id?: string
          updated_at?: string
        }
        Update: {
          areas?: string[]
          created_at?: string
          discipline?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      external_project_access: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_project_access_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      external_visible_users: {
        Row: {
          created_at: string
          external_user_id: string
          granted_by: string | null
          id: string
          visible_user_id: string
        }
        Insert: {
          created_at?: string
          external_user_id: string
          granted_by?: string | null
          id?: string
          visible_user_id: string
        }
        Update: {
          created_at?: string
          external_user_id?: string
          granted_by?: string | null
          id?: string
          visible_user_id?: string
        }
        Relationships: []
      }
      fic_oauth_tokens: {
        Row: {
          access_token: string
          company_id: number
          company_name: string | null
          created_at: string
          id: string
          refresh_token: string
          token_expiry: string
          updated_at: string
        }
        Insert: {
          access_token: string
          company_id: number
          company_name?: string | null
          created_at?: string
          id?: string
          refresh_token: string
          token_expiry: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          company_id?: number
          company_name?: string | null
          created_at?: string
          id?: string
          refresh_token?: string
          token_expiry?: string
          updated_at?: string
        }
        Relationships: []
      }
      help_feedback: {
        Row: {
          comment: string | null
          context: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          helpful: boolean
          id: string
          query: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          context?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          helpful: boolean
          id?: string
          query?: string | null
          source: string
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          context?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          helpful?: boolean
          id?: string
          query?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      hubspot_field_mappings: {
        Row: {
          created_at: string
          entity_type: string
          hubspot_field: string
          hubspot_field_label: string | null
          id: string
          is_active: boolean
          local_field: string
          local_field_label: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          hubspot_field: string
          hubspot_field_label?: string | null
          id?: string
          is_active?: boolean
          local_field: string
          local_field_label?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          hubspot_field?: string
          hubspot_field_label?: string | null
          id?: string
          is_active?: boolean
          local_field?: string
          local_field_label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      hubspot_owner_mappings: {
        Row: {
          created_at: string
          hubspot_owner_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hubspot_owner_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hubspot_owner_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      levels: {
        Row: {
          areas: Database["public"]["Enums"]["level_area"][]
          created_at: string
          hourly_rate: number
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          areas?: Database["public"]["Enums"]["level_area"][]
          created_at?: string
          hourly_rate: number
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          areas?: Database["public"]["Enums"]["level_area"][]
          created_at?: string
          hourly_rate?: number
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          notification_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          notification_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          notification_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          project_id: string | null
          read: boolean
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          project_id?: string | null
          read?: boolean
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          project_id?: string | null
          read?: boolean
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_modes: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean | null
          label: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          label: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          label?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      payment_terms: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          label: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          label: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          label?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      performance_objectives: {
        Row: {
          bonus_percentage: number | null
          created_at: string
          description: string | null
          id: string
          review_id: string
          sort_order: number | null
          title: string
          updated_at: string
        }
        Insert: {
          bonus_percentage?: number | null
          created_at?: string
          description?: string | null
          id?: string
          review_id: string
          sort_order?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          bonus_percentage?: number | null
          created_at?: string
          description?: string | null
          id?: string
          review_id?: string
          sort_order?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_objectives_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "performance_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_profiles: {
        Row: {
          career_long_term_goal: string | null
          career_target_role: string | null
          company_support: string | null
          compensation: string | null
          contract_history: string | null
          contract_type: string | null
          created_at: string
          id: string
          job_title: string | null
          start_date: string | null
          team: string | null
          team_leader_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          career_long_term_goal?: string | null
          career_target_role?: string | null
          company_support?: string | null
          compensation?: string | null
          contract_history?: string | null
          contract_type?: string | null
          created_at?: string
          id?: string
          job_title?: string | null
          start_date?: string | null
          team?: string | null
          team_leader_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          career_long_term_goal?: string | null
          career_target_role?: string | null
          company_support?: string | null
          compensation?: string | null
          contract_history?: string | null
          contract_type?: string | null
          created_at?: string
          id?: string
          job_title?: string | null
          start_date?: string | null
          team?: string | null
          team_leader_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_quarterly_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          quarter: string
          review_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          quarter: string
          review_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          quarter?: string
          review_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_quarterly_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_quarterly_notes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "performance_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reviews: {
        Row: {
          career_long_term_goal: string | null
          career_target_role: string | null
          company_support: string | null
          compensation: string | null
          compilation_period: string | null
          compiled_by: string | null
          contract_history: string | null
          contract_type: string | null
          created_at: string
          id: string
          improvement_areas: string | null
          job_title: string | null
          start_date: string | null
          strengths: string | null
          team: string | null
          team_leader_name: string | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          career_long_term_goal?: string | null
          career_target_role?: string | null
          company_support?: string | null
          compensation?: string | null
          compilation_period?: string | null
          compiled_by?: string | null
          contract_history?: string | null
          contract_type?: string | null
          created_at?: string
          id?: string
          improvement_areas?: string | null
          job_title?: string | null
          start_date?: string | null
          strengths?: string | null
          team?: string | null
          team_leader_name?: string | null
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          career_long_term_goal?: string | null
          career_target_role?: string | null
          company_support?: string | null
          compensation?: string | null
          compilation_period?: string | null
          compiled_by?: string | null
          contract_history?: string | null
          contract_type?: string | null
          created_at?: string
          id?: string
          improvement_areas?: string | null
          job_title?: string | null
          start_date?: string | null
          strengths?: string | null
          team?: string | null
          team_leader_name?: string | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_compiled_by_fkey"
            columns: ["compiled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_payment_splits: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          payment_mode_id: string
          payment_term_id: string | null
          percentage: number
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          payment_mode_id: string
          payment_term_id?: string | null
          percentage: number
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          payment_mode_id?: string
          payment_term_id?: string | null
          percentage?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_payment_splits_payment_mode_id_fkey"
            columns: ["payment_mode_id"]
            isOneToOne: false
            referencedRelation: "payment_modes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_payment_splits_payment_term_id_fkey"
            columns: ["payment_term_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_payment_splits_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_service_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_service_subcategories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_service_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          code: string
          created_at: string
          description: string | null
          gross_price: number
          id: string
          name: string
          net_price: number
          payment_terms: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          description?: string | null
          gross_price: number
          id?: string
          name: string
          net_price: number
          payment_terms?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description?: string | null
          gross_price?: number
          id?: string
          name?: string
          net_price?: number
          payment_terms?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean | null
          area: string | null
          avatar_url: string | null
          contract_hours: number | null
          contract_hours_period:
            | Database["public"]["Enums"]["contract_hours_period"]
            | null
          contract_type: Database["public"]["Enums"]["contract_type"] | null
          created_at: string
          deleted_at: string | null
          email: string | null
          first_name: string | null
          full_name: string | null
          hourly_rate: number | null
          id: string
          last_name: string | null
          level_id: string | null
          target_productivity_percentage: number | null
          title: string | null
          updated_at: string
        }
        Insert: {
          approved?: boolean | null
          area?: string | null
          avatar_url?: string | null
          contract_hours?: number | null
          contract_hours_period?:
            | Database["public"]["Enums"]["contract_hours_period"]
            | null
          contract_type?: Database["public"]["Enums"]["contract_type"] | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          hourly_rate?: number | null
          id: string
          last_name?: string | null
          level_id?: string | null
          target_productivity_percentage?: number | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          approved?: boolean | null
          area?: string | null
          avatar_url?: string | null
          contract_hours?: number | null
          contract_hours_period?:
            | Database["public"]["Enums"]["contract_hours_period"]
            | null
          contract_type?: Database["public"]["Enums"]["contract_type"] | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          hourly_rate?: number | null
          id?: string
          last_name?: string | null
          level_id?: string | null
          target_productivity_percentage?: number | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      project_additional_costs: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          name: string
          project_id: string
          supplier_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_id: string
          supplier_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          supplier_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_additional_costs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_additional_costs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      project_audit_log: {
        Row: {
          action: string
          created_at: string
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          project_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          project_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_project_audit_log_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_decisions: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          project_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          project_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          project_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_decisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_progress_updates: {
        Row: {
          created_at: string
          id: string
          progress_value: number
          project_id: string
          roadblocks_text: string | null
          update_text: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          progress_value: number
          project_id: string
          roadblocks_text?: string | null
          update_text?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          progress_value?: number
          project_id?: string
          roadblocks_text?: string | null
          update_text?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_progress_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_services: {
        Row: {
          created_at: string
          id: string
          project_id: string
          service_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          service_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_services_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      project_timesheet_adjustments: {
        Row: {
          adjustment_type: string
          created_at: string | null
          id: string
          percentage: number
          project_id: string
          target_id: string
          updated_at: string | null
        }
        Insert: {
          adjustment_type: string
          created_at?: string | null
          id?: string
          percentage?: number
          project_id: string
          target_id: string
          updated_at?: string | null
        }
        Update: {
          adjustment_type?: string
          created_at?: string | null
          id?: string
          percentage?: number
          project_id?: string
          target_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_timesheet_adjustments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_update_drafts: {
        Row: {
          created_at: string
          draft_content: string
          generated_from: string
          id: string
          project_id: string
          published_progress_update_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slack_messages_count: number | null
          status: string
          week_start: string
        }
        Insert: {
          created_at?: string
          draft_content: string
          generated_from?: string
          id?: string
          project_id: string
          published_progress_update_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slack_messages_count?: number | null
          status?: string
          week_start: string
        }
        Update: {
          created_at?: string
          draft_content?: string
          generated_from?: string
          id?: string
          project_id?: string
          published_progress_update_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slack_messages_count?: number | null
          status?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_update_drafts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_update_drafts_published_progress_update_id_fkey"
            columns: ["published_progress_update_id"]
            isOneToOne: false
            referencedRelation: "project_progress_updates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_update_drafts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          account_user_id: string | null
          area: string | null
          assigned_user_id: string | null
          billing_type: string | null
          brief_link: string | null
          budget_template_id: string | null
          client_contact_id: string | null
          client_id: string | null
          created_at: string
          description: string | null
          discipline: Database["public"]["Enums"]["discipline"] | null
          discount_percentage: number | null
          drive_folder_id: string | null
          drive_folder_name: string | null
          end_date: string | null
          id: string
          is_billable: boolean | null
          manual_activities_budget: number | null
          manual_quote_number: string | null
          margin_percentage: number | null
          name: string
          objective: string | null
          payment_terms: string | null
          progress: number | null
          project_leader_id: string | null
          project_status: Database["public"]["Enums"]["project_status"] | null
          project_type: string
          projection_critical_threshold: number | null
          projection_warning_threshold: number | null
          secondary_objective: string | null
          slack_channel_id: string | null
          slack_channel_name: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["budget_status"]
          status_changed_at: string | null
          timesheet_share_token: string | null
          timesheet_token_created_at: string | null
          timesheet_token_expiry_days: number | null
          total_budget: number | null
          total_hours: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_user_id?: string | null
          area?: string | null
          assigned_user_id?: string | null
          billing_type?: string | null
          brief_link?: string | null
          budget_template_id?: string | null
          client_contact_id?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          discipline?: Database["public"]["Enums"]["discipline"] | null
          discount_percentage?: number | null
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          end_date?: string | null
          id?: string
          is_billable?: boolean | null
          manual_activities_budget?: number | null
          manual_quote_number?: string | null
          margin_percentage?: number | null
          name: string
          objective?: string | null
          payment_terms?: string | null
          progress?: number | null
          project_leader_id?: string | null
          project_status?: Database["public"]["Enums"]["project_status"] | null
          project_type: string
          projection_critical_threshold?: number | null
          projection_warning_threshold?: number | null
          secondary_objective?: string | null
          slack_channel_id?: string | null
          slack_channel_name?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["budget_status"]
          status_changed_at?: string | null
          timesheet_share_token?: string | null
          timesheet_token_created_at?: string | null
          timesheet_token_expiry_days?: number | null
          total_budget?: number | null
          total_hours?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_user_id?: string | null
          area?: string | null
          assigned_user_id?: string | null
          billing_type?: string | null
          brief_link?: string | null
          budget_template_id?: string | null
          client_contact_id?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          discipline?: Database["public"]["Enums"]["discipline"] | null
          discount_percentage?: number | null
          drive_folder_id?: string | null
          drive_folder_name?: string | null
          end_date?: string | null
          id?: string
          is_billable?: boolean | null
          manual_activities_budget?: number | null
          manual_quote_number?: string | null
          margin_percentage?: number | null
          name?: string
          objective?: string | null
          payment_terms?: string | null
          progress?: number | null
          project_leader_id?: string | null
          project_status?: Database["public"]["Enums"]["project_status"] | null
          project_type?: string
          projection_critical_threshold?: number | null
          projection_warning_threshold?: number | null
          secondary_objective?: string | null
          slack_channel_id?: string | null
          slack_channel_name?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["budget_status"]
          status_changed_at?: string | null
          timesheet_share_token?: string | null
          timesheet_token_created_at?: string | null
          timesheet_token_expiry_days?: number | null
          total_budget?: number | null
          total_hours?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_budget_template_id_fkey"
            columns: ["budget_template_id"]
            isOneToOne: false
            referencedRelation: "budget_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_contact_id_fkey"
            columns: ["client_contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_budgets: {
        Row: {
          budget_id: string
          created_at: string
          id: string
          quote_id: string
        }
        Insert: {
          budget_id: string
          created_at?: string
          id?: string
          quote_id: string
        }
        Update: {
          budget_id?: string
          created_at?: string
          id?: string
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_budgets_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_budgets_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_payment_splits: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          payment_mode_id: string
          payment_term_id: string | null
          percentage: number
          quote_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          payment_mode_id: string
          payment_term_id?: string | null
          percentage: number
          quote_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          payment_mode_id?: string
          payment_term_id?: string | null
          percentage?: number
          quote_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_payment_splits_payment_mode_id_fkey"
            columns: ["payment_mode_id"]
            isOneToOne: false
            referencedRelation: "payment_modes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_payment_splits_payment_term_id_fkey"
            columns: ["payment_term_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_payment_splits_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          budget_id: string | null
          created_at: string
          discount_percentage: number | null
          discounted_total: number
          fic_document_id: number | null
          generated_at: string
          id: string
          margin_percentage: number | null
          project_id: string | null
          quote_number: string
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_id?: string | null
          created_at?: string
          discount_percentage?: number | null
          discounted_total?: number
          fic_document_id?: number | null
          generated_at?: string
          id?: string
          margin_percentage?: number | null
          project_id?: string | null
          quote_number: string
          status?: string
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_id?: string | null
          created_at?: string
          discount_percentage?: number | null
          discounted_total?: number
          fic_document_id?: number | null
          generated_at?: string
          id?: string
          margin_percentage?: number | null
          project_id?: string | null
          quote_number?: string
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_access_settings: boolean
          can_change_project_status: boolean
          can_create_projects: boolean
          can_create_quotes: boolean
          can_delete_projects: boolean
          can_delete_quotes: boolean
          can_download_quotes: boolean
          can_edit_budget: boolean
          can_edit_financial_fields: boolean
          can_edit_projects: boolean
          can_edit_quotes: boolean
          can_manage_categories: boolean
          can_manage_clients: boolean
          can_manage_levels: boolean
          can_manage_products: boolean
          can_manage_services: boolean
          can_manage_templates: boolean
          can_manage_users: boolean
          can_view_all_projects: boolean
          created_at: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          can_access_settings?: boolean
          can_change_project_status?: boolean
          can_create_projects?: boolean
          can_create_quotes?: boolean
          can_delete_projects?: boolean
          can_delete_quotes?: boolean
          can_download_quotes?: boolean
          can_edit_budget?: boolean
          can_edit_financial_fields?: boolean
          can_edit_projects?: boolean
          can_edit_quotes?: boolean
          can_manage_categories?: boolean
          can_manage_clients?: boolean
          can_manage_levels?: boolean
          can_manage_products?: boolean
          can_manage_services?: boolean
          can_manage_templates?: boolean
          can_manage_users?: boolean
          can_view_all_projects?: boolean
          created_at?: string
          id?: string
          role: string
          updated_at?: string
        }
        Update: {
          can_access_settings?: boolean
          can_change_project_status?: boolean
          can_create_projects?: boolean
          can_create_quotes?: boolean
          can_delete_projects?: boolean
          can_delete_quotes?: boolean
          can_download_quotes?: boolean
          can_edit_budget?: boolean
          can_edit_financial_fields?: boolean
          can_edit_projects?: boolean
          can_edit_quotes?: boolean
          can_manage_categories?: boolean
          can_manage_clients?: boolean
          can_manage_levels?: boolean
          can_manage_products?: boolean
          can_manage_services?: boolean
          can_manage_templates?: boolean
          can_manage_users?: boolean
          can_view_all_projects?: boolean
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_payment_splits: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          payment_mode_id: string
          payment_term_id: string | null
          percentage: number
          service_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          payment_mode_id: string
          payment_term_id?: string | null
          percentage: number
          service_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          payment_mode_id?: string
          payment_term_id?: string | null
          percentage?: number
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_payment_splits_payment_mode_id_fkey"
            columns: ["payment_mode_id"]
            isOneToOne: false
            referencedRelation: "payment_modes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_payment_splits_payment_term_id_fkey"
            columns: ["payment_term_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_payment_splits_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          budget_template_id: string | null
          category: string
          code: string
          created_at: string
          description: string | null
          discipline: Database["public"]["Enums"]["discipline"] | null
          gross_price: number
          id: string
          name: string
          net_price: number
          payment_terms: string | null
          updated_at: string
          user_id: string
          vat_rate: number
        }
        Insert: {
          budget_template_id?: string | null
          category: string
          code: string
          created_at?: string
          description?: string | null
          discipline?: Database["public"]["Enums"]["discipline"] | null
          gross_price: number
          id?: string
          name: string
          net_price: number
          payment_terms?: string | null
          updated_at?: string
          user_id: string
          vat_rate?: number
        }
        Update: {
          budget_template_id?: string | null
          category?: string
          code?: string
          created_at?: string
          description?: string | null
          discipline?: Database["public"]["Enums"]["discipline"] | null
          gross_price?: number
          id?: string
          name?: string
          net_price?: number
          payment_terms?: string | null
          updated_at?: string
          user_id?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_budget_template_id_fkey"
            columns: ["budget_template_id"]
            isOneToOne: false
            referencedRelation: "budget_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          fic_id: number | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          fic_id?: number | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          fic_id?: number | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      team_leader_areas: {
        Row: {
          area: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          area: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          area?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_action_logs: {
        Row: {
          action_description: string
          action_type: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action_description: string
          action_type: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action_description?: string
          action_type?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      user_activity_completions: {
        Row: {
          budget_item_id: string
          completed_at: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          budget_item_id: string
          completed_at?: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          budget_item_id?: string
          completed_at?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_completions_budget_item_id_fkey"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_calendar_settings: {
        Row: {
          created_at: string
          default_slot_duration: number
          id: string
          number_of_days: number
          show_weekends: boolean
          timezone: string
          updated_at: string
          user_id: string
          week_starts_on: number
          work_day_end: string
          work_day_start: string
          zoom_level: number
        }
        Insert: {
          created_at?: string
          default_slot_duration?: number
          id?: string
          number_of_days?: number
          show_weekends?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
          week_starts_on?: number
          work_day_end?: string
          work_day_start?: string
          zoom_level?: number
        }
        Update: {
          created_at?: string
          default_slot_duration?: number
          id?: string
          number_of_days?: number
          show_weekends?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
          week_starts_on?: number
          work_day_end?: string
          work_day_start?: string
          zoom_level?: number
        }
        Relationships: []
      }
      user_contract_periods: {
        Row: {
          contract_hours: number
          contract_hours_period: string
          contract_type: string
          created_at: string
          end_date: string | null
          hourly_rate: number
          id: string
          start_date: string
          target_productivity_percentage: number
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_hours?: number
          contract_hours_period?: string
          contract_type?: string
          created_at?: string
          end_date?: string | null
          hourly_rate?: number
          id?: string
          start_date: string
          target_productivity_percentage?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_hours?: number
          contract_hours_period?: string
          contract_type?: string
          created_at?: string
          end_date?: string | null
          hourly_rate?: number
          id?: string
          start_date?: string
          target_productivity_percentage?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_google_tokens: {
        Row: {
          access_token: string
          created_at: string
          id: string
          refresh_token: string
          selected_calendars: string[] | null
          token_expiry: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          refresh_token: string
          selected_calendars?: string[] | null
          token_expiry: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          refresh_token?: string
          selected_calendars?: string[] | null
          token_expiry?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_hours_adjustments: {
        Row: {
          adjustment_hours: number
          created_at: string
          created_by: string
          id: string
          month: string
          reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adjustment_hours?: number
          created_at?: string
          created_by: string
          id?: string
          month: string
          reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adjustment_hours?: number
          created_at?: string
          created_by?: string
          id?: string
          month?: string
          reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_hours_carryover: {
        Row: {
          carryover_hours: number
          created_at: string
          created_by: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          carryover_hours?: number
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          carryover_hours?: number
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workflow_flow_tasks: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          depends_on_task_id: string | null
          description: string | null
          display_order: number
          due_date: string | null
          flow_id: string
          id: string
          is_completed: boolean
          task_template_id: string | null
          title: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          depends_on_task_id?: string | null
          description?: string | null
          display_order?: number
          due_date?: string | null
          flow_id: string
          id?: string
          is_completed?: boolean
          task_template_id?: string | null
          title: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          depends_on_task_id?: string | null
          description?: string | null
          display_order?: number
          due_date?: string | null
          flow_id?: string
          id?: string
          is_completed?: boolean
          task_template_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_flow_tasks_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "workflow_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_flow_tasks_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "workflow_task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_flows: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          custom_name: string
          id: string
          owner_id: string
          template_id: string | null
          template_name: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          custom_name: string
          id?: string
          owner_id: string
          template_id?: string | null
          template_name: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          custom_name?: string
          id?: string
          owner_id?: string
          template_id?: string | null
          template_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_flows_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "workflow_flow_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_task_templates: {
        Row: {
          created_at: string
          depends_on_task_id: string | null
          description: string | null
          display_order: number
          id: string
          template_id: string
          title: string
        }
        Insert: {
          created_at?: string
          depends_on_task_id?: string | null
          description?: string | null
          display_order?: number
          id?: string
          template_id: string
          title: string
        }
        Update: {
          created_at?: string
          depends_on_task_id?: string | null
          description?: string | null
          display_order?: number
          id?: string
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_task_templates_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "workflow_task_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_task_templates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_action_logs: { Args: never; Returns: undefined }
      delete_user_completely: { Args: { _user_id: string }; Returns: undefined }
      execute_readonly_query: { Args: { query_text: string }; Returns: Json }
      get_profiles_by_roles: {
        Args: { role_filter: Database["public"]["Enums"]["app_role"][] }
        Returns: {
          email: string
          first_name: string
          id: string
          last_name: string
        }[]
      }
      get_user_email_preference: {
        Args: { p_notification_type: string; p_user_id: string }
        Returns: boolean
      }
      get_user_hourly_rate_at_date: {
        Args: { p_date?: string; p_user_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_approved_user: { Args: { _user_id: string }; Returns: boolean }
      is_editor_or_admin: { Args: { _user_id: string }; Returns: boolean }
      recalculate_all_pack_projects_progress: {
        Args: never
        Returns: {
          confirmed_hours: number
          new_progress: number
          old_progress: number
          planned_hours: number
          project_id: string
          project_name: string
        }[]
      }
      restore_user: { Args: { _user_id: string }; Returns: undefined }
      soft_delete_user: { Args: { _user_id: string }; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "account"
        | "finance"
        | "team_leader"
        | "coordinator"
        | "member"
        | "external"
      budget_status:
        | "in_attesa"
        | "approvato"
        | "rifiutato"
        | "bozza"
        | "in_revisione"
      contract_hours_period: "daily" | "weekly" | "monthly"
      contract_type: "full-time" | "part-time" | "freelance" | "consuntivo"
      discipline:
        | "content_creation_storytelling"
        | "paid_advertising_media_buying"
        | "website_landing_page_development"
        | "brand_identity_visual_design"
        | "social_media_management"
        | "email_marketing_automation"
        | "seo_content_optimization"
        | "crm_customer_data_platform"
        | "software_development_integration"
        | "ai_implementation_automation"
        | "strategic_consulting"
      level_area: "marketing" | "tech" | "branding" | "sales" | "interno" | "ai"
      project_status: "in_partenza" | "aperto" | "da_fatturare" | "completato"
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
      app_role: [
        "admin",
        "account",
        "finance",
        "team_leader",
        "coordinator",
        "member",
        "external",
      ],
      budget_status: [
        "in_attesa",
        "approvato",
        "rifiutato",
        "bozza",
        "in_revisione",
      ],
      contract_hours_period: ["daily", "weekly", "monthly"],
      contract_type: ["full-time", "part-time", "freelance", "consuntivo"],
      discipline: [
        "content_creation_storytelling",
        "paid_advertising_media_buying",
        "website_landing_page_development",
        "brand_identity_visual_design",
        "social_media_management",
        "email_marketing_automation",
        "seo_content_optimization",
        "crm_customer_data_platform",
        "software_development_integration",
        "ai_implementation_automation",
        "strategic_consulting",
      ],
      level_area: ["marketing", "tech", "branding", "sales", "interno", "ai"],
      project_status: ["in_partenza", "aperto", "da_fatturare", "completato"],
    },
  },
} as const
