import { createApp, readConfig } from "./server.js";

const config = readConfig();
const app = createApp(config);
const port = Number(process.env.PORT ?? 8080);

app.listen(port, () => {
  console.log(
    `Scout listening on :${port} — settling ${config.chain.assetSymbol} on ${config.chain.network}, paid to ${config.payTo}`,
  );
});
