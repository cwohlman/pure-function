"use strict";
exports.__esModule = true;
var typescript_1 = require("typescript");
var Scope = /** @class */ (function () {
    function Scope(parentScope) {
        this.parentScope = parentScope;
        this.variables = [];
    }
    Scope.prototype.hasVariable = function (varname) {
        var _a;
        return this.variables.some(function (v) { return v == varname; }) || ((_a = this.parentScope) === null || _a === void 0 ? void 0 : _a.hasVariable(varname));
    };
    Scope.prototype.addVariable = function (varname) {
        this.variables.push(varname);
    };
    Scope.prototype.newScope = function () {
        return new Scope(this);
    };
    return Scope;
}());
function pureFn(source) {
    var sourceFile = typescript_1.createSourceFile("subject.ts", source, typescript_1.ScriptTarget.ESNext, false);
    function visit(node, scope) {
        console.log(Object.keys(typescript_1.SyntaxKind).find(function (key) { return typescript_1.SyntaxKind[key] == node.kind; }));
        switch (node.kind) {
            case typescript_1.SyntaxKind.VariableDeclaration: {
                var variable_1 = node;
                var variableName = variable_1.name.text;
                scope.addVariable(variableName);
                variable_1.forEachChild(function (node) {
                    if (node != variable_1.name) {
                        visit(node, scope);
                    }
                });
                break;
            }
            case typescript_1.SyntaxKind.Parameter: {
                var parameter = node;
                var parameterName_1 = parameter.name;
                scope.addVariable(parameterName_1.text);
                parameter.forEachChild(function (node) {
                    if (node != parameterName_1) {
                        visit(node, scope);
                    }
                });
                break;
            }
            case typescript_1.SyntaxKind.FunctionDeclaration: {
                var fn = node;
                var functionName_1 = fn.name;
                scope.addVariable(functionName_1.text);
                var childScope_1 = scope.newScope();
                fn.forEachChild(function (node) {
                    if (node != functionName_1) {
                        visit(node, childScope_1);
                    }
                });
                break;
            }
            case typescript_1.SyntaxKind.Identifier: {
                var identifier = node;
                if (!scope.hasVariable(identifier.text)) {
                    report(node, "Identifier not in scope: " + identifier.text);
                }
                break;
            }
            default: {
                typescript_1.forEachChild(node, function (node) { return visit(node, scope); });
            }
        }
    }
    function report(node, message) {
        console.log(node);
        var _a = (function () {
            try {
                return sourceFile.getLineAndCharacterOfPosition(node.getStart());
            }
            catch (e) {
                return {
                    line: -1,
                    character: -1
                };
            }
        })(), line = _a.line, character = _a.character;
        throw new Error("Not allowed: (" + (line + 1) + "," + (character + 1) + "): " + message);
    }
    visit(sourceFile, new Scope());
    return typescript_1.transpile(source);
}
exports["default"] = pureFn;
;
