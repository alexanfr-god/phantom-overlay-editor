const RESET = "\x1b[0m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";

function timestamp(): string {
  return new Date().toTimeString().slice(0, 12); // HH:MM:SS.mmm
}

export const log = {
  info: (msg: string, ...args: unknown[]) =>
    console.log(`${CYAN}[${timestamp()}]${RESET} ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) =>
    console.warn(`${YELLOW}[${timestamp()}] WARN${RESET} ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) =>
    console.error(`${RED}[${timestamp()}] ERROR${RESET} ${msg}`, ...args),
  ok: (msg: string, ...args: unknown[]) =>
    console.log(`${GREEN}[${timestamp()}] ✓${RESET} ${msg}`, ...args),
};
