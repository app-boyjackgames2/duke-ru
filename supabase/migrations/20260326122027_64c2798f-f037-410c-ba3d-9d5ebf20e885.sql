CREATE POLICY "Authors can update posts" ON public.channel_posts
  FOR UPDATE TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);