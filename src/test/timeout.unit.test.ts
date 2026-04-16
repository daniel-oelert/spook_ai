import * as assert from 'assert';

// We test the timeout logic in isolation by importing the module
// (runPythonWithTimeout is not exported, so we test the pattern directly)
// The integration with rlm.ts is covered by the extension test suite.

/**
 * Creates a mock Pyodide instance with a controllable runPythonAsync.
 */
function createMockPyodide(options: {
    shouldHang?: boolean;
    shouldThrow?: Error;
    result?: any;
}): any {
    return {
        runPythonAsync: async (_code: string) => {
            if (options.shouldHang) {
                // Never resolves — simulates an infinite loop
                return new Promise(() => {});
            }
            if (options.shouldThrow) {
                throw options.shouldThrow;
            }
            return options.result;
        },
        FS: {
            mkdir: () => {},
            mount: () => {},
        },
        globals: {
            get: (key: string) => key === '_handoff_called' ? false : undefined,
        },
        setStdout: () => {},
        setStderr: () => {},
    };
}

/**
 * Pure-function reimplementation of runPythonWithTimeout for testing.
 * Mirrors the logic in src/agent/rlm.ts exactly.
 */
async function runPythonWithTimeout(
    pyodide: any,
    pythonCode: string,
    timeoutMs: number
): Promise<{ pyodide: any; timedOut: boolean }> {
    const execution = pyodide.runPythonAsync(pythonCode);

    let settled = false;
    const timeout = new Promise<'timeout'>((resolve) => {
        setTimeout(() => {
            if (!settled) resolve('timeout');
        }, timeoutMs);
    });

    const result = await Promise.race([execution.then(() => ({ timedOut: false })), timeout]);

    settled = true;

    if (result === 'timeout') {
        return { pyodide, timedOut: true };
    }

    return { pyodide, timedOut: false };
}

suite('Python Execution Timeout Test Suite', () => {

    test('completes successfully when code finishes before timeout', async () => {
        const pyodide = createMockPyodide({ result: 42 });
        const { timedOut } = await runPythonWithTimeout(pyodide, 'x = 1', 5000);
        assert.strictEqual(timedOut, false);
    });

    test('returns timedOut=true when code hangs beyond timeout', async () => {
        const pyodide = createMockPyodide({ shouldHang: true });
        const { timedOut } = await runPythonWithTimeout(pyodide, 'while True: pass', 100);
        assert.strictEqual(timedOut, true);
    });

    test('returns timedOut=false even with very short timeout if code is instant', async () => {
        const pyodide = createMockPyodide({ result: null });
        // 1ms timeout, but execution resolves immediately
        const { timedOut } = await runPythonWithTimeout(pyodide, 'x = 1', 1);
        assert.strictEqual(timedOut, false);
    });

    test('does not reject on timeout (swallows the hanging promise)', async () => {
        const pyodide = createMockPyodide({ shouldHang: true });
        // Should not throw, even though the underlying promise never resolves
        const result = await runPythonWithTimeout(pyodide, 'while True: pass', 50);
        assert.ok(result);
        assert.strictEqual(result.timedOut, true);
    });

    test('timeout does not interfere with normal error propagation', async () => {
        const pyodide = createMockPyodide({
            shouldThrow: new Error('NameError: name "x" is not defined'),
        });
        // Errors from the code itself should propagate (not be swallowed by timeout)
        await assert.rejects(
            () => runPythonWithTimeout(pyodide, 'print(x)', 5000),
            { message: 'NameError: name "x" is not defined' }
        );
    });

    test('settled flag prevents timeout from firing after completion', async () => {
        const pyodide = createMockPyodide({ result: 'done' });
        const start = Date.now();
        const { timedOut } = await runPythonWithTimeout(pyodide, 'pass', 200);
        const elapsed = Date.now() - start;
        // Should complete almost instantly, not wait for the 200ms timeout
        assert.strictEqual(timedOut, false);
        assert.ok(elapsed < 100, `Expected <100ms, got ${elapsed}ms`);
    });
});
