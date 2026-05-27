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
      contacts: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          type: Database["public"]["Enums"]["contact_type"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          type: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          type?: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          expense_date: string
          id: string
          updated_at: string
          vehicle_no: string | null
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          updated_at?: string
          vehicle_no?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          updated_at?: string
          vehicle_no?: string | null
        }
        Relationships: []
      }
      other_incomes: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          id: string
          income_date: string
          updated_at: string
          vehicle_no: string | null
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          income_date?: string
          updated_at?: string
          vehicle_no?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          income_date?: string
          updated_at?: string
          vehicle_no?: string | null
        }
        Relationships: []
      }
      transfers: {
        Row: {
          amount: number
          created_at: string
          from_party: string
          id: string
          notes: string | null
          to_party: string
          transfer_date: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          from_party: string
          id?: string
          notes?: string | null
          to_party: string
          transfer_date?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          from_party?: string
          id?: string
          notes?: string | null
          to_party?: string
          transfer_date?: string
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
          notes: string | null
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
          notes?: string | null
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
          notes?: string | null
          supervisor?: string | null
          trip_date?: string
          updated_at?: string
          vehicle_no?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          owner_name: string | null
          updated_at: string
          vehicle_no: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_name?: string | null
          updated_at?: string
          vehicle_no: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_name?: string | null
          updated_at?: string
          vehicle_no?: string
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
