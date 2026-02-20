interface JsonErrorResponse {
  error?: string;
  message?: string;
}

interface RequestJsonOptions extends Omit<RequestInit, "headers"> {
  headers?: HeadersInit;
  token?: string | null;
}

const API_BASE_URL = "/api" as const;

const buildHeaders = (
  headers?: HeadersInit,
  token?: string | null
): Headers => {
  const normalizedHeaders = new Headers(headers);
  if (token) {
    normalizedHeaders.set("Authorization", `Bearer ${token}`);
  }
  return normalizedHeaders;
};

const getErrorMessage = async (response: Response): Promise<string> => {
  const fallbackMessage = `Request failed with status ${response.status}`;

  try {
    const data = (await response.json()) as JsonErrorResponse;
    return data.message ?? data.error ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
};

export const requestJson = async <T>(
  path: string,
  options: RequestJsonOptions = {}
): Promise<T> => {
  const { headers, token, ...requestInit } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestInit,
    headers: buildHeaders(headers, token),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as T;
};

export const requestEmpty = async (
  path: string,
  options: RequestJsonOptions = {}
): Promise<void> => {
  const { headers, token, ...requestInit } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestInit,
    headers: buildHeaders(headers, token),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
};
