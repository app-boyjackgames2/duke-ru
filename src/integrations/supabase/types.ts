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
      call_history: {
        Row: {
          call_type: string
          caller_id: string
          conversation_id: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          started_at: string
          status: string
        }
        Insert: {
          call_type?: string
          caller_id: string
          conversation_id: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
        }
        Update: {
          call_type?: string
          caller_id?: string
          conversation_id?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      channel_bans: {
        Row: {
          banned_by: string
          channel_id: string
          created_at: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          banned_by: string
          channel_id: string
          created_at?: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          banned_by?: string
          channel_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      channel_members: {
        Row: {
          channel_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_posts: {
        Row: {
          author_id: string
          channel_id: string
          content: string
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          image_url: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          channel_id: string
          content: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          channel_id?: string
          content?: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_posts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          access_type: string
          avatar_url: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          access_type?: string
          avatar_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          access_type?: string
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversation_last_read: {
        Row: {
          conversation_id: string
          id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_last_read_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string | null
          type: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          reply_to: string | null
          sender_id: string
          type: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          reply_to?: string | null
          sender_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          reply_to?: string | null
          sender_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      pin_audit_log: {
        Row: {
          action: string
          actor_id: string
          conversation_id: string
          created_at: string
          id: string
          message_id: string
        }
        Insert: {
          action: string
          actor_id: string
          conversation_id: string
          created_at?: string
          id?: string
          message_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_id?: string
        }
        Relationships: []
      }
      pinned_messages: {
        Row: {
          conversation_id: string
          id: string
          message_id: string
          pinned_at: string
          pinned_by: string
        }
        Insert: {
          conversation_id: string
          id?: string
          message_id: string
          pinned_at?: string
          pinned_by: string
        }
        Update: {
          conversation_id?: string
          id?: string
          message_id?: string
          pinned_at?: string
          pinned_by?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          is_online: boolean | null
          last_seen: string | null
          status_text: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_online?: boolean | null
          last_seen?: string | null
          status_text?: string | null
          updated_at?: string
          user_id: string
          username?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_online?: boolean | null
          last_seen?: string | null
          status_text?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      stream_chat_messages: {
        Row: {
          attachment_url: string | null
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          stream_id: string
          user_id: string
        }
        Insert: {
          attachment_url?: string | null
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          stream_id: string
          user_id: string
        }
        Update: {
          attachment_url?: string | null
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_chat_messages_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_chat_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_chat_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "stream_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          stream_id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          stream_id: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          stream_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_notifications_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_videos: {
        Row: {
          created_at: string
          duration_seconds: number
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          position: number
          stream_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          position?: number
          stream_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          position?: number
          stream_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_videos_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_viewers: {
        Row: {
          id: string
          joined_at: string
          last_seen_at: string
          stream_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          last_seen_at?: string
          stream_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          last_seen_at?: string
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_viewers_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      streams: {
        Row: {
          access_token: string | null
          access_type: string
          actual_ended_at: string | null
          actual_started_at: string | null
          age_rating: string | null
          auto_end: boolean
          auto_start: boolean
          channel_id: string
          created_at: string
          created_by: string
          current_index: number
          current_started_at: string | null
          description: string | null
          disable_ads: boolean
          ends_at: string | null
          id: string
          is_broadcast: boolean
          logo_url: string | null
          loop_video: boolean
          mode: string
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          access_type?: string
          actual_ended_at?: string | null
          actual_started_at?: string | null
          age_rating?: string | null
          auto_end?: boolean
          auto_start?: boolean
          channel_id: string
          created_at?: string
          created_by: string
          current_index?: number
          current_started_at?: string | null
          description?: string | null
          disable_ads?: boolean
          ends_at?: string | null
          id?: string
          is_broadcast?: boolean
          logo_url?: string | null
          loop_video?: boolean
          mode: string
          starts_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          access_type?: string
          actual_ended_at?: string | null
          actual_started_at?: string | null
          age_rating?: string | null
          auto_end?: boolean
          auto_start?: boolean
          channel_id?: string
          created_at?: string
          created_by?: string
          current_index?: number
          current_started_at?: string | null
          description?: string | null
          disable_ads?: boolean
          ends_at?: string | null
          id?: string
          is_broadcast?: boolean
          logo_url?: string | null
          loop_video?: boolean
          mode?: string
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_notification_prefs: {
        Row: {
          stream_alerts: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          stream_alerts?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          stream_alerts?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_message: {
        Args: { _message_id: string; _user_id: string }
        Returns: boolean
      }
      is_channel_member: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_channel_mod: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_conversation_admin: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
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
    Enums: {},
  },
} as const
