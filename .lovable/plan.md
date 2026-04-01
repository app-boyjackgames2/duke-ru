

# DUKE — Обновление 01.04.2026: Новые функции каналов

## Что уже реализовано (пропускаем)
- Landing Page (Home/Features/Download) + APK кнопка
- Групповые чаты, звонки, история звонков, уведомления
- Тёмная/светлая тема
- Создание личных чатов, файлы в чатах

## Что нужно добавить

### 1. Публичная страница канала (`/@channel_name`)

**Маршрут**: `/channel/:channelName` в `App.tsx`

**Новая страница**: `src/pages/ChannelPage.tsx`
- Загружает канал по `name` из URL
- Показывает: название, описание, аватар, кол-во участников, последние посты
- Кнопка «Подписаться» (для авторизованных — вставляет в `channel_members`; для неавторизованных — редирект на `/login`)
- Кнопка «Поделиться ссылкой» (копирует URL)

### 2. Типы доступа к каналам

**Миграция**: добавить колонку `access_type` в `channels`:
```sql
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS access_type text NOT NULL DEFAULT 'open';
```
Значения: `open` (всем), `link` (по ссылке), `restricted` (по приглашению).

**Обновить RLS**: для `open` каналов — `SELECT` доступен всем authenticated; для `link`/`restricted` — только членам + создателю.

**UI**: в `CreateChannelDialog` добавить выбор типа доступа. В `ChannelPage` — показывать кнопку подписки только для `open`/`link`.

### 3. @channel_name упоминания в чате

**Файл**: `src/components/chat/MessageBubble.tsx`
- В тексте сообщения парсить `@channel_name` через regex
- Заменять на кликабельную ссылку, ведущую на `/channel/channel_name`

### 4. Загрузка файлов в каналы

**Файл**: `src/components/channels/ChannelView.tsx`
- Добавить кнопку прикрепления файла рядом с полем публикации
- Загрузка в Supabase Storage bucket `chat-attachments` (путь: `channels/{channelId}/{timestamp}.{ext}`)
- Лимит 50 МБ
- После загрузки — передать URL в `createPost` как `image_url` (для изображений показывать превью, для файлов — ссылку)

**Миграция**: добавить колонку `file_url` и `file_name` в `channel_posts`:
```sql
ALTER TABLE public.channel_posts ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE public.channel_posts ADD COLUMN IF NOT EXISTS file_name text;
```

**Обновить `useChannels.ts`**: `createPost` принимает `fileUrl`/`fileName`.

### 5. RLS для публичных страниц каналов

Добавить политику SELECT на `channels` для `open` типа — доступ всем authenticated:
```sql
CREATE POLICY "Anyone can view open channels"
ON public.channels FOR SELECT TO authenticated
USING (access_type = 'open');
```

## Порядок реализации
1. Миграция: `access_type`, `file_url`, `file_name` + RLS
2. `ChannelPage.tsx` + маршрут в `App.tsx`
3. Тип доступа в `CreateChannelDialog`
4. Файлы в `ChannelView` + `useChannels`
5. @упоминания в `MessageBubble`

