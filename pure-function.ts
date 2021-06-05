import { ForStatement, Literal, StringLiteral } from "@babel/types";
import {
  BindingElement,
  ComputedPropertyName,
  createSourceFile,
  Declaration,
  ElementAccessExpression,
  forEachChild,
  ForInOrOfStatement,
  Identifier,
  Node,
  ObjectBindingPattern,
  ParameterDeclaration,
  PropertyAccessExpression,
  PropertyAssignment,
  ScriptTarget,
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
          checkPropertyAccess(name.text, node, scope);
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
          checkPropertyAccess((name.expression as any).text, node, scope);
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
          checkPropertyAccess(identifierName, node, scope);
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

  function checkPropertyAccess(
    identifierName: string,
    node: Node,
    scope: Scope
  ) {
    // Whitelist
    if (["keys", "values", "pairs"].indexOf(identifierName) !== -1) return;

    // Blacklist
    if ([].indexOf(identifierName) !== -1) return report(
      node,
      "Invalid use of blacklisted property in property access.",
      scope
    );

    // Object properties
    if (
      Object.getOwnPropertyNames(Object.prototype).some(
        (key) => key == identifierName && key !== "keys"
      )
    ) {
      return report(
        node,
        "Invalid use of Object.prototype property in property access.",
        scope
      );
    }
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
      return node.getText(sourceFile)
    })()
    throw new Error(
      `Not allowed: ${text} (${line + 1},${
        character + 1
      }): ${message} at ${scope.stack.join(">")}`
    );
  }

  // TODO: maybe allow Math, Date, Map, Set, JSON, & other safe globals.
  // since property access is strictly controlled, it should be very difficult to
  // break out
  // Note: because the this keyword is not allowed, class methods will be pretty useless.
  // Note: because dynamic property access is not allowed you actually can't operate on array elements!
  //       you have to use .forEach, .map, etc.
  //       potential fix for this is to provide an alternate List that's just an array substitute
  //       Set isn't a substitute for Array because you can't access elements by index using Set either.
  visit(sourceFile, new Scope());

  return eval("(() => { return " + transpile(source) + " })()");
}
function getNodeName(nodeKind: SyntaxKind): string {
  return Object.keys(SyntaxKind).find((key) => SyntaxKind[key] == nodeKind);
}
