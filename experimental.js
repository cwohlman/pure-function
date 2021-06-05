const shouldSucceeed = require('./pure-function').default(`
function biff(fizz) { 
  const foo = fizz; 
  while(false){
    let x = 5; 
    while(false) { x = 19; }
  }

  biff();
  
  return foo; 
}
`);

console.log({ shouldSucceeed: shouldSucceeed + '' });

const shouldFail = require('./pure-function').default(`
function biff(fizz) { const foo = fizz; while(false){let x = 5;} x = 99; return foo; }
`);

console.log({ shouldFail: shouldFail + '' });
