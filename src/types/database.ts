export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string;
          name: string;
          password: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          password: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          password?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      players: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          user_name: string;
          role: 'dealer' | 'player';
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          user_name: string;
          role: 'dealer' | 'player';
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string;
          user_name?: string;
          role?: 'dealer' | 'player';
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      game_state: {
        Row: {
          id: string;
          room_id: string;
          current_topic: string | null;
          phase: 'lobby' | 'waiting' | 'topic_drawn' | 'answering' | 'voting' | 'results';
          round: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          current_topic?: string | null;
          phase?: 'lobby' | 'waiting' | 'topic_drawn' | 'answering' | 'voting' | 'results';
          round?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          current_topic?: string | null;
          phase?: 'lobby' | 'waiting' | 'topic_drawn' | 'answering' | 'voting' | 'results';
          round?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      answers: {
        Row: {
          id: string;
          room_id: string;
          game_state_id: string;
          user_id: string;
          user_name: string;
          answer_text: string;
          votes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          game_state_id: string;
          user_id: string;
          user_name: string;
          answer_text: string;
          votes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          game_state_id?: string;
          user_id?: string;
          user_name?: string;
          answer_text?: string;
          votes?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      votes: {
        Row: {
          id: string;
          room_id: string;
          answer_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          answer_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          answer_id?: string;
          user_id?: string;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
