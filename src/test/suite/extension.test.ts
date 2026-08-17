import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Configuration should use jmltk namespace', async () => {
        const config = vscode.workspace.getConfiguration('jmltk');
        
        // Verify configuration exists and has expected properties
        assert.ok(config);
        assert.strictEqual(typeof config.get('lspDisabled'), 'boolean');
        assert.strictEqual(typeof config.get('javaPath'), 'string');
        assert.strictEqual(typeof config.get('javaHome'), 'object'); // can be null
        assert.strictEqual(typeof config.get('jarFile'), 'object'); // can be null
        assert.strictEqual(typeof config.get('githubOwner'), 'string');
        assert.strictEqual(typeof config.get('githubRepo'), 'string');
        assert.strictEqual(typeof config.get('assetPattern'), 'string');
    });
});