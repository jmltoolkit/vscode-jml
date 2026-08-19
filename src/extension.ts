'use strict';

import * as fs from "fs";
import * as path from 'path';
import * as net from 'net';
import * as child_process from "child_process";
import * as vscode from 'vscode';
import { workspace, Disposable, ExtensionContext, window } from 'vscode';
import { LanguageClient, LanguageClientOptions, StreamInfo } from 'vscode-languageclient/node';

import { ServerDownloader } from "./serverDownloader";


export function activate(context: ExtensionContext) {
    context.subscriptions.push(
        activateLanguageServer(context)
    );
}

function activateLanguageServer(context: ExtensionContext): Disposable {
    const output = window.createOutputChannel("JMLtk Language Server", { log: true });

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
                throw err;
            });

            findServerScript(context).then(scriptPath => {
                console.log("Found server script: ", scriptPath);
                // grab a random port.
                server.listen(() => {
                    // Start the child process
                    let options = { cwd: workspace.rootPath };

                    let args: string[] = [
                        "--client", (server.address() as net.AddressInfo).port.toString()
                    ];

                    console.log("Starting JML: " + scriptPath + " " + args);

                    let process = child_process.spawn(scriptPath, args, options);

                    process.on('error', err => {
                        server.close();
                        reject(err);
                    });

                    // Send raw output to storage path
                    const storagePath = context.storageUri?.fsPath;
                    if (storagePath && !fs.existsSync(storagePath)) {
                        fs.mkdirSync(context.storageUri?.fsPath, { recursive: true });
                    }

                    process.stdout.on("data", chunk => output.append(chunk.toString()));
                    process.stderr.on("data", chunk => output.append(chunk.toString()));
                });
            }).catch(err => {
                window.showErrorMessage(`Failed to find/download JML LSP server: ${err.message}`);
                reject(err);
            });
        });
    };

    // Options to control the language client
    let clientOptions: LanguageClientOptions = {
         documentSelector: [
            { scheme: 'file', language: 'java' },
            { scheme: 'file', language: 'key' }        
        ],
        synchronize: {
            configurationSection: 'jmltk',
            fileEvents: workspace.createFileSystemWatcher('**/*.{java,jml}')
        },        
        outputChannel: output,
        initializationOptions: {}
    };

    // Create the language client and start the client.
    let client = new LanguageClient('jmltk', 'JMLtk Language Server', createServer, clientOptions);
    let disposable = client.start();
    context.subscriptions.push(output, client);
    return client;
}

async function findServerScript(context: ExtensionContext): Promise<string> {
    const config = workspace.getConfiguration('jmltk');
    const storagePath = context.storageUri?.fsPath;

    // List of potential paths to search for the LSP server script
    const potentialPaths: string[] = [];
    
    // 1. User-configured serverScript path
    const configuredServerScript = config.get<string | null>('serverScript');
    if (configuredServerScript) {
        potentialPaths.push(path.resolve(configuredServerScript));
    }
    
    // 2. Extension folder relative path
    potentialPaths.push(
        path.join(context.extensionPath, '..', 'lsp', 'bin', 'jmltk-lsp')
    );

    potentialPaths.push(
        path.join(context.extensionPath, '..', 'javaparser', 'tools', 'cli', 'build', 'install','jmltk', 'bin', 'jmltk-lsp')
    );


    // 3. Storage path (VS Code extension storage)
    if (storagePath) {
        potentialPaths.push(path.join(storagePath, "lsp", "bin", "jmltk-lsp"));
    }
    
    // 4. User home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (homeDir) {
        potentialPaths.push(path.join(homeDir, ".jmltk-lsp", "bin", "jmltk-lsp"));
    }

    // Search each potential path
    for (const candidate of potentialPaths) {
        if (fs.existsSync(candidate)) {
            console.log(`Found server script: ${candidate}`);
            return candidate;
        }
    }

    // 5. Search workspace for locally installed server
    try {
        const locallyInstalled = await workspace.findFiles("**/bin/jmltk-lsp");
        if (locallyInstalled && locallyInstalled.length > 0) {
            console.log(`Found server script in workspace: ${locallyInstalled[0].fsPath}`);
            return locallyInstalled[0].fsPath;
        }
    } catch {
        // Continue to download
    }

    // 6. Download from GitHub releases
    console.log("Server script not found locally, initiating download from GitHub...");
    const installDir = storagePath ? path.join(storagePath, 'lsp') : 
                       path.join(context.extensionPath, 'lsp');
    
    const githubOwner = config.get<string>('githubOwner') || 'jmltoolkit';
    const githubRepo = config.get<string>('githubRepo') || 'jmltk';
    const assetPatternStr = config.get<string>('assetPattern') || 'jmltk-.*\\.zip$';
    const assetPattern = new RegExp(assetPatternStr);
    
    const downloader = new ServerDownloader(
        "JMLTK LSP", 
        githubOwner, 
        githubRepo, 
        assetPattern, 
        installDir
    );
    
    const downloadedPath = await downloader.downloadServerIfNeeded();
    console.log(`Downloaded/Using server: ${downloadedPath}`);
    return downloadedPath;
}
