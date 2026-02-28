import { ApiClient } from '@vscode/sync-api-client';
import { URI } from 'vscode-uri';

// Define the shape of our internal nodes for Type Safety
interface CoWNode {
    isLower: boolean;
    contents?: Uint8Array;
    whiteouts?: Set<string>;
    parent: CoWNode;
    name: string;
    [key: string]: any;
}

export function createCoWBackend(FS: any, apiClient: ApiClient, excludePatterns: RegExp[]) {
    const ERRORS = FS.genericErrors;

    return {
        mount(mount: any) {
            return this.node_ops.createNode(mount, '/', 0o40000 | 0o777, 0);
        },
        node_ops: {
            lookup(parent: CoWNode, name: string) {
                const fullPath = `${parent.path}/${name}`;

                // 1. Exclusion/Hiding Filter
                if (excludePatterns.some(re => re.test(fullPath))) {
                    throw new FS.ErrnoError(ERRORS.ENOENT);
                }

                // 2. Check Upper (MEMFS) Cache
                if (parent.contents && (parent.contents as any)[name]) {
                    return (parent.contents as any)[name];
                }

                // 3. Check for Whiteouts
                if (parent.whiteouts && parent.whiteouts.has(name)) {
                    throw new FS.ErrnoError(ERRORS.ENOENT);
                }

                // 4. Check Lower (VS Code) via Sync API
                try {
                    const stat = apiClient.vscode.workspace.fileSystem.stat(URI.file(fullPath));
                    const statMode = (stat as any).mode || (stat.type === 1 ? 0o100000 | 0o666 : 0o40000 | 0o777);
                    return this.createNode(parent, name, statMode, 0, stat);
                } catch {
                    throw new FS.ErrnoError(ERRORS.ENOENT);
                }
            },

            createNode(parent: any, name: string, mode: number, dev: any, lowerStat?: any) {
                const node = FS.createNode(parent, name, mode, dev);
                node.path = parent ? `${parent.path}/${name}` : name;
                if (lowerStat) {
                    node.isLower = true;
                    node.size = lowerStat.size;
                } else {
                    node.isLower = false;
                }
                return node;
            }
        },
        stream_ops: {
            open(stream: any) {
                const node = stream.node as CoWNode;
                const isWrite = (stream.flags & 64) || (stream.flags & 2); // O_CREAT or O_RDWR

                if (isWrite && node.isLower) {
                    // PERFORM COPY-UP: Fetch from VS Code, move to MEMFS
                    const bytes = apiClient.vscode.workspace.fileSystem.readFile(URI.file(node.path));
                    node.contents = new Uint8Array(bytes); // Native global Uint8Array
                    node.isLower = false;
                }
            },
            read(stream: any, buffer: Uint8Array, offset: number, length: number, pos: number) {
                const node = stream.node as CoWNode;
                let data: Uint8Array;

                if (node.isLower) {
                    data = new Uint8Array(apiClient.vscode.workspace.fileSystem.readFile(URI.file(node.path)));
                } else {
                    data = node.contents!;
                }

                const available = data.length - pos;
                if (available <= 0) return 0;
                const toRead = Math.min(available, length);
                buffer.set(data.subarray(pos, pos + toRead), offset);
                return toRead;
            }
            // write and llseek would follow standard MEMFS patterns...
        }
    };
}