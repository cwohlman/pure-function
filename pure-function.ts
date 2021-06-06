import { ForStatement, FunctionDeclaration, FunctionExpression, Literal, StringLiteral } from "@babel/types";
import {
  BindingElement,
  Block,
  ComputedPropertyName,
  ConciseBody,
  createSourceFile,
  Declaration,
  ElementAccessExpression,
  Expression,
  factory,
  forEachChild,
  ForInOrOfStatement,
  Identifier,
  isArrowFunction,
  isDoStatement,
  isForInStatement,
  isForOfStatement,
  isForStatement,
  isFunctionDeclaration,
  isFunctionExpression,
  isFunctionLike,
  isWhileStatement,
  Node,
  ObjectBindingPattern,
  ParameterDeclaration,
  PropertyAccessExpression,
  PropertyAssignment,
  ScriptTarget,
  SignatureDeclaration,
  Statement,
  StringLiteralLike,
  StringLiteralType,
  SyntaxKind,
  Token,
  transpile,
  transpileModule,
  VariableDeclaration,
  visitEachChild,
} from "typescript";

class Scope {
  constructor(public parentScope?: Scope) {}

  public stack: string[] = [];

  private variables: string[] = [];
  hasVariable(varname: string) {
    return (
      this.variables.some((v) => v == varname) ||
      this.parentScope?.hasVariable(varname)
    );
  }
  addVariable(varname: string) {
    this.variables.push(varname);
  }
  newScope() {
    return new Scope(this);
  }
}

export function isAllowedKey(key: string): true | string {
  // Whitelist
  if (["keys", "values", "pairs"].indexOf(key) !== -1) return true;

  // Blacklist
  if ([].indexOf(key) !== -1)
    return `Invalid use of blacklisted property (${key}) in property access.`;

  // Object properties
  if (
    Object.getOwnPropertyNames(Object.prototype).some(
      (protoKey) => protoKey == key
    )
  ) {
    return `Invalid use of Object.prototype property (${key}) in property access.`;
  }

  //  All other properties are allowed
  return true;
}
function dynamicCheckKey(key: string) {
  const message = isAllowedKey(key);

  if (message !== true) throw new Error(message);
}
export function $keys(object) {
  return Object.keys(object).filter((key) => isAllowedKey(key) === true);
}
export function $get(object, key) {
  dynamicCheckKey(key);
  return object[key];
}
export function $set(object, key, value) {
  dynamicCheckKey(key);
  return (object[key] = value);
}
export function $clear(object, key) {
  dynamicCheckKey(key);
  delete object[key];
}
export default function pureFn(source: string) {
  const sourceFile = createSourceFile(
    "subject.ts",
    source,
    ScriptTarget.ESNext,
    false
  );

  function visit(
    node: Node,
    scope: Scope,
    context:
      | "none"
      | "declaration"
      | "propertyAssignment"
      | "propertyAccess" = "none"
  ) {
    const nodeKind = node.kind;
    scope.stack.push(getNodeName(nodeKind));

    switch (node.kind) {
      case SyntaxKind.BindingElement: {
        const variable = node as BindingElement;
        variable.forEachChild((node) => {
          if (node == variable.name) {
            visit(node, scope, "declaration");
          } else {
            visit(node, scope, "propertyAccess");
          }
        });
        break;
      }
      case SyntaxKind.VariableDeclaration: {
        const variable = node as VariableDeclaration;
        variable.forEachChild((node) => {
          if (node == variable.name) {
            visit(node, scope, "declaration");
          } else {
            visit(node, scope);
          }
        });
        break;
      }
      case SyntaxKind.PropertyAccessExpression: {
        const access = node as PropertyAccessExpression;

        access.forEachChild((node) => {
          if (node == access.name) {
            visit(node, scope, "propertyAccess");
          } else {
            visit(node, scope, context);
          }
        });

        break;
      }
      case SyntaxKind.PropertyAssignment: {
        const assignment = node as PropertyAssignment;

        assignment.forEachChild((node) => {
          if (node === assignment.name) {
            visit(node, scope, "propertyAssignment");
          } else {
            visit(node, scope);
          }
        });
        break;
      }
      case SyntaxKind.Parameter: {
        const parameter = node as ParameterDeclaration;

        parameter.forEachChild((node) => {
          if (node == parameter.name) {
            visit(node, scope, "declaration");
          } else {
            visit(node, scope.parentScope || new Scope());
          }
        });
        break;
      }
      case SyntaxKind.Block: {
        const childScope = scope.newScope();
        node.forEachChild((node) => {
          visit(node, childScope);
        });
        break;
      }
      case SyntaxKind.FunctionDeclaration: {
        const fn = node as ParameterDeclaration;

        const childScope = scope.newScope();
        fn.forEachChild((node) => {
          if (node == fn.name) {
            visit(node, scope, "declaration");
          } else {
            visit(node, childScope);
          }
        });
        break;
      }
      case SyntaxKind.ForInStatement:
      case SyntaxKind.ForOfStatement:
      case SyntaxKind.ForStatement: {
        const childScope = scope.newScope();
        node.forEachChild((node) => visit(node, childScope));
        break;
      }
      case SyntaxKind.ThisKeyword: {
        report(node, "You may not use this!", scope);
        break;
      }
      case SyntaxKind.ElementAccessExpression: {
        const access = node as ElementAccessExpression;

        if (access.argumentExpression.kind === SyntaxKind.StringLiteral) {
          const name = access.argumentExpression as StringLiteralLike;
          staticCheckKey(name.text, node, scope);
        } else {
          report(
            node,
            "Non-static element access is not allowed: use Map or Set for dictionaries & lists",
            scope
          );
        }

        access.forEachChild((node) => {
          if (node == access.argumentExpression) {
            visit(node, scope, "propertyAccess");
          } else {
            visit(node, scope, context);
          }
        });

        break;
      }
      case SyntaxKind.ComputedPropertyName: {
        const name = node as ComputedPropertyName;

        if (name.expression.kind === SyntaxKind.StringLiteral) {
          staticCheckKey((name.expression as any).text, node, scope);
        } else {
          report(
            node,
            "Non-static computed property names are not allowed",
            scope
          );
        }

        break;
      }
      case SyntaxKind.Identifier: {
        const identifier = node as Identifier;

        if (context === "declaration") {
          scope.addVariable(identifier.text);
        } else if (context === "propertyAssignment") {
          // ok here to use identifier
        } else if (context === "propertyAccess") {
          const identifierName = identifier.text;
          staticCheckKey(identifierName, node, scope);
        } else if (!scope.hasVariable(identifier.text)) {
          report(node, "Identifier not in scope: " + identifier.text, scope);
        }
        break;
      }
      default: {
        // console.log(getNodeName(nodeKind));
        forEachChild(node, (node) => visit(node, scope));
      }
    }
    scope.stack.pop();
  }

  function staticCheckKey(identifierName: string, node: Node, scope: Scope) {
    const message = isAllowedKey(identifierName);

    if (message !== true) report(node, message, scope);
  }

  function report(node: Node, message: string, scope) {
    const { line, character } = (() => {
      try {
        return sourceFile.getLineAndCharacterOfPosition(node.getStart());
      } catch (e) {
        return {
          line: -1,
          character: -1,
        };
      }
    })();
    const text = (() => {
      return node.getText(sourceFile);
    })();
    throw new Error(
      `Not allowed: ${text} (${line + 1},${
        character + 1
      }): ${message} at ${scope.stack.join(">")}`
    );
  }

  // Note: because the this keyword is not allowed, class methods will be pretty useless.
  // Note: we could automate the use of $get, $set, $clear, etc.

  const globalScope = new Scope();

  // Whitelist:
  globalScope.addVariable("$keys");
  globalScope.addVariable("$get");
  globalScope.addVariable("$set");
  globalScope.addVariable("$clear");
  globalScope.addVariable("RegExp");
  globalScope.addVariable("Math");
  globalScope.addVariable("Date");
  globalScope.addVariable("Map");
  globalScope.addVariable("Set");
  globalScope.addVariable("JSON");

  visit(sourceFile, globalScope);

  return eval(
    `(() => {
      // OOPS! this is outside the function declaration, successive calls to the function will not reset $$tick
      
      let $$tick = 0;
      const $$mark = () => {
        $$tick++;
        if ($$tick > 1000000) {
          throw new Error('Excessive iterations!');
        }
      };
      return ` +
      transpileModule(source, {
        transformers: {
          before: [
            (context) => {
              function visit<T extends Node>(node: T) {
                // Function calls can be recursive
                // For loops can be infinite
                // While loops can be infinite
                // TODO: move locals/variables checking here, apparently function ast node already includes a list of locals & parameters

                // TODO: define a replace body helper function with pseudo code: (body) => [$$()].concat(body)
                if (isForStatement(node)) {
                  const body = node.statement;

                  return visitEachChild(node, (child) => {
                    if (child == body) {
                      return visitEachChild(replaceNodeBody(child as Block, true), visit, context);
                    }
                    return visitEachChild(child, visit, context);
                  }, context)
                }
                if (isForInStatement(node)) {
                  const body = node.statement;

                  return visitEachChild(node, (child) => {
                    if (child == body) {
                      return visitEachChild(replaceNodeBody(child as Block, true), visit, context);
                    }
                    return visitEachChild(child, visit, context);
                  }, context)
                }
                if (isForOfStatement(node)) {
                  const body = node.statement;

                  return visitEachChild(node, (child) => {
                    if (child == body) {
                      return visitEachChild(replaceNodeBody(child as Block, true), visit, context);
                    }
                    return visitEachChild(child, visit, context);
                  }, context)
                }
                if (isWhileStatement(node)) {
                  const body = node.statement;

                  return visitEachChild(node, (child) => {
                    if (child == body) {
                      return visitEachChild(replaceNodeBody(child as Block, true), visit, context);
                    }
                    return visitEachChild(child, visit, context);
                  }, context)
                }
                if (isDoStatement(node)) {
                  const body = node.statement;

                  return visitEachChild(node, (child) => {
                    if (child == body) {
                      return visitEachChild(replaceNodeBody(child as Block, true), visit, context);
                    }
                    return visitEachChild(child, visit, context);
                  }, context)
                }

                // TODO: technically we don't have to protect against recursion in functions that can't be accessed from the outside

                if (isFunctionDeclaration(node)) {
                  const body = node.body;

                  return visitEachChild(node, (child) => {
                    if (child == body) {
                      return visitEachChild(replaceNodeBody(child as Block, true), visit, context);
                    }
                    return visitEachChild(child, visit, context);
                  }, context)
                }
                if (isFunctionExpression(node)) {
                  const body = node.body;

                  return visitEachChild(node, (child) => {
                    if (child == body) {
                      return visitEachChild(replaceNodeBody(child as Block, true), visit, context);
                    }
                    return visitEachChild(child, visit, context);
                  }, context)
                }
                if (isArrowFunction(node)) {
                  const body = node.body;

                  return visitEachChild(node, (child) => {
                    if (child == body) {
                      return visitEachChild(replaceNodeBody(child as ConciseBody, true), visit, context);
                    }
                    return visitEachChild(child, visit, context);
                  }, context)
                }
                // if (isFunctionLike(node)) {
                //   const body = (node as SignatureDeclaration).
                //   return replaceNodeBody()
                // }

                return visitEachChild(node, (child) => visit(child), context);
              }
              return (sourceFile) => {
                return visit(sourceFile);
              };
            },
          ],
        },
      }).outputText +
      " })()"
  );

  // return (...args: any): any => {};
}

function replaceNodeBody(node: Expression | Block, shouldReturn: boolean): Block {
  const check = factory.createExpressionStatement(factory.createCallExpression(factory.createIdentifier('$$mark'), [], []));
  if (node.kind === SyntaxKind.Block) {
    const block = node as Block;
    return factory.createBlock(
      [check as Statement].concat(block.statements)
    );
  } else if (shouldReturn) {
    const expression = node as Expression;
    return factory.createBlock(
      [check as Statement].concat(factory.createReturnStatement(expression))
    );
  } else {
    const expression = node as Expression;
    return factory.createBlock(
      [check as Statement].concat(factory.createExpressionStatement(expression))
    );
  }
}

function getNodeName(nodeKind: SyntaxKind): string {
  return Object.keys(SyntaxKind).find((key) => SyntaxKind[key] == nodeKind);
}
