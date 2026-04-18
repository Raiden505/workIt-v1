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
      category: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: never
          name: string
        }
        Update: {
          id?: never
          name?: string
        }
        Relationships: []
      }
      client: {
        Row: {
          company_name: string | null
          user_id: number
        }
        Insert: {
          company_name?: string | null
          user_id: number
        }
        Update: {
          company_name?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contract: {
        Row: {
          end_date: string
          freelancer_id: number | null
          id: number
          job_id: number | null
          proposal_id: number | null
          start_date: string
          status: Database["public"]["Enums"]["contract_status"] | null
          total_price: number
        }
        Insert: {
          end_date: string
          freelancer_id?: number | null
          id?: never
          job_id?: number | null
          proposal_id?: number | null
          start_date: string
          status?: Database["public"]["Enums"]["contract_status"] | null
          total_price: number
        }
        Update: {
          end_date?: string
          freelancer_id?: number | null
          id?: never
          job_id?: number | null
          proposal_id?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["contract_status"] | null
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "freelancer"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "contract_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposal"
            referencedColumns: ["id"]
          },
        ]
      }
      freelancer: {
        Row: {
          hourly_rate: number
          portfolio_url: string | null
          user_id: number
        }
        Insert: {
          hourly_rate?: number
          portfolio_url?: string | null
          user_id: number
        }
        Update: {
          hourly_rate?: number
          portfolio_url?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "freelancer_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      freelancer_skill: {
        Row: {
          freelancer_id: number
          skill_id: number
        }
        Insert: {
          freelancer_id: number
          skill_id: number
        }
        Update: {
          freelancer_id?: number
          skill_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "freelancer_skill_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "freelancer"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "freelancer_skill_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skill"
            referencedColumns: ["id"]
          },
        ]
      }
      job: {
        Row: {
          budget: number
          category_id: number | null
          client_id: number | null
          created_at: string
          description: string
          id: number
          status: Database["public"]["Enums"]["job_status"]
          title: string
        }
        Insert: {
          budget: number
          category_id?: number | null
          client_id?: number | null
          created_at?: string
          description: string
          id?: never
          status: Database["public"]["Enums"]["job_status"]
          title: string
        }
        Update: {
          budget?: number
          category_id?: number | null
          client_id?: number | null
          created_at?: string
          description?: string
          id?: never
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["user_id"]
          },
        ]
      }
      job_skill: {
        Row: {
          job_id: number
          skill_id: number
        }
        Insert: {
          job_id: number
          skill_id: number
        }
        Update: {
          job_id?: number
          skill_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_skill_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_skill_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skill"
            referencedColumns: ["id"]
          },
        ]
      }
      profile: {
        Row: {
          avatar_url: string | null
          bio: string | null
          first_name: string
          last_name: string | null
          user_id: number
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          first_name: string
          last_name?: string | null
          user_id: number
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          first_name?: string
          last_name?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal: {
        Row: {
          bid_amount: number | null
          created_at: string
          freelancer_id: number | null
          id: number
          job_id: number | null
          status: Database["public"]["Enums"]["proposal_status"] | null
        }
        Insert: {
          bid_amount?: number | null
          created_at?: string
          freelancer_id?: number | null
          id?: never
          job_id?: number | null
          status?: Database["public"]["Enums"]["proposal_status"] | null
        }
        Update: {
          bid_amount?: number | null
          created_at?: string
          freelancer_id?: number | null
          id?: never
          job_id?: number | null
          status?: Database["public"]["Enums"]["proposal_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "freelancer"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "proposal_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job"
            referencedColumns: ["id"]
          },
        ]
      }
      review: {
        Row: {
          comment: string | null
          contract_id: number | null
          created_at: string
          id: number
          rating: number | null
          reviewee_id: number | null
          reviewer_id: number | null
        }
        Insert: {
          comment?: string | null
          contract_id?: number | null
          created_at?: string
          id?: never
          rating?: number | null
          reviewee_id?: number | null
          reviewer_id?: number | null
        }
        Update: {
          comment?: string | null
          contract_id?: number | null
          created_at?: string
          id?: never
          rating?: number | null
          reviewee_id?: number | null
          reviewer_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "review_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      skill: {
        Row: {
          id: number
          name: string
        }
        Insert: {
          id?: never
          name: string
        }
        Update: {
          id?: never
          name?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          contract_id: number | null
          created_at: string
          id: number
          receiver_id: number | null
          sender_id: number | null
          status: Database["public"]["Enums"]["transactions_status"] | null
        }
        Insert: {
          amount: number
          contract_id?: number | null
          created_at?: string
          id?: never
          receiver_id?: number | null
          sender_id?: number | null
          status?: Database["public"]["Enums"]["transactions_status"] | null
        }
        Update: {
          amount?: number
          contract_id?: number | null
          created_at?: string
          id?: never
          receiver_id?: number | null
          sender_id?: number | null
          status?: Database["public"]["Enums"]["transactions_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "freelancer"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transactions_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "client"
            referencedColumns: ["user_id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: number
          is_verified: boolean
          password: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: never
          is_verified?: boolean
          password: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: never
          is_verified?: boolean
          password?: string
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
      contract_status: "active" | "completed" | "terminated"
      job_status: "open" | "in_progress" | "completed" | "cancelled"
      proposal_status: "pending" | "accepted" | "rejected" | "withdrawn"
      transactions_status: "pending" | "completed" | "failed" | "refunded"
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
      contract_status: ["active", "completed", "terminated"],
      job_status: ["open", "in_progress", "completed", "cancelled"],
      proposal_status: ["pending", "accepted", "rejected", "withdrawn"],
      transactions_status: ["pending", "completed", "failed", "refunded"],
    },
  },
} as const
