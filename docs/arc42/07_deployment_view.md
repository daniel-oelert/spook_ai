# 7. Deployment View

Spook AI deploys entirely as a standard VS Code extension.

## 7.1 Architecture Constraints for Deployment
- All files must be packaged logically inside `.vsix`.
- Pyodide's `.wasm` and `.js` bundles need to be bundled into the extension artifacts, or dynamically loaded via CDN. Given offline capabilities and stable constraints, bundling is often preferred.

## 7.2 Execution Environment Mapping
- **Extension Host:** Node.js process managed directly by VS Code. Handles VS Code UI APIs, async file actions, process spanning.
- **Web Worker:** Pyodide executes in a separate thread context to avoid locking the Extension Host UI loop.
- **WebViews:** Render the UI (Session Panels) using HTML/CSS & React/Vanilla-JS embedded. WebViews maintain their own encapsulated environment inside VS Code.
