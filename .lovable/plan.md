

# DUKE — Уведомления + Редактирование канала + Поделиться

## 1. Уведомления при бане и исключении

**Файл**: `src/components/channels/ChannelView.tsx`

В `handleKick` и `handleBan` — после успешного действия показывать toast с именем пользователя:
- Kick: `toast.success("Пользователь {username} исключён из канала")`
- Ban: `toast.success("Пользователь {username} заблокирован")`

Добавить новые ключи в `src/i18n/translations.ts`:
- `user_kicked`, `user_banned`, `channel_edited`, `edit_channel`, `share_channel`, `link_copied`, `channel_name`, `channel_description`, `access_type_label`, `subscribers`

## 2. Редактирование канала в ChannelView

**Файл**: `src/components/channels/ChannelView.tsx`

Добавить кнопку редактирования (Pencil icon) в header рядом с кнопкой удаления (видна только создателю). По клику — Dialog с формой:
- Поле «Название канала» (prefilled)
- Поле «Описание» (prefilled)
- Select «Тип доступа» (open / link / restricted)
- Кнопка «Сохранить» → `supabase.from("channels").update({...}).eq("id", channel.id)` → `onRefresh()`

## 3. Кнопка «Поделиться» в ChannelView

**Файл**: `src/components/channels/ChannelView.tsx`

Добавить кнопку Share2 в header. По клику — копировать `window.location.origin + "/channel/" + channel.name` в буфер обмена, показать toast.

## 4. ChannelPage.tsx — i18n

**Файл**: `src/pages/ChannelPage.tsx`

Заменить хардкод-строки на `t(key, lang)` с использованием `useLanguage`. Всё остальное (маршрут, подписка, типы доступа, кнопка «Поделиться») уже реализовано.

## Порядок
1. Добавить i18n ключи в `translations.ts`
2. Уведомления в `handleKick`/`handleBan` в `ChannelView.tsx`
3. Кнопки «Редактировать» и «Поделиться» в header `ChannelView.tsx`
4. i18n в `ChannelPage.tsx`

