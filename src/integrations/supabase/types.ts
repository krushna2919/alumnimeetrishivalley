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
      admin_activity_logs: {
        Row: {
          action_type: string
          admin_email: string | null
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          target_application_id: string | null
          target_registration_id: string | null
        }
        Insert: {
          action_type: string
          admin_email?: string | null
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_application_id?: string | null
          target_registration_id?: string | null
        }
        Update: {
          action_type?: string
          admin_email?: string | null
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_application_id?: string | null
          target_registration_id?: string | null
        }
        Relationships: []
      }
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
      bed_assignments: {
        Row: {
          bed_number: number
          created_at: string
          id: string
          registration_id: string | null
          room_id: string
          updated_at: string
        }
        Insert: {
          bed_number: number
          created_at?: string
          id?: string
          registration_id?: string | null
          room_id: string
          updated_at?: string
        }
        Update: {
          bed_number?: number
          created_at?: string
          id?: string
          registration_id?: string | null
          room_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bed_assignments_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_assignments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "hostel_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      geofence_settings: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          latitude: number
          longitude: number
          radius_km: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          latitude: number
          longitude: number
          radius_km?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          latitude?: number
          longitude?: number
          radius_km?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      hostel_rooms: {
        Row: {
          beds_count: number
          created_at: string
          hostel_id: string
          id: string
          room_number: string
        }
        Insert: {
          beds_count?: number
          created_at?: string
          hostel_id: string
          id?: string
          room_number: string
        }
        Update: {
          beds_count?: number
          created_at?: string
          hostel_id?: string
          id?: string
          room_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "hostel_rooms_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
        ]
      }
      hostels: {
        Row: {
          beds_per_room: number
          created_at: string
          id: string
          name: string
          total_rooms: number
          updated_at: string
          washrooms: number
        }
        Insert: {
          beds_per_room?: number
          created_at?: string
          id?: string
          name: string
          total_rooms?: number
          updated_at?: string
          washrooms?: number
        }
        Update: {
          beds_per_room?: number
          created_at?: string
          id?: string
          name?: string
          total_rooms?: number
          updated_at?: string
          washrooms?: number
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
          accounts_verified: boolean
          accounts_verified_at: string | null
          accounts_verified_by: string | null
          address_line1: string
          address_line2: string | null
          application_id: string
          approval_email_sent: boolean | null
          approved_at: string | null
          approved_by: string | null
          board_type: string
          city: string
          confirmation_email_sent: boolean | null
          country: string
          created_at: string
          district: string
          email: string
          gender: string
          hostel_name: string | null
          id: string
          name: string
          occupation: string
          parent_application_id: string | null
          payment_date: string | null
          payment_proof_url: string | null
          payment_receipt_url: string | null
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
          accounts_verified?: boolean
          accounts_verified_at?: string | null
          accounts_verified_by?: string | null
          address_line1: string
          address_line2?: string | null
          application_id: string
          approval_email_sent?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          board_type?: string
          city: string
          confirmation_email_sent?: boolean | null
          country?: string
          created_at?: string
          district: string
          email: string
          gender: string
          hostel_name?: string | null
          id?: string
          name: string
          occupation: string
          parent_application_id?: string | null
          payment_date?: string | null
          payment_proof_url?: string | null
          payment_receipt_url?: string | null
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
          accounts_verified?: boolean
          accounts_verified_at?: string | null
          accounts_verified_by?: string | null
          address_line1?: string
          address_line2?: string | null
          application_id?: string
          approval_email_sent?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          board_type?: string
          city?: string
          confirmation_email_sent?: boolean | null
          country?: string
          created_at?: string
          district?: string
          email?: string
          gender?: string
          hostel_name?: string | null
          id?: string
          name?: string
          occupation?: string
          parent_application_id?: string | null
          payment_date?: string | null
          payment_proof_url?: string | null
          payment_receipt_url?: string | null
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
        Relationships: [
          {
            foreignKeyName: "registrations_parent_application_id_fkey"
            columns: ["parent_application_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["application_id"]
          },
        ]
      }
      user_device_sessions: {
        Row: {
          browser: string | null
          created_at: string
          device_info: Json
          device_type: string | null
          id: string
          ip_address: string | null
          last_active_at: string
          latitude: number | null
          location_city: string | null
          location_country: string | null
          location_region: string | null
          longitude: number | null
          os: string | null
          session_id: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_info?: Json
          device_type?: string | null
          id?: string
          ip_address?: string | null
          last_active_at?: string
          latitude?: number | null
          location_city?: string | null
          location_country?: string | null
          location_region?: string | null
          longitude?: number | null
          os?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_info?: Json
          device_type?: string | null
          id?: string
          ip_address?: string | null
          last_active_at?: string
          latitude?: number | null
          location_city?: string | null
          location_country?: string | null
          location_region?: string | null
          longitude?: number | null
          os?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string
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
      user_screen_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          screen_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          screen_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          screen_key?: string
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
      get_geofence_settings: {
        Args: never
        Returns: {
          is_enabled: boolean
          latitude: number
          longitude: number
          radius_km: number
        }[]
      }
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
      is_accounts_admin: { Args: { _user_id: string }; Returns: boolean }
      is_admin_or_superadmin: { Args: { _user_id: string }; Returns: boolean }
      is_registration_manager: { Args: { _user_id: string }; Returns: boolean }
      is_user_superadmin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "superadmin" | "admin" | "user" | "accounts_admin" | "reviewer"
      payment_status: "pending" | "submitted" | "verified" | "rejected"
      registration_status: "pending" | "approved" | "rejected" | "expired"
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
      app_role: ["superadmin", "admin", "user", "accounts_admin", "reviewer"],
      payment_status: ["pending", "submitted", "verified", "rejected"],
      registration_status: ["pending", "approved", "rejected", "expired"],
    },
  },
} as const
