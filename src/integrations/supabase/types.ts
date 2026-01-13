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
      batch_configuration: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_registration_open: boolean
          registration_end_date: string | null
          registration_start_date: string | null
          updated_at: string
          year_from: number
          year_to: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_registration_open?: boolean
          registration_end_date?: string | null
          registration_start_date?: string | null
          updated_at?: string
          year_from: number
          year_to: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_registration_open?: boolean
          registration_end_date?: string | null
          registration_start_date?: string | null
          updated_at?: string
          year_from?: number
          year_to?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          address_line1: string
          address_line2: string | null
          application_id: string
          approved_at: string | null
          approved_by: string | null
          city: string
          confirmation_email_sent: boolean | null
          country: string
          created_at: string
          district: string
          email: string
          gender: string
          id: string
          name: string
          occupation: string
          payment_date: string | null
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string
          postal_code: string
          qr_code_data: string | null
          registration_fee: number
          registration_status: Database["public"]["Enums"]["registration_status"]
          rejection_reason: string | null
          state: string
          stay_type: string
          tshirt_size: string
          updated_at: string
          year_of_passing: number
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          application_id: string
          approved_at?: string | null
          approved_by?: string | null
          city: string
          confirmation_email_sent?: boolean | null
          country?: string
          created_at?: string
          district: string
          email: string
          gender: string
          id?: string
          name: string
          occupation: string
          payment_date?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone: string
          postal_code: string
          qr_code_data?: string | null
          registration_fee: number
          registration_status?: Database["public"]["Enums"]["registration_status"]
          rejection_reason?: string | null
          state: string
          stay_type: string
          tshirt_size: string
          updated_at?: string
          year_of_passing: number
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          application_id?: string
          approved_at?: string | null
          approved_by?: string | null
          city?: string
          confirmation_email_sent?: boolean | null
          country?: string
          created_at?: string
          district?: string
          email?: string
          gender?: string
          id?: string
          name?: string
          occupation?: string
          payment_date?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string
          postal_code?: string
          qr_code_data?: string | null
          registration_fee?: number
          registration_status?: Database["public"]["Enums"]["registration_status"]
          rejection_reason?: string | null
          state?: string
          stay_type?: string
          tshirt_size?: string
          updated_at?: string
          year_of_passing?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          is_approved: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_approved?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_approved?: boolean
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
      generate_application_id: { Args: never; Returns: string }
      get_open_batch_configuration: {
        Args: never
        Returns: {
          is_registration_open: boolean
          registration_end_date: string
          registration_start_date: string
          year_from: number
          year_to: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_superadmin: { Args: { _user_id: string }; Returns: boolean }
      is_registration_manager: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "superadmin" | "admin" | "user"
      payment_status: "pending" | "submitted" | "verified" | "rejected"
      registration_status: "pending" | "approved" | "rejected"
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
      app_role: ["superadmin", "admin", "user"],
      payment_status: ["pending", "submitted", "verified", "rejected"],
      registration_status: ["pending", "approved", "rejected"],
    },
  },
} as const
