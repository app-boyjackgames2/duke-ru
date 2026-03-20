-- Channels table
CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  avatar_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Channel members
CREATE TABLE public.channel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Channel posts
CREATE TABLE public.channel_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_posts ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION public.is_channel_member(_user_id uuid, _channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE user_id = _user_id AND channel_id = _channel_id
  );
$$;

-- Channels policies
CREATE POLICY "Authenticated can create channels" ON public.channels
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Members can view channels" ON public.channels
  FOR SELECT TO authenticated USING (is_channel_member(auth.uid(), id));

CREATE POLICY "Creator can update channel" ON public.channels
  FOR UPDATE TO authenticated USING (auth.uid() = created_by);

-- Channel members policies
CREATE POLICY "Members can view channel membership" ON public.channel_members
  FOR SELECT TO authenticated USING (is_channel_member(auth.uid(), channel_id));

CREATE POLICY "Authenticated can join channels" ON public.channel_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR is_channel_member(auth.uid(), channel_id));

-- Channel posts policies
CREATE POLICY "Members can view posts" ON public.channel_posts
  FOR SELECT TO authenticated USING (is_channel_member(auth.uid(), channel_id));

CREATE POLICY "Members can create posts" ON public.channel_posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id AND is_channel_member(auth.uid(), channel_id));

CREATE POLICY "Authors can delete posts" ON public.channel_posts
  FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- Realtime for posts
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_posts;

-- Triggers
CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_channel_posts_updated_at BEFORE UPDATE ON public.channel_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();