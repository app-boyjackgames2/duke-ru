
-- Table for tracking last read message per conversation per user
CREATE TABLE public.conversation_last_read (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

ALTER TABLE public.conversation_last_read ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own last_read" ON public.conversation_last_read
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own last_read" ON public.conversation_last_read
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own last_read" ON public.conversation_last_read
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
