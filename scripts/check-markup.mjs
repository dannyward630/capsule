/**
 * A check that the markup layer does what it says.
 *
 * The bug this exists for: a template that returned a plain string escaped
 * its own output the second time it was interpolated, so a list of rows came
 * out as escaped source on the page and the browser reported no errors.
 *
 *   node scripts/check-markup.mjs
 */
import { html, raw, escape } from "../public/components/dom.js";

/**
 * The escaped forms, written as entities.
 *
 * They are assembled rather than typed, so the expectation cannot be
 * confused with the literal text it is supposed to differ from.
 */
const LT = "&" + "lt;";
const GT = "&" + "gt;";
const AMP = "&" + "amp;";
const QUOT = "&" + "quot;";
const APOS = "&" + "#" + "39;";

let failures = 0;

function check(name, actual, expected) {
  if (actual === expected) {
    console.log(`  ok   ${name}`);
    return;
  }
  failures += 1;
  console.log(
    `  FAIL ${name}\n         expected: ${expected}\n         actual:   ${actual}`,
  );
}

console.log("the markup layer");

check(
  "plain text is escaped",
  String(html`<p>${"<script>alert(1)</script>"}</p>`),
  `<p>${LT}script${GT}alert(1)${LT}/script${GT}</p>`,
);

check(
  "markup is trusted",
  String(html`<p>${raw("<b>bold</b>")}</p>`),
  "<p><b>bold</b></p>",
);

check(
  "a list of markup is a list, not escaped text",
  String(html`<ul>${[raw("<li>one</li>"), raw("<li>two</li>")]}</ul>`),
  "<ul><li>one</li><li>two</li></ul>",
);

check(
  "a nested template keeps its trust",
  String(html`<div>${html`<span>${raw("<b>x</b>")}</span>`}</div>`),
  "<div><span><b>x</b></span></div>",
);

check(
  "a list of nested templates keeps its trust",
  String(html`<ul>${[html`<li>${raw("<b>x</b>")}</li>`]}</ul>`),
  "<ul><li><b>x</b></li></ul>",
);

check(
  "a list of plain text is still escaped",
  String(html`<ul>${["<b>x</b>"]}</ul>`),
  `<ul>${LT}b${GT}x${LT}/b${GT}</ul>`,
);

check(
  "an ampersand is escaped",
  escape("a & b"),
  `a ${AMP} b`,
);

check(
  "a quote is escaped",
  escape('say "hi"'),
  `say ${QUOT}hi${QUOT}`,
);

check(
  "a single quote is escaped",
  escape("it's"),
  `it${APOS}s`,
);

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
