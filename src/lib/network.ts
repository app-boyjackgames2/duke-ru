const NETWORK_ERROR_PATTERN = /failed to fetch|networkerror|load failed|timeout|522|503|504|connection|aborted/i;

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Exponential backoff with jitter. Only ever use for idempotent reads. */
export function backoffDelay(attempt: number, baseMs = 700, maxMs = 8000) {
  const exponential = Math.min(baseMs * 2 ** attempt, maxMs);
  return Math.round(exponential / 2 + Math.random() * (exponential / 2));
}

type RetryOptions = {
  attempts?: number;
  timeoutMs?: number;
  /** Called before each retry, e.g. to surface a status to the user. */
  onRetry?: (attempt: number) => void;
};

/**
 * Runs an idempotent read with a timeout and bounded retries on transient
 * network failures only. High-latency regions (RU/BY/KZ) get a finite,
 * predictable failure instead of a hanging request.
 */
export async function retryRead<T>(factory: () => PromiseLike<T>, options: RetryOptions = {}): Promise<T> {
  const { attempts = 3, timeoutMs = 20000, onRetry } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await withTimeout(factory(), timeoutMs);
    } catch (error) {
      lastError = error;
      if (!isTemporaryNetworkError(error) || attempt === attempts - 1) throw error;
      onRetry?.(attempt + 1);
      await sleep(backoffDelay(attempt));
    }
  }

  throw lastError;
}

export function getAuthErrorMessage(error: unknown) {
  if (!navigator.onLine) return "Нет подключения к интернету. Проверьте сеть и повторите попытку.";
  if (isTemporaryNetworkError(error)) return "Сервис временно недоступен. Данные сохранены — повторите попытку чуть позже.";

  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/invalid login credentials/i.test(message)) return "Неверный email или пароль.";
  if (/email not confirmed/i.test(message)) return "Подтвердите email перед входом.";
  if (/user already registered/i.test(message)) return "Аккаунт с таким email уже существует.";
  if (/rate limit|too many/i.test(message)) return "Слишком много попыток. Подождите минуту и повторите.";
  if (/password/i.test(message)) return "Пароль не соответствует требованиям безопасности.";
  return message || "Не удалось выполнить запрос.";
}

export function getUploadErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return "Загрузка отменена.";
  if (!navigator.onLine) return "Нет подключения к интернету. Файл сохранён — нажмите «Повторить».";
  if (isTemporaryNetworkError(error)) return "Соединение прервалось. Нажмите «Повторить», чтобы продолжить загрузку.";
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/exceeded|too large|413/i.test(message)) return "Файл слишком большой.";
  return message || "Не удалось загрузить файл.";
}
