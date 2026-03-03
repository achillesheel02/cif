#!/usr/bin/env node
/**
 * CIF — Convergent Identity Framework
 * MCP server entry point
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
const server = createServer();
const transport = new StdioServerTransport();
server.connect(transport).catch((err) => {
    console.error("[cif] Fatal error:", err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map