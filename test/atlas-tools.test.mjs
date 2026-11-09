import test from "node:test";
import assert from "node:assert/strict";
import { calculateExpression, convertUnits, executeAtlasTool, ATLAS_FUNCTION_TOOLS, ATLAS_REALTIME_TOOLS, ATLAS_TOOL_NAMES } from "../src/atlas-tools.mjs";

test("calcula operaciones con precedencia y paréntesis", () => {
  assert.equal(calculateExpression("(1250 * 0.16) + 1250"), 1450);
  assert.equal(calculateExpression("10 + 3 * 2"), 16);
  assert.equal(calculateExpression("-(8 - 3)"), -5);
});

test("rechaza expresiones peligrosas y división entre cero", () => {
  assert.throws(() => calculateExpression("process.exit()"));
  assert.throws(() => calculateExpression("5 / 0"), /cero/);
  assert.throws(() => calculateExpression("1 2"));
});

test("consulta fecha y hora en la zona Monterrey", () => {
  const result = executeAtlasTool("get_local_datetime", {}, new Date("2026-11-08T18:00:00.000Z"));
  assert.equal(result.timezone, "America/Monterrey");
  assert.match(result.datetime, /2026/);
});

test("genera una lista sin afirmar persistencia", () => {
  const result = executeAtlasTool("make_checklist", { tasks: ["Enviar propuesta", "Revisar presupuesto"] });
  assert.equal(result.persisted, false);
  assert.equal(result.tasks.length, 2);
  assert.equal(result.tasks[0].completed, false);
});

test("convierte longitud, masa, volumen y temperatura", () => {
  assert.equal(convertUnits({ category: "longitud", value: 1, from_unit: "km", to_unit: "m" }), 1000);
  assert.equal(convertUnits({ category: "masa", value: 1, from_unit: "kg", to_unit: "lb" }), 2.20462262185);
  assert.equal(convertUnits({ category: "volumen", value: 1, from_unit: "gal_us", to_unit: "L" }), 3.785411784);
  assert.equal(convertUnits({ category: "temperatura", value: 0, from_unit: "C", to_unit: "F" }), 32);
  assert.equal(convertUnits({ category: "temperatura", value: 32, from_unit: "F", to_unit: "C" }), 0);
});

test("rechaza unidades incompatibles, cantidades inválidas y temperaturas bajo cero absoluto", () => {
  assert.throws(() => convertUnits({ category: "longitud", value: 1, from_unit: "kg", to_unit: "m" }), /categoría/);
  assert.throws(() => convertUnits({ category: "temperatura", value: -300, from_unit: "C", to_unit: "K" }), /cero absoluto/);
  assert.throws(() => convertUnits({ category: "masa", value: Infinity, from_unit: "kg", to_unit: "g" }), /número finito/);
});

test("rechaza nombres de herramientas no autorizados", () => {
  assert.throws(() => executeAtlasTool("run_shell", {}), /no está autorizada/);
});

test("declara funciones en modo estricto", () => {
  assert.equal(ATLAS_FUNCTION_TOOLS.length, 4);
  assert.ok(ATLAS_FUNCTION_TOOLS.every((tool) => tool.strict === true));
});

test("Realtime comparte las herramientas pero omite strict", () => {
  assert.deepEqual(ATLAS_REALTIME_TOOLS.map((tool) => tool.name), ATLAS_TOOL_NAMES);
  assert.ok(ATLAS_REALTIME_TOOLS.every((tool) => tool.type === "function" && !("strict" in tool)));
});
