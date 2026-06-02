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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_diary: {
        Row: {
          content: string | null
          created_at: string
          entry_date: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          address: string | null
          auth_user_id: string | null
          created_at: string
          id: string
          is_active: boolean
          login_id: string | null
          name: string
          phone: string | null
          type: Database["public"]["Enums"]["contact_type"]
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          auth_user_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          login_id?: string | null
          name: string
          phone?: string | null
          type: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          auth_user_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          login_id?: string | null
          name?: string
          phone?: string | null
          type?: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      entry_lookups: {
        Row: {
          created_at: string
          id: string
          kind: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      expense_categories: {
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
      expense_heads: {
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
            foreignKeyName: "expense_heads_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          expense_date: string
          head: string | null
          id: string
          owner_id: string | null
          updated_at: string
          vehicle_no: string | null
          vendor: string | null
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          description?: string | null
          expense_date?: string
          head?: string | null
          id?: string
          owner_id?: string | null
          updated_at?: string
          vehicle_no?: string | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          head?: string | null
          id?: string
          owner_id?: string | null
          updated_at?: string
          vehicle_no?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      other_incomes: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          head: string | null
          id: string
          income_date: string
          owner_id: string | null
          updated_at: string
          vehicle_no: string | null
          vendor: string | null
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          description?: string | null
          head?: string | null
          id?: string
          income_date?: string
          owner_id?: string | null
          updated_at?: string
          vehicle_no?: string | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          head?: string | null
          id?: string
          income_date?: string
          owner_id?: string | null
          updated_at?: string
          vehicle_no?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "other_incomes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          auth_user_id: string | null
          created_at: string
          id: string
          login_id: string | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          login_id?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          login_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          created_at: string
          dena_1: number
          dena_2: number
          fare_1: number
          fare_2: number
          id: string
          jama_1: number
          jama_2: number
          route_1: string | null
          route_2: string | null
          serial_no: number | null
          supervisor: string | null
          trip_date: string
          updated_at: string
          vehicle_no: string
        }
        Insert: {
          created_at?: string
          dena_1?: number
          dena_2?: number
          fare_1?: number
          fare_2?: number
          id?: string
          jama_1?: number
          jama_2?: number
          route_1?: string | null
          route_2?: string | null
          serial_no?: number | null
          supervisor?: string | null
          trip_date?: string
          updated_at?: string
          vehicle_no: string
        }
        Update: {
          created_at?: string
          dena_1?: number
          dena_2?: number
          fare_1?: number
          fare_2?: number
          id?: string
          jama_1?: number
          jama_2?: number
          route_1?: string | null
          route_2?: string | null
          serial_no?: number | null
          supervisor?: string | null
          trip_date?: string
          updated_at?: string
          vehicle_no?: string
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
      vehicle_routes: {
        Row: {
          created_at: string
          fare: number
          id: string
          name: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          fare?: number
          id?: string
          name: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          fare?: number
          id?: string
          name?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          owner_id: string | null
          owner_name: string | null
          shareholder_id: string | null
          updated_at: string
          vehicle_no: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          owner_name?: string | null
          shareholder_id?: string | null
          updated_at?: string
          vehicle_no: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          owner_name?: string | null
          shareholder_id?: string | null
          updated_at?: string
          vehicle_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_shareholder_id_fkey"
            columns: ["shareholder_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
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
      is_admin_or_moderator: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "shareholder"
      contact_type:
        | "individual"
        | "company"
        | "rental"
        | "vendor"
        | "owner"
        | "helper"
        | "partner"
        | "dada_bhai"
        | "mejho_bhai"
        | "choto_bhai"
        | "bordidi"
        | "mejhdidi"
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
      app_role: ["admin", "moderator", "shareholder"],
      contact_type: [
        "individual",
        "company",
        "rental",
        "vendor",
        "owner",
        "helper",
        "partner",
        "dada_bhai",
        "mejho_bhai",
        "choto_bhai",
        "bordidi",
        "mejhdidi",
      ],
    },
  },
} as const
