import {
  BindingElement,
  createSourceFile,
  Declaration,
  forEachChild,
  Identifier,
  Node,
  ObjectBindingPattern,
  ParameterDeclaration,
  PropertyAccessExpression,
  PropertyAssignment,
  ScriptTarget,
  SyntaxKind,
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
    scope.stack.push(
      Object.keys(SyntaxKind).find((key) => SyntaxKind[key] == node.kind)
    );

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
      case SyntaxKind.Identifier: {
        const identifier = node as Identifier;

        if (context === "declaration") {
          scope.addVariable(identifier.text);
        } else if (context === "propertyAssignment") {
          // ok here to use identifier
        } else if (context === "propertyAccess") {
          // TODO: check for unsafe property access, e.g. constructor, prototype, etc.
          // ok here to use identifier
        } else if (!scope.hasVariable(identifier.text)) {
          report(node, "Identifier not in scope: " + identifier.text, scope);
        }
        break;
      }
      default: {
        forEachChild(node, (node) => visit(node, scope));
      }
    }
    scope.stack.pop();
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
    throw new Error(
      `Not allowed: (${line + 1},${
        character + 1
      }): ${message} at ${scope.stack.join(">")}`
    );
  }

  visit(sourceFile, new Scope());

  return eval("(() => { return " + transpile(source) + " })()");
}
