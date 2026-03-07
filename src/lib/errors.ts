type ResponsePayload = {
  error?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
  error_description?: unknown;
};

type ErrorLike = {
  error?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
  error_description?: unknown;
  context?: Response;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function collectErrorParts(source: ErrorLike | ResponsePayload): string[] {
  return [
    typeof source.message === "string" ? source.message : null,
    typeof source.error === "string" ? source.error : null,
    typeof source.details === "string" ? source.details : null,
    typeof source.hint === "string" ? `Hint: ${source.hint}` : null,
    typeof source.error_description === "string" ? source.error_description : null,
    typeof source.code === "string" ? `Code: ${source.code}` : null,
  ].filter((part): part is string => Boolean(part && part.trim()));
}

export function formatErrorMessage(error: unknown, fallback = "Error desconocido"): string {
  if (error instanceof Error) {
    const parts = collectErrorParts(error as ErrorLike);
    if (parts.length > 0) {
      return parts.join(" | ");
    }

    return error.message || fallback;
  }

  if (typeof error === "string") {
    return error || fallback;
  }

  if (isObject(error)) {
    const parts = collectErrorParts(error as ErrorLike);
    if (parts.length > 0) {
      return parts.join(" | ");
    }

    try {
      return JSON.stringify(error);
    } catch {
      return fallback;
    }
  }

  return fallback;
}

export async function formatFunctionErrorMessage(error: unknown, fallback = "Error desconocido"): Promise<string> {
  if (!isObject(error)) {
    return formatErrorMessage(error, fallback);
  }

  const context = error.context;
  if (context instanceof Response) {
    try {
      const payload = (await context.clone().json()) as ResponsePayload;
      const parts = collectErrorParts(payload);
      if (parts.length > 0) {
        return parts.join(" | ");
      }
    } catch {
      try {
        const text = (await context.clone().text()).trim();
        if (text) {
          return text;
        }
      } catch {
        // Ignore invalid response bodies and fall back to local error formatting.
      }
    }
  }

  return formatErrorMessage(error, fallback);
}

export function logError(scope: string, error: unknown, extra?: unknown) {
  if (extra === undefined) {
    console.error(scope, error);
    return;
  }

  console.error(scope, error, extra);
}
