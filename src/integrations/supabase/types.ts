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
      budget_items: {
        Row: {
          activity_name: string
          assignee_id: string | null
          assignee_name: string | null
          category: string
          created_at: string
          display_order: number
          hourly_rate: number
          hours_worked: number
          id: string
          is_custom_activity: boolean | null
          is_product: boolean | null
          product_id: string | null
          project_id: string
          total_cost: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          activity_name: string
          assignee_id?: string | null
          assignee_name?: string | null
          category: string
          created_at?: string
          display_order: number
          hourly_rate: number
          hours_worked: number
          id?: string
          is_custom_activity?: boolean | null
          is_product?: boolean | null
          product_id?: string | null
          project_id: string
          total_cost: number
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          activity_name?: string
          assignee_id?: string | null
          assignee_name?: string | null
          category?: string
          created_at?: string
          display_order?: number
          hourly_rate?: number
          hours_worked?: number
          id?: string
          is_custom_activity?: boolean | null
          is_product?: boolean | null
          product_id?: string | null
          project_id?: string
          total_cost?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
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
      clients: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
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
          avatar_url: string | null
          contract_hours: number | null
          contract_hours_period:
            | Database["public"]["Enums"]["contract_hours_period"]
            | null
          contract_type: Database["public"]["Enums"]["contract_type"] | null
          created_at: string
          email: string | null
          first_name: string | null
          full_name: string | null
          hourly_rate: number | null
          id: string
          last_name: string | null
          updated_at: string
        }
        Insert: {
          approved?: boolean | null
          avatar_url?: string | null
          contract_hours?: number | null
          contract_hours_period?:
            | Database["public"]["Enums"]["contract_hours_period"]
            | null
          contract_type?: Database["public"]["Enums"]["contract_type"] | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          hourly_rate?: number | null
          id: string
          last_name?: string | null
          updated_at?: string
        }
        Update: {
          approved?: boolean | null
          avatar_url?: string | null
          contract_hours?: number | null
          contract_hours_period?:
            | Database["public"]["Enums"]["contract_hours_period"]
            | null
          contract_type?: Database["public"]["Enums"]["contract_type"] | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          hourly_rate?: number | null
          id?: string
          last_name?: string | null
          updated_at?: string
        }
        Relationships: []
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
      projects: {
        Row: {
          account_user_id: string | null
          area: string | null
          brief_link: string | null
          budget_template_id: string | null
          client_id: string | null
          created_at: string
          description: string | null
          discipline: Database["public"]["Enums"]["discipline"] | null
          discount_percentage: number | null
          end_date: string | null
          id: string
          margin_percentage: number | null
          name: string
          objective: string | null
          payment_terms: string | null
          progress: number | null
          project_status: Database["public"]["Enums"]["project_status"] | null
          project_type: string
          start_date: string | null
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
          brief_link?: string | null
          budget_template_id?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          discipline?: Database["public"]["Enums"]["discipline"] | null
          discount_percentage?: number | null
          end_date?: string | null
          id?: string
          margin_percentage?: number | null
          name: string
          objective?: string | null
          payment_terms?: string | null
          progress?: number | null
          project_status?: Database["public"]["Enums"]["project_status"] | null
          project_type: string
          start_date?: string | null
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
          brief_link?: string | null
          budget_template_id?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          discipline?: Database["public"]["Enums"]["discipline"] | null
          discount_percentage?: number | null
          end_date?: string | null
          id?: string
          margin_percentage?: number | null
          name?: string
          objective?: string | null
          payment_terms?: string | null
          progress?: number | null
          project_status?: Database["public"]["Enums"]["project_status"] | null
          project_type?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["budget_status"]
          status_changed_at?: string | null
          total_budget?: number | null
          total_hours?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_account_user_id_fkey"
            columns: ["account_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_budget_template_id_fkey"
            columns: ["budget_template_id"]
            isOneToOne: false
            referencedRelation: "budget_templates"
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
      quotes: {
        Row: {
          created_at: string
          discount_percentage: number | null
          discounted_total: number
          generated_at: string
          id: string
          margin_percentage: number | null
          project_id: string
          quote_number: string
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discount_percentage?: number | null
          discounted_total?: number
          generated_at?: string
          id?: string
          margin_percentage?: number | null
          project_id: string
          quote_number: string
          status?: string
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          discount_percentage?: number | null
          discounted_total?: number
          generated_at?: string
          id?: string
          margin_percentage?: number | null
          project_id?: string
          quote_number?: string
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
    }
    Enums: {
      app_role: "admin" | "account" | "finance" | "team_leader" | "member"
      budget_status: "in_attesa" | "approvato" | "rifiutato"
      contract_hours_period: "daily" | "weekly" | "monthly"
      contract_type: "full-time" | "part-time" | "freelance"
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
      level_area: "marketing" | "tech" | "branding" | "sales"
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
      app_role: ["admin", "account", "finance", "team_leader", "member"],
      budget_status: ["in_attesa", "approvato", "rifiutato"],
      contract_hours_period: ["daily", "weekly", "monthly"],
      contract_type: ["full-time", "part-time", "freelance"],
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
      level_area: ["marketing", "tech", "branding", "sales"],
      project_status: ["in_partenza", "aperto", "da_fatturare", "completato"],
    },
  },
} as const
