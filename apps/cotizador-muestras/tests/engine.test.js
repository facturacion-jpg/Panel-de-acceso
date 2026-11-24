'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = require('../src/engine');

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'catalog.json'), 'utf8'));
const params = catalog.parameters;

function close(actual, expected, tolerance, label) {
  assert.ok(
    Math.abs(Number(actual) - Number(expected)) <= tolerance,
    `${label}: esperado ${expected}, obtenido ${actual}`
  );
}

test('el caso dorado coincide con el Excel', () => {
  const comparison = engine.compareWithExcel(catalog, params);
  assert.equal(comparison.passed, true, JSON.stringify(comparison));
  close(comparison.actual.samMin, comparison.expected.samMin, 0.0001, 'SAM');
  close(comparison.actual.cost, comparison.expected.cost, 0.0001, 'costo');
  close(comparison.actual.suggestedPrice, comparison.expected.suggestedPrice, 0.0001, 'precio');
});

test('la cantidad escala linealmente el SAM y el costo', () => {
  const one = engine.calculateQuote([{ operation: 'Sesgar cuello', quantity: 1 }], params, catalog.operations);
  const two = engine.calculateQuote([{ operation: 'Sesgar cuello', quantity: 2 }], params, catalog.operations);
  close(two.totals.samTotal, one.totals.samTotal * 2, 1e-9, 'SAM x2');
  close(two.totals.costoTransformacion, one.totals.costoTransformacion * 2, 1e-9, 'costo x2');
});

test('el tiempo ajustado tiene prioridad sobre el tiempo base', () => {
  const result = engine.calculateQuote([{ operation: 'Sesgar cuello', quantity: 1, adjustedSec: 40 }], params, catalog.operations);
  assert.equal(result.lines[0].baseSec, 40);
  assert.equal(result.lines[0].timeSource, 'ajustado');
});

test('selecciona la tarifa según el bloque', () => {
  const conf = engine.calculateQuote([{ operation: 'Sesgar cuello' }], params, catalog.operations).lines[0];
  assert.equal(conf.rate, params.costPerMinConf);
  const empaque = catalog.operations.find((op) => engine.norm(op.block) === 'empaque' && Number(op.baseSec) > 0);
  const pack = engine.calculateQuote([{ operation: empaque.name }], params, catalog.operations).lines[0];
  assert.equal(pack.rate, params.costPerMinFinish);
});

test('el precio sugerido aplica margen sobre precio', () => {
  const result = engine.calculateQuote([{ operation: 'Sesgar cuello' }], params, catalog.operations);
  close(result.totals.precioSugerido, result.totals.costoTransformacion / (1 - params.profitPct), 1e-9, 'precio');
});

test('normaliza acentos en nombres y bloques', () => {
  assert.equal(engine.norm('Confección'), engine.norm('CONFECCION'));
  assert.ok(engine.isBlock('Terminación', 'terminacion'));
  assert.ok(engine.findOperation('SESGAR CUELLO', catalog.operations));
});

test('rechaza operación inexistente', () => {
  assert.throws(() => engine.calculateQuote([{ operation: 'NO EXISTE' }], params, catalog.operations), /no encontrada/i);
});

test('rechaza parámetros fuera de rango y cantidades inválidas', () => {
  assert.throws(() => engine.validateParams(Object.assign({}, params, { profitPct: 1 })), /utilidad/i);
  assert.throws(() => engine.calculateQuote([{ operation: 'Sesgar cuello', quantity: 0 }], params, catalog.operations), /cantidad/i);
});

test('el catálogo importado tiene datos mínimos esperados', () => {
  assert.ok(catalog.operations.length > 500);
  assert.ok(catalog.references.length > 150);
  assert.equal(catalog.meta.historicalBlankCodes, 327);
});
