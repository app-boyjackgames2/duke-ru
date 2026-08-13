const NETWORK_ERROR_PATTERN = /failed to fetch|networkerror|load failed|timeout|522|connection/i;

export class RequestTimeoutError extends Error {
  constructor() {
    super("Request timed out");
    this.name = "RequestTimeoutError";
  }
}

export async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RequestTimeoutError()), timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(promise), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function isTemporaryNetworkError(error: unknown) {
  if (!navigator.onLine || error instanceof RequestTimeoutError) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return NETWORK_ERROR_PATTERN.test(message);
}

export function getAuthErrorMessage(error: unknown) {
  if (!navigator.onLine) return "Нет подключения к интернету. Проверьте сеть и повторите попытку.";
  if (isTemporaryNetworkError(error)) return "Сервис временно недоступен. Данные сохранены — повторите попытку чуть позже.";

  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/invalid login credentials/i.test(message)) return "Неверный email или пароль.";
  if (/email not confirmed/i.test(message)) return "Подтвердите email перед входом.";
  if (/user already registered/i.test(message)) return "Аккаунт с таким email уже существует.";
  if (/password/i.test(message)) return "Пароль не соответствует требованиям безопасности.";
  return message || "Не удалось выполнить запрос.";
}