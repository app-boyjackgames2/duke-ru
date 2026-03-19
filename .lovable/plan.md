
# DUKE Messenger — MVP Plan

## Design
- **Color scheme**: Dark navy background (`hsl(220, 60%, 8%)`) with electric blue accents (`hsl(210, 100%, 55%)`)
- **Layout**: Two-panel — left sidebar with conversations list, right panel with active chat
- **Typography**: Clean sans-serif, modern spacing, subtle glow effects on active elements

## Phase 1: Auth & Profiles (Supabase)
- Enable Lovable Cloud with Supabase Auth (email/password)
- Create `profiles` table (id, username, avatar_url, status_text, is_online, last_seen)
- Auto-create profile on signup via trigger
- Login & signup pages with DUKE branding
- Profile settings page (edit avatar, username, status)

## Phase 2: Chat Infrastructure
- Create tables: `conversations` (id, type: direct/group, name, avatar_url, created_by), `conversation_members` (conversation_id, user_id, joined_at), `messages` (id, conversation_id, sender_id, content, type: text/file/voice, reply_to, created_at, updated_at)
- RLS policies so users only see their own conversations
- Supabase Realtime subscriptions for live message delivery
- Online/offline presence tracking via Realtime Presence

## Phase 3: Chat UI
- **Sidebar**: Search bar, list of conversations sorted by last message, unread badges, user avatars with online dot
- **Chat area**: Message bubbles (sent vs received styling), timestamps, auto-scroll, typing indicators
- **Message input**: Text input with send button, emoji picker
- New conversation: search users by username, start 1-on-1 or create group chat

## Phase 4: Reactions & Replies
- Emoji reactions on messages (stored in `message_reactions` table)
- Reply-to threading — click reply on a message, shows quoted preview above input
- Message forwarding to other conversations

## Phase 5: File & Image Sharing
- Supabase Storage bucket for chat attachments
- Upload images/files via input area (drag & drop + button)
- Image previews inline in chat, file downloads for other types
- File size limit ~50MB per upload

## Pages
- `/login` — Sign in
- `/signup` — Register
- `/` — Main chat interface (sidebar + chat)
- `/settings` — Profile settings
