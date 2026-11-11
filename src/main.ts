import app, { readConfig } from "./app.js";

const config = readConfig();
const port = Number(process.env.PORT ?? 8080);

app.listen(port, () => {
  console.log(
    `Scout listening on :${port} — settling ${config.chain.assetSymbol} on ${config.chain.network}, paid to ${config.payTo}`,
  );
});
