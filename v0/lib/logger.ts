/* eslint-disable no-console */

const shouldLogInDev = process.env.NODE_ENV !== "production";

const logIf = (shouldLog: boolean, callback: (...args: unknown[]) => void, ...args: unknown[]) => {
  if (!shouldLog) return;
  callback(...args);
};

export const logger = {
  debug: (...args: unknown[]) => logIf(shouldLogInDev, console.debug, ...args),
  info: (...args: unknown[]) => logIf(true, console.info, ...args),
  warn: (...args: unknown[]) => logIf(true, console.warn, ...args),
  error: (...args: unknown[]) => logIf(true, console.error, ...args),
  log: (...args: unknown[]) => logIf(shouldLogInDev, console.log, ...args),
};
