import "reflect-metadata";
import { Server } from "./server";

/**
 * Main entry point
 */
async function main() {
  console.log("Starting Zkcash Backend Service...");

  const server = new Server();

  // Handle shutdown gracefully
  process.on("SIGINT", async () => {
    console.log("\nReceived SIGINT, shutting down gracefully...");
    await server.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\nReceived SIGTERM, shutting down gracefully...");
    await server.stop();
    process.exit(0);
  });

  try {
    await server.initialize();
    await server.start();
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();



