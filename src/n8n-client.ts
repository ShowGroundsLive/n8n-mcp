export class N8nApiError extends Error {
  constructor(
    public statusCode: number,
    public statusText: string,
    public body: string
  ) {
    super(`n8n API error ${statusCode} ${statusText}: ${body}`);
    this.name = "N8nApiError";
  }
}

export class N8nClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "") + "/api/v1";
    this.apiKey = apiKey;
  }

  private buildUrl(path: string, query?: Record<string, unknown>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private get headers(): Record<string, string> {
    return {
      "X-N8N-API-KEY": this.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  private async request(
    method: string,
    path: string,
    options?: { body?: unknown; query?: Record<string, unknown> }
  ): Promise<unknown> {
    const url = this.buildUrl(path, options?.query);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: this.headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });
    } catch (err) {
      throw new Error(
        `Cannot reach n8n instance at ${this.baseUrl}: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const text = await response.text();

    if (!response.ok) {
      throw new N8nApiError(response.status, response.statusText, text);
    }

    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }

  async get(path: string, query?: Record<string, unknown>): Promise<unknown> {
    return this.request("GET", path, { query });
  }

  async post(path: string, body?: unknown): Promise<unknown> {
    return this.request("POST", path, { body });
  }

  async put(path: string, body?: unknown): Promise<unknown> {
    return this.request("PUT", path, { body });
  }

  async patch(path: string, body?: unknown): Promise<unknown> {
    return this.request("PATCH", path, { body });
  }

  async delete(path: string): Promise<unknown> {
    return this.request("DELETE", path);
  }
}
