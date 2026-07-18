import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import App, { EXAMPLE_OPTIONS } from "../src/App.js";

test("preview app exposes every example through an accessible tab list", () => {
  const html = renderToStaticMarkup(React.createElement(App));

  assert.equal(EXAMPLE_OPTIONS.length, 3);
  assert.match(html, /role="tablist"/);
  assert.equal((html.match(/role="tab"/g) || []).length, 3);
  assert.equal((html.match(/aria-selected="true"/g) || []).length, 1);
  assert.match(html, /E-Commerce Platform Architecture/);
  assert.match(html, /Shared schema/);
  assert.match(html, /3 examples/);
});
