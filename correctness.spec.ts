import pureFn from "./pure-function";

describe("pure-function - correctness", () => {
  it("should transpile a simple identity function", () => {
    const result = pureFn("a => a");

    expect(result(1)).toEqual(1);
  });
  it("should support various property access and assignments", () => {
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
  });
  it("should support $get", () => {
    const fn = pureFn("(a, b) => $get(a, b)");

    expect(fn({ a: 1 }, "a")).toEqual(1);
  });
  it("should support $set", () => {
    const fn = pureFn("(a, b, c) => {$set(a, b, c); return a;}");

    expect(fn({ a: 1 }, "a", 2)).toEqual({ a: 2 });
  });
  it("should support $keys", () => {
    const fn = pureFn("(a) => $keys(a)");

    expect(fn({ a: 1 })).toEqual(["a"]);
  });
  it("should support $clear", () => {
    const fn = pureFn("(a, b) => {$clear(a, b); return a;}");

    expect(fn({ a: 1 }, "a")).toEqual({});
  });
  it("should support Date", () => {
    const fn = pureFn("(a, b) => Date.now()");

    expect(fn({ a: 1 }, "a")).toBeGreaterThan(0);
  });
  it("should support Map", () => {
    const fn = pureFn("() => new Map()");

    expect(fn()).toBeInstanceOf(Map);
  });
  it("should support Set", () => {
    const fn = pureFn("() => new Set()");

    expect(fn()).toBeInstanceOf(Set);
  });
  it("should support RegExp", () => {
    const fn = pureFn("(a) => new RegExp(a)");

    expect(fn("foo")).toBeInstanceOf(RegExp);
  });
  it("should support JSON", () => {
    const fn = pureFn("(a) => JSON.stringify(a)");

    expect(fn({})).toEqual("{}");
  });
  it("should support math", () => {
    const fn = pureFn("(a) => Math.floor(a)");

    expect(fn(1.000001)).toEqual(1)
  })
});
