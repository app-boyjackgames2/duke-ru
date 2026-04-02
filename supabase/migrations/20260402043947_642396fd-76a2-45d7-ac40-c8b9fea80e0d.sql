
-- Table for channel bans
CREATE TABLE IF NOT EXISTS public.channel_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL,
  user_id uuid NOT NULL,
  banned_by uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

ALTER TABLE public.channel_bans ENABLE ROW LEVEL SECURITY;

-- Function to check if user is admin or moderator
CREATE OR REPLACE FUNCTION public.is_channel_mod(_user_id uuid, _channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE user_id = _user_id AND channel_id = _channel_id AND role IN ('admin', 'moderator')
  );
$$;

-- Bans: mods can insert
CREATE POLICY "Mods can ban users"
ON public.channel_bans FOR INSERT TO authenticated
WITH CHECK (is_channel_mod(auth.uid(), channel_id));

-- Bans: mods can delete (unban)
CREATE POLICY "Mods can unban users"
ON public.channel_bans FOR DELETE TO authenticated
USING (is_channel_mod(auth.uid(), channel_id));

-- Bans: members can view
CREATE POLICY "Members can view bans"
ON public.channel_bans FOR SELECT TO authenticated
USING (is_channel_member(auth.uid(), channel_id));

-- Allow mods to update channel_members roles
CREATE POLICY "Mods can update member roles"
ON public.channel_members FOR UPDATE TO authenticated
USING (is_channel_mod(auth.uid(), channel_id));

-- Allow mods to delete posts in their channel
CREATE POLICY "Mods can delete posts"
ON public.channel_posts FOR DELETE TO authenticated
USING (is_channel_mod(auth.uid(), channel_id));

-- Allow mods to remove members
CREATE POLICY "Mods can remove members"
ON public.channel_members FOR DELETE TO authenticated
USING (is_channel_mod(auth.uid(), channel_id));
