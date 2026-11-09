const MONTERREY_TZ = "America/Monterrey";

export const ATLAS_FUNCTION_TOOLS = [
  {
    type: "function",
    name: "calculate",
    description: "Resuelve una operación aritmética básica cuando el usuario pide un cálculo. Acepta números, paréntesis y los operadores +, -, * y /.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Operación matemática, por ejemplo (1250 * 0.16) + 1250." }
      },
      required: ["expression"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "get_local_datetime",
    description: "Consulta la fecha y hora actuales en la zona horaria de Monterrey, Nuevo León, México.",
    strict: true,
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false }
  },
  {
    type: "function",
    name: "make_checklist",
    description: "Organiza una lista de tareas proporcionada por el usuario en una lista de verificación ordenada. No agenda ni ejecuta tareas externas.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          description: "Entre 1 y 10 tareas concretas.",
          items: { type: "string" }
        }
      },
      required: ["tasks"],
      additionalProperties: false
    }
  },
  {
    type: "function",
    name: "convert_units",
    description: "Convierte una cantidad entre unidades compatibles de longitud, masa, temperatura o volumen. Usa únicamente las unidades enumeradas y respeta la categoría.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["longitud", "masa", "temperatura", "volumen"] },
        value: { type: "number", description: "Cantidad numérica finita entre -1e12 y 1e12." },
        from_unit: { type: "string", enum: ["m", "km", "cm", "mi", "ft", "kg", "g", "lb", "oz", "C", "F", "K", "L", "mL", "gal_us"] },
        to_unit: { type: "string", enum: ["m", "km", "cm", "mi", "ft", "kg", "g", "lb", "oz", "C", "F", "K", "L", "mL", "gal_us"] }
      },
      required: ["category", "value", "from_unit", "to_unit"],
      additionalProperties: false
    }
  }
];

function tokenize(expression) {
  if (typeof expression !== "string" || expression.length > 120) {
    throw new Error("La operación debe ser texto de hasta 120 caracteres.");
  }
  if (/\d\s+\d/.test(expression)) throw new Error("No se permiten espacios entre dígitos.");
  const tokens = expression.match(/\s*\d+(?:\.\d+)?\s*|\s*[()+\-*/]\s*/g);
  if (!tokens) throw new Error("La operación contiene caracteres no permitidos.");
  const compact = tokens.map((token) => token.trim()).filter(Boolean);
  if (compact.join("") !== expression.replace(/\s+/g, "")) {
    throw new Error("Solo se permiten números, paréntesis y +, -, *, /.");
  }
  return compact;
}

export function calculateExpression(expression) {
  const tokens = tokenize(expression);
  let index = 0;

  function parsePrimary() {
    const token = tokens[index++];
    if (token === "(") {
      const value = parseExpression();
      if (tokens[index++] !== ")") throw new Error("Falta cerrar un paréntesis.");
      return value;
    }
    if (token === "+" || token === "-") {
      const value = parsePrimary();
      return token === "-" ? -value : value;
    }
    if (!token || !/^\d+(?:\.\d+)?$/.test(token)) {
      throw new Error("Se esperaba un número.");
    }
    return Number(token);
  }

  function parseTerm() {
    let value = parsePrimary();
    while (tokens[index] === "*" || tokens[index] === "/") {
      const operator = tokens[index++];
      const right = parsePrimary();
      if (operator === "/" && right === 0) throw new Error("No es posible dividir entre cero.");
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }

  function parseExpression() {
    let value = parseTerm();
    while (tokens[index] === "+" || tokens[index] === "-") {
      const operator = tokens[index++];
      const right = parseTerm();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  const result = parseExpression();
  if (index !== tokens.length || !Number.isFinite(result)) {
    throw new Error("La operación no es válida o el resultado está fuera de rango.");
  }
  return Number(result.toPrecision(12));
}

const UNIT_DEFINITIONS = {
  longitud: {
    m: { factor: 1 }, km: { factor: 1000 }, cm: { factor: 0.01 },
    mi: { factor: 1609.344 }, ft: { factor: 0.3048 }
  },
  masa: {
    kg: { factor: 1 }, g: { factor: 0.001 }, lb: { factor: 0.45359237 },
    oz: { factor: 0.028349523125 }
  },
  volumen: {
    L: { factor: 1 }, mL: { factor: 0.001 }, gal_us: { factor: 3.785411784 }
  },
  temperatura: {
    C: { toBase: (value) => value, fromBase: (value) => value },
    F: { toBase: (value) => (value - 32) * 5 / 9, fromBase: (value) => value * 9 / 5 + 32 },
    K: { toBase: (value) => value - 273.15, fromBase: (value) => value + 273.15 }
  }
};

export function convertUnits({ category, value, from_unit, to_unit }) {
  if (!Number.isFinite(value) || Math.abs(value) > 1e12) {
    throw new Error("La cantidad debe ser un número finito entre -1e12 y 1e12.");
  }
  const units = UNIT_DEFINITIONS[category];
  if (!units || !units[from_unit] || !units[to_unit]) {
    throw new Error("Las unidades no pertenecen a la categoría seleccionada.");
  }

  let result;
  if (category === "temperatura") {
    const kelvin = units[from_unit].toBase(value);
    if (kelvin < -273.15) throw new Error("La temperatura no puede ser inferior al cero absoluto.");
    result = units[to_unit].fromBase(kelvin);
  } else {
    const baseValue = value * units[from_unit].factor;
    result = baseValue / units[to_unit].factor;
  }
  if (!Number.isFinite(result)) throw new Error("El resultado de la conversión está fuera de rango.");
  return Number(result.toPrecision(12));
}

export function executeAtlasTool(name, args = {}, now = new Date()) {
  if (name === "calculate") {
    const result = calculateExpression(args.expression);
    return { ok: true, expression: args.expression, result };
  }

  if (name === "get_local_datetime") {
    const formatter = new Intl.DateTimeFormat("es-MX", {
      timeZone: MONTERREY_TZ,
      dateStyle: "full",
      timeStyle: "long"
    });
    return { ok: true, timezone: MONTERREY_TZ, datetime: formatter.format(now) };
  }

  if (name === "make_checklist") {
    if (!Array.isArray(args.tasks) || args.tasks.length < 1 || args.tasks.length > 10 ||
        args.tasks.some((task) => typeof task !== "string" || !task.trim() || task.length > 240)) {
      throw new Error("La lista debe contener de 1 a 10 tareas de hasta 240 caracteres cada una.");
    }
    return {
      ok: true,
      persisted: false,
      tasks: args.tasks.map((task, index) => ({ number: index + 1, title: task.trim(), completed: false }))
    };
  }

  if (name === "convert_units") {
    const result = convertUnits(args);
    return { ok: true, ...args, result };
  }

  throw new Error("La herramienta solicitada no está autorizada.");
}
