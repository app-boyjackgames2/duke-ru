CREATE TABLE public.call_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  caller_id uuid NOT NULL,
  call_type text NOT NULL DEFAULT 'audio',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  status text NOT NULL DEFAULT 'missed'
);
ALTER TABLE public.call_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view call history" ON public.call_history
  FOR SELECT TO authenticated
  USING (public.is_conversation_member(auth.uid(), conversation_id));
CREATE POLICY "Authenticated can insert call history" ON public.call_history
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = caller_id);
CREATE POLICY "Caller can update call history" ON public.call_history
  FOR UPDATE TO authenticated
  USING (auth.uid() = caller_id);