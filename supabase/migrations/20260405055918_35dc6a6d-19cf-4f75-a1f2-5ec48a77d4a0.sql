CREATE POLICY "Users can leave conversations"
ON public.conversation_members
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);