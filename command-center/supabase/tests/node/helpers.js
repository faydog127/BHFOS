/**
 * Helper functions: HTTP calls, assertions, minimal runner hooks.
 */

var fs = require("fs");
var path = require("path");
var CONFIG = require("./config.js");

function joinUrl(base, suffix) {
  if (base.charAt(base.length - 1) === "/") {
    return base + suffix;
  }
  return base + "/" + suffix;
}

async function postEdge(pathSuffix, body, extraHeaders) {
  var url = joinUrl(CONFIG.EDGE, pathSuffix);
  var headers = {
    "Content-Type": "application/json"
  };
  if (extraHeaders) {
    for (var k in extraHeaders) {
      headers[k] = extraHeaders[k];
    }
  }
  var resp = await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(body)
  });
  var json;
  try {
    json = await resp.json();
  } catch (e) {
    json = { parseError: String(e) };
  }
  return { status: resp.status, json: json };
}

async function restInsert(table, rows) {
  var url = joinUrl(CONFIG.REST, table) + "?select=*";
  var headers = {
    "Content-Type": "application/json",
    "apikey": CONFIG.SERVICE,
    "Authorization": "Bearer " + CONFIG.SERVICE,
    "Prefer": "return=representation"
  };
  var resp = await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(rows)
  });
  var json;
  try {
    json = await resp.json();
  } catch (e) {
    json = { parseError: String(e) };
  }
  return { status: resp.status, json: json };
}

async function restSelect(queryPath) {
  var url = joinUrl(CONFIG.REST, queryPath);
  var headers = {
    "apikey": CONFIG.SERVICE,
    "Authorization": "Bearer " + CONFIG.SERVICE
  };
  var resp = await fetch(url, {
    method: "GET",
    headers: headers
  });
  var json;
  try {
    json = await resp.json();
  } catch (e) {
    json = { parseError: String(e) };
  }
  return { status: resp.status, json: json };
}

/* ---------- Assertions ---------- */

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

function assertEquals(a, b, message) {
  if (a !== b) {
    throw new Error((message || "Expected equality") + " (got " + a + " vs " + b + ")");
  }
}

/* ---------- Fixtures ---------- */

function readJsonFixture(relPath) {
  var full = path.join(__dirname, relPath);
  var raw = fs.readFileSync(full, "utf8");
  return JSON.parse(raw);
}

/* ---------- Minimal runner ---------- */

var TESTS = [];

function addTest(name, fn) {
  TESTS.push({ name: name, fn: fn });
}

async function runAllTests() {
  var passed = 0;
  var failed = 0;
  for (var i = 0; i < TESTS.length; i++) {
    var t = TESTS[i];
    process.stdout.write("• " + t.name + " ... ");
    try {
      await t.fn();
      console.log("OK");
      passed += 1;
    } catch (e) {
      console.log("FAIL");
      console.log("   " + String(e && e.stack ? e.stack : e));
      failed += 1;
    }
  }
  console.log("\nTotal: " + TESTS.length + " | Passed: " + passed + " | Failed: " + failed);
  if (failed > 0) {
    process.exit(1);
  }
}

module.exports = {
  postEdge: postEdge,
  restInsert: restInsert,
  restSelect: restSelect,
  assert: assert,
  assertEquals: assertEquals,
  readJsonFixture: readJsonFixture,
  addTest: addTest,
  runAllTests: runAllTests
};