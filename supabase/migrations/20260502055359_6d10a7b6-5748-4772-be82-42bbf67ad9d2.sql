-- Audit log for pin/unpin actions
CREATE TABLE public.pin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  message_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('pin','unpin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view pin audit"
  ON public.pin_audit_log FOR SELECT TO authenticated
  USING (public.is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "Members can insert pin audit"
  ON public.pin_audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor_id AND public.is_conversation_member(auth.uid(), conversation_id));

-- Triggers to auto-log pin/unpin
CREATE OR REPLACE FUNCTION public.log_pin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pin_audit_log(conversation_id, message_id, actor_id, action)
  VALUES (NEW.conversation_id, NEW.message_id, COALESCE(auth.uid(), NEW.pinned_by), 'pin');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_unpin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pin_audit_log(conversation_id, message_id, actor_id, action)
  VALUES (OLD.conversation_id, OLD.message_id, COALESCE(auth.uid(), OLD.pinned_by), 'unpin');
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_pin_insert
  AFTER INSERT ON public.pinned_messages
  FOR EACH ROW EXECUTE FUNCTION public.log_pin();

CREATE TRIGGER trg_pin_delete
  AFTER DELETE ON public.pinned_messages
  FOR EACH ROW EXECUTE FUNCTION public.log_unpin();

ALTER PUBLICATION supabase_realtime ADD TABLE public.pin_audit_log;

-- Role management policies
CREATE POLICY "Admins can update member roles"
  ON public.conversation_members FOR UPDATE TO authenticated
  USING (public.is_conversation_admin(auth.uid(), conversation_id))
  WITH CHECK (public.is_conversation_admin(auth.uid(), conversation_id));

DROP POLICY IF EXISTS "Users can leave conversations" ON public.conversation_members;
CREATE POLICY "Users can leave or admins can remove"
  ON public.conversation_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_conversation_admin(auth.uid(), conversation_id));

-- Prevent removing the last admin
CREATE OR REPLACE FUNCTION public.ensure_admin_exists()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  admin_count int;
  conv_type text;
BEGIN
  SELECT type INTO conv_type FROM public.conversations
    WHERE id = COALESCE(NEW.conversation_id, OLD.conversation_id);
  IF conv_type <> 'group' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT count(*) INTO admin_count
    FROM public.conversation_members
    WHERE conversation_id = COALESCE(NEW.conversation_id, OLD.conversation_id)
      AND role = 'admin'
      AND id <> COALESCE(OLD.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF (TG_OP = 'UPDATE' AND OLD.role = 'admin' AND NEW.role <> 'admin' AND admin_count = 0)
     OR (TG_OP = 'DELETE' AND OLD.role = 'admin' AND admin_count = 0) THEN
    RAISE EXCEPTION 'Cannot remove last admin from group';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_ensure_admin
  BEFORE UPDATE OR DELETE ON public.conversation_members
  FOR EACH ROW EXECUTE FUNCTION public.ensure_admin_exists();