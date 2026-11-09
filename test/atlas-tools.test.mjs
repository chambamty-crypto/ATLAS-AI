import test from "node:test";
import assert from "node:assert/strict";
import { calculateExpression, executeAtlasTool, ATLAS_FUNCTION_TOOLS } from "../src/atlas-tools.mjs";

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

test("rechaza nombres de herramientas no autorizados", () => {
  assert.throws(() => executeAtlasTool("run_shell", {}), /no está autorizada/);
});

test("declara funciones en modo estricto", () => {
  assert.equal(ATLAS_FUNCTION_TOOLS.length, 3);
  assert.ok(ATLAS_FUNCTION_TOOLS.every((tool) => tool.strict === true));
});
