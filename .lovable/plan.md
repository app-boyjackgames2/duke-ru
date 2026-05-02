# План работ

Запрос большой и часть пунктов несовместима с архитектурой проекта (React + Lovable Cloud / Supabase). Ниже — что реально сделаем сейчас, и что вынесено как «вне области» с честным объяснением.

## Будет реализовано

### 1. Список закреплённых сообщений + быстрый переход
- Кнопка-индикатор «📌 N» в шапке `ChatArea.tsx` рядом с поиском.
- Новый диалог `PinnedListDialog.tsx`:
  - Список всех закреплённых: автор (avatar + username), время (`formatDistanceToNow`), превью текста/типа (📷/🎙/📎), кто закрепил, когда.
  - Клик по строке → закрывает диалог и скроллит к `#msg-{id}` в чате (используем уже существующий id).
  - Клик по аватару автора → переход в его DM (через `createDirectConversation` из `useConversations`).
  - Для админов группы — кнопка «Открепить» в каждой строке.
- Хук `usePinnedMessages` уже отдаёт нужные данные; добавим в выборку `pinned_by` и подтянем профиль закрепившего.

### 2. Экспорт закреплённых (CSV / JSON) — для админа группы
- В `PinnedListDialog` две кнопки «Экспорт CSV» / «Экспорт JSON», видимые только если `canPin && convType === 'group'` (= админ группы) или в DM для обоих.
- Генерация полностью на клиенте (Blob + `URL.createObjectURL`), без edge-функции.
- Поля: `pinned_at, pinned_by_username, message_id, sender_username, message_created_at, type, content, file_url`.

### 3. Аудит закрепления/открепления
- Новая таблица `pin_audit_log`:
  - `id, conversation_id, message_id, actor_id, action ('pin'|'unpin'), created_at`
  - RLS: SELECT — члены чата; INSERT — члены чата (actor = auth.uid()); UPDATE/DELETE запрещены.
- Триггеры на `pinned_messages` AFTER INSERT / AFTER DELETE → запись в `pin_audit_log` (actor = `auth.uid()`).
- Вкладка «Аудит» в `PinnedListDialog` (Tabs: «Закреплённые» / «Аудит»):
  - Список действий: иконка pin/unpin, кто (avatar+username), когда, превью сообщения (если ещё существует).

### 4. Управление ролями участников группы
- Новый диалог `GroupMembersDialog.tsx` (открывается из header `ChatArea` для групп):
  - Список участников с ролью (admin/member).
  - Для админа — Select «admin/member» рядом с каждым (кроме себя — нельзя понизить последнего админа: проверка на клиенте + защита в политике).
  - Кнопка «Удалить из группы» (только админ, не себя).
- Миграция RLS на `conversation_members`:
  - Добавить policy UPDATE: `is_conversation_admin(auth.uid(), conversation_id)` (with check то же).
  - Расширить DELETE: разрешить админам удалять других (`auth.uid() = user_id OR is_conversation_admin(...)`).
- Защита «нельзя оставить группу без админа» — триггер BEFORE UPDATE/DELETE на `conversation_members`, который RAISE EXCEPTION, если последний admin превращается в member или удаляется.

### 5. Повтор/отмена/сброс загрузки в каналах
В `ChannelView.tsx` (`xhr` уже используется для прогресса):
- Сохранить ссылку на текущий `XMLHttpRequest` в ref.
- Кнопка «Отмена» рядом с прогресс-баром → `xhr.abort()`, очистка `attachedFile`, `uploadProgress=0`, `uploadEta=""`, `uploading=false`.
- При ошибке/abort — показать «Повторить» рядом с превью файла, по клику снова запускать `uploadFile()` с тем же `attachedFile`.
- Корректный сброс `uploadProgress`/`uploadEta` во всех путях (success/error/abort/cancel).

### 6. Фикс ошибок при создании группы (RLS)
Сейчас при создании группы из `CreateGroupDialog`:
- `conversations` insert (creator) — ок.
- `conversation_members` insert для самого себя как `admin` — ок.
- Insert остальных участников падает по RLS: политика требует `auth.uid() = user_id OR is_conversation_member(auth.uid(), conversation_id)`. На момент вставки первой записи участников `is_conversation_member` для creator уже true (он только что добавил себя), но если порядок другой — падает.
Что делаем:
- В `CreateGroupDialog` гарантировать порядок: 1) создать conversation, 2) вставить себя как admin, 3) затем bulk insert остальных участников.
- Проверить и при необходимости пересоздать SECURITY DEFINER функцию для bulk-добавления, чтобы избежать гонок.

## Вне области (объясняю почему)

- **«DUKE использует Telegram как базу данных вместо браузерной логики»** — невозможно. Telegram Bot API не является базой данных, нет произвольных запросов/RLS/реалтайма по таблицам. Архитектура проекта — Lovable Cloud (Supabase). Если нужна интеграция с Telegram (бот-уведомления, логин через Telegram) — это отдельный запрос.
- **Вкладка «Терминал» с xterm.js + node-pty, реальные Ubuntu/Debian/Fedora контейнеры в браузере** — требует серверной инфраструктуры (Docker/контейнеры, WebSocket-сервер с node-pty). Lovable хостит статический клиент + edge-функции (короткоживущие, без PTY). Можно сделать только «фейковый» терминал на xterm.js без выполнения реальных команд — это игрушка, бесполезная для работы. Рекомендую отложить и обсуждать отдельно с выбором внешнего провайдера (например, e2b.dev / WebContainers).
- **«Личные чаты — добавить возможность создания»** — уже реализовано (`NewChatDialog` + `createDirectConversation`). Пропускаем.

## Технические детали

### SQL миграция
```sql
-- audit log
create table public.pin_audit_log (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  message_id uuid not null,
  actor_id uuid not null,
  action text not null check (action in ('pin','unpin')),
  created_at timestamptz not null default now()
);
alter table public.pin_audit_log enable row level security;

create policy "Members can view pin audit"
  on public.pin_audit_log for select to authenticated
  using (public.is_conversation_member(auth.uid(), conversation_id));

create policy "Members can insert pin audit"
  on public.pin_audit_log for insert to authenticated
  with check (auth.uid() = actor_id and public.is_conversation_member(auth.uid(), conversation_id));

-- triggers
create or replace function public.log_pin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.pin_audit_log(conversation_id, message_id, actor_id, action)
  values (new.conversation_id, new.message_id, coalesce(auth.uid(), new.pinned_by), 'pin');
  return new;
end $$;

create or replace function public.log_unpin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.pin_audit_log(conversation_id, message_id, actor_id, action)
  values (old.conversation_id, old.message_id, coalesce(auth.uid(), old.pinned_by), 'unpin');
  return old;
end $$;

create trigger trg_pin_insert after insert on public.pinned_messages
  for each row execute function public.log_pin();
create trigger trg_pin_delete after delete on public.pinned_messages
  for each row execute function public.log_unpin();

alter publication supabase_realtime add table public.pin_audit_log;

-- role management
create policy "Admins can update member roles"
  on public.conversation_members for update to authenticated
  using (public.is_conversation_admin(auth.uid(), conversation_id))
  with check (public.is_conversation_admin(auth.uid(), conversation_id));

drop policy if exists "Users can leave conversations" on public.conversation_members;
create policy "Users can leave or admins can remove"
  on public.conversation_members for delete to authenticated
  using (auth.uid() = user_id or public.is_conversation_admin(auth.uid(), conversation_id));

-- prevent removing last admin
create or replace function public.ensure_admin_exists() returns trigger
language plpgsql as $$
declare admin_count int;
begin
  select count(*) into admin_count
    from public.conversation_members
    where conversation_id = coalesce(new.conversation_id, old.conversation_id)
      and role = 'admin'
      and id <> coalesce(old.id, '00000000-0000-0000-0000-000000000000'::uuid);
  if (tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin' and admin_count = 0)
     or (tg_op = 'DELETE' and old.role = 'admin' and admin_count = 0) then
    raise exception 'Cannot remove last admin';
  end if;
  return coalesce(new, old);
end $$;

create trigger trg_ensure_admin
  before update or delete on public.conversation_members
  for each row execute function public.ensure_admin_exists();
```

### Файлы
- Новые: `src/components/chat/PinnedListDialog.tsx`, `src/components/chat/GroupMembersDialog.tsx`, миграция SQL.
- Правки: `usePinnedMessages.ts` (доп. поля + аудит-выборка), `ChatArea.tsx` (кнопка списка + members-диалог), `CreateGroupDialog.tsx` (порядок insert), `ChannelView.tsx` (cancel/retry), `MessageBubble.tsx` (без изменений API).

После одобрения — реализую всё одной итерацией.