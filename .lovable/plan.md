
# DUKE LIVE v1.0 + DUKE Ads — план реализации

Большой changelog. Разбиваю на фазы по приоритету. Фазы 1–4 — ядро DUKE LIVE из верхних пунктов. Фазы 5–7 — расширенный режим «Вещание» и DUKE Ads (можно итеративно).

## Фаза 1. Страница стрима + доступ + панель управления

### БД (миграция)
- `streams`: добавить `access_token text` (для unlisted), `logo_url text`, `age_rating text check in ('0+','6+','12+','16+','18+')`, `is_broadcast bool default false`, `disable_ads bool default false`.
- `stream_chat_messages`: `id, stream_id, user_id, content text, attachment_url text, created_at, deleted_at`.
- `stream_chat_reactions`: `id, message_id, user_id, emoji, unique(message_id,user_id,emoji)`.
- `stream_viewers`: индекс `(stream_id, user_id)`, поле `last_seen_at` для онлайн-присутствия (heartbeat). Добавить триггер на `joined_at` и cleanup-функцию.
- `stream_notifications` (инбокс): `id, user_id, stream_id, type ('started'|'ended'|'upcoming'|'next'), payload jsonb, read_at, created_at`.
- `user_notification_prefs`: `user_id pk, stream_alerts bool default true`.
- RLS:
  - стрим/видео: чтение если `is_channel_member` ИЛИ `access_type='open'` ИЛИ (`access_type='link'` AND токен совпадает — проверяется в edge function, RLS даёт open + member).
  - chat insert: только viewer/member, не deleted_at, проверка `status='live'`.
  - reactions insert/delete: автор реакции.
  - notifications: только владелец.
- Realtime: добавить новые таблицы в `supabase_realtime`.

### Edge function
- `stream-access` (verify_jwt=false): `GET ?stream_id&token` → проверяет access_type, возвращает данные стрима + одноразовый short-lived JWT для зрителя по ссылке.
- `stream-scheduler` обновить:
  - писать в `stream_notifications` события start/end/upcoming/next вместо только статуса.
  - анонсы: за 5–20 мин и 1–24 ч до `starts_at` (записать `upcoming`).
  - «Смотрите далее» за 2:01 и 0:31 до конца текущего видео (для `is_broadcast` или video-mode плейлиста).
  - «Скоро стрим закончится» за 4:31/2:01/0:31.
- `stream-control` (verify_jwt=true): ручной старт/стоп/skip-next, проверка прав владельца/мода канала.

### Фронтенд
- `src/pages/StreamPage.tsx` (новый роут `/channel/:name/stream/:id`) — заменяет текущий `StreamPlayer.tsx` как полноценная страница:
  - Левая колонка: плеер (переиспользуем логику из StreamPlayer) + панель управления для владельца/мода (Старт, Завершить + поле причины, Следующий ролик).
  - Правая колонка (desktop) / табы (mobile):
    - **Видео-плейлист** со списком, текущий индекс подсвечен.
    - **Чат зрителей** (новый `StreamChat.tsx`) — сообщения, вложения через storage, реакции, soft-delete для модерации.
    - **Онлайн-зрители** (`ViewersList.tsx`) — heartbeat каждые 20с в `stream_viewers.last_seen_at`, фильтр `last_seen_at > now()-60s`.
- `src/hooks/useStreamChat.ts`, `useStreamViewers.ts`, `useStreamAccess.ts` (валидация токена из URL `?t=...`).
- Панель управления — компонент `StreamControlPanel.tsx`, использует `stream-control`.
- `CreateStreamDialog.tsx`: добавить выбор access_type (public/unlisted/restricted), генерация ссылки с токеном, выбор логотипа, age rating, флаги loop/auto-start/auto-end/disable_ads.
- `StreamsList.tsx`: фильтр видимости по access_type, бейджи LIVE/Запланировано, копирование invite-link для unlisted.

### Синхронизация плеера
- `StreamPlayer` → плавная коррекция: если `|currentTime - target| < 1.5s` → `playbackRate = 1.05/0.95` на 2с; если ≥1.5s — seek; периодическая проверка раз в 5с.
- Плавный переход между роликами: при изменении `current_index` предзагружать следующий через скрытый `<video preload="auto">`.

## Фаза 2. Инбокс уведомлений

- Компонент `NotificationsInbox.tsx` — выпадающее меню в шапке (колокольчик) + бейдж с непрочитанными.
- Хук `useNotificationsInbox.ts` — realtime подписка на `stream_notifications` пользователя.
- Действия: «Отметить прочитанным», «Прочитать все», «Открыть стрим».
- Настройки → переключатель «Уведомления о трансляциях» → пишет в `user_notification_prefs`.
- Браузерные `Notification` остаются, но триггерятся только если `stream_alerts=true`.

## Фаза 3. Программа передач (schedule)

- Таблица `stream_programs`: `id, stream_id, title, video_url, starts_at, age_rating, loop bool, notify_program bool, notify_premiere bool, position int`.
- Таблица `program_requests` (заявки): `id, stream_id, payload jsonb, status ('pending'|'accepted'|'rejected'), created_by, applies_at` (следующий четверг 00:00).
- Cron-job (pg_cron): каждый четверг 00:00 — применяет `accepted` заявки.
- UI: вкладка «Программа передач» внутри страницы стрима, кнопки «Добавить» (для участника → создаёт заявку, для админа — сразу), «Создать заявку», «Отмена».
- Уведомления премьеры/возрастного рейтинга/«Курение вредит» — оверлеи в плеере с fade in/out (CSS-анимация `animate-fade-in`/`animate-fade-out`).

## Фаза 4. Режим «Вещание» (broadcast)

- Флаг `is_broadcast` на streams — расширенный плеер с:
  - постоянным логотипом-оверлеем,
  - оверлеями уведомлений (рейтинг 11с, предупреждение 9с, премьера, «Скоро закончится», «Смотрите далее»),
  - запуском видео всегда с 0:00 (без offset-синхронизации),
  - автопереходом без чёрных экранов (двойной `<video>` с кросс-фейдом).

## Фаза 5. DUKE Ads (фундамент)

- Таблицы: `ad_campaigns` (created_by, status, email_verified_at), `ad_creatives` (campaign_id, video_url, duration), `ad_targets` (campaign_id, channel_id), `ad_impressions` (campaign_id, creative_id, stream_id, shown_at, viewer_id).
- Edge function `ads-verify` (отправка email-кода через Resend/SMTP, требует подключения почтового домена — вынести как отдельный шаг).
- Edge function `ads-queue`: возвращает плеера 5–20 роликов для блока (фильмы — каждые 12–30 мин, мультфильмы — после ролика).
- Плеер вставляет блок: пауза фильма → проигрывает очередь → продолжает с сохранённой позиции.
- UI вкладка `/ads`: список кампаний, мастер создания, статистика показов.

## Фаза 6. Preview + Embed

- Кнопка «Поделиться» на странице стрима → диалог с iframe-кодом `<iframe src="/embed/stream/:id?t=token">`.
- Роут `/embed/stream/:id` — минималистичная страница плеера без чата/сайдбаров.

## Фаза 7. Хранилище (заглушка)

- В диалоге программы передач — селектор «Источник: Хранилище (скоро, до 7 мая)» с disabled-вариантом и подсказкой. Реальная интеграция — отдельная задача.

## Открытые вопросы / риски

- DUKE Ads email-верификация требует SMTP/Resend — нужен будет API key и подключённый домен (фаза 5 заблокирована до этого).
- Лимит размера файлов в Supabase Storage (50MB) — для длинных видео и рекламы предупредим UI-сообщением (S3 ранее отклонён).
- Возможный рост нагрузки на realtime-чат стрима — введём rate limit (1 сообщение/сек на user) на уровне edge function `stream-chat-send`.

## Что попадает в первую итерацию (рекомендую утвердить как MVP)

Фазы **1, 2, базовая часть 3** (программа передач без системы заявок и cron-обновления по четвергам — добавим во второй итерации). Остальные фазы (Broadcast-режим с оверлеями, DUKE Ads, Embed, Хранилище) — следующими PR-ами по мере утверждения.

Подтвердите MVP-скоуп (или скажите «всё сразу»), и я приступаю к реализации.
