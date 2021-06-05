import pureFn from "./pure-function";

describe('pure-function - safety', () => {
  it('should not allow access to globals', () => {
    expect(() => {
      pureFn('function () { return window } ')
    }).toThrow();
    expect(() => {
      pureFn('function () { return global } ')
    }).toThrow();
    expect(() => {
      pureFn('function () { return x } ')
    }).toThrow();
    expect(() => {
      pureFn('function () { return Object } ')
    }).toThrow();
    expect(() => {
      pureFn('function () { return Array } ')
    }).toThrow();
    expect(() => {
      pureFn('function () { return Function } ')
    }).toThrow();
    expect(() => {
      pureFn('function () { return Prototype } ')
    }).toThrow();
  });
  it('should not allow binding elements to access themselves', () => {
    expect(() => {
      pureFn('function ({ a } = a) { return a } ');
    }).toThrow();
  })
  it('should not allow binding elements to access themselves', () => {
    expect(() => {
      pureFn('function ({ a } = a) { return a } ');
    }).toThrow();
  })
  it('should not allow object assignment to imply variable existance', () => {
    expect(() => {
      pureFn('function (a = { j: 100 }) { return j } ');
    }).toThrow();
  })
  it('should not allow access of dangerous object.proptotype memebers', () => {
    expect(() => {
      pureFn('function (a = { j: 100 }) { return a.constructor; } ');
    }).toThrow();
  })
  it('should not allow access to function prototype', () => {
    expect(() => {
      pureFn('function () { (() => {}).prototype.apply(function () { return this; }) } ');
    }).toThrow();
  })
  it('should not allow string access to dangerous members', () => {
    expect(() => {
      pureFn('function () { return new (() => {})["constructor"]("return window") } ');
    }).toThrow();
  })
  it('should not allow dynamic member access', () => {
    expect(() => {
      pureFn('function (a) { return new (() => {})[a]("return window") } ');
    }).toThrow();
  })
})

describe('pure-function - exploit attempts', () => {
  const disallowedValue = (global as any).disallowedValue = {};

  testDangerousFunction('function () { return disallowedValue; }', disallowedValue);
  testDangerousFunction('function () { return ({}).constructor }', Object);

  testDangerousFunction(`function () {
    const exploit = new Function("return disallowedValue");

    return exploit();
  }`, disallowedValue);
  testDangerousFunction(`function () {
    for (let Function = 1; Function < 1; Function++) {}

    return (new Function("return disallowedValue"))();
  }`, disallowedValue);

  testDangerousFunction(`function () {
    const foo = [];

    for (let Function of foo) {}

    return (new Function("return disallowedValue"))();
  }`, disallowedValue);

  testDangerousFunction(`function () {
    const foo = [];

    for (let Function in foo) {}

    return (new Function("return disallowedValue"))();
  }`, disallowedValue);

  // does not exploit.
  // testDangerousFunction(`function () {
  //   const Function = 1;

  //   delete Function;

  //   return (new Function("return disallowedValue"))();
  // }`, disallowedValue);


  testDangerousFunction(`function () {
    const foo = [];

    switch (foo) {
      case false: {
        const Function = 1;
      }
    }

    return (new Function("return disallowedValue"))();
  }`, disallowedValue);

  testDangerousFunction(`new Function("return disallowedValue")`, disallowedValue)

  // Fails to exploit
  // testDangerousFunction(`function () {
  //   while (let Function = true) { break; }

  //   return (new Function("return disallowedValue"))();
  // }`, disallowedValue);
})

function testDangerousFunction(fn: string, unguardedValue) {
  it('should stop: ' + fn + '', () => {
    const compiled = eval("(() => { return " + fn + " })()")
    const result = compiled();

    expect(result).toBe(unguardedValue);
    expect(() => {
      pureFn(fn);
    }).toThrow();
  })
}