

# DUKE — AlertDialog для подтверждения удаления чата

## Что будет сделано

**Файл**: `src/components/chat/ChatSidebar.tsx`

Заменить мгновенное удаление чата на подтверждение через `AlertDialog`:

1. Импортировать компоненты `AlertDialog` из `@/components/ui/alert-dialog`
2. Добавить состояние `deletingConvId` для хранения ID чата, который пользователь хочет удалить
3. Кнопка Trash2 теперь открывает AlertDialog вместо немедленного удаления
4. AlertDialog показывает заголовок и описание с подтверждением
5. Кнопка «Удалить» выполняет `leaveConversation`, кнопка «Отмена» закрывает диалог

**Файл**: `src/i18n/translations.ts`

Добавить ключи: `confirm_delete_chat`, `confirm_delete_chat_desc`, `cancel`, `delete`

## Поведение
- Hover на чате → иконка корзины
- Клик по корзине → AlertDialog: «Удалить чат? Вы больше не будете видеть этот чат»
- «Удалить» → удаление + toast
- «Отмена» → закрытие диалога

