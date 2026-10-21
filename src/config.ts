// Validate configuration without including credentials in error messages.
export function databaseUrl(value: string | undefined) {
  try {
    if (!value || value.trim() !== value) throw new Error();
    const url = new URL(value);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      url.pathname.length < 2
    ) {
      throw new Error();
    }
    return value;
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL URL with a host and database name.');
  }
}

export function runtimeConfig(env: NodeJS.ProcessEnv) {
  const connectionString = databaseUrl(env.DATABASE_URL);
  const hostname = env.HOST ?? '127.0.0.1';
  if (!hostname || /\s|[/:]/.test(hostname)) {
    throw new Error('HOST must be a hostname or IPv4 address.');
  }
  const portValue = env.PORT ?? '3000';
  const port = Number(portValue);
  if (!/^\d+$/.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535.');
  }
  const secret = env.AUTH_SECRET ?? '';
  if (!secret || /\s/.test(secret)) {
    throw new Error('Authentication secret must be nonempty and contain no whitespace.');
  }
  const ownerId = env.AUTH_OWNER_ID ?? '';
  if (!ownerId || ownerId.trim() !== ownerId) {
    throw new Error('Authentication owner ID must be nonempty with no surrounding whitespace.');
  }
  return { connectionString, hostname, port, secret, ownerId };
}
