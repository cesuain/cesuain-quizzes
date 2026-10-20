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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          category: string
          created_at: string
          criteria_config: Json
          criteria_type: string
          description: string
          icon: string
          id: string
          is_active: boolean
          name: string
          rarity: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          criteria_config?: Json
          criteria_type: string
          description: string
          icon: string
          id?: string
          is_active?: boolean
          name: string
          rarity?: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          criteria_config?: Json
          criteria_type?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          rarity?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      answer_options: {
        Row: {
          body: string
          id: string
          is_correct: boolean
          question_id: string
          source_index: number
        }
        Insert: {
          body: string
          id?: string
          is_correct: boolean
          question_id: string
          source_index: number
        }
        Update: {
          body?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          source_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "answer_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_questions: {
        Row: {
          attempt_id: string
          option_ids: string[]
          outcome: string
          position: number
          question_id: string
          resolved_at: string | null
          submissions: number
          xp_awarded: number
        }
        Insert: {
          attempt_id: string
          option_ids: string[]
          outcome?: string
          position: number
          question_id: string
          resolved_at?: string | null
          submissions?: number
          xp_awarded?: number
        }
        Update: {
          attempt_id?: string
          option_ids?: string[]
          outcome?: string
          position?: number
          question_id?: string
          resolved_at?: string | null
          submissions?: number
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "attempt_questions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          id: string
          name: string
          position: number
        }
        Insert: {
          id: string
          name: string
          position: number
        }
        Update: {
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_responses: {
        Row: {
          attempt_id: string
          client_event_id: string
          created_at: string
          duration_ms: number
          id: string
          is_correct: boolean
          option_id: string | null
          question_id: string
          seq: number
          submission_number: number
          user_id: string
          xp_awarded: number
        }
        Insert: {
          attempt_id: string
          client_event_id: string
          created_at?: string
          duration_ms?: number
          id?: string
          is_correct: boolean
          option_id?: string | null
          question_id: string
          seq?: never
          submission_number: number
          user_id: string
          xp_awarded?: number
        }
        Update: {
          attempt_id?: string
          client_event_id?: string
          created_at?: string
          duration_ms?: number
          id?: string
          is_correct?: boolean
          option_id?: string | null
          question_id?: string
          seq?: never
          submission_number?: number
          user_id?: string
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_responses_attempt_id_question_id_fkey"
            columns: ["attempt_id", "question_id"]
            isOneToOne: false
            referencedRelation: "attempt_questions"
            referencedColumns: ["attempt_id", "question_id"]
          },
          {
            foreignKeyName: "question_responses_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "answer_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          explanation: string | null
          id: string
          is_active: boolean
          language: string
          level_id: string
          prompt: string
          quiz_id: string
          source_id: number
        }
        Insert: {
          explanation?: string | null
          id?: string
          is_active?: boolean
          language: string
          level_id: string
          prompt: string
          quiz_id: string
          source_id: number
        }
        Update: {
          explanation?: string | null
          id?: string
          is_active?: boolean
          language?: string
          level_id?: string
          prompt?: string
          quiz_id?: string
          source_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "questions_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_quiz_id_language_fkey"
            columns: ["quiz_id", "language"]
            isOneToOne: false
            referencedRelation: "quiz_localizations"
            referencedColumns: ["quiz_id", "language"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          abandoned_at: string | null
          accuracy: number | null
          completed_at: string | null
          completion_bonus: number
          correct_count: number
          duration_seconds: number
          first_try_count: number
          id: string
          incorrect_count: number
          language: string
          last_activity_at: string
          level_filter: string
          mode: string
          questions_answered: number
          quiz_id: string
          seconds_per_question: number
          started_at: string
          status: string
          total_questions: number
          user_id: string
          xp_earned: number
        }
        Insert: {
          abandoned_at?: string | null
          accuracy?: number | null
          completed_at?: string | null
          completion_bonus?: number
          correct_count?: number
          duration_seconds?: number
          first_try_count?: number
          id?: string
          incorrect_count?: number
          language: string
          last_activity_at?: string
          level_filter: string
          mode?: string
          questions_answered?: number
          quiz_id: string
          seconds_per_question?: number
          started_at?: string
          status?: string
          total_questions: number
          user_id: string
          xp_earned?: number
        }
        Update: {
          abandoned_at?: string | null
          accuracy?: number | null
          completed_at?: string | null
          completion_bonus?: number
          correct_count?: number
          duration_seconds?: number
          first_try_count?: number
          id?: string
          incorrect_count?: number
          language?: string
          last_activity_at?: string
          level_filter?: string
          mode?: string
          questions_answered?: number
          quiz_id?: string
          seconds_per_question?: number
          started_at?: string
          status?: string
          total_questions?: number
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_quiz_id_language_fkey"
            columns: ["quiz_id", "language"]
            isOneToOne: false
            referencedRelation: "quiz_localizations"
            referencedColumns: ["quiz_id", "language"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_localizations: {
        Row: {
          language: string
          quiz_id: string
          title: string
        }
        Insert: {
          language: string
          quiz_id: string
          title: string
        }
        Update: {
          language?: string
          quiz_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_localizations_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          id: string
          is_published: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          is_published?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_published?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          metadata: Json
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          metadata?: Json
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          metadata?: Json
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_ledger: {
        Row: {
          amount: number
          attempt_id: string
          award_type: string
          created_at: string
          event: string
          id: string
          idempotency_key: string
          response_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          attempt_id: string
          award_type: string
          created_at?: string
          event: string
          id?: string
          idempotency_key: string
          response_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          attempt_id?: string
          award_type?: string
          created_at?: string
          event?: string
          id?: string
          idempotency_key?: string
          response_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_ledger_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_ledger_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "question_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abandon_attempt: { Args: { p_attempt_id: string }; Returns: undefined }
      get_attempt: { Args: { p_attempt_id: string }; Returns: Json }
      my_achievements: {
        Args: never
        Returns: {
          category: string
          criteria_config: Json
          criteria_type: string
          current_value: number
          description: string
          icon: string
          id: string
          name: string
          rarity: string
          slug: string
          sort_order: number
          target_value: number
          unlocked_at: string
        }[]
      }
      my_stats: { Args: never; Returns: Json }
      quiz_catalog: { Args: never; Returns: Json }
      reveal_answer: {
        Args: { p_attempt_id: string; p_question_id: string }
        Returns: Json
      }
      start_attempt: {
        Args: {
          p_count: number
          p_language: string
          p_level: string
          p_quiz_id: string
          p_seconds_per_question: number
        }
        Returns: string
      }
      submit_answer: {
        Args: {
          p_attempt_id: string
          p_client_event_id: string
          p_option_id: string
          p_question_id: string
        }
        Returns: Json
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
