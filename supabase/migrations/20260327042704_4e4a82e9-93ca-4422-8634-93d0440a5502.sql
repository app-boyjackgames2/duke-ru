CREATE POLICY "Creators can view own channels"
ON public.channels
FOR SELECT TO authenticated
USING (auth.uid() = created_by);