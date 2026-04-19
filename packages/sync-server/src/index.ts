import { createSyncServer } from "./server";
import { log } from "./logger";

const PORT = parseInt(process.env.PORT ?? "3333", 10);

const wss = createSyncServer(PORT);

process.on("SIGINT", () => {
  log.info("shutting down...");
  wss.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  wss.close(() => process.exit(0));
});
