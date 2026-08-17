// Download language servers from GitHub releases
// Licensed under GPL-3.0-only

import * as path from "path";
import * as fs from "fs";
import got from 'got';
import { promisify } from 'node:util';
import * as stream from 'stream';
import * as vscode from 'vscode';
// Note: semver types are provided by @types/semver
const semver = require('semver');


export interface ServerInfo {
    version: string;
    lastUpdate: number;
    filename: string;
}

export interface GitHubReleasesAPIResponse {
    url: string;
    assets_url: string;
    upload_url: string;
    html_url: string;
    id: number;
    node_id: string;
    tag_name: string;
    target_commitish: string;
    name: string;
    draft: boolean;
    author: GitHubReleasesAPIAuthor;
    prerelease: boolean;
    created_at: string;
    published_at: string;
    assets: GitHubReleasesAPIAsset[];
    tarball_url: string;
    zipball_url: string;
    body: any | null;
}

export interface GitHubReleasesAPIAuthor {
    login: string;
    id: number;
    node_id: string;
    gravatar_id: string;
    url: string;
    html_url: string;
    followers_url: string;
    following_url: string;
    gists_url: string;
    starred_url: string;
    subscriptions_url: string;
    organizations_url: string;
    repos_url: string;
    events_url: string;
    received_events_url: string;
    type: string;
    site_admin: boolean;
}

export interface GitHubReleasesAPIAsset {
    url: string;
    id: number;
    node_id: string;
    name: string;
    label: string;
    uploader: GitHubReleasesAPIAuthor;
    content_type: string;
    state: string;
    size: number;
    download_count: number;
    created_at: string;
    updated_at: string;
    browser_download_url: string;
}


/**
 * Downloads a file from URL to destination path with progress reporting
 */
export async function download(
    srcUrl: string, 
    destPath: string, 
    progress: (percent: number) => void
): Promise<void> {
    const pipeline = promisify(stream.pipeline);
    const downStream = got.stream(srcUrl);
    downStream.on('downloadProgress', (progressData) => {
        progress(progressData.percent);
    });
    await pipeline(downStream, fs.createWriteStream(destPath));
}

async function fsExists(pathLike: string): Promise<boolean> {
    try {
        await fs.promises.access(pathLike);
        return true;
    } catch {
        return false;
    }
}

/**
 * Downloads language servers from GitHub releases.
 * The downloader automatically manages versioning and downloads
 * updates if necessary.
 */
export class ServerDownloader {
    private displayName: string;
    private githubOwner: string;
    private githubRepo: string;
    private assetPattern: RegExp;
    private installDir: string;

    constructor(
        displayName: string, 
        githubOwner: string, 
        githubRepo: string,
        assetPattern: RegExp, 
        installDir: string
    ) {
        this.displayName = displayName;
        this.githubOwner = githubOwner;
        this.githubRepo = githubRepo;
        this.installDir = installDir;
        this.assetPattern = assetPattern;
    }

    private async latestReleaseInfo(): Promise<GitHubReleasesAPIResponse> {
        return await got.get(
            `https://api.github.com/repos/${this.githubOwner}/${this.githubRepo}/releases/latest`, 
            {
                headers: { "User-Agent": "vscode-jmltk" }
            }
        ).json() as GitHubReleasesAPIResponse;
    }

    private serverInfoFile(): string {
        return path.join(this.installDir, "SERVER-INFO");
    }

    private async installedServerInfo(): Promise<ServerInfo | null> {
        try {
            const info = JSON.parse(
                (await fs.promises.readFile(this.serverInfoFile())).toString("utf8")
            ) as ServerInfo;
            return semver.valid(info.version) ? info : null;
        } catch {
            return null;
        }
    }

    private async updateInstalledServerInfo(info: ServerInfo): Promise<void> {
        await fs.promises.writeFile(
            this.serverInfoFile(), 
            JSON.stringify(info), 
            { encoding: "utf8" }
        );
    }

    /**
     * Downloads the server jar file with VS Code progress notification
     */
    private async downloadServer(downloadUrl: string, version: string): Promise<string> {
        if (!(await fsExists(this.installDir))) {
            await fs.promises.mkdir(this.installDir, { recursive: true });
        }

        const fileName = path.basename(new URL(downloadUrl).pathname);
        const destPath = path.join(this.installDir, fileName);

        await vscode.window.withProgress({
            cancellable: true,
            location: vscode.ProgressLocation.Notification,
            title: `Downloading ${this.displayName}`
        }, async (progress, token) => {
            progress.report({ message: `Downloading ${this.displayName} ${version}...` });
            
            await download(downloadUrl, destPath, (percent) => {
                const percentStr = (percent * 100).toFixed(2);
                progress.report({ 
                    message: `Downloading ${this.displayName} ${version}: ${percentStr}%`,
                    increment: 0
                });
            });

            progress.report({ message: `Initializing ${this.displayName} ${version}...` });
        });

        return destPath;
    }

    /**
     * Downloads the server if needed and returns the path to the jar file
     */
    async downloadServerIfNeeded(): Promise<string> {
        const serverInfo = await this.installedServerInfo();
        const serverInfoOrDefault: ServerInfo = serverInfo ?? { 
            version: "0.0.0", 
            lastUpdate: Number.MIN_SAFE_INTEGER,
            filename: ""
        };
        const secondsSinceLastUpdate = (Date.now() - serverInfoOrDefault.lastUpdate) / 1000;

        // Only check for updates if enough time has passed (8 minutes)
        if (secondsSinceLastUpdate > 480) {
            console.info(`Querying GitHub API for new ${this.displayName} version...`);

            let releaseInfo: GitHubReleasesAPIResponse;

            try {
                releaseInfo = await this.latestReleaseInfo();
            } catch (error) {
                const message = `Could not fetch from GitHub releases API: ${error}.`;
                if (serverInfo == null) {
                    // No server is installed yet, so throw
                    throw new Error(message);
                } else {
                    // User might be offline, use existing installation
                    console.warn(message);
                    return path.join(this.installDir, serverInfo.filename);
                }
            }

            const latestVersion = releaseInfo.tag_name;
            const installedVersion = serverInfoOrDefault.version;
            const serverNeedsUpdate = semver.gt(latestVersion, installedVersion);

            if (serverNeedsUpdate || !serverInfo) {
                const serverAsset = releaseInfo.assets.find(asset => 
                    asset.name.match(this.assetPattern)
                );
                
                if (serverAsset) {
                    const downloadUrl = serverAsset.browser_download_url;
                    const downloadedPath = await this.downloadServer(
                        downloadUrl, 
                        latestVersion
                    );
                    
                    await this.updateInstalledServerInfo({
                        version: latestVersion,
                        lastUpdate: Date.now(),
                        filename: serverAsset.name
                    });

                    vscode.window.showInformationMessage(
                        `${this.displayName} ${latestVersion} downloaded successfully!`
                    );
                    
                    return downloadedPath;
                } else {
                    throw new Error(
                        `Latest GitHub release for ${this.githubOwner}/${this.githubRepo} ` +
                        `does not contain an asset matching pattern '${this.assetPattern}'!`
                    );
                }
            }
        }
        
        // Return existing installation
        const filename = serverInfo?.filename || serverInfoOrDefault.filename;
        return path.join(this.installDir, filename);
    }
}
