// Taken from https://raw.githubusercontent.com/fwcd/vscode-kotlin/dc413a27e4f8e9a728e7cee63f795105e53939fc/src/serverDownloader.ts
// Original licensed under MIT, modified for vscode-jml

import * as path from "path";
import * as semver from "semver";
import * as fs from "fs";
import got from 'got';
import { promisify } from 'node:util';
import * as stream from 'stream'
import * as vscode from 'vscode'


export interface ServerInfo {
    version: string
    lastUpdate: number
    filename: string
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


export async function download(srcUrl: string, destPath: fs.PathLike, progress: (percent: number) => void): Promise<void> {
    const pipeline = promisify(stream.pipeline)
    const downStream = got.stream(srcUrl)
    downStream.on('downloadProgress', progress)
    await pipeline(downStream, fs.createWriteStream(destPath))

    /*
    return new Promise((resolve, reject) => {
        requestProgress(request(srcUrl))
            .on("progress", state => progress(state.percent))
            .on("complete", () => resolve())
            .on("error", err => reject(err))
            .pipe(fs.createWriteStream(destPath));
    });*/
}

async function fsExists(path: fs.PathLike): Promise<boolean> {
    try {
        await fs.promises.access(path);
        return true;
    } catch {
        return false;
    }
}

/**
 * Downloads language servers or debug adapters from GitHub releases.
 * The downloaded automatically manages versioning and downloads
 * updates if necessary.
 */
export class ServerDownloader {
    private displayName: string;
    private githubProjectName: string;
    private assetName: RegExp;
    private installDir: string;

    constructor(displayName: string, githubProjectName: string, assetName: RegExp, installDir: string) {
        this.displayName = displayName;
        this.githubProjectName = githubProjectName;
        this.installDir = installDir;
        this.assetName = assetName;
    }

    private async latestReleaseInfo(): Promise<GitHubReleasesAPIResponse> {
        return await got.get(`https://api.github.com/repos/vscode-jml/${this.githubProjectName}/releases/latest`, {
            headers: { "User-Agent": "vscode-jml" }
        }).json() as GitHubReleasesAPIResponse;
    }

    private serverInfoFile(): string {
        return path.join(this.installDir, "SERVER-INFO");
    }

    private async installedServerInfo(): Promise<ServerInfo> {
        try {
            const info = JSON.parse((await fs.promises.readFile(this.serverInfoFile())).toString("utf8")) as ServerInfo;
            return semver.valid(info.version) ? info : null;
        } catch {
            return null;
        }
    }

    private async updateInstalledServerInfo(info: ServerInfo): Promise<void> {
        await fs.promises.writeFile(this.serverInfoFile(), JSON.stringify(info), { encoding: "utf8" });
    }

    private async downloadServer(downloadUrl: string, downloadDest: string, version: string) {
        if (!(await fsExists(this.installDir))) {
            await fs.promises.mkdir(this.installDir, { recursive: true });
        }

        vscode.window.withProgress({
            cancellable: true,
            location: vscode.ProgressLocation.Notification,
            title: "Downloading jml language server"
        }, async (progress, cancel) => {
            //const downloadDest = path.join(this.installDir, `download-${this.assetName}`);
            progress.report({ message: `Downloading ${this.displayName} ${version}...` });
            await download(downloadUrl, downloadDest, percent => {
                progress.report({ message: `Downloading ${this.displayName} ${version} :: ${(percent * 100).toFixed(2)} %` });
            });

            //status.update(`Unpacking ${this.displayName} ${version}...`);
            //await extractZip(downloadDest, { dir: this.installDir });
            //await fs.promises.unlink(downloadDest);
            progress.report({ message: `Initializing ${this.displayName} ${version}...` });
        });
    }

    async downloadServerIfNeeded(): Promise<string> {
        const serverInfo = await this.installedServerInfo();
        const serverInfoOrDefault = serverInfo || { version: "0.0.0", lastUpdate: Number.MIN_SAFE_INTEGER };
        const secondsSinceLastUpdate = (Date.now() - serverInfoOrDefault.lastUpdate) / 1000;

        if (secondsSinceLastUpdate > 480) {
            // Only query GitHub API for latest version if some time has passed
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
                    // Do not throw since user might just be offline
                    // and a version of the server is already installed
                    console.warn(message);
                    return;
                }
            }

            const latestVersion = releaseInfo.tag_name;
            const installedVersion = serverInfoOrDefault.version;
            const serverNeedsUpdate = semver.gt(latestVersion, installedVersion);
            let newVersion = installedVersion;

            if (serverNeedsUpdate) {
                const serverAsset = releaseInfo.assets.find(asset => asset.name.match(this.assetName));
                if (serverAsset) {
                    const downloadUrl = serverAsset.browser_download_url;
                    await this.downloadServer(downloadUrl,
                        path.join(this.installDir, serverAsset.name), latestVersion);
                    newVersion = latestVersion;
                    await this.updateInstalledServerInfo({
                        version: newVersion,
                        lastUpdate: Date.now(),
                        filename: serverAsset.name
                    });                    
                    return path.join(this.installDir, serverAsset.name)
                } else {
                    throw new Error(`Latest GitHub release for ${this.githubProjectName} does not contain the asset with pattern '${this.assetName}'!`);
                }
            }
        } 
        return path.join(this.installDir, serverInfo.filename)
    }
}

/*
async function downloadLanguageServer(storagePath: string): Promise<string> {
    let progress: vscode.Progress<any> | undefined;
    let cancel: vscode.CancellationToken | undefined;
    let dest: string | undefined
    let done: Function | false | undefined;

    const request = http.get("https://github.com", function (response) {
        if (response.statusCode == 200) {
            dest = path.join(storagePath, "lsp", response.headers["content-disposition"])
            if (cancel) {
                cancel.onCancellationRequested(() => {
                    if (request.destroyed || response.destroyed) return;
                    request.destroy();
                    response.destroy();
                });
            } else {
                console.error("failed registering cancel token");
            }

            let len = parseInt(response.headers["content-length"] || "0")
            let totalPercent: number = 0;
            response.addListener("data", (chunk) => {
                let increment = chunk.length / len;
                totalPercent += increment;
                if (progress)
                    progress.report({
                        message: `Downloaded ${(totalPercent * 100).toFixed(2)}%`,
                        increment: increment * 100
                    });
            })

            const file = fs.createWriteStream(path.resolve())
            response.pipe(file, { end: true });
            // after download completed close filestream
            file.on("end", () => {
                file.close();
                console.log("Download Completed");
            });

            response.on('error', error => {
                file.close()
                window.showErrorMessage("Download error " + error.message)
                console.log(error)
            })
        }
    }).on('error', function (err) { // Handle errors
        if (dest) fs.unlink(dest, (err) => { });
        //if (cb) cb(err.message);
    });

    vscode.window.withProgress({
        cancellable: true,
        location: vscode.ProgressLocation.Notification,
        title: "Downloading jml language server"
    }, (_progress, _cancel) => {
        progress = _progress;
        cancel = _cancel;
        return new Promise((resolve) => {
            if (done === false)
                return resolve(undefined);
            done = resolve;
        });
    });
    return "";
}
*/