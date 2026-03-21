#!/usr/bin/env node
"use strict";
import("../dist/cli.js").catch((err) => {
  console.error(err);
  process.exit(1);
});
