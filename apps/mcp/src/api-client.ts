import type { Task } from './find-tasks.js';

export interface ApiConfig {
  /** Base URL of the api, e.g. `http://localhost:4000`. */
  url: string;
  /** Credentials of the user the server acts as. */
  email: string;
  password: string;
}

const endpoint = (url: string, path: string) => new URL(path, `${url}/`);

async function login({ url, email, password }: ApiConfig): Promise<string> {
  const response = await fetch(endpoint(url, 'auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`api login failed with ${response.status}`);
  }
  return ((await response.json()) as { accessToken: string }).accessToken;
}

// Authenticated api client: logs in lazily and again when the token expires.
// Reuses the api's own read side: `GET /meetings` (ListMeetingsQuery) already
// limits the result to meetings the user owns or is invited to.
export function createApiClient(config: ApiConfig) {
  // The promise is cached, so parallel tool calls share one login.
  let token: Promise<string> | undefined;

  const accessToken = () =>
    (token ??= login(config).catch((error: unknown) => {
      token = undefined; // a failed login must not stay cached
      throw error;
    }));

  const getMeetings = async () =>
    fetch(endpoint(config.url, 'meetings'), {
      headers: { Authorization: `Bearer ${await accessToken()}` },
    });

  return {
    async listTasks(): Promise<Task[]> {
      let response = await getMeetings();
      if (response.status === 401) {
        token = undefined;
        response = await getMeetings();
        if (response.status === 401) {
          throw new Error('api rejected the token it just issued (401)');
        }
      }
      if (!response.ok) {
        throw new Error(`api responded ${response.status} to GET /meetings`);
      }
      return (await response.json()) as Task[];
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
