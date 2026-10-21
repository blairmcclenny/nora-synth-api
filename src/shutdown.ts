// Stop accepting requests before closing the pool used by active handlers.
export function createShutdown(
  server: {
    close(callback: (error?: Error) => void): unknown;
    closeAllConnections?: () => void;
  },
  pool: { end(): Promise<void> },
  options: {
    timeoutMs?: number;
    exit?: (code: number) => void;
    logError?: (error: unknown) => void;
  } = {},
) {
  const exit = options.exit ?? ((code) => process.exit(code));
  const logError = options.logError ?? console.error;
  let stopping = false;

  return () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => {
      logError(new Error('Graceful shutdown timed out.'));
      server.closeAllConnections?.();
      exit(1);
    }, options.timeoutMs ?? 10_000);

    server.close((error) => {
      void (async () => {
        let failed = Boolean(error);
        if (error) logError(error);
        try {
          await pool.end();
        } catch (poolError) {
          failed = true;
          logError(poolError);
        }
        clearTimeout(deadline);
        exit(failed ? 1 : 0);
      })();
    });
  };
}
