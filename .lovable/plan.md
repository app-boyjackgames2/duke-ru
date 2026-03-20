

# DUKE Messenger — Update 20.03.2026

## Overview
Four features: group chats, Google sign-in, typing indicator, emoji picker.

---

## 1. Group Chats

**Database**: No schema changes needed — `conversations` table already supports `type='group'`, `name`, `avatar_url`.

**New component**: `CreateGroupDialog.tsx`
- Step 1: Enter group name, upload avatar to `avatars` bucket
- Step 2: Search and select multiple users (checkboxes)
- Step 3: Create conversation with `type='group'`, insert all selected members into `conversation_members`

**UI changes**:
- Add "Create Group" button in `ChatSidebar` (or option in existing `NewChatDialog`)
- `ChatArea` header: show member count for groups, display group name/avatar
- Group messages show sender names above each bubble (already implemented via `showAvatar`)

**Hook changes**: Add `createGroupConversation(name, avatarUrl, memberIds)` to `useConversations`.

---

## 2. Sign in with Google

Use Lovable Cloud managed Google OAuth (no API key needed).

- Run the **Configure Social Login** tool to generate `src/integrations/lovable/` module
- Add Google sign-in button on `Login.tsx` and `Signup.tsx` using `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`
- Style button with Google branding in DUKE theme

---

## 3. Typing Indicator

**Approach**: Use Supabase Realtime Presence (no DB table needed).

- In `ChatArea`, track presence on a channel per conversation
- When user types in `MessageInput`, broadcast `{ typing: true, username }` via presence
- Display "Username печатает..." below messages when other users are typing
- Debounce: stop typing status 2 seconds after last keystroke

**New hook**: `useTypingIndicator(conversationId)` — returns `typingUsers: string[]` and `setTyping(isTyping)`.

---

## 4. Emoji Picker

Install `emoji-mart` or `@emoji-mart/react` package for a full emoji picker.

- Add emoji button (😀) in `MessageInput` next to the paperclip
- Click opens a popover with the full emoji picker grid
- Selecting an emoji inserts it into the text input at cursor position
- Keep the existing quick-reaction emojis on `MessageBubble` as-is

---

## Implementation Order
1. Database: no migrations needed
2. Configure Google OAuth (tool call)
3. Build `CreateGroupDialog` + update hooks
4. Build `useTypingIndicator` hook + integrate into `ChatArea`/`MessageInput`
5. Add emoji picker to `MessageInput`
6. Update `Login.tsx`/`Signup.tsx` with Google button

