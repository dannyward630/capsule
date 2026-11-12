import { test } from "node:test";
import assert from "node:assert/strict";
import { parseChoice } from "../src/serv.js";
import { dollarsToBaseUnits } from "../src/proof.js";

test("the model's answer is parsed", () => {
  const choice = parseChoice('{"action":"buy","endpoint":"/v1/history","topic":"ETH","reason":"trend"}');
  assert.equal(choice.action, "buy");
  assert.equal(choice.endpoint, "/v1/history");
  assert.equal(choice.topic, "ETH");
});

test("a fenced answer is parsed", () => {
  const choice = parseChoice('```json\n{"action":"answer","endpoint":null,"topic":null,"reason":"done"}\n```');
  assert.equal(choice.action, "answer");
  assert.equal(choice.endpoint, null);
});

test("the parser keeps the endpoint id the model named", () => {
  // The parser used to return a fixed shape and drop the id, so the agent saw
  // a decision with no endpoint and bought nothing.
  const parsed = parseChoice('{"action":"buy","id":"e09","reason":"it covers the fact"}');
  assert.equal(parsed.action, "buy");
  assert.equal(parsed.id, "e09");
  assert.equal(parsed.reason, "it covers the fact");
});

test("an unknown action is an error, not a silent default", () => {
  assert.throws(() => parseChoice('{"action":"buy_now"}'), /unknown action/);
});

test("unparseable output is an error", () => {
  assert.throws(() => parseChoice("I think we should buy the report"), /unparseable JSON/);
});

test("receipt amounts convert to the asset's base units", () => {
  assert.equal(dollarsToBaseUnits("0.05", 6), "50000");
  assert.equal(dollarsToBaseUnits("1.20", 6), "1200000");
});
