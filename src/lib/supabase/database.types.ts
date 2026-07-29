export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      trial_progress: {
        Row: {
          id: string
          user_id: string
          product_id: string
          videos_filmed: number
          source: 'manual' | 'sales-history' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          videos_filmed?: number
          source?: 'manual' | 'sales-history' | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          videos_filmed?: number
          source?: 'manual' | 'sales-history' | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      retainer_deals: {
        Row: {
          id: string
          user_id: string
          brand_name: string
          product: string
          stage: Database['public']['Enums']['deal_stage']
          deal_type: Database['public']['Enums']['deal_type'] | null
          compensation: number | null
          commission_percent: number | null
          videos_required: number | null
          deadline_date: string | null
          contract_signed: boolean
          notes: string | null
          video_deliverables: Json
          is_retainer: boolean
          retainer_total_videos: number | null
          retainer_deadline_date: string | null
          filming_checklist: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          brand_name: string
          product?: string
          stage?: Database['public']['Enums']['deal_stage']
          deal_type?: Database['public']['Enums']['deal_type'] | null
          compensation?: number | null
          commission_percent?: number | null
          videos_required?: number | null
          deadline_date?: string | null
          contract_signed?: boolean
          notes?: string | null
          video_deliverables?: Json
          is_retainer?: boolean
          retainer_total_videos?: number | null
          retainer_deadline_date?: string | null
          filming_checklist?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          brand_name?: string
          product?: string
          stage?: Database['public']['Enums']['deal_stage']
          deal_type?: Database['public']['Enums']['deal_type'] | null
          compensation?: number | null
          commission_percent?: number | null
          videos_required?: number | null
          deadline_date?: string | null
          contract_signed?: boolean
          notes?: string | null
          video_deliverables?: Json
          is_retainer?: boolean
          retainer_total_videos?: number | null
          retainer_deadline_date?: string | null
          filming_checklist?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      income_entries: {
        Row: {
          id: string
          user_id: string
          month_key: string
          source: string
          note: string | null
          gmv_total: number
          estimated_commission: number
          settled_commission: number
          brand_deals_income: number
          bonuses_rewards: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          month_key: string
          source?: string
          note?: string | null
          gmv_total?: number
          estimated_commission?: number
          settled_commission?: number
          brand_deals_income?: number
          bonuses_rewards?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          month_key?: string
          source?: string
          note?: string | null
          gmv_total?: number
          estimated_commission?: number
          settled_commission?: number
          brand_deals_income?: number
          bonuses_rewards?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sprint_history: {
        Row: {
          id: string
          user_id: string
          started_at: string | null
          ended_at: string
          file_name: string | null
          schedule_mode: Database['public']['Enums']['schedule_mode']
          videos_per_day: number
          sprint_days: number
          start_total_commission: number | null
          end_total_commission: number
          commission_delta: number | null
          commission_percent_change: number | null
          start_snapshot: Json | null
          end_snapshot: Json
          tier_movements: Json
          trial_completions: Json
          top_performer: Json | null
          trials_in_progress: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          started_at?: string | null
          ended_at?: string
          file_name?: string | null
          schedule_mode?: Database['public']['Enums']['schedule_mode']
          videos_per_day: number
          sprint_days: number
          start_total_commission?: number | null
          end_total_commission?: number
          commission_delta?: number | null
          commission_percent_change?: number | null
          start_snapshot?: Json | null
          end_snapshot?: Json
          tier_movements?: Json
          trial_completions?: Json
          top_performer?: Json | null
          trials_in_progress?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          started_at?: string | null
          ended_at?: string
          file_name?: string | null
          schedule_mode?: Database['public']['Enums']['schedule_mode']
          videos_per_day?: number
          sprint_days?: number
          start_total_commission?: number | null
          end_total_commission?: number
          commission_delta?: number | null
          commission_percent_change?: number | null
          start_snapshot?: Json | null
          end_snapshot?: Json
          tier_movements?: Json
          trial_completions?: Json
          top_performer?: Json | null
          trials_in_progress?: number
          created_at?: string
        }
        Relationships: []
      }
      product_scout_list: {
        Row: {
          id: string
          user_id: string
          product_name: string
          metrics: Json
          verdict: Database['public']['Enums']['product_scout_verdict'] | null
          total_score: number | null
          scoring_logic_version: number | null
          funnel_recommendation: Json | null
          promoted_catalog_product_id: string | null
          promoted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_name: string
          metrics?: Json
          verdict?: Database['public']['Enums']['product_scout_verdict'] | null
          total_score?: number | null
          scoring_logic_version?: number | null
          funnel_recommendation?: Json | null
          promoted_catalog_product_id?: string | null
          promoted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_name?: string
          metrics?: Json
          verdict?: Database['public']['Enums']['product_scout_verdict'] | null
          total_score?: number | null
          scoring_logic_version?: number | null
          funnel_recommendation?: Json | null
          promoted_catalog_product_id?: string | null
          promoted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_products: {
        Row: {
          id: string
          user_id: string
          display_name: string
          brand: string | null
          external_product_id: string | null
          linked_external_ids: Json
          source: Database['public']['Enums']['catalog_product_source']
          is_favorite: boolean
          gmv: number
          commission: number
          items_sold: number
          order_count: number
          in_rotation: boolean
          is_manual: boolean
          date_received: string | null
          first_video_deadline: string | null
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          display_name: string
          brand?: string | null
          external_product_id?: string | null
          linked_external_ids?: Json
          source?: Database['public']['Enums']['catalog_product_source']
          is_favorite?: boolean
          gmv?: number
          commission?: number
          items_sold?: number
          order_count?: number
          in_rotation?: boolean
          is_manual?: boolean
          date_received?: string | null
          first_video_deadline?: string | null
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          display_name?: string
          brand?: string | null
          external_product_id?: string | null
          linked_external_ids?: Json
          source?: Database['public']['Enums']['catalog_product_source']
          is_favorite?: boolean
          gmv?: number
          commission?: number
          items_sold?: number
          order_count?: number
          in_rotation?: boolean
          is_manual?: boolean
          date_received?: string | null
          first_video_deadline?: string | null
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalog_merge_history: {
        Row: {
          id: string
          user_id: string
          survivor_id: string
          survivor_display_name: string
          absorbed_ids: Json
          before_products: Json
          before_trial: Json
          after_trial_videos_filmed: number
          created_at: string
          undone_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          survivor_id: string
          survivor_display_name: string
          absorbed_ids?: Json
          before_products?: Json
          before_trial?: Json
          after_trial_videos_filmed?: number
          created_at?: string
          undone_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          survivor_id?: string
          survivor_display_name?: string
          absorbed_ids?: Json
          before_products?: Json
          before_trial?: Json
          after_trial_videos_filmed?: number
          created_at?: string
          undone_at?: string | null
        }
        Relationships: []
      }
      onboarding_state: {
        Row: {
          user_id: string
          completed: boolean
          mode: Database['public']['Enums']['user_mode'] | null
          videos_per_day: number | null
          monthly_commission: Database['public']['Enums']['monthly_commission_level'] | null
          filming_approach: Database['public']['Enums']['filming_approach'] | null
          welcome_seen: boolean
          sprint_entry_seen: boolean
          sprint_start_snapshot: Json | null
          sprint_previous_snapshot: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          completed?: boolean
          mode?: Database['public']['Enums']['user_mode'] | null
          videos_per_day?: number | null
          monthly_commission?: Database['public']['Enums']['monthly_commission_level'] | null
          filming_approach?: Database['public']['Enums']['filming_approach'] | null
          welcome_seen?: boolean
          sprint_entry_seen?: boolean
          sprint_start_snapshot?: Json | null
          sprint_previous_snapshot?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          completed?: boolean
          mode?: Database['public']['Enums']['user_mode'] | null
          videos_per_day?: number | null
          monthly_commission?: Database['public']['Enums']['monthly_commission_level'] | null
          filming_approach?: Database['public']['Enums']['filming_approach'] | null
          welcome_seen?: boolean
          sprint_entry_seen?: boolean
          sprint_start_snapshot?: Json | null
          sprint_previous_snapshot?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      current_sprint_state: {
        Row: {
          user_id: string
          stage: string
          schedule_mode: Database['public']['Enums']['schedule_mode']
          file_name: string | null
          sprint_config: Json
          products: Json
          deadline_products: Json
          excluded_product_keys: string[]
          sample_products: Json
          schedule: Json
          filming_progress: Json
          updated_at: string
        }
        Insert: {
          user_id: string
          stage: string
          schedule_mode?: Database['public']['Enums']['schedule_mode']
          file_name?: string | null
          sprint_config?: Json
          products?: Json
          deadline_products?: Json
          excluded_product_keys?: string[]
          sample_products?: Json
          schedule?: Json
          filming_progress?: Json
          updated_at?: string
        }
        Update: {
          user_id?: string
          stage?: string
          schedule_mode?: Database['public']['Enums']['schedule_mode']
          file_name?: string | null
          sprint_config?: Json
          products?: Json
          deadline_products?: Json
          excluded_product_keys?: string[]
          sample_products?: Json
          schedule?: Json
          filming_progress?: Json
          updated_at?: string
        }
        Relationships: []
      }
      user_engagement: {
        Row: {
          user_id: string
          last_csv_upload_at: string | null
          last_upload_reminder_sent_at: string | null
          upload_reminder_dismissed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          last_csv_upload_at?: string | null
          last_upload_reminder_sent_at?: string | null
          upload_reminder_dismissed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          last_csv_upload_at?: string | null
          last_upload_reminder_sent_at?: string | null
          upload_reminder_dismissed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tiktok_connections: {
        Row: {
          user_id: string
          open_id: string
          display_name: string | null
          avatar_url: string | null
          scope: string | null
          access_token: string
          refresh_token: string | null
          access_token_expires_at: string | null
          refresh_token_expires_at: string | null
          connected_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          open_id: string
          display_name?: string | null
          avatar_url?: string | null
          scope?: string | null
          access_token: string
          refresh_token?: string | null
          access_token_expires_at?: string | null
          refresh_token_expires_at?: string | null
          connected_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          open_id?: string
          display_name?: string | null
          avatar_url?: string | null
          scope?: string | null
          access_token?: string
          refresh_token?: string | null
          access_token_expires_at?: string | null
          refresh_token_expires_at?: string | null
          connected_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          user_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: Database['public']['Enums']['subscription_status']
          price_id: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          trial_conversion_email_sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: Database['public']['Enums']['subscription_status']
          price_id?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          trial_conversion_email_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: Database['public']['Enums']['subscription_status']
          price_id?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          trial_conversion_email_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      subscription_status:
        | 'none'
        | 'incomplete'
        | 'incomplete_expired'
        | 'trialing'
        | 'active'
        | 'past_due'
        | 'canceled'
        | 'unpaid'
        | 'paused'
      deal_stage:
        | 'negotiating'
        | 'contract_sent'
        | 'sample_otw'
        | 'filming'
        | 'posted'
        | 'awaiting_payment'
        | 'paid_closed'
      deal_type: 'video' | 'live' | 'bundle'
      filming_approach: 'whatever_samples' | 'rough_system' | 'solid_system'
      monthly_commission_level: 'just_starting' | 'growing' | 'established'
      product_scout_verdict: 'strong' | 'test' | 'pass'
      catalog_product_source: 'csv' | 'manual' | 'sample' | 'backfill'
      schedule_mode: 'full' | 'sample' | 'momentum'
      tier_label: 'Anchor' | 'Rising' | 'Test' | 'Cut'
      trial_progress_source: 'manual' | 'sales-history'
      user_mode: 'beginner' | 'advanced'
    }
    CompositeTypes: Record<string, never>
  }
}
