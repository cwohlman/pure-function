import pureFn from "./pure-function"

describe('pure-function - correctness', () => {
  it('should transpile a simple identity function', () => {
    const result = pureFn('a => a');

    expect(result(1)).toEqual(1);
  })
  it('should support advanced features', () => {
    const result = pureFn(`
    function veryComplexFunction({ z: a, b } = { z: 100, b: 100 }, c = { j: 100 }) {
      const d = a + b;
      let f;
      while(true) {
        let e = d + a + b;
        f = e;
        break;
      }
      for (let i = 0; i <= 1; i++) {
        f += i;
      }
      const g = () => {
        let r = 99;
        f += r;
      }
      g();

      c.xyz = "100";
      
      const h = c.xyz.length;

      return f;
    }
    `);

    expect(result()).toEqual(100 * 4 + 1 + 99);
  })
})