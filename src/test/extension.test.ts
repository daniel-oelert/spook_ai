import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';
import { loadPyodide } from 'pyodide';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('Pyodide test', async () => {
		const py = await loadPyodide();

		const result = await py.runPythonAsync(`
			import sys
			a = "test"
			f"Hello from Python {sys.version}"
		`);
		assert.ok(typeof result === 'string' && result.startsWith('Hello from Python'));

		const result2 = await py.runPythonAsync(`
			f"Hello from Python {a}"
			from pathlib import Path
			list(Path.cwd().iterdir())
		`);
		assert.ok(result2 !== undefined);
	});
});
