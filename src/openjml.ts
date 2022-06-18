import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, SpawnOptions } from 'child_process';


function isJavaFile(uri: vscode.Uri): boolean {
    return path.basename(uri.fsPath).endsWith(".java")
}



let jmlPath = "~/.openjml/openjml.jar"
export function updateDiagnosticsWithOpenJml(document: vscode.TextDocument, collection: vscode.DiagnosticCollection): void {
    if (document && isJavaFile(document.uri)) {
        let file = document.uri.fsPath
        let process = spawn("java", ["-jar", jmlPath, file], {
            cwd: "/tmp", shell: true
        });
        process.on('close', (c, s) => {
            let lines = process.stdout.read()
            let error = process.stderr.read()

            collection.set(document.uri, [{
                code: '',
                message: 'cannot assign twice to immutable variable `x`',
                range: new vscode.Range(new vscode.Position(3, 4), new vscode.Position(3, 10)),
                severity: vscode.DiagnosticSeverity.Error,
                source: '',
                relatedInformation: [
                    new vscode.DiagnosticRelatedInformation(new vscode.Location(document.uri, new vscode.Range(new vscode.Position(1, 8), new vscode.Position(1, 9))), 'first assignment to `x`')
                ]
            }]);
        });
    } else {
        collection.clear();
    }
}
