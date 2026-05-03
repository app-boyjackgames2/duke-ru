# Система трансляций в каналах

Добавляем во вкладку «Каналы» полноценные стримы: запланированный запуск, видео-плейлист или live-«Бар», уведомления и автозавершение.

## База данных (миграция)

Новые таблицы в `public`:

**streams**
- `id uuid pk`, `channel_id uuid`, `created_by uuid`
- `title text`, `description text`
- `mode text check (mode in ('video','bar'))`
- `access_type text check in ('open','link','restricted') default 'open'`
- `starts_at timestamptz not null`
- `ends_at timestamptz null` — custom end time
- `actual_started_at`, `actual_ended_at timestamptz`
- `status text check in ('scheduled','live','ended','cancelled') default 'scheduled'`
- `loop_video bool default false`
- `auto_start bool default true`
- `auto_end bool default true`
- `current_index int default 0` — индекс текущего видео (для синхронизации зрителей)
- `current_started_at timestamptz` — когда запустился текущий ролик
- `created_at`, `updated_at`

**stream_videos** (до 100 файлов)
- `id uuid pk`, `stream_id uuid`, `position int`
- `file_url text`, `file_name text`, `file_size bigint`, `duration_seconds numeric`

**stream_viewers** (presence/счётчик)
- `id`, `stream_id`, `user_id`, `joined_at`

RLS: участники канала (`is_channel_member`) видят стримы; создавать/обновлять/удалять — только модераторы канала (`is_channel_mod`). Видео — те же правила через подзапрос. Зрители — сам пользователь.

Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE streams, stream_videos, stream_viewers`.

Хранение видео: bucket `chat-attachments` (уже публичный) в папке `streams/{stream_id}/`.

## Edge function: `stream-scheduler`

Cron каждую минуту (`pg_cron` + `pg_net`). Логика:
- `scheduled` + `auto_start` + `now() >= starts_at` → `status='live'`, `actual_started_at=now()`, `current_index=0`, `current_started_at=now()`, рассылка уведомлений подписчикам канала.
- `live` + `auto_end` и достигнут `ends_at` (если задан) или конец плейлиста без `loop_video` → `status='ended'`, `actual_ended_at=now()`, уведомление с длительностью.
- Для `mode='video'` без custom end: продвижение `current_index` по сумме `duration_seconds`. Если последний ролик закончен и `loop_video=false` → завершить.

Уведомления — запись в существующую систему (см. `useNotifications`) + браузерные push (Notification API на клиенте, как в чатах).

## Frontend

**`src/components/channels/streams/`**
- `CreateStreamDialog.tsx` — форма: название, описание, режим (radio Video/Бар), access_type, starts_at, опц. ends_at, флаги loop/auto-start/auto-end. Для Video — мультизагрузка до 100 файлов с прогрессом (переиспользуем XHR-логику из `ChannelView`), создание `streams` + `stream_videos`.
- `StreamsList.tsx` — список запланированных/идущих/завершённых стримов канала, кнопка «Создать» для модов.
- `StreamPlayer.tsx` — экран просмотра:
  - Бейдж `| ПРЯМОЙ ЭФИР | HH:MM:SS`, после 24ч `| ПРЯМОЙ ЭФИР | N DAY: HH:MM`. Тикер на `setInterval`.
  - Режим **video**: `<video autoPlay>` без controls (нельзя паузить/перематывать), src берётся из `stream_videos[current_index]`, синхронизация по `current_started_at` (seek = now − current_started_at). Авто-переход к следующему через realtime-обновление `current_index`. Кнопка «Завершить» скрыта.
  - Режим **bar**: WebRTC live (переиспользуем `useWebRTC`) — микрофон, звук, демонстрация экрана (`getDisplayMedia`). Кнопка «Завершить» доступна владельцу/модам.
- `StreamBadge.tsx` — индикатор LIVE в списке каналов.

**Интеграция:**
- `ChannelView.tsx` — вкладка «Трансляции», кнопка «Создать стрим» для модов.
- `useNotifications.ts` — обработка событий `stream_started` / `stream_ended` с текстом по ТЗ (включая длительность через `date-fns`).
- Роуты: `/channel/:name/stream/:id` для отдельной страницы плеера.

## Уведомления (тексты)

- Старт: `"{title} уже начался стрим"`.
- Конец: `"{title} уже закончился стрим. Результат длительность {duration}"` (формат `Hч Mм Sс`).

Триггеры — edge function (для авто) и клиент (для ручного «Завершить» в Бар-режиме).

## Ограничения и заметки

- Видеофайлы — Supabase Storage (S3-коннектор был отклонён ранее), лимит инстанса 50MB по умолчанию. Для крупных файлов используем уже реализованный resumable-XHR; если упрётся в лимит хранилища — предупредим пользователя.
- «Нельзя ставить на паузу» обеспечивается отсутствием `controls` и обработчиком `onPause` → `play()`.
- Синхронизация зрителей — через серверное `current_started_at` (без WebRTC для video-режима).

## Файлы

Создать: миграция SQL, `supabase/functions/stream-scheduler/index.ts`, `CreateStreamDialog.tsx`, `StreamsList.tsx`, `StreamPlayer.tsx`, `StreamBadge.tsx`, `useStreams.ts`.
Изменить: `ChannelView.tsx`, `ChannelPage.tsx`, `useNotifications.ts`, `App.tsx` (роут), `i18n/translations.ts`.
