

# DUKE — Update 27.03.2026

## 1. TURN Server Support for WebRTC

**File**: `src/hooks/useWebRTC.ts`

Add a free TURN server (e.g. from metered.ca or OpenRelay) alongside existing STUN servers in `ICE_SERVERS` config. This ensures calls work behind restrictive NATs.

```ts
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "turn:a]relay.metered.ca:80", username: "open", credential: "open" },
  { urls: "turn:a.relay.metered.ca:443?transport=tcp", username: "open", credential: "open" },
];
```

For production, a paid TURN service with secret credentials would be needed, but for MVP the free relay works.

## 2. Call Status Display in Sidebar

**File**: `src/components/chat/ChatSidebar.tsx`

- Accept a new prop `activeCallConversationId: string | null` from `Index.tsx`
- When a conversation matches the active call, show a pulsing green phone icon badge next to it
- Small "В звонке" label under the conversation name

**File**: `src/pages/Index.tsx`
- Track `activeCallConversationId` state, set it when a call starts/ends from `useWebRTC`

## 3. Call History

**Database migration**: New `call_history` table:
```sql
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
-- RLS: members of conversation can view
CREATE POLICY "Members can view call history" ON public.call_history
  FOR SELECT TO authenticated
  USING (is_conversation_member(auth.uid(), conversation_id));
-- Authenticated can insert
CREATE POLICY "Authenticated can insert call history" ON public.call_history
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = caller_id);
-- Caller can update (to set ended_at)
CREATE POLICY "Caller can update call history" ON public.call_history
  FOR UPDATE TO authenticated
  USING (auth.uid() = caller_id);
```

**File**: `src/hooks/useWebRTC.ts`
- On `startCall`: insert a record into `call_history` with status `calling`
- On `connected`: update status to `connected`
- On `endCall`: update `ended_at` and calculate `duration_seconds`
- On `rejectCall`: update status to `missed`

**File**: `src/components/chat/ChatArea.tsx`
- Add a small call history section (or button to toggle it) showing recent calls for the current conversation with timestamps, duration, and missed/completed status

## 4. Channel Creation Stability (Fix)

**File**: `src/components/channels/CreateChannelDialog.tsx`
- Current code looks correct; verify the `onCreated` callback is properly wired
- Add better error logging to surface the actual Supabase error message in toast

## Implementation Order
1. Database migration for `call_history`
2. TURN server config in `useWebRTC.ts`
3. Call history insert/update logic in `useWebRTC.ts`
4. Call status badge in `ChatSidebar.tsx` + `Index.tsx` state
5. Call history UI in `ChatArea.tsx`
6. Channel creation error fix

