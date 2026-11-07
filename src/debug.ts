/** Prints a timestamped progress message to stderr when `SLIDEV_CHECK_DEBUG` is set. */
export const debug = process.env['SLIDEV_CHECK_DEBUG']
  ? (message: string): void => console.error(`[check-debug] ${Date.now() % 100_000} ${message}`)
  : (): void => {};
