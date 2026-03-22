import * as vscode from 'vscode';
import { loadPyodide } from 'pyodide';
import { LLMProvider, LLMMessage } from '../llm/llmClient.js';
import { createCoWBackend } from '../fs.js';

export interface RLMConfig {
    provider: LLMProvider;
    outputChannel: vscode.OutputChannel;
    apiClient?: any; // the SyncApiClient used by the CoW FS
    postToWebview?: (msg: any) => void;
}

const SYSTEM_PROMPT = `
You are tasked with answering a query with associated context. You can access, transform, and analyze this context interactively in a REPL environment that can recursively query sub-LLMs, which you are strongly encouraged to use as much as possible. You will be queried iteratively until you provide a final answer.

The REPL environment is initialized with:
1. A \`context\` variable that contains extremely important information about your query. You should check the content of the \`context\` variable to understand what you are working with. Make sure you look through it sufficiently as you answer your query.
2. A \`query(prompt, agent=None)\` function that spawns a sub-call with specified agent for deeper thinking subtasks.
3. A \`SHOW_VARS()\` function that returns all variables you have created in the REPL. Use this to check what variables exist before using handoff_var.
4. The ability to use \`print()\` statements to view the output of your REPL code and continue your reasoning.

**Breaking down problems:** You must break problems into more digestible components—whether that means chunking or summarizing a large context, or decomposing a hard task into easier sub-problems and delegating them via \`query\`. Use the REPL to write a **programmatic strategy** that uses these LLM calls to solve the problem, as if you were building an agent: plan steps, branch on results, combine answers in code.

**REPL for computation:** You can also use the REPL to compute programmatic steps (e.g. \`math.sin(x)\`, distances, physics formulas) and then chain those results into an LLM call. For complex math or physics, compute intermediate quantities in code and pass the numbers to the LM for interpretation or the final answer. Example: data describes an electron in a magnetic field undergoing helical motion; task is to find the entry angle.
\`\`\`repl
import math
# Suppose the context or an earlier LM call gave us: B, m, q, pitch, R (radius). Extract or set them.
# Helical motion: v_parallel = pitch * (q*B)/(2*pi*m), v_perp = R * (q*B)/m. Entry angle theta: tan(theta) = v_perp/v_parallel.
v_parallel = pitch * (q * B) / (2 * math.pi * m)
v_perp = R * (q * B) / m
theta_rad = math.atan2(v_perp, v_parallel)
theta_deg = math.degrees(theta_rad)
final_answer = query(f"An electron entered a B field and underwent helical motion. Computed entry angle: {{theta_deg:.2f}} deg. State the answer clearly for the user.")
\`\`\`
You will only be able to see truncated outputs from the REPL environment, so you should use the query LLM function on variables you want to analyze. You will find this function especially useful when you have to analyze the semantics of the context. Use these variables as buffers to build up your final answer.
Make sure to explicitly look through the entire context in REPL before answering your query. Break the context and the problem into digestible pieces: e.g. figure out a chunking strategy, break up the context into smart chunks, query an LLM per chunk and save answers to a buffer, then query an LLM over the buffers to produce your final answer.

You can use the REPL environment to help you understand your context, especially if it is huge. Remember that your sub LLMs are powerful -- they can fit around 200K characters in their context window, so don't be afraid to put a lot of context into them. For example, a viable strategy is to feed 10 documents per sub-LLM query. Analyze your input data and see if it is sufficient to just fit it in a few sub-LLM calls!

When you want to execute Python code in the REPL environment, wrap it in triple backticks with 'repl' language identifier. For example, say we want our recursive model to search for the magic number in the context (assuming the context is a string), and the context is very long, so we want to chunk it:
\`\`\`repl
chunk = context[:10000]
answer = query(f"What is the magic number in the context? Here is the chunk: {{chunk}}")
print(answer)
\`\`\`

As an example, suppose you're trying to answer a question about a book. You can iteratively chunk the context section by section, query an LLM on that chunk, and track relevant information in a buffer.
\`\`\`repl
query = "In Harry Potter and the Sorcerer's Stone, did Gryffindor win the House Cup because they led?"
for i, section in enumerate(context):
    if i == len(context) - 1:
        buffer = query(f"You are on the last section of the book. So far you know that: {{buffers}}. Gather from this last section to answer {{query}}. Here is the section: {{section}}")
        print(f"Based on reading iteratively through the book, the answer is: {{buffer}}")
    else:
        buffer = query(f"You are iteratively looking through a book, and are on section {{i}} of {{len(context)}}. Gather information to help answer {{query}}. Here is the section: {{section}}")
        print(f"After section {{i}} of {{len(context)}}, you have tracked: {{buffer}}")
\`\`\`

As another example, when the context isn't that long (e.g. >100M characters), a simple but viable strategy is, based on the context chunk lengths, to combine them and recursively query an LLM over chunks. For example, if the context is a List[str], we ask the same query over each chunk using \`query\`:
\`\`\`repl
sub_prompt = "A man became famous for his book "The Great Gatsby". How many jobs did he have?"
# Suppose our context is ~1M chars, and we want each sub-LLM query to be ~0.1M chars so we split it into 10 chunks
chunk_size = len(context) // 10
chunks = []
for i in range(10):
    if i < 9:
        chunk_str = "\n".join(context[i*chunk_size:(i+1)*chunk_size])
    else:
        chunk_str = "\n".join(context[i*chunk_size:])
    chunks.append(chunk_str)

# Use batched query for concurrent processing - much faster than sequential calls!
sub_prompts = [f"Try to answer the following query: {{sub_prompt}}. Here are the documents:\n{{chunk}}. Only answer if you are confident in your answer based on the evidence." for chunk in chunks]
answers = [query(i) for i in sub_prompts]
for i, answer in enumerate(answers):
    print(f"I got the answer from chunk {{i}}: {{answer}}")
final_answer = query(f"Aggregating all the answers per chunk, answer the original query about total number of jobs: {{sub_prompt}}\\n\\nAnswers:\\n" + "\\n".join(answers))
\`\`\`

For subtasks that require deeper reasoning (e.g. solving a complex sub-problem), use \`query\` with a more complex agent. The child gets its own REPL to iterate; you can then use the result in parent logic:
\`\`\`repl
# Child RLM solves the sub-problem in its own REPL; we use the result in code
trend = query(f"Analyze this dataset and conclude with one word: up, down, or stable: {{data}}", agent=context.agents["complex_agent"])
if "up" in trend.lower():
    recommendation = "Consider increasing exposure."
elif "down" in trend.lower():
    recommendation = "Consider hedging."
else:
    recommendation = "Hold position."
final_answer = query(f"Given trend={{trend}} and recommendation={{recommendation}}, one-sentence summary for the user.")
\`\`\`

As a final example, implement the solution as a **program**: try one approach via \`query\`; inspect the result and branch. If it suffices, use it. If not, break into one easier subproblem and delegate that only. More branches, one path runs—don't load the model. Example: prove sqrt 2 irrational.
\`\`\`repl
r = query("Prove sqrt 2 is irrational. Give a 1-2 sentence proof, or reply only: USE_LEMMA or USE_CONTRADICTION.")
if "USE_LEMMA" in r.upper():
    final_answer = query("Prove 'n^2 even => n even' then use it to show sqrt 2 irrational. Two sentences.")
\`\`\`

IMPORTANT: When you are done with the iterative process, you MUST provide a final answer inside a \`handoff\` or \`handoff_var\` function when you have completed your task in a repl block. Do not use these tags unless you have completed your task. You have two options:
1. Use handoff("your final answer here") to provide the answer directly
2. Use handoff_var(variable_name) to return a variable you have created in the REPL environment as your final output

WARNING - COMMON MISTAKE: handoff_var retrieves an EXISTING variable. You MUST create and assign the variable in a \`repl\` block FIRST, then call \`handoff_var\` in a SEPARATE step. For example:
- WRONG: Calling \`handoff_var(my_answer)\` without first creating \`my_answer\` in a repl block
- CORRECT: First run \`\`\`repl
my_answer = "the result"
print(my_answer)
\`\`\` then in the NEXT response call \`handoff_var(my_answer)\`

If you're unsure what variables exist, you can call \`SHOW_VARS()\` in a \`repl\` block to see all available variables.

Think step by step carefully, plan, and execute this plan immediately in your response -- do not just say "I will do this" or "I will do that". Output to the REPL environment and recursive LLMs as much as possible. Remember to explicitly answer the original query in your final answer.
\`\`\`
`;
// You are an autonomous AI Agent living inside a fully functional Python environment.
// You are tasked with solving a user's request by writing and executing Python code.
// You can read files, analyze them, and write changes.

// IMPORTANT RULES:
// 1. You may think and explain your process, but you MUST enclose any executable Python code you want to run within a \`\`\`python code block.
// 2. The code block will be executed immediately, and its standard output (stdout) and standard error (stderr) will be returned to you in the next message.
// 3. Use the \`print()\` function frequently to inspect variables, logic, and file contents. If you do not print anything, you will not receive any meaningful output.
// 4. Stop outputting Python blocks once you believe the task is fully complete. If you output a Python block, the system will assume you need to run it and wait for the output.
// `;

export async function runRudimentaryRLMSession(prompt: string, config: RLMConfig) {
    const { provider, outputChannel, apiClient } = config;

    outputChannel.appendLine("===========================================");
    outputChannel.appendLine(`Starting RLM Session`);
    outputChannel.appendLine(`Prompt: ${prompt}`);
    outputChannel.appendLine("===========================================\n");

    if (config.postToWebview) {
        config.postToWebview({ command: 'receiveMessage', role: 'user', content: prompt });
    }

    const messages: LLMMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
            role: 'assistant', content: `
            \`\`\`repl
            print(context)${prompt}
            \`\`\`
            ` },
        {
            role: 'user', content: `[Execution Output]:\n${prompt}`
        }
    ];

    outputChannel.appendLine("[System] Initializing Pyodide Sandbox...");
    const pyodide = await loadPyodide();

    if (apiClient) {
        outputChannel.appendLine("[System] Mounting CoW Filesystem...");

        const config = vscode.workspace.getConfiguration('spook');
        const excludeDirs = config.get<string[]>('excludeDirectories') || [];
        const excludePatterns = excludeDirs.map(dir => new RegExp(`(?:^|/)${dir}(?:/|$)`));

        const cowFS = createCoWBackend(pyodide.FS, apiClient, excludePatterns);
        try {
            pyodide.FS.mkdir('/workspace');
        } catch { }
        pyodide.FS.mount(cowFS as any, {}, '/workspace');
    }

    let isDone = false;
    let turnCount = 0;

    while (!isDone && turnCount < 10) {
        turnCount++;
        outputChannel.appendLine(`\n--- Turn ${turnCount} ---`);
        outputChannel.appendLine("[Agent is thinking...]");

        if (config.postToWebview) {
            config.postToWebview({
                command: 'agentStatus',
                agent: { id: 'rlm', name: 'RLM Agent', status: 'thinking', icon: '🤖' },
                status: 'thinking'
            });
        }

        let fullContent = "";
        let fullReasoning = "";
        let isThinking = false;
        let firstTokenTime: number | null = null;
        let tokensStats = "";

        try {
            for await (const chunk of provider.chatStream(messages)) {
                if (!firstTokenTime) {
                    firstTokenTime = Date.now();
                }
                if (chunk.type === 'reasoning') {
                    if (!isThinking) {
                        isThinking = true;
                        outputChannel.append("\n<think>\n");
                        fullReasoning += "<think>\n";
                    }
                    outputChannel.append(chunk.text);
                    fullReasoning += chunk.text;
                } else if (chunk.type === 'content') {
                    if (isThinking) {
                        isThinking = false;
                        outputChannel.append("\n</think>\n");
                        fullReasoning += "\n</think>\n";
                    }
                    outputChannel.append(chunk.text);
                    fullContent += chunk.text;
                } else if (chunk.type === 'usage') {
                    const elapsedSec = firstTokenTime ? (Date.now() - firstTokenTime) / 1000 : 0;
                    const tps = elapsedSec > 0 ? (chunk.usage.completionTokens / elapsedSec).toFixed(1) : "0.0";
                    tokensStats = `\n[Stats] Context Size: ${chunk.usage.promptTokens} tokens | Tokens Generated: ${chunk.usage.completionTokens} | Speed: ${tps} tok/s`;
                }
            }
            if (isThinking) {
                isThinking = false;
                outputChannel.append("\n</think>\n");
                fullReasoning += "\n</think>\n";
            }
            if (tokensStats) {
                outputChannel.appendLine(tokensStats);
            }
        } catch (e: any) {
            outputChannel.appendLine(`\n[LLM Error]: ${e.message}`);
            break;
        }

        outputChannel.appendLine("\n");
        messages.push({ role: 'assistant', content: fullContent });

        if (config.postToWebview) {
            config.postToWebview({
                command: 'agentStatus',
                agent: { id: 'rlm', name: 'RLM Agent', status: 'active', icon: '🤖' },
                status: 'active'
            });
            let replyContent = fullContent;
            if (fullReasoning) {
                // Prepend reasoning as an expandable section or just text.
                // For now just appending text
                replyContent = `*(Thought process)*\n\n${fullReasoning}\n\n---\n\n${fullContent}`;
            }
            config.postToWebview({ command: 'receiveMessage', role: 'assistant', content: replyContent });
        }

        // Extract Python Block strictly from actual content (ignore what it wrote in <think> tags)
        const pythonMatch = fullContent.match(/```repl\n([\s\S]*?)```/);

        if (pythonMatch && pythonMatch[1].trim()) {
            const pythonCode = pythonMatch[1];
            outputChannel.appendLine("[System] Executing Python Block...");

            // Redirect stdout/stderr
            let stdout = "";
            let stderr = "";
            pyodide.setStdout({ batched: (msg: string) => { stdout += msg + "\\n"; } });
            pyodide.setStderr({ batched: (msg: string) => { stderr += msg + "\\n"; } });

            try {
                await pyodide.runPythonAsync(pythonCode);
                const combinedOutput = `STDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
                outputChannel.appendLine(`[Execution Result]:\n${combinedOutput}`);
                messages.push({ role: 'user', content: `Execution Output:\n${combinedOutput}` });

                if (config.postToWebview) {
                    config.postToWebview({ command: 'receiveMessage', role: 'system', content: `[Execution Result]:\n${combinedOutput}` });
                }
            } catch (err: any) {
                const combinedOutput = `STDOUT:\n${stdout}\nSTDERR:\n${stderr}\nEXCEPTION:\n${err.message}`;
                outputChannel.appendLine(`[Execution Exception]:\n${combinedOutput}`);
                messages.push({ role: 'user', content: `Execution Exception:\n${combinedOutput}` });

                if (config.postToWebview) {
                    config.postToWebview({ command: 'receiveMessage', role: 'system', content: `[Execution Exception]:\n${combinedOutput}` });
                }
            }
        } else {
            // No python block means the LLM believes it is done
            outputChannel.appendLine("[System] No Python code block found. Session Complete.");
            if (config.postToWebview) {
                config.postToWebview({
                    command: 'agentStatus',
                    agent: { id: 'rlm', name: 'RLM Agent', status: 'idle', icon: '🤖' },
                    status: 'idle'
                });
                config.postToWebview({ command: 'receiveMessage', role: 'system', content: `[System] Session Complete.` });
            }
            isDone = true;
        }
    }

    if (turnCount >= 10) {
        outputChannel.appendLine("[System] Session hit maximum turns limit!");
        if (config.postToWebview) {
            config.postToWebview({ command: 'receiveMessage', role: 'system', content: `[System] Session hit maximum turns limit!` });
        }
    }
}
