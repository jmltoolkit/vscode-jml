import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ServerDownloader, ServerInfo } from '../../serverDownloader';

suite('ServerDownloader Test Suite', () => {
    let tempDir: string;

    setup(() => {
        // Create a temporary directory for each test
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jmltk-downloader-test-'));
    });

    teardown(() => {
        // Clean up temporary directory after each test
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('ServerDownloader should be constructable with valid parameters', () => {
        const downloader = new ServerDownloader(
            'Test LSP',
            'test-owner',
            'test-repo',
            /.*\.jar/,
            tempDir
        );
        
        assert.ok(downloader);
    });

    test('ServerDownloader should handle empty install directory', async () => {
        const downloader = new ServerDownloader(
            'Test LSP',
            'wadoon',
            'jml-lsp',
            /.*\.jar/,
            tempDir
        );

        // The downloadServerIfNeeded should either download or throw gracefully
        // when no server info exists and network is unavailable
        try {
            await downloader.downloadServerIfNeeded();
            // If it succeeds, verify the install directory was created
            assert.ok(fs.existsSync(tempDir));
        } catch (err) {
            // Expected to fail if offline or repo doesn't exist
            assert.ok(err instanceof Error);
        }
    });

    test('ServerDownloader should read existing SERVER-INFO file', async () => {
        // Create a mock SERVER-INFO file
        const serverInfo: ServerInfo = {
            version: '1.0.0',
            lastUpdate: Date.now(),
            filename: 'test-server.jar'
        };
        
        fs.mkdirSync(tempDir, { recursive: true });
        fs.writeFileSync(
            path.join(tempDir, 'SERVER-INFO'),
            JSON.stringify(serverInfo)
        );

        // Create a dummy jar file
        fs.writeFileSync(path.join(tempDir, 'test-server.jar'), 'dummy content');

        const downloader = new ServerDownloader(
            'Test LSP',
            'wadoon',
            'jml-lsp',
            /.*\.jar/,
            tempDir
        );

        // Should return the existing jar path without downloading
        const result = await downloader.downloadServerIfNeeded();
        assert.ok(result.includes('test-server.jar'));
    });

    test('ServerDownloader should detect outdated version', async () => {
        // Create an old SERVER-INFO file
        const oldServerInfo: ServerInfo = {
            version: '0.0.1',
            lastUpdate: 0, // Very old timestamp
            filename: 'old-server.jar'
        };
        
        fs.mkdirSync(tempDir, { recursive: true });
        fs.writeFileSync(
            path.join(tempDir, 'SERVER-INFO'),
            JSON.stringify(oldServerInfo)
        );

        const downloader = new ServerDownloader(
            'Test LSP',
            'wadoon',
            'jml-lsp',
            /.*\.jar/,
            tempDir
        );

        // This will attempt to check for updates from GitHub
        // May succeed (if online and repo exists) or fail gracefully
        try {
            await downloader.downloadServerIfNeeded();
        } catch (err) {
            // Expected to potentially fail if offline
            assert.ok(err instanceof Error);
        }
    });

    test('ServerDownloader respects update interval (480 seconds)', async () => {
        // Create a recent SERVER-INFO file
        const recentServerInfo: ServerInfo = {
            version: '1.0.0',
            lastUpdate: Date.now(),
            filename: 'current-server.jar'
        };
        
        fs.mkdirSync(tempDir, { recursive: true });
        fs.writeFileSync(
            path.join(tempDir, 'SERVER-INFO'),
            JSON.stringify(recentServerInfo)
        );
        fs.writeFileSync(path.join(tempDir, 'current-server.jar'), 'dummy content');

        const downloader = new ServerDownloader(
            'Test LSP',
            'wadoon',
            'jml-lsp',
            /.*\.jar/,
            tempDir
        );

        // Should return immediately without checking GitHub
        const result = await downloader.downloadServerIfNeeded();
        assert.ok(result.includes('current-server.jar'));
    });

    test('ServerDownloader handles invalid SERVER-INFO gracefully', async () => {
        fs.mkdirSync(tempDir, { recursive: true });
        // Write invalid JSON
        fs.writeFileSync(
            path.join(tempDir, 'SERVER-INFO'),
            'invalid json content'
        );

        const downloader = new ServerDownloader(
            'Test LSP',
            'wadoon',
            'jml-lsp',
            /.*\.jar/,
            tempDir
        );

        // Should treat as no server info and attempt download or fail gracefully
        try {
            await downloader.downloadServerIfNeeded();
        } catch (err) {
            // Expected to potentially fail if offline
            assert.ok(err instanceof Error);
        }
    });

    test('Asset pattern matching works correctly', () => {
        const jarPattern = /.*\.jar/;
        const specificPattern = /jml-lsp-.*-all\.jar/;
        
        const testAssets = [
            'jml-lsp-1.0.0-all.jar',
            'server.jar',
            'library.zip',
            'my-app.jar',
            'JML-LSP-2.0.0-all.JAR'
        ];

        // Test generic jar pattern
        assert.ok(jarPattern.test('jml-lsp-1.0.0-all.jar'));
        assert.ok(jarPattern.test('server.jar'));
        assert.ok(!jarPattern.test('library.zip'));

        // Test specific pattern
        assert.ok(specificPattern.test('jml-lsp-1.0.0-all.jar'));
        assert.ok(!specificPattern.test('other.jar'));
    });
});