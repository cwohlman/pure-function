# pure-function

**Goal:**

Store user-supplied functions intended to operate on user-supplied data in the browser. The user should be able to do math, string manipulation, statistics, business logic, etc with custom defined functions. The program can store & run these functions, hopefully without any harmful side effects.

**Guards**

- Prevents **(tries to!)** access to any data or code not explicitly passed to the function
- Prevents side effects (e.g. creating the function should not have any effects)
- Prevents infinite loops (by setting a 1 million operation execution limit)

**How it works**

Refuses to compile code to a function unless it does not access any globals, this, or the constructor property of any value.

Also runs code through the typescript compiler which hopefully eliminates any parsing inconsistencies (e.g. inconsistent unicode parsing in code) by emitting ideomatic code.

**Wishful goal:**

Execute 3rd party supplied functions on user data in any context. It probably isn't possible to safely do this, but in theory the guards listed above should allow us to do that.

**Restrictions**

- No globals or undefined variable access
- No this
- No access to any properties defined on `Object`, in particular no access to `constructor`
- No unguarded dynamic property access (you have to use the `$get` and `$set` helpers which guard against access of unsafe properties)

**Usage:**

Just call the main export with any string that represents a javascript or typescript function.

```ts
import pureFn from './pure-fuction.ts';

const countDots = pureFn('(a: string) => a.split(/\./).length - 1');

const result = countDots('...'); // should be 3
```