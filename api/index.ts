import { createApp, readConfig } from "../src/server.js";

/**
 * Vercel entry point. The whole app is one Express server: the paid seller,
 * the proof endpoint and the judge page.
 */
const app = createApp(readConfig());

export default app;
export const config = { maxDuration: 60 };
