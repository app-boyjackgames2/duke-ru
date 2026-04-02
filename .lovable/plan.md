# DUKE — Обновление 02.04.2026

## 1. Автоматическое определение языка (RU/EN)

**Новый файл**: `src/hooks/useLanguage.ts`
- Определяет язык через `navigator.language` (ru/en)
- Хранит выбор в `localStorage` (`duke-lang`)
- Экспортирует `lang` и `setLang`, а также хелпер `t(key)` для переводов

**Новый файл**: `src/i18n/translations.ts`
- Словарь строк интерфейса на русском и английском (sidebar labels, кнопки, placeholder'ы, диалоги)

**Обновляемые файлы** (замена хардкод-строк на `t(key)`):
- `ChatSidebar.tsx` — «Поиск...», «Каналы», «Чаты», «В сети», «Ничего не найдено»
- `ChannelList.tsx` — «Каналы», «Нет каналов», «участн.»
- `Settings.tsx` — заголовки секций
- `ChannelView.tsx`, `CreateChannelDialog.tsx` — labels

## 2. Роли и модерация для каналов

**Миграция**:
```sql
-- Добавить роль 'moderator' в channel_members
-- (role уже есть: 'member' default; добавим 'admin', 'moderator')
-- Добавить таблицу channel_bans для блокировки
CREATE TABLE IF NOT EXISTS public.channel_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL,
  user_id uuid NOT NULL,
  banned_by uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);
ALTER TABLE public.channel_bans ENABLE ROW LEVEL SECURITY;

-- RLS: создатель/модератор может банить
CREATE OR REPLACE FUNCTION public.is_channel_mod(_user_id uuid, _channel_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE user_id = _user_id AND channel_id = _channel_id AND role IN ('admin', 'moderator')
  );
$$;

-- Policies for channel_bans
CREATE POLICY "Mods can manage bans" ON public.channel_bans
  FOR ALL TO authenticated USING (is_channel_mod(auth.uid(), channel_id))
  WITH CHECK (is_channel_mod(auth.uid(), channel_id));

CREATE POLICY "Members can view bans" ON public.channel_bans
  FOR SELECT TO authenticated USING (is_channel_member(auth.uid(), channel_id));

-- Update channel_members: allow mods to update roles
CREATE POLICY "Mods can update member roles" ON public.channel_members
  FOR UPDATE TO authenticated USING (is_channel_mod(auth.uid(), channel_id));

-- Update channel_posts: mods can delete any post
CREATE POLICY "Mods can delete posts" ON public.channel_posts
  FOR DELETE TO authenticated USING (is_channel_mod(auth.uid(), channel_id));
```

**UI**: В `ChannelView.tsx` добавить:
- Кнопка «Участники» → список с ролями (admin/moderator/member)
- Для создателя/модератора: назначение ролей, удаление участников, бан
- Модераторы могут удалять посты других пользователей

## 3. Поиск каналов в sidebar

**Файл**: `ChatSidebar.tsx`
- Существующий поиск уже фильтрует чаты. Расширить: фильтровать также каналы по названию
- Передавать `search` в `ChannelList` как проп, фильтровать `channels` по `name.includes(search)`

**Файл**: `ChannelList.tsx`
- Принять `searchQuery?: string`
- Фильтровать список каналов по `searchQuery`

## Порядок реализации
1. Миграция: `channel_bans` + `is_channel_mod` + RLS
2. `useLanguage.ts` + `translations.ts`
3. Поиск каналов в sidebar
4. UI модерации в `ChannelView`
5. Замена хардкод-строк на `t(key)`
