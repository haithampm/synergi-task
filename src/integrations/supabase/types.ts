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
      activity_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      agent_decisions: {
        Row: {
          action_taken: Json
          confidence: number | null
          context: Json
          created_at: string
          decision_type: string
          id: string
          user_id: string
          was_overridden: boolean | null
        }
        Insert: {
          action_taken: Json
          confidence?: number | null
          context: Json
          created_at?: string
          decision_type: string
          id?: string
          user_id: string
          was_overridden?: boolean | null
        }
        Update: {
          action_taken?: Json
          confidence?: number | null
          context?: Json
          created_at?: string
          decision_type?: string
          id?: string
          user_id?: string
          was_overridden?: boolean | null
        }
        Relationships: []
      }
      agent_memory: {
        Row: {
          content: Json
          created_at: string
          expires_at: string | null
          id: string
          memory_type: string
          relevance_score: number | null
          user_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          expires_at?: string | null
          id?: string
          memory_type: string
          relevance_score?: number | null
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          expires_at?: string | null
          id?: string
          memory_type?: string
          relevance_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          detail: string | null
          entity_id: string | null
          entity_type: string
          id: string
          payload: Json
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          detail?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          payload?: Json
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          detail?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          payload?: Json
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channels: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["channel_kind"]
          name: string
          project_id: string | null
          quick_links: Json
          read_only: boolean
          topic: string | null
          whatsapp_group_url: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["channel_kind"]
          name: string
          project_id?: string | null
          quick_links?: Json
          read_only?: boolean
          topic?: string | null
          whatsapp_group_url?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["channel_kind"]
          name?: string
          project_id?: string | null
          quick_links?: Json
          read_only?: boolean
          topic?: string | null
          whatsapp_group_url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_channels_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachments: Json
          author_user_id: string | null
          channel_id: string
          created_at: string
          id: string
          mentions: string[]
          message: string
          parent_message_id: string | null
          pinned: boolean
        }
        Insert: {
          attachments?: Json
          author_user_id?: string | null
          channel_id: string
          created_at?: string
          id?: string
          mentions?: string[]
          message: string
          parent_message_id?: string | null
          pinned?: boolean
        }
        Update: {
          attachments?: Json
          author_user_id?: string | null
          channel_id?: string
          created_at?: string
          id?: string
          mentions?: string[]
          message?: string
          parent_message_id?: string | null
          pinned?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          project_id: string | null
          task_id: string | null
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          project_id?: string | null
          task_id?: string | null
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          project_id?: string | null
          task_id?: string | null
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          active: boolean
          entity_type: Database["public"]["Enums"]["custom_field_entity"]
          field_key: string
          field_type: string
          id: string
          label: string
          options: Json
          required: boolean
          validation: Json
          workspace_id: string
        }
        Insert: {
          active?: boolean
          entity_type: Database["public"]["Enums"]["custom_field_entity"]
          field_key: string
          field_type: string
          id?: string
          label: string
          options?: Json
          required?: boolean
          validation?: Json
          workspace_id: string
        }
        Update: {
          active?: boolean
          entity_type?: Database["public"]["Enums"]["custom_field_entity"]
          field_key?: string
          field_type?: string
          id?: string
          label?: string
          options?: Json
          required?: boolean
          validation?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboards: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          layout: Json
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          layout?: Json
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          layout?: Json
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          channel_id: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          join_url: string | null
          project_id: string | null
          provider: string
          starts_at: string
          status: string
          task_id: string | null
          title: string
          workspace_id: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          join_url?: string | null
          project_id?: string | null
          provider?: string
          starts_at: string
          status?: string
          task_id?: string | null
          title: string
          workspace_id: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          join_url?: string | null
          project_id?: string | null
          provider?: string
          starts_at?: string
          status?: string
          task_id?: string | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      personal_events: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          kind: string
          notes: string | null
          starts_at: string
          title: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          kind?: string
          notes?: string | null
          starts_at: string
          title: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          kind?: string
          notes?: string | null
          starts_at?: string
          title?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          department: string | null
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          department?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_documents: {
        Row: {
          category: string
          content: string | null
          created_at: string
          created_by: string | null
          external_url: string | null
          folder: string | null
          generated_by_ai: boolean
          id: string
          metadata: Json
          name: string
          output_format: Database["public"]["Enums"]["document_output_format"]
          project_id: string | null
          provider: string
          review_status: Database["public"]["Enums"]["document_review_status"]
          type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          category: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          folder?: string | null
          generated_by_ai?: boolean
          id?: string
          metadata?: Json
          name: string
          output_format?: Database["public"]["Enums"]["document_output_format"]
          project_id?: string | null
          provider?: string
          review_status?: Database["public"]["Enums"]["document_review_status"]
          type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          folder?: string | null
          generated_by_ai?: boolean
          id?: string
          metadata?: Json
          name?: string
          output_format?: Database["public"]["Enums"]["document_output_format"]
          project_id?: string | null
          provider?: string
          review_status?: Database["public"]["Enums"]["document_review_status"]
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          ai_summary: string | null
          budget: number | null
          created_at: string
          custom_field_values: Json
          department: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          namespace: string | null
          owner_id: string | null
          priority: string
          progress: number
          project_nature: string | null
          radar_lifecycle: Json
          risk_level: string | null
          start_date: string | null
          status: string
          tags: string[]
          updated_at: string
          workflow_id: string | null
          workspace_id: string | null
        }
        Insert: {
          ai_summary?: string | null
          budget?: number | null
          created_at?: string
          custom_field_values?: Json
          department?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          namespace?: string | null
          owner_id?: string | null
          priority?: string
          progress?: number
          project_nature?: string | null
          radar_lifecycle?: Json
          risk_level?: string | null
          start_date?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          workflow_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          ai_summary?: string | null
          budget?: number | null
          created_at?: string
          custom_field_values?: Json
          department?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          namespace?: string | null
          owner_id?: string | null
          priority?: string
          progress?: number
          project_nature?: string | null
          radar_lifecycle?: Json
          risk_level?: string | null
          start_date?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          workflow_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sticky_notes: {
        Row: {
          color: string
          content: string
          created_at: string
          done: boolean
          id: string
          title: string | null
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          color?: string
          content: string
          created_at?: string
          done?: boolean
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          color?: string
          content?: string
          created_at?: string
          done?: boolean
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sticky_notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          dependency_type: string
          id: string
          lag_days: number
          predecessor_task_id: string
          task_id: string
        }
        Insert: {
          dependency_type?: string
          id?: string
          lag_days?: number
          predecessor_task_id: string
          task_id: string
        }
        Update: {
          dependency_type?: string
          id?: string
          lag_days?: number
          predecessor_task_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_predecessor_task_id_fkey"
            columns: ["predecessor_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_timesheets: {
        Row: {
          activity: string
          created_at: string
          created_by: string | null
          hours: number
          id: string
          notes: string | null
          task_id: string
          team_member_id: string | null
          work_date: string
        }
        Insert: {
          activity: string
          created_at?: string
          created_by?: string | null
          hours?: number
          id?: string
          notes?: string | null
          task_id: string
          team_member_id?: string | null
          work_date: string
        }
        Update: {
          activity?: string
          created_at?: string
          created_by?: string | null
          hours?: number
          id?: string
          notes?: string | null
          task_id?: string
          team_member_id?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_timesheets_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_timesheets_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_hours: number | null
          ai_generated: boolean | null
          assignee_id: string | null
          created_at: string
          created_by: string | null
          custom_field_values: Json
          depends_on: string[] | null
          description: string | null
          due_date: string | null
          duration_days: number | null
          end_date: string | null
          estimated_hours: number | null
          id: string
          is_milestone: boolean
          parent_task_id: string | null
          phase: string | null
          priority: string
          progress: number
          project_id: string | null
          start_date: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          workload_hours: number | null
          workspace_id: string | null
        }
        Insert: {
          actual_hours?: number | null
          ai_generated?: boolean | null
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_field_values?: Json
          depends_on?: string[] | null
          description?: string | null
          due_date?: string | null
          duration_days?: number | null
          end_date?: string | null
          estimated_hours?: number | null
          id?: string
          is_milestone?: boolean
          parent_task_id?: string | null
          phase?: string | null
          priority?: string
          progress?: number
          project_id?: string | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          workload_hours?: number | null
          workspace_id?: string | null
        }
        Update: {
          actual_hours?: number | null
          ai_generated?: boolean | null
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_field_values?: Json
          depends_on?: string[] | null
          description?: string | null
          due_date?: string | null
          duration_days?: number | null
          end_date?: string | null
          estimated_hours?: number | null
          id?: string
          is_milestone?: boolean
          parent_task_id?: string | null
          phase?: string | null
          priority?: string
          progress?: number
          project_id?: string | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          workload_hours?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          capacity_hours: number
          created_at: string
          department: string | null
          email: string | null
          id: string
          metadata: Json
          name: string
          privilege_role: Database["public"]["Enums"]["app_role"]
          profile_id: string | null
          role_title: string | null
          updated_at: string
          user_id: string | null
          utilization_target: number
          workspace_id: string
        }
        Insert: {
          capacity_hours?: number
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          metadata?: Json
          name: string
          privilege_role?: Database["public"]["Enums"]["app_role"]
          profile_id?: string | null
          role_title?: string | null
          updated_at?: string
          user_id?: string | null
          utilization_target?: number
          workspace_id: string
        }
        Update: {
          capacity_hours?: number
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          metadata?: Json
          name?: string
          privilege_role?: Database["public"]["Enums"]["app_role"]
          profile_id?: string | null
          role_title?: string | null
          updated_at?: string
          user_id?: string | null
          utilization_target?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assignee_id: string | null
          category: string | null
          created_at: string
          custom_field_values: Json
          description: string | null
          id: string
          priority: string
          project_id: string | null
          reporter_id: string | null
          resolved_at: string | null
          sla_deadline: string | null
          status: string
          task_id: string | null
          title: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          assignee_id?: string | null
          category?: string | null
          created_at?: string
          custom_field_values?: Json
          description?: string | null
          id?: string
          priority?: string
          project_id?: string | null
          reporter_id?: string | null
          resolved_at?: string | null
          sla_deadline?: string | null
          status?: string
          task_id?: string | null
          title: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          assignee_id?: string | null
          category?: string | null
          created_at?: string
          custom_field_values?: Json
          description?: string | null
          id?: string
          priority?: string
          project_id?: string | null
          reporter_id?: string | null
          resolved_at?: string | null
          sla_deadline?: string | null
          status?: string
          task_id?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workflows: {
        Row: {
          created_at: string
          description: string | null
          entity_type: string
          id: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          entity_type: string
          id?: string
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          entity_type?: string
          id?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_integrations: {
        Row: {
          configuration: Json
          connected: boolean
          enabled: boolean
          id: string
          last_sync_at: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          scopes: string[]
          status: string
          sync_mode: Database["public"]["Enums"]["integration_sync_mode"]
          workspace_id: string
        }
        Insert: {
          configuration?: Json
          connected?: boolean
          enabled?: boolean
          id?: string
          last_sync_at?: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          scopes?: string[]
          status?: string
          sync_mode?: Database["public"]["Enums"]["integration_sync_mode"]
          workspace_id: string
        }
        Update: {
          configuration?: Json
          connected?: boolean
          enabled?: boolean
          id?: string
          last_sync_at?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          scopes?: string[]
          status?: string
          sync_mode?: Database["public"]["Enums"]["integration_sync_mode"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_memberships: {
        Row: {
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          title: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          title?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          title?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          ai_settings: Json
          branding: Json
          created_at: string
          created_by: string | null
          id: string
          ms_project_settings: Json
          name: string
          organization_id: string
          portfolio_office: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          ai_settings?: Json
          branding?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          ms_project_settings?: Json
          name: string
          organization_id: string
          portfolio_office?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          ai_settings?: Json
          branding?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          ms_project_settings?: Json
          name?: string
          organization_id?: string
          portfolio_office?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      has_workspace_role: {
        Args: { _roles: string[]; _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "project_manager"
        | "team_member"
        | "organization_admin"
        | "project_admin"
        | "standard_member"
        | "guest"
      channel_kind: "general" | "deliverables" | "announcements" | "support"
      custom_field_entity: "project" | "task" | "team_member" | "ticket"
      document_output_format: "doc" | "xlsx" | "pdf" | "txt"
      document_review_status: "draft" | "in-review" | "approved" | "signed"
      integration_provider:
        | "outlook"
        | "teams"
        | "onedrive"
        | "whatsapp"
        | "google_calendar"
      integration_sync_mode: "read" | "write" | "two-way"
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
      app_role: [
        "admin",
        "project_manager",
        "team_member",
        "organization_admin",
        "project_admin",
        "standard_member",
        "guest",
      ],
      channel_kind: ["general", "deliverables", "announcements", "support"],
      custom_field_entity: ["project", "task", "team_member", "ticket"],
      document_output_format: ["doc", "xlsx", "pdf", "txt"],
      document_review_status: ["draft", "in-review", "approved", "signed"],
      integration_provider: [
        "outlook",
        "teams",
        "onedrive",
        "whatsapp",
        "google_calendar",
      ],
      integration_sync_mode: ["read", "write", "two-way"],
    },
  },
} as const

