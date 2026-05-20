-- ============================================================
-- AGENT SUPPORT MIGRATION
-- Adds site_ids to profiles (for multi-site agents)
-- Adds assigned_agent_id to chat_sessions
-- ============================================================

-- Add site_ids column to profiles
-- Agents have an array of site IDs they are allowed to manage
-- NULL means no site restriction (used for admin/manager roles)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS site_ids INTEGER[] DEFAULT NULL;

-- Add assigned_agent_id to chat_sessions
-- Allows a chat to be assigned to a specific agent
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Index for fast agent chat lookups
CREATE INDEX IF NOT EXISTS idx_chat_sessions_assigned_agent
  ON public.chat_sessions(assigned_agent_id);

CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON public.profiles(role);
