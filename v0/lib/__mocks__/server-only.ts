// No-op mock for the `server-only` package in Vitest environments.
// In production Next.js, `server-only` throws when imported from client code.
// In tests we neutralise it so server-module unit tests can run under jsdom.
export {}
