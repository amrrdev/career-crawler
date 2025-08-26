import { JobApiServer } from "./api/server";

async function main() {
  console.log("Starting Job Posting Aggregator...");
  console.log("==================================");

  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const bypassCache = process.env.BYPASS_CACHE === 'true';
  const server = new JobApiServer(port, bypassCache);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nReceived SIGINT. Gracefully shutting down...");
    server.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("Received SIGTERM. Gracefully shutting down...");
    server.stop();
    process.exit(0);
  });

  try {
    await server.start();
    console.log("==================================");
    console.log("Job Posting Aggregator is running!");
    console.log("==================================");
    console.log(`Bypass cache: ${bypassCache ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  console.error("Application failed to start:", error);
  process.exit(1);
});
