import { ApiClient } from '@vscode/sync-api-client';
import { URI } from 'vscode-uri';

// Define the shape of our internal nodes for Type Safety
export interface CoWNode {
    isLower: boolean;
    contents?: Uint8Array | Record<string, CoWNode>;
    whiteouts?: Set<string>;
    parent: CoWNode;
    name: string;
    path: string;
    mode: number;
    size?: number;
    timestamp?: number;
    id?: number;
    isAdded?: boolean;
    [key: string]: any;
}

// Emscripten FS constants
const S_IFDIR = 0o40000;
const S_IFREG = 0o100000;

export function createCoWBackend(FS: any, apiClient: ApiClient, excludePatterns: RegExp[]) {
    const ERRORS = FS.genericErrors || { ENOENT: 44, EPERM: 1, EACCES: 2 };

    const copyUp = (node: CoWNode) => {
        if (node.isLower) {
            const bytes = apiClient.vscode.workspace.fileSystem.readFile(URI.file(node.path));
            node.contents = new Uint8Array(bytes);
            node.isLower = false;
        }
    };

    const backend = {
        mount(mount: any) {
            const root = this.node_ops.createNode(null, '/', S_IFDIR | 0o777, 0);
            root.node_ops = this.node_ops;
            root.stream_ops = this.stream_ops;
            root.mount = mount;
            return root;
        },
        node_ops: {
            lookup(parent: CoWNode, name: string) {
                const fullPath = parent.path === '/' ? `/${name}` : `${parent.path}/${name}`;

                // 1. Exclusion/Hiding Filter
                if (excludePatterns.some(re => re.test(fullPath))) {
                    throw new FS.ErrnoError(ERRORS.ENOENT);
                }

                // 2. Check Upper Cache
                if (parent.contents && (parent.contents as any)[name]) {
                    return (parent.contents as any)[name];
                }

                // 3. Check for Whiteouts
                if (parent.whiteouts && parent.whiteouts.has(name)) {
                    throw new FS.ErrnoError(ERRORS.ENOENT);
                }

                // 4. Check Lower via Sync API
                try {
                    const stat = apiClient.vscode.workspace.fileSystem.stat(URI.file(fullPath));
                    const statMode = (stat as any).mode || (stat.type === 1 ? S_IFREG | 0o666 : S_IFDIR | 0o777);
                    return this.createNode(parent, name, statMode, 0, stat);
                } catch (e) {
                    console.log("STAT CATCH:", e);
                    throw new FS.ErrnoError(ERRORS.ENOENT);
                }
            },

            createNode(parent: any, name: string, mode: number, dev: any, lowerStat?: any) {
                const node = FS.createNode(parent, name, mode, dev);

                // Emscripten doesn't automatically attach ops for our custom filesystem
                // so we must do it ourselves or nodes won't have getattr/lookup!
                node.node_ops = this;
                node.stream_ops = backend.stream_ops;

                node.path = parent && parent.path ? (parent.path === '/' ? `/${name}` : `${parent.path}/${name}`) : name;
                node.timestamp = Date.now();
                if (lowerStat) {
                    node.isLower = true;
                    node.size = lowerStat.size;
                } else {
                    node.isLower = false;
                    node.isAdded = true;
                    node.size = 0;
                    if (FS.isDir(mode)) {
                        node.contents = {};
                        node.whiteouts = new Set();
                    }
                }

                // Add node to parent contents if parent exists and is not lower
                if (parent && !parent.isLower) {
                    if (!parent.contents) { parent.contents = {}; }
                    (parent.contents as any)[name] = node;
                }

                return node;
            },

            getattr(node: CoWNode) {
                return {
                    dev: 1,
                    ino: node.id || 0,
                    mode: node.mode,
                    nlink: 1,
                    uid: 0,
                    gid: 0,
                    rdev: node.rdev || 0,
                    size: node.isLower ? (node.size || 0) : (node.contents instanceof Uint8Array ? node.contents.length : 4096),
                    atime: new Date(node.timestamp || Date.now()),
                    mtime: new Date(node.timestamp || Date.now()),
                    ctime: new Date(node.timestamp || Date.now()),
                    blksize: 4096,
                    blocks: Math.ceil((node.size || 0) / 4096)
                };
            },

            setattr(node: CoWNode, attr: any) {
                if (node.isLower) {
                    copyUp(node);
                }
                if (attr.mode !== undefined) {
                    node.mode = attr.mode;
                }
                if (attr.timestamp !== undefined) {
                    node.timestamp = attr.timestamp;
                }
                if (attr.size !== undefined) {
                    if (node.contents instanceof Uint8Array) {
                        const newContents = new Uint8Array(attr.size);
                        newContents.set(node.contents.subarray(0, Math.min(attr.size, node.contents.length)));
                        node.contents = newContents;
                        node.size = attr.size;
                    }
                }
            },

            mknod(parent: CoWNode, name: string, mode: number, dev: any) {
                const fullPath = parent.path === '/' ? `/${name}` : `${parent.path}/${name}`;
                if (excludePatterns.some(re => re.test(fullPath))) {
                    throw new FS.ErrnoError(ERRORS.ENOENT);
                }

                // Always create in upper layer
                if (parent.isLower) {
                    parent.isLower = false; // Simplified copy-up for directories
                    parent.contents = {};
                    parent.whiteouts = new Set();
                }

                // If it was whiteout out, remove whiteout
                if (parent.whiteouts?.has(name)) {
                    parent.whiteouts.delete(name);
                }

                return this.createNode(parent, name, mode, dev);
            },

            rename(old_node: CoWNode, new_dir: CoWNode, new_name: string) {
                const old_dir = old_node.parent;
                const old_name = old_node.name;

                // Copy-up if node is lower
                if (old_node.isLower) {
                    copyUp(old_node);
                }

                // Copy-up old_dir
                if (old_dir.isLower) {
                    old_dir.isLower = false;
                    if (!old_dir.contents) { old_dir.contents = {}; }
                }

                // Leave whiteout in old_dir
                if (!old_dir.whiteouts) { old_dir.whiteouts = new Set(); }
                old_dir.whiteouts.add(old_name);

                if (old_dir.contents) {
                    delete (old_dir.contents as any)[old_name];
                }

                // Target logic
                if (new_dir.isLower) {
                    new_dir.isLower = false;
                    if (!new_dir.contents) { new_dir.contents = {}; }
                }

                // Remove whiteout in new_dir if exists
                if (new_dir.whiteouts?.has(new_name)) {
                    new_dir.whiteouts.delete(new_name);
                }

                old_node.name = new_name;
                old_node.parent = new_dir;
                old_node.path = new_dir.path === '/' ? `/${new_name}` : `${new_dir.path}/${new_name}`;

                if (!new_dir.contents) { new_dir.contents = {}; }
                (new_dir.contents as any)[new_name] = old_node;
            },

            unlink(parent: CoWNode, name: string) {
                const node = this.lookup(parent, name); // will throw ENOENT if not exists

                if (parent.isLower) {
                    parent.isLower = false;
                    if (!parent.contents) { parent.contents = {}; }
                }

                if (!parent.whiteouts) { parent.whiteouts = new Set(); }
                parent.whiteouts.add(name);

                if (parent.contents) {
                    delete (parent.contents as any)[name];
                }
            },

            rmdir(parent: CoWNode, name: string) {
                this.unlink(parent, name);
            },

            readdir(node: CoWNode) {
                const entries = new Set<string>(['.', '..']);

                // Lower layer entries
                try {
                    const lowerEntries = apiClient.vscode.workspace.fileSystem.readDirectory(URI.file(node.path));
                    for (const [name] of lowerEntries) {
                        entries.add(name);
                    }
                } catch {
                    // Ignore lower layer errors
                }

                // Upper layer entries
                if (node.contents && typeof node.contents === 'object' && !(node.contents instanceof Uint8Array)) {
                    for (const name of Object.keys(node.contents)) {
                        entries.add(name);
                    }
                }

                const result: string[] = [];
                for (const name of entries) {
                    const fullPath = node.path === '/' ? `/${name}` : `${node.path}/${name}`;

                    if (excludePatterns.some(re => re.test(fullPath))) { continue; }
                    if (node.whiteouts?.has(name)) { continue; }

                    result.push(name);
                }
                return result;
            }
        },
        stream_ops: {
            open(stream: any) {
                const node = stream.node as CoWNode;
                const O_RDWR = 2;
                const O_WRONLY = 1;
                const O_CREAT = 64;
                const O_APPEND = 1024;
                const O_TRUNC = 512;

                const isWrite = (stream.flags & O_CREAT) || (stream.flags & O_RDWR) || (stream.flags & O_WRONLY) || (stream.flags & O_APPEND) || (stream.flags & O_TRUNC);

                if (isWrite && node.isLower) {
                    copyUp(node);
                }

                if ((stream.flags & O_TRUNC) && !node.isLower) {
                    node.contents = new Uint8Array(0);
                    node.size = 0;
                }
            },
            read(stream: any, buffer: Uint8Array, offset: number, length: number, pos: number) {
                const node = stream.node as CoWNode;
                let data: Uint8Array;

                if (node.isLower) {
                    data = new Uint8Array(apiClient.vscode.workspace.fileSystem.readFile(URI.file(node.path)));
                } else {
                    data = node.contents as Uint8Array;
                    if (!data) { data = new Uint8Array(0); }
                }

                const available = data.length - pos;
                if (available <= 0) { return 0; }
                const toRead = Math.min(available, length);
                buffer.set(data.subarray(pos, pos + toRead), offset);
                return toRead;
            },
            write(stream: any, buffer: Uint8Array, offset: number, length: number, position: number) {
                const node = stream.node as CoWNode;
                if (!node.contents) { node.contents = new Uint8Array(0); }
                const contents = node.contents as Uint8Array;

                const newSize = Math.max(contents.length, position + length);
                const newData = new Uint8Array(newSize);
                newData.set(contents);
                newData.set(buffer.subarray(offset, offset + length), position);

                node.contents = newData;
                node.size = newSize;
                node.timestamp = Date.now();
                return length;
            },
            llseek(stream: any, offset: number, whence: number) {
                let position = offset;
                if (whence === 1) { // SEEK_CUR
                    position += stream.position;
                } else if (whence === 2) { // SEEK_END
                    const node = stream.node as CoWNode;
                    const size = node.isLower ? (node.size || 0) : (node.contents instanceof Uint8Array ? node.contents.length : 0);
                    position += size;
                }
                return position;
            }
        }
    };
    return backend;
}

export function getDirtyNodes(rootNode: CoWNode): { added: string[], modified: string[], deleted: string[] } {
    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];

    function traverse(node: CoWNode) {
        if (!node) { return; }

        if (node.whiteouts) {
            for (const w of node.whiteouts) {
                const wPath = node.path === '/' ? `/${w}` : `${node.path}/${w}`;
                deleted.push(wPath);
            }
        }

        if (node.contents && typeof node.contents === 'object' && !(node.contents instanceof Uint8Array)) {
            for (const childName in node.contents) {
                const child = (node.contents as Record<string, CoWNode>)[childName];

                // If it is an active node not in the lower layer originally
                if (!child.isLower) {
                    if (child.isAdded) {
                        added.push(child.path);
                    } else if (child.contents instanceof Uint8Array) {
                        modified.push(child.path);
                    }
                }

                traverse(child);
            }
        }
    }
    traverse(rootNode);
    return { added, modified, deleted };
}
