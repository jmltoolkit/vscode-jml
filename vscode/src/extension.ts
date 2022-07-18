'use strict';

import * as fs from "fs";
import * as path from 'path';
import * as net from 'net';
import * as child_process from "child_process";
import * as vscode from 'vscode';
import { activateSemanticTokensProvider } from './jst'
import { workspace, Disposable, ExtensionContext, window } from 'vscode';
import { LanguageClient, LanguageClientOptions, SettingMonitor, StreamInfo } from 'vscode-languageclient/node';

export function activate(context: ExtensionContext) {
	context.subscriptions.push(
		activateSemanticTokensProvider()
	);

	context.subscriptions.push(
		//activateLanguageServer(context)
	);

}

function activateLanguageServer(context: ExtensionContext): Disposable {
	function createServer(): Promise<StreamInfo> {
		return new Promise((resolve, reject) => {
			var server = net.createServer((socket) => {
				console.log("Creating server");

				resolve({
					reader: socket,
					writer: socket
				});

				socket.on('end', () => console.log("Disconnected"));
			}).on('error', (err) => {
				// handle errors here
				throw err;
			});

			const javaExecutablePath = findJavaExecutable();
			findJar(context).then(jarFile => {
				// grab a random port.
				server.listen(() => {
					// Start the child java process
					let options = { cwd: workspace.rootPath };

					let args: string[] = [
						'-jar', jarFile, "--client", server.address().port.toString()
					];

					console.log("Starting OpenJML: " + javaExecutablePath + " " + args);

					let process = child_process.spawn(javaExecutablePath, args, options);

					// Send raw output to a file
					const storagePath = context.storageUri?.fsPath;
					if (storagePath && !fs.existsSync(storagePath)) {
						fs.mkdirSync(context.storageUri?.fsPath);
					}

					let logFile = context.storagePath + '/vscode-languageserver-java-example.log';
					let logStream = fs.createWriteStream(logFile, { flags: 'w' });

					if (process) {
						process.stdout.pipe(logStream);
						process.stderr.pipe(logStream);
					}

					console.log(`Storing log in '${logFile}'`);
				});
			});
		});
	};

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: ['java'],
		synchronize: {
			// Synchronize the setting section 'languageServerExample' to the server
			configurationSection: 'openjml',
			// Notify the server about file changes to '.clientrc files contain in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/*.{java,jml}')
		}
	};

	// Create the language client and start the client.
	let client = new LanguageClient('openjml', 'OpenJML support', createServer, clientOptions);
	let disposable = client.start();
	return client;
}

// MIT Licensed code from: https://github.com/georgewfraser/vscode-javac
function findJavaExecutable(): string {
	let binname = correctBinname("java");

	let config = workspace.getConfiguration('openjml');
	let userDefined = path.resolve(config.get("javaPath") || "java");
	if (fs.existsSync(userDefined)) {
		return userDefined;
	}

	// First search each JAVA_HOME bin folder
	if (process.env['JAVA_HOME']) {
		let workspaces = process.env['JAVA_HOME'].split(path.delimiter);
		for (let i = 0; i < workspaces.length; i++) {
			let binpath = path.join(workspaces[i], 'bin', binname);
			if (fs.existsSync(binpath)) {
				return binpath;
			}
		}
	}

	// Then search PATH parts
	if (process.env['PATH']) {
		let pathparts = process.env['PATH'].split(path.delimiter);
		for (let i = 0; i < pathparts.length; i++) {
			let binpath = path.join(pathparts[i], binname);
			if (fs.existsSync(binpath)) {
				return binpath;
			}
		}
	}

	// Else return the binary name directly (this will likely always fail downstream) 
	return "java";
}

async function findJar(context: ExtensionContext): Promise<string> {
	let config = workspace.getConfiguration('openjml');
	let userDefined = path.resolve(config.get("jarFile") || "openjml-lsp-1.0-all.jar");

	if (fs.existsSync(userDefined)) {
		return userDefined;
	}

	const localDevMode =
		path.resolve(context.extensionPath,
			'..', 'server', 'build', 'libs', 'openjml-lsp-1.0-SNAPSHOT-all.jar');

	if (fs.existsSync(localDevMode)) {
		return localDevMode;
	}

	const globallyInstalled =
		path.resolve("${env.HOME}", ".openjml-lsp", "openjml-lsp-1.0-SNAPSHOT-all.jar");

	if (fs.existsSync(globallyInstalled)) {
		return localDevMode;
	}

	const locallyInstalled = await workspace.findFiles("**/openjml-lsp-*-all.jar");

	if (locallyInstalled) {
		return locallyInstalled[0].fsPath;
	}

	window.showErrorMessage("Could not find openjml-lsp jar file.");

	return path.resolve("openjml-lsp.jar");
}

function correctBinname(binname: string) {
	if (process.platform === 'win32') {
		return binname + '.exe';
	}
	else {
		return binname;
	}
}

