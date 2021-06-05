import pureFn from "./pure-function"

describe('pure-function - correctness', () => {
  it('should transpile a simple identity function', () => {
    const result = pureFn('a => a');

    expect(result(1)).toEqual(1);
  })
  it('should support advanced features', () => {
    const result = pureFn(`
    function veryComplexFunction({ a, b } = { a: 100, b: 100 }, c) {
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
      c = () => {
        let r = 99;
        f += r;
      }
      c();

      return f;
    }
    `);

    expect(result()).toEqual(100 * 4 + 1 + 99);
  })
})