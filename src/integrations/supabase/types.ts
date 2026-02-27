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
      courses: {
        Row: {
          academic_year: number
          created_at: string
          id: string
          orientation: string | null
          school_id: string
          speciality: string | null
          status: Database["public"]["Enums"]["course_status"]
          subject: string
          updated_at: string
          user_id: string
          year_level: number
        }
        Insert: {
          academic_year: number
          created_at?: string
          id?: string
          orientation?: string | null
          school_id: string
          speciality?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          subject: string
          updated_at?: string
          user_id: string
          year_level: number
        }
        Update: {
          academic_year?: number
          created_at?: string
          id?: string
          orientation?: string | null
          school_id?: string
          speciality?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          subject?: string
          updated_at?: string
          user_id?: string
          year_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "courses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_documents: {
        Row: {
          content_hash: string | null
          created_at: string
          cycle: Database["public"]["Enums"]["curriculum_cycle"]
          id: string
          official_url: string | null
          province: string
          status: Database["public"]["Enums"]["curriculum_status"]
          subject: string
          updated_at: string
          year_level: number
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          cycle: Database["public"]["Enums"]["curriculum_cycle"]
          id?: string
          official_url?: string | null
          province?: string
          status?: Database["public"]["Enums"]["curriculum_status"]
          subject: string
          updated_at?: string
          year_level: number
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          cycle?: Database["public"]["Enums"]["curriculum_cycle"]
          id?: string
          official_url?: string | null
          province?: string
          status?: Database["public"]["Enums"]["curriculum_status"]
          subject?: string
          updated_at?: string
          year_level?: number
        }
        Relationships: []
      }
      curriculum_nodes: {
        Row: {
          created_at: string
          curriculum_document_id: string
          id: string
          name: string
          node_type: Database["public"]["Enums"]["curriculum_node_type"]
          order_index: number
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          curriculum_document_id: string
          id?: string
          name: string
          node_type: Database["public"]["Enums"]["curriculum_node_type"]
          order_index?: number
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          curriculum_document_id?: string
          id?: string
          name?: string
          node_type?: Database["public"]["Enums"]["curriculum_node_type"]
          order_index?: number
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_nodes_curriculum_document_id_fkey"
            columns: ["curriculum_document_id"]
            isOneToOne: false
            referencedRelation: "curriculum_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "curriculum_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_shift_events: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          new_date: string | null
          previous_date: string | null
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          new_date?: string | null
          previous_date?: string | null
          reason?: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          new_date?: string | null
          previous_date?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_shift_events_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          course_id: string
          created_at: string
          id: string
          lesson_number: number
          notes: string
          plan_lesson_id: string
          scheduled_date: string | null
          status: Database["public"]["Enums"]["lesson_status"]
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          lesson_number: number
          notes?: string
          plan_lesson_id: string
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["lesson_status"]
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          lesson_number?: number
          notes?: string
          plan_lesson_id?: string
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["lesson_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_plan_lesson_id_fkey"
            columns: ["plan_lesson_id"]
            isOneToOne: false
            referencedRelation: "plan_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_content_mappings: {
        Row: {
          created_at: string
          curriculum_node_id: string
          id: string
          order_index: number
          plan_id: string
        }
        Insert: {
          created_at?: string
          curriculum_node_id: string
          id?: string
          order_index?: number
          plan_id: string
        }
        Update: {
          created_at?: string
          curriculum_node_id?: string
          id?: string
          order_index?: number
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_content_mappings_curriculum_node_id_fkey"
            columns: ["curriculum_node_id"]
            isOneToOne: false
            referencedRelation: "curriculum_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_content_mappings_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_lesson_content_links: {
        Row: {
          created_at: string
          id: string
          plan_content_mapping_id: string
          plan_lesson_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_content_mapping_id: string
          plan_lesson_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_content_mapping_id?: string
          plan_lesson_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_lesson_content_links_plan_content_mapping_id_fkey"
            columns: ["plan_content_mapping_id"]
            isOneToOne: false
            referencedRelation: "plan_content_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_lesson_content_links_plan_lesson_id_fkey"
            columns: ["plan_lesson_id"]
            isOneToOne: false
            referencedRelation: "plan_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_lessons: {
        Row: {
          created_at: string
          id: string
          is_integrative_evaluation: boolean
          is_recovery: boolean
          justification: string
          learning_outcome: string
          lesson_number: number
          plan_id: string
          subtitle: string
          term: number
          theme: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_integrative_evaluation?: boolean
          is_recovery?: boolean
          justification?: string
          learning_outcome?: string
          lesson_number: number
          plan_id: string
          subtitle?: string
          term: number
          theme?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_integrative_evaluation?: boolean
          is_recovery?: boolean
          justification?: string
          learning_outcome?: string
          lesson_number?: number
          plan_id?: string
          subtitle?: string
          term?: number
          theme?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_lessons_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_objectives: {
        Row: {
          created_at: string
          description: string
          id: string
          order_index: number
          plan_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          order_index?: number
          plan_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          order_index?: number
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_objectives_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          course_id: string
          created_at: string
          estrategias_marco: string
          estrategias_practicas: string[]
          evaluacion_marco: string
          fundamentacion: string
          id: string
          second_term_started: boolean
          status: Database["public"]["Enums"]["plan_status"]
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          estrategias_marco?: string
          estrategias_practicas?: string[]
          evaluacion_marco?: string
          fundamentacion?: string
          id?: string
          second_term_started?: boolean
          status?: Database["public"]["Enums"]["plan_status"]
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          estrategias_marco?: string
          estrategias_practicas?: string[]
          evaluacion_marco?: string
          fundamentacion?: string
          id?: string
          second_term_started?: boolean
          status?: Database["public"]["Enums"]["plan_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          id: string
          name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      schools: {
        Row: {
          created_at: string
          created_by: string | null
          district: string
          id: string
          locality: string
          official_name: string
          school_type: Database["public"]["Enums"]["school_type"]
          source_url: string | null
          updated_at: string
          user_created: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          district?: string
          id?: string
          locality?: string
          official_name: string
          school_type?: Database["public"]["Enums"]["school_type"]
          source_url?: string | null
          updated_at?: string
          user_created?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          district?: string
          id?: string
          locality?: string
          official_name?: string
          school_type?: Database["public"]["Enums"]["school_type"]
          source_url?: string | null
          updated_at?: string
          user_created?: boolean
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
      is_course_owner: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      is_lesson_owner: {
        Args: { _lesson_id: string; _user_id: string }
        Returns: boolean
      }
      is_plan_lesson_owner: {
        Args: { _plan_lesson_id: string; _user_id: string }
        Returns: boolean
      }
      is_plan_owner: {
        Args: { _plan_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "docente" | "admin"
      course_status: "ACTIVE" | "ARCHIVED"
      curriculum_cycle: "BASIC" | "UPPER"
      curriculum_node_type: "EJE" | "UNIDAD" | "BLOQUE" | "CONTENIDO"
      curriculum_status: "VERIFIED" | "DEPRECATED"
      lesson_status: "PLANNED" | "TAUGHT" | "RESCHEDULED" | "LOCKED"
      plan_status: "INCOMPLETE" | "VALIDATED"
      school_type: "COMUN" | "TECNICA"
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
      app_role: ["docente", "admin"],
      course_status: ["ACTIVE", "ARCHIVED"],
      curriculum_cycle: ["BASIC", "UPPER"],
      curriculum_node_type: ["EJE", "UNIDAD", "BLOQUE", "CONTENIDO"],
      curriculum_status: ["VERIFIED", "DEPRECATED"],
      lesson_status: ["PLANNED", "TAUGHT", "RESCHEDULED", "LOCKED"],
      plan_status: ["INCOMPLETE", "VALIDATED"],
      school_type: ["COMUN", "TECNICA"],
    },
  },
} as const
