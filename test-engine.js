const assert = require('node:assert/strict');
const fs = require('node:fs');
const engine = require('./tax-engine.js');
const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));

function close(actual, expected, tolerance = 0.02, label = 'value') {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

function sampleState() {
  const state = engine.defaultState();
  state.activities[0] = { cnae: '7490104', revenue: 30000, specialRegime: 'Hotelaria', annexOverride: 'III' };
  state.rbt12 = 360000;
  state.payrollMonth = 8500;
  state.payroll12 = 102000;
  return state;
}

const technical = sampleState();
technical.methodology = 'technical';
let result = engine.calculate(data, technical);
close(result.main.factorR, 102000 / 360000, 1e-10, 'Fator R');
assert.equal(result.main.band, 2);
assert.equal(result.main.activities[0].annex, 'III');
close(result.main.activities[0].effectiveRate, .086, 1e-10, 'effective rate');
close(result.main.pureTotal, 2580, .01, 'pure total');
close(result.main.hybridDas, 2138.82, .01, 'hybrid DAS');
close(result.main.cbsOutside, 1584, .01, 'CBS outside');
close(result.main.ibsOutside, 18, .01, 'IBS outside');
close(result.main.hybridTotal, 3740.82, .01, 'hybrid total');
close(result.dre.presumedTax, 5406, .01, 'presumed taxes before payroll');
close(result.regimes.find(r => r.name === 'Lucro Presumido').total, 7106, .01, 'presumed technical total');

const spreadsheet = sampleState();
spreadsheet.methodology = 'spreadsheet';
result = engine.calculate(data, spreadsheet);
close(result.regimes.find(r => r.name === 'Lucro Presumido').total, 8806, .01, 'spreadsheet 4-regime presumed total');
close(result.regimes.find(r => r.name === 'Lucro Real').total, 10921.84, .02, 'spreadsheet 4-regime real total');

const tech2029 = sampleState(); tech2029.year = 2029; tech2029.methodology = 'technical';
const sheet2029 = sampleState(); sheet2029.year = 2029; sheet2029.methodology = 'spreadsheet';
const rTech2029 = engine.calculate(data, tech2029);
const rSheet2029 = engine.calculate(data, sheet2029);
assert.ok(rTech2029.main.ibsDebit > rSheet2029.main.ibsDebit * 9.9, 'technical mode must avoid double IBS ramp in 2029');

const withCredits = sampleState();
withCredits.costs[0].value = 10000;
result = engine.calculate(data, withCredits);
close(result.main.cbsCostCredit, 880, .01, 'CBS cost credit');
close(result.main.ibsCostCredit, 10, .01, 'IBS cost credit');
close(result.main.cbsOutside, 704, .01, 'net CBS after credit');

console.log('OK: engine scenarios reconciled');
