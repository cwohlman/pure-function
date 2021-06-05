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
})