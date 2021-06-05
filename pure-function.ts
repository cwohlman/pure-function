import {
  createSourceFile,
  Declaration,
  forEachChild,
  Identifier,
  Node,
  ParameterDeclaration,
  ScriptTarget,
  SyntaxKind,
  transpile,
  transpileModule,
  VariableDeclaration,
  visitEachChild,
} from "typescript";
import { compileFunction } from "vm";

class Scope {
  constructor(private parentScope?: Scope) {}

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

  function visit(node: Node, scope: Scope) {
    // console.log(
    //   Object.keys(SyntaxKind).find((key) => SyntaxKind[key] == node.kind)
    // );

    switch (node.kind) {
      case SyntaxKind.VariableDeclaration: {
        const variable = node as VariableDeclaration;
        const variableName = (variable.name as Identifier).text;
        scope.addVariable(variableName);

        variable.forEachChild((node) => {
          if (node != variable.name) {
            visit(node, scope);
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
      case SyntaxKind.Parameter: {
        const parameter = node as ParameterDeclaration;
        const parameterName = parameter.name as Identifier;
        scope.addVariable(parameterName.text);

        parameter.forEachChild((node) => {
          if (node != parameterName) {
            visit(node, scope);
          }
        });
        break;
      }
      case SyntaxKind.FunctionDeclaration: {
        const fn = node as ParameterDeclaration;
        const functionName = fn.name as Identifier;
        scope.addVariable(functionName.text);

        const childScope = scope.newScope();
        fn.forEachChild((node) => {
          if (node != functionName) {
            visit(node, childScope);
          }
        });
        break;
      }
      case SyntaxKind.Identifier: {
        const identifier = node as Identifier;
        if (!scope.hasVariable(identifier.text)) {
          report(node, "Identifier not in scope: " + identifier.text);
        }
        break;
      }
      default: {
        forEachChild(node, (node) => visit(node, scope));
      }
    }
  }

  function report(node: Node, message: string) {
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
    throw new Error(`Not allowed: (${line + 1},${character + 1}): ${message}`);
  }

  visit(sourceFile, new Scope());

  return transpile(source);
}
