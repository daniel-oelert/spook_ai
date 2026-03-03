import * as assert from 'assert';
import { loadPyodide } from 'pyodide';
import { createCoWBackend, getDirtyNodes } from '../fs.js';

suite('CoW FS Integration Test (Headless)', () => {
    let pyodide: any;
    let mockApiClient: any;
    let mockLowerFs: Map<string, string | Uint8Array>;

    suiteSetup(async () => {
        pyodide = await loadPyodide();

        mockLowerFs = new Map([
            ['/file.txt', 'lower content'],
            ['/dir1/lower_file2.txt', 'lower file 2 content'],
            ['/dir1', 'DIR']
        ]);

        mockApiClient = {
            vscode: {
                workspace: {
                    fileSystem: {
                        stat: (uri: any) => {
                            const path = uri.path;
                            const content = mockLowerFs.get(path);

                            if (content === 'DIR' || Array.from(mockLowerFs.keys()).some(k => k.startsWith(path + '/'))) {
                                return { type: 2, size: 0, mode: 0o40000 | 0o777 };
                            }
                            if (content !== undefined) {
                                return {
                                    type: 1,
                                    size: typeof content === 'string' ? Buffer.from(content).length : content.length,
                                    mode: 0o100000 | 0o666
                                };
                            }
                            throw new Error('Not found: ' + path);
                        },
                        readFile: (uri: any) => {
                            const path = uri.path;
                            const content = mockLowerFs.get(path);
                            if (content !== undefined && content !== 'DIR') {
                                return typeof content === 'string' ? new Uint8Array(Buffer.from(content)) : content;
                            }
                            throw new Error('Not found or is dir: ' + path);
                        },
                        readDirectory: (uri: any) => {
                            const path = uri.path;
                            const results: [string, number][] = [];
                            const prefix = path === '/' ? '/' : path + '/';

                            for (const k of mockLowerFs.keys()) {
                                if (k !== path && k.startsWith(prefix)) {
                                    const sub = k.slice(prefix.length);
                                    if (!sub.includes('/')) {
                                        results.push([sub, mockLowerFs.get(k) === 'DIR' ? 2 : 1]);
                                    }
                                }
                            }
                            if (results.length === 0 && !mockLowerFs.has(path) && !Array.from(mockLowerFs.keys()).some(k => k.startsWith(prefix))) {
                                throw new Error('Not found: ' + path);
                            }
                            return results;
                        }
                    }
                }
            }
        };

        const CoWFS = createCoWBackend(pyodide.FS, mockApiClient, []);
        pyodide.FS.mkdir('/cow');
        pyodide.FS.mount(CoWFS, {}, '/cow');
    });

    test('Python reads lower file', async () => {
        const result = await pyodide.runPythonAsync(`
            f = open('/cow/file.txt', 'r')
            c = f.read()
            f.close()
            c
        `);
        assert.strictEqual(result, 'lower content');
    });

    test('Python creates and writes to a new file, gets marked as added', async () => {
        await pyodide.runPythonAsync(`
            with open('/cow/new_file.txt', 'w') as f:
                f.write('new content')
        `);

        // Read it back
        const result = await pyodide.runPythonAsync(`
            f = open('/cow/new_file.txt', 'r')
            c = f.read()
            f.close()
            c
        `);
        assert.strictEqual(result, 'new content');

        const root = pyodide.FS.lookupPath('/cow').node;
        const dirty = getDirtyNodes(root);
        assert.ok(dirty.added.includes('/new_file.txt'), 'new_file.txt should be in added');
    });

    test('Python modifies a lower file, gets marked as modified', async () => {
        await pyodide.runPythonAsync(`
            with open('/cow/file.txt', 'w') as f:
                f.write('modified content')
        `);

        const result = await pyodide.runPythonAsync(`
            f = open('/cow/file.txt', 'r')
            c = f.read()
            f.close()
            c
        `);
        assert.strictEqual(result, 'modified content');

        const root = pyodide.FS.lookupPath('/cow').node;
        const dirty = getDirtyNodes(root);
        assert.ok(dirty.modified.includes('/file.txt'), 'file.txt should be modified');
        assert.ok(!dirty.added.includes('/file.txt'), 'file.txt should not be added');
    });

    test('Python deletes a lower file, gets marked as deleted (whiteout)', async () => {
        await pyodide.runPythonAsync(`
            import os
            os.remove('/cow/file.txt')
        `);

        let throws = false;
        try {
            await pyodide.runPythonAsync(`
                f = open('/cow/file.txt', 'r')
            `);
        } catch (e) {
            throws = true;
        }
        assert.ok(throws, "Should throw when reading a removed file");

        const root = pyodide.FS.lookupPath('/cow').node;
        const dirty = getDirtyNodes(root);
        assert.ok(dirty.deleted.includes('/file.txt'), 'file.txt should be in deleted (whiteouts)');
    });

    test('Python os.listdir works and combines upper and lower', async () => {
        await pyodide.runPythonAsync(`
            import os
            with open('/cow/upper_file.txt', 'w') as f:
                f.write('upper')
            files = os.listdir('/cow')
        `);
        const files = pyodide.globals.get('files').toJs();
        assert.ok(files.includes('dir1'), 'dir1 should be there');
        assert.ok(files.includes('upper_file.txt'), 'upper_file.txt should be there');
        assert.ok(!files.includes('file.txt'), 'file.txt should be whiteout-ed / removed');
    });

    test('Python os.rename from lower to upper (moving)', async () => {
        await pyodide.runPythonAsync(`
            import os
            os.rename('/cow/dir1/lower_file2.txt', '/cow/moved_file.txt')
        `);

        const result = await pyodide.runPythonAsync(`
            f = open('/cow/moved_file.txt', 'r')
            c = f.read()
            f.close()
            c
        `);
        assert.strictEqual(result, 'lower file 2 content');

        const root = pyodide.FS.lookupPath('/cow').node;
        const dirty = getDirtyNodes(root);

        assert.ok(dirty.deleted.includes('/dir1/lower_file2.txt'), 'lower_file2.txt should be marked as deleted / whiteout');
        assert.ok(dirty.modified.includes('/moved_file.txt') || dirty.added.includes('/moved_file.txt'), 'moved_file.txt is new');
    });
});
