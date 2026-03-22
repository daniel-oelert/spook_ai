import * as assert from 'assert';
import * as vscode from 'vscode';
import { SessionStore } from '../session/sessionStore.js';
import { SessionData } from '../../shared/types.js';

suite('SessionStore Test Suite', () => {
    let sessionStore: SessionStore;
    let testWorkspaceRoot: vscode.Uri;

    suiteSetup(async () => {
        // Find or create a valid workspace root for testing
        testWorkspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri || vscode.Uri.file(__dirname);
        sessionStore = new SessionStore(testWorkspaceRoot);
        await sessionStore.initialize();
    });

    teardown(async () => {
        // Clean up all sessions after each test
        const sessions = await sessionStore.getSessions();
        for (const session of sessions) {
            await sessionStore.deleteSession(session.id);
        }
    });

    test('Should create and retrieve a session', async () => {
        const sessionId = 'test_session_1';
        const sessionData: SessionData = {
            name: 'Test Session',
            short_name: 'test_session',
            description: 'A test session',
            created_at: new Date().toISOString(),
            messages: [
                { role: 'user', content: 'Hello' }
            ]
        };

        await sessionStore.saveSession(sessionId, sessionData);

        const retrieved = await sessionStore.getSession(sessionId);
        assert.ok(retrieved !== null, 'Session should be retrieved');
        assert.strictEqual(retrieved!.name, 'Test Session');
        assert.strictEqual(retrieved!.messages.length, 1);
        assert.strictEqual(retrieved!.messages[0].content, 'Hello');
    });

    test('Should list created sessions', async () => {
        await sessionStore.saveSession('session_a', {
            name: 'Session A', short_name: 'a', description: '', created_at: '', messages: []
        });
        await sessionStore.saveSession('session_b', {
            name: 'Session B', short_name: 'b', description: '', created_at: '', messages: []
        });

        const sessions = await sessionStore.getSessions();
        assert.ok(sessions.length >= 2, 'Should return at least our 2 sessions');

        const ids = sessions.map(s => s.id);
        assert.ok(ids.includes('session_a'));
        assert.ok(ids.includes('session_b'));

        const sessionA = sessions.find(s => s.id === 'session_a');
        assert.strictEqual(sessionA!.name, 'Session A');
    });

    test('Should delete a session', async () => {
        const sessionId = 'session_to_delete';
        await sessionStore.saveSession(sessionId, {
            name: 'To Delete', short_name: 'del', description: '', created_at: '', messages: []
        });

        let retrieved = await sessionStore.getSession(sessionId);
        assert.ok(retrieved !== null);

        await sessionStore.deleteSession(sessionId);

        retrieved = await sessionStore.getSession(sessionId);
        assert.ok(retrieved === null, 'Deleted session should return null');
    });
});
