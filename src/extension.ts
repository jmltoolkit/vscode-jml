'use strict';

import * as fs from "fs";
import * as path from 'path';
import * as net from 'net';
import * as child_process from "child_process";
import * as vscode from 'vscode';
import { workspace, Disposable, ExtensionContext, window } from 'vscode';
import { LanguageClient, LanguageClientOptions, StreamInfo } from 'vscode-languageclient/node';

import { globby } from 'globby';
import { ServerDownloader } from "./serverDownloader";


export function activate(context: ExtensionContext) {
    // Activate semantic tokens provider for JML
    // context.subscriptions.push(activateSemanticTokensProvider());

    // Activate KeY language support
    // activateKeyLanguage(context);

    const config = workspace.getConfiguration("jmltk");
    if (config.get("lspDisabled") !== true) {
        context.subscriptions.push(
            activateLanguageServer(context)
        );
    }
}

function activateLanguageServer(context: ExtensionContext): Disposable {
    const output = window.createOutputChannel("JMLTK Language Server", { log: true });

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

            const javaExecutablePath = findJavaExecutable();
            findJar(context).then(jarFile => {
                console.log("Found Jar file: ", jarFile);
                // grab a random port.
                server.listen(() => {
                    // Start the child java process
                    let options = { cwd: workspace.rootPath };

                    let args: string[] = [
                        '-jar', jarFile, "--mode", "client",
                        "--port", (server.address() as net.AddressInfo).port.toString()
                    ];

                    console.log("Starting JML: " + javaExecutablePath + " " + args);

                    let process = child_process.spawn(javaExecutablePath, args, options);

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
        documentSelector: ['java'],
        synchronize: {
            configurationSection: 'jmltk',
            fileEvents: workspace.createFileSystemWatcher('**/*.{java,jml}')
        }
    };

    // Create the language client and start the client.
    let client = new LanguageClient('jmltk', 'JMLTK Language Server', createServer, clientOptions);
    let disposable = client.start();
    context.subscriptions.push(output);
    return client;
}

/**
 * Finds the Java executable by checking multiple sources in order:
 * 1. jmltk.javaHome config setting + /bin/java
 * 2. JAVA_HOME environment variable + /bin/java
 * 3. jmltk.javaPath config setting (full path override)
 * 4. System PATH search for 'java'
 * 5. Platform-specific locations (/usr/lib/jvm, /Library/Java, etc.)
 */
function findJavaExecutable(): string {
    const config = workspace.getConfiguration('jmltk');
    
    // Priority 1: Check jmltk.javaHome config setting
    const javaHomeConfig = config.get<string>('javaHome');
    if (javaHomeConfig) {
        const binname = getJavaBinName();
        const javaHomePath = path.resolve(javaHomeConfig);
        const javaFromHome = path.join(javaHomePath, 'bin', binname);
        if (fs.existsSync(javaFromHome)) {
            console.log(`Found Java via javaHome config: ${javaFromHome}`);
            return javaFromHome;
        }
        // Also try without bin on Windows
        if (process.platform === 'win32') {
            const javaFromHomeDirect = path.join(javaHomePath, binname);
            if (fs.existsSync(javaFromHomeDirect)) {
                console.log(`Found Java via javaHome config (direct): ${javaFromHomeDirect}`);
                return javaFromHomeDirect;
            }
        }
    }

    // Priority 2: Check JAVA_HOME environment variable
    if (process.env['JAVA_HOME']) {
        const binname = getJavaBinName();
        const javaHomePath = process.env['JAVA_HOME'];
        const javaFromEnv = path.join(javaHomePath, 'bin', binname);
        if (fs.existsSync(javaFromEnv)) {
            console.log(`Found Java via JAVA_HOME: ${javaFromEnv}`);
            return javaFromEnv;
        }
    }

    // Priority 3: Check jmltk.javaPath full path override
    const userDefinedJava = config.get<string>('javaPath');
    if (userDefinedJava) {
        const userDefinedPath = path.resolve(userDefinedJava);
        if (fs.existsSync(userDefinedPath)) {
            console.log(`Found Java via javaPath config: ${userDefinedPath}`);
            return userDefinedPath;
        }
    }

    // Priority 4: Search system PATH for 'java'
    const pathFromEnv = findInPath(getJavaBinName());
    if (pathFromEnv) {
        console.log(`Found Java in PATH: ${pathFromEnv}`);
        return pathFromEnv;
    }

    // Priority 5: Platform-specific locations
    const platformSpecific = findPlatformSpecificJava();
    if (platformSpecific) {
        console.log(`Found Java via platform-specific search: ${platformSpecific}`);
        return platformSpecific;
    }

    // Fallback: return 'java' and hope it's in PATH
    console.warn('Java not found, using default "java" command');
    return "java";
}

function getJavaBinName(): string {
    if (process.platform === 'win32') {
        return 'java.exe';
    }
    return 'java';
}

function findInPath(binname: string): string | null {
    if (!process.env['PATH']) {
        return null;
    }
    
    const pathParts = process.env['PATH'].split(path.delimiter);
    for (const pathPart of pathParts) {
        const binpath = path.join(pathPart, binname);
        if (fs.existsSync(binpath)) {
            return binpath;
        }
    }
    return null;
}

/**
 * Platform-specific Java detection
 * - Linux: /usr/lib/jvm, /usr/java, /opt/java, etc.
 * - macOS: /Library/Java/JavaVirtualMachines, /usr/bin/java
 * - Windows: Program Files/Java, Program Files (x86)/Java, etc.
 */
function findPlatformSpecificJava(): string | null {
    const binname = getJavaBinName();
    
    if (process.platform === 'linux') {
        // Check common Linux Java installation paths
        const linuxJavaPaths = [
            '/usr/lib/jvm',
            '/usr/java',
            '/opt/java',
            '/usr/local/java'
        ];
        
        for (const baseDir of linuxJavaPaths) {
            if (fs.existsSync(baseDir)) {
                try {
                    const entries = fs.readdirSync(baseDir);
                    for (const entry of entries) {
                        const javaPath = path.join(baseDir, entry, 'bin', binname);
                        if (fs.existsSync(javaPath)) {
                            return javaPath;
                        }
                    }
                } catch {
                    // Ignore read errors
                }
            }
        }
    } else if (process.platform === 'darwin') {
        // Check macOS Java installation paths
        const macJavaBase = '/Library/Java/JavaVirtualMachines';
        if (fs.existsSync(macJavaBase)) {
            try {
                const entries = fs.readdirSync(macJavaBase);
                for (const entry of entries) {
                    const javaPath = path.join(
                        macJavaBase, entry, 'Contents', 'Home', 'bin', binname
                    );
                    if (fs.existsSync(javaPath)) {
                        return javaPath;
                    }
                }
            } catch {
                // Ignore read errors
            }
        }
        
        // Also check /usr/bin/java symlink
        if (fs.existsSync('/usr/bin/java')) {
            return '/usr/bin/java';
        }
    } else if (process.platform === 'win32') {
        // Check common Windows Java installation paths
        const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
        const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
        
        const winJavaPaths = [
            path.join(programFiles, 'Java'),
            path.join(programFilesX86, 'Java'),
            path.join(programFiles, 'Eclipse Adoptium'),
            path.join(programFilesX86, 'Eclipse Adoptium'),
            path.join(programFiles, 'Microsoft'),
            path.join(process.env['LOCALAPPDATA'] || '', 'Microsoft\\WindowsApps')
        ];
        
        for (const baseDir of winJavaPaths) {
            if (fs.existsSync(baseDir)) {
                try {
                    const entries = fs.readdirSync(baseDir);
                    for (const entry of entries) {
                        const javaPath = path.join(baseDir, entry, 'bin', binname);
                        if (fs.existsSync(javaPath)) {
                            return javaPath;
                        }
                    }
                } catch {
                    // Ignore read errors
                }
            }
        }
    }
    
    return null;
}

async function findJar(context: ExtensionContext): Promise<string> {
    const config = workspace.getConfiguration('jmltk');
    const storagePath = context.storageUri?.fsPath;

    // List of potential paths to search for the LSP jar file
    const potentialPaths: string[] = [];
    
    // 1. User-configured jarFile path
    const configuredJarFile = config.get<string | null>('jarFile');
    if (configuredJarFile) {
        potentialPaths.push(path.resolve(configuredJarFile));
    }
    
    // 2. Extension folder relative path
    potentialPaths.push(
        path.join(context.extensionPath, '..', 'lsp', 'build', 'libs', 'jml-lsp-*-all.jar')
    );
    
    // 3. Storage path (VS Code extension storage)
    if (storagePath) {
        potentialPaths.push(path.join(storagePath, "lsp", "jml-lsp-*-all.jar"));
    }
    
    // 4. User home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (homeDir) {
        potentialPaths.push(path.join(homeDir, ".jml-lsp", "jml-lsp-*-all.jar"));
        potentialPaths.push(path.join(homeDir, ".jmltk", "lsp", "jml-lsp-*-all.jar"));
    }

    // Search each potential path using glob pattern matching
    for (const candidate of potentialPaths) {
        try {
            const paths = await globby(candidate);
            if (paths.length > 0) {
                console.log(`Found JAR via glob pattern: ${candidate} -> ${paths[0]}`);
                return paths[0];
            }
        } catch {
            // Continue to next candidate
        }
    }

    // 5. Search workspace for locally installed jars
    try {
        const locallyInstalled = await workspace.findFiles("**/jml-lsp-*-all.jar");
        if (locallyInstalled && locallyInstalled.length > 0) {
            console.log(`Found JAR in workspace: ${locallyInstalled[0].fsPath}`);
            return locallyInstalled[0].fsPath;
        }
    } catch {
        // Continue to download
    }

    // 6. Download from GitHub releases
    console.log("JAR not found locally, initiating download from GitHub...");
    const installDir = storagePath ? path.join(storagePath, 'lsp') : 
                       path.join(context.extensionPath, 'lsp');
    
    const githubOwner = config.get<string>('githubOwner') || 'wadoon';
    const githubRepo = config.get<string>('githubRepo') || 'jml-lsp';
    const assetPatternStr = config.get<string>('assetPattern') || '.*\\.jar';
    const assetPattern = new RegExp(assetPatternStr);
    
    const downloader = new ServerDownloader(
        "JMLTK LSP", 
        githubOwner, 
        githubRepo, 
        assetPattern, 
        installDir
    );
    
    const downloadedPath = await downloader.downloadServerIfNeeded();
    console.log(`Downloaded/Using JAR: ${downloadedPath}`);
    return downloadedPath;
}