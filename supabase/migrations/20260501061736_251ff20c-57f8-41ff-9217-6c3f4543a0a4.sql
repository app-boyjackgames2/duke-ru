-- 1. Add role to conversation_members
ALTER TABLE public.conversation_members
ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member';

-- Backfill: mark conversation creators as admins
UPDATE public.conversation_members cm
SET role = 'admin'
FROM public.conversations c
WHERE c.id = cm.conversation_id
  AND c.created_by = cm.user_id
  AND cm.role = 'member';

-- 2. Helper: check if user is admin of a conversation
CREATE OR REPLACE FUNCTION public.is_conversation_admin(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE user_id = _user_id
      AND conversation_id = _conversation_id
      AND role = 'admin'
  );
$$;

-- 3. Pinned messages table
CREATE TABLE IF NOT EXISTS public.pinned_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL,
  message_id uuid NOT NULL,
  pinned_by uuid NOT NULL,
  pinned_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_pinned_messages_conv ON public.pinned_messages(conversation_id);

ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;

-- View pins: any conversation member
CREATE POLICY "Members can view pinned messages"
ON public.pinned_messages
FOR SELECT
TO authenticated
USING (public.is_conversation_member(auth.uid(), conversation_id));

-- Pin: direct chat -> any member; group -> admin only
CREATE POLICY "Members can pin in direct, admins in group"
ON public.pinned_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = pinned_by
  AND public.is_conversation_member(auth.uid(), conversation_id)
  AND (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.type = 'direct'
    )
    OR public.is_conversation_admin(auth.uid(), conversation_id)
  )
);

-- Unpin: same rules
CREATE POLICY "Members can unpin in direct, admins in group"
ON public.pinned_messages
FOR DELETE
TO authenticated
USING (
  public.is_conversation_member(auth.uid(), conversation_id)
  AND (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.type = 'direct'
    )
    OR public.is_conversation_admin(auth.uid(), conversation_id)
  )
);

-- 4. Allow admins to update conversation (name, avatar) for groups
CREATE POLICY "Admins can update group conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (public.is_conversation_admin(auth.uid(), id))
WITH CHECK (public.is_conversation_admin(auth.uid(), id));

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pinned_messages;