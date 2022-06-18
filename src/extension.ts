'use strict';
import * as vscode from 'vscode';
import { updateDiagnosticsWithOpenJml } from './openjml';

export function activate(context: vscode.ExtensionContext) {
    const collection = vscode.languages.createDiagnosticCollection('jml');
    if (vscode.window.activeTextEditor) {
        updateDiagnosticsWithOpenJml(vscode.window.activeTextEditor.document, collection);
    }
    //TODO wrong event
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            updateDiagnosticsWithOpenJml(editor.document, collection);
        }
    }));
}

// this method is called when your extension is deactivated
export function deactivate() {
}



/*import vscode;

let diagnosticCollection: vscode.DiagnosticCollection;

function onChange() {
    let uri = document.uri;
    check(uri.fsPath, goConfig).then(errors => {
        diagnosticCollection.clear();
        let diagnosticMap: Map<string, vscode.Diagnostic[]> = new Map();
        errors.forEach(error => {
            let canonicalFile = vscode.Uri.file(error.file).toString();
            let range = new vscode.Range(error.line - 1, error.startColumn, error.line - 1, error.endColumn);
            let diagnostics = diagnosticMap.get(canonicalFile);
            if (!diagnostics) { diagnostics = []; }
            diagnostics.push(new vscode.Diagnostic(range, error.msg, error.severity));
            diagnosticMap.set(canonicalFile, diagnostics);
        });
        diagnosticMap.forEach((diags, file) => {
            diagnosticCollection.set(vscode.Uri.parse(file), diags);
        });
    })
}



export function activate(ctx: vscode.ExtensionContext): void {
    ctx.subscriptions.push(getDisposable());
    diagnosticCollection = vscode.languages.createDiagnosticCollection('go');
    ctx.subscriptions.push(diagnosticCollection);

}*/