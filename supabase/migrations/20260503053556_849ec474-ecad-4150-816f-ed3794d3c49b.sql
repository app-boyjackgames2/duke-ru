
CREATE TABLE public.streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  mode text NOT NULL CHECK (mode IN ('video','bar')),
  access_type text NOT NULL DEFAULT 'open' CHECK (access_type IN ('open','link','restricted')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  actual_started_at timestamptz,
  actual_ended_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended','cancelled')),
  loop_video boolean NOT NULL DEFAULT false,
  auto_start boolean NOT NULL DEFAULT true,
  auto_end boolean NOT NULL DEFAULT true,
  current_index integer NOT NULL DEFAULT 0,
  current_started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.stream_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  file_url text NOT NULL,
  file_name text,
  file_size bigint,
  duration_seconds numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.stream_viewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stream_id, user_id)
);

CREATE INDEX idx_streams_channel ON public.streams(channel_id);
CREATE INDEX idx_streams_status ON public.streams(status);
CREATE INDEX idx_stream_videos_stream ON public.stream_videos(stream_id, position);

ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_viewers ENABLE ROW LEVEL SECURITY;

-- streams policies
CREATE POLICY "Members view streams" ON public.streams FOR SELECT TO authenticated
  USING (public.is_channel_member(auth.uid(), channel_id) OR access_type = 'open');
CREATE POLICY "Mods create streams" ON public.streams FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.is_channel_mod(auth.uid(), channel_id));
CREATE POLICY "Mods update streams" ON public.streams FOR UPDATE TO authenticated
  USING (public.is_channel_mod(auth.uid(), channel_id));
CREATE POLICY "Mods delete streams" ON public.streams FOR DELETE TO authenticated
  USING (public.is_channel_mod(auth.uid(), channel_id));

-- stream_videos policies
CREATE POLICY "Members view stream videos" ON public.stream_videos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.streams s WHERE s.id = stream_id
    AND (public.is_channel_member(auth.uid(), s.channel_id) OR s.access_type = 'open')));
CREATE POLICY "Mods insert stream videos" ON public.stream_videos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.streams s WHERE s.id = stream_id
    AND public.is_channel_mod(auth.uid(), s.channel_id)));
CREATE POLICY "Mods delete stream videos" ON public.stream_videos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.streams s WHERE s.id = stream_id
    AND public.is_channel_mod(auth.uid(), s.channel_id)));

-- stream_viewers policies
CREATE POLICY "Members view viewers" ON public.stream_viewers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.streams s WHERE s.id = stream_id
    AND (public.is_channel_member(auth.uid(), s.channel_id) OR s.access_type = 'open')));
CREATE POLICY "Self join as viewer" ON public.stream_viewers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Self leave viewer" ON public.stream_viewers FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_streams_updated_at
  BEFORE UPDATE ON public.streams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.streams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_videos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_viewers;
ALTER TABLE public.streams REPLICA IDENTITY FULL;
ALTER TABLE public.stream_videos REPLICA IDENTITY FULL;
ALTER TABLE public.stream_viewers REPLICA IDENTITY FULL;
