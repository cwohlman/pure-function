const compiled = require('./pure-function').default(`
function biff(fizz) { const foo = fizz; while(false){const x = 5;} x = 99; return foo; }
`);

console.log(compiled + '');
