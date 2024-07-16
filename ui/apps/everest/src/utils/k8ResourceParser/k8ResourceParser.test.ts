import { cpuParser, memoryParser } from '.';

describe('cpu parser', () => {
  // pattern is [description, input, output]
  const tests: [string, string, number][] = [
    ['parses full numbers', '1', 1],
    ['parses floats (< 1)', '1.5', 1.5],
    ['parses floats (> 1)', '0.5', 0.5],
    ['parses strings with milli (m) unit (whole number)', '1000m', 1],
    ['parses strings with milli (m) unit (decimal number)', '1300m', 1.3],
    ['parses strings with milli (m) unit (< 1)', '300m', 0.3],
  ];

  tests.map((t) =>
    it(`${t[0]} (${t[1]} to ${t[2]})`, () => {
      expect(cpuParser(t[1])).toEqual(t[2]);
    })
  );
});

describe('memory parser', () => {
  it('correctly parses memory strings', () => {
    expect(memoryParser('1')).toEqual(1);
    expect(memoryParser('1k', 'G')).toEqual(1 * 10 ** -6);
    expect(memoryParser('1G', 'Gi')).toEqual(10 ** 9 / 1024 ** 3);
    expect(memoryParser('1G', 'G')).toEqual(1);
  });
});
