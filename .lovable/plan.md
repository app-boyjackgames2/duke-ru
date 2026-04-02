

# DUKE — Обновление 02.04.2026

## 1. Миграция: Модерация каналов

Новая таблица `channel_bans` + функция `is_channel_mod` + RLS:

```sql
CREATE TABLE public.channel_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL,
  user_id uuid NOT NULL,
  banned_by uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);
ALTER TABLE public.channel_bans ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_channel_mod(_user_id uuid, _channel_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE user_id = _user_id AND channel_id = _channel_id AND role IN ('admin', 'moderator')
  );
$$;
```

Policies: mods can insert/delete bans, members can view bans, mods can update member roles, mods can delete posts and kick members.

## 2. i18n — Авто-определение языка

**Новый файл** `src/i18n/translations.ts` — словарь ~70 ключей (RU/EN) для всех строк интерфейса.

**Новый файл** `src/hooks/useLanguage.ts` — определяет язык из `navigator.language`, хранит в `localStorage` (`duke-lang`), экспортирует `{ lang, setLang }`.

## 3. Поиск каналов в sidebar

- `ChatSidebar.tsx` — передать `searchQuery={search}` в `ChannelList`
- `ChannelList.tsx` — принять `searchQuery?: string`, фильтровать `channels.filter(ch => ch.name.toLowerCase().includes(searchQuery))`

## 4. UI модерации в ChannelView

В `ChannelView.tsx` добавить:
- Кнопка «Участники» (Users icon) → Sheet/Dialog со списком участников
- Загрузка участников из `channel_members` + `profiles`
- Для каждого участника: роль (admin/moderator/member)
- Для creator/mod: кнопки назначить модератором, исключить, забанить
- Модераторы видят кнопку удаления постов других авторов

## 5. Замена строк на t()

Обновить файлы, заменив хардкод-строки на `t(key, lang)`:
- `ChatSidebar.tsx`
- `ChannelList.tsx`
- `ChannelView.tsx`
- `Settings.tsx` (+ добавить переключатель языка RU/EN)

## 6. Переключатель языка в Settings

В `Settings.tsx` добавить секцию «Язык» с двумя кнопками: **Русский** / **English**.

## Порядок
1. Миграция
2. `translations.ts` + `useLanguage.ts`
3. Поиск каналов в sidebar
4. Модерация UI в ChannelView
5. Замена строк + переключатель языка в Settings

