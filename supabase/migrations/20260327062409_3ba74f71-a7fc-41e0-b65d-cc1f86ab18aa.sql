CREATE POLICY "Creators can delete channels"
ON public.channels
FOR DELETE TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Channel creators can delete members"
ON public.channel_members
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.channels
    WHERE id = channel_id AND created_by = auth.uid()
  )
  OR auth.uid() = user_id
);

CREATE POLICY "Channel creators can delete all posts"
ON public.channel_posts
FOR DELETE TO authenticated
USING (
  auth.uid() = author_id
  OR EXISTS (
    SELECT 1 FROM public.channels
    WHERE id = channel_id AND created_by = auth.uid()
  )
);