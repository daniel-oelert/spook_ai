import * as assert from 'assert';
import { createCoWBackend, getDirtyNodes, CoWNode } from '../fs.js';

suite('CoW FS Test Suite', () => {
    let mockFS: any;
    let mockApiClient: any;

    setup(() => {
        mockFS = {
            genericErrors: { ENOENT: 2, EPERM: 1 },
            ErrnoError: class extends Error {
                constructor(public errno: number) { super(); }
            },
            createNode: (parent: any, name: string, mode: number, dev: any) => ({
                id: Math.floor(Math.random() * 1000) + 1,
                name,
                mode,
                rdev: dev,
                parent
            }),
            isDir: (mode: number) => (mode & 0o40000) === 0o40000,
            isFile: (mode: number) => (mode & 0o100000) === 0o100000,
        };

        mockApiClient = {
            vscode: {
                workspace: {
                    fileSystem: {
                        stat: (uri: any) => {
                            if (uri.path.endsWith('lower.txt')) {
                                return { type: 1, size: 10, mode: 0o100000 | 0o644 };
                            }
                            if (uri.path.endsWith('lower_dir')) {
                                return { type: 2 };
                            }
                            throw new Error('Not found');
                        },
                        readFile: (uri: any) => {
                            if (uri.path.endsWith('lower.txt')) {
                                return new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
                            }
                            throw new Error('Not found');
                        },
                        readDirectory: (uri: any) => {
                            if (uri.path.endsWith('lower_dir')) {
                                return [['lower_inside.txt', 1]];
                            }
                            return [];
                        }
                    }
                }
            }
        };
    });

    test('mount creates root directory', () => {
        const cow = createCoWBackend(mockFS, mockApiClient, []);
        const root = cow.mount({});
        assert.strictEqual(root.name, '/');
        assert.strictEqual(root.isLower, false);
        assert.deepStrictEqual(root.contents, {});
    });

    test('lookup existing lower file', () => {
        const cow = createCoWBackend(mockFS, mockApiClient, []);
        const root = cow.mount({});
        const node = cow.node_ops.lookup(root, 'lower.txt');
        assert.strictEqual(node.name, 'lower.txt');
        assert.strictEqual(node.isLower, true);
        assert.strictEqual(node.size, 10);
    });

    test('lookup missing file throws ENOENT', () => {
        const cow = createCoWBackend(mockFS, mockApiClient, []);
        const root = cow.mount({});
        assert.throws(() => cow.node_ops.lookup(root, 'missing.txt'), (err: any) => err.errno === 2);
    });

    test('lookup filtered file throws ENOENT', () => {
        const cow = createCoWBackend(mockFS, mockApiClient, [/git/]);
        const root = cow.mount({});
        // Should throw ENOENT even if we mock lower
        assert.throws(() => cow.node_ops.lookup(root, '.git'), (err: any) => err.errno === 2);
    });

    test('open for write performs copy-up', () => {
        const cow = createCoWBackend(mockFS, mockApiClient, []);
        const root = cow.mount({});
        const node = cow.node_ops.lookup(root, 'lower.txt');

        cow.stream_ops.open({ node, flags: 2 /* O_RDWR */ });

        assert.strictEqual(node.isLower, false);
        assert.ok(node.contents instanceof Uint8Array);
        assert.strictEqual((node.contents as Uint8Array).length, 10);
    });

    test('mknod creates new upper file', () => {
        const cow = createCoWBackend(mockFS, mockApiClient, []);
        const root = cow.mount({});

        const node = cow.node_ops.mknod(root, 'new.txt', 0o100000 | 0o666, 0);

        assert.strictEqual(node.isLower, false);
        assert.strictEqual(node.name, 'new.txt');
        assert.strictEqual((root.contents as any)['new.txt'], node);
    });

    test('rename leaves whiteout and moves file', () => {
        const cow = createCoWBackend(mockFS, mockApiClient, []);
        const root = cow.mount({});

        // Mock a lower dir in root.contents
        const dir1 = cow.node_ops.lookup(root, 'lower_dir');

        const fileNode = cow.node_ops.mknod(dir1, 'new.txt', 0o100000, 0);

        cow.node_ops.rename(fileNode, root, 'moved.txt');

        assert.ok(dir1.whiteouts!.has('new.txt'));
        assert.strictEqual((root.contents as any)['moved.txt'], fileNode);
    });

    test('readdir merges and filters paths', () => {
        const cow = createCoWBackend(mockFS, mockApiClient, [/hidden/]);
        const root = cow.mount({});

        const dir1 = cow.node_ops.lookup(root, 'lower_dir');

        cow.node_ops.mknod(dir1, 'upper.txt', 0o100000, 0);
        dir1.whiteouts = new Set(['lower_inside.txt']); // whiteout lower file

        const entries = cow.node_ops.readdir(dir1);

        assert.ok(entries.includes('.'));
        assert.ok(entries.includes('..'));
        assert.ok(entries.includes('upper.txt'));
        assert.ok(!entries.includes('lower_inside.txt'));
    });

    test('getDirtyNodes correct traversal', () => {
        const cow = createCoWBackend(mockFS, mockApiClient, []);
        const root = cow.mount({});

        const dir1 = cow.node_ops.lookup(root, 'lower_dir');

        // added
        const node = cow.node_ops.mknod(dir1, 'new.txt', 0o100000, 0);
        delete node.id; // ensure ID is undefined to mark as added

        // modified
        const lowerFile = cow.node_ops.lookup(root, 'lower.txt');
        cow.stream_ops.open({ node: lowerFile, flags: 2 }); // copy-up -> modified

        // deleted
        root.whiteouts!.add('deleted.txt');

        const dirty = getDirtyNodes(root);

        assert.deepStrictEqual(dirty.deleted, ['/deleted.txt']);
        assert.deepStrictEqual(dirty.modified, ['/lower.txt']);
        assert.deepStrictEqual(dirty.added, ['/lower_dir/new.txt']);
    });
});
