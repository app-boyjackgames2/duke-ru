
-- Add access_type to channels
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS access_type text NOT NULL DEFAULT 'open';

-- Add file columns to channel_posts
ALTER TABLE public.channel_posts ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE public.channel_posts ADD COLUMN IF NOT EXISTS file_name text;

-- RLS: anyone authenticated can view open channels
CREATE POLICY "Anyone can view open channels"
ON public.channels FOR SELECT TO authenticated
USING (access_type = 'open');

-- RLS: anyone authenticated can view posts in open channels
CREATE POLICY "Anyone can view posts in open channels"
ON public.channel_posts FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.channels c
  WHERE c.id = channel_posts.channel_id AND c.access_type = 'open'
));
