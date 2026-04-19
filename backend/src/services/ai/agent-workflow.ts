import { StateGraph, Annotation, END, START } from '@langchain/langgraph';
import { z } from 'zod';
import { AIGateway, AIRateLimitError, createGLMGateway, createOpenRouterGateway } from './ai-gateway';
import { env } from '../../config/env';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

const MAX_NODE_RETRIES = 3;
const RETRY_DELAY_MS = 6000;

// ─── Types ─────────────────────────────────────────────────────────────────

interface QAResult {
    status: 'PASSED' | 'FAILED';
    feedback: string | null;
}

const QAResultSchema = z.object({
    status: z.enum(['PASSED', 'FAILED']),
    feedback: z.string().nullable(),
});

interface WorkflowOutput {
    featureRequest: string;
    plan: string;
    generatedCode: string;
    qaResult: QAResult;
    iterationsUsed: number;
    finalVerdict: 'PASSED' | 'MAX_ITERATIONS_REACHED';
}

// ─── State Definition ──────────────────────────────────────────────────────

const AgentState = Annotation.Root({
    featureRequest: Annotation<string>,
    plan: Annotation<string>,
    generatedCode: Annotation<string>,
    qaResult: Annotation<QAResult | null>,
    qaFeedback: Annotation<string>,
    iterationCount: Annotation<number>,
    existingCode: Annotation<string>,
});

type AgentStateType = typeof AgentState.State;

// ─── Gateway Instances ────────────────────────────────────────────────────

let glmGateway: AIGateway | null = null;
let openRouterCoderGateway: AIGateway | null = null;

function getGLMGateway(): AIGateway {
    if (!glmGateway) {
        glmGateway = createGLMGateway({
            apiKey: env.GLM_API_KEY,
            baseURL: env.GLM_BASE_URL,
        });
    }
    return glmGateway;
}

function getOpenRouterCoderGateway(): AIGateway {
    if (!openRouterCoderGateway) {
        openRouterCoderGateway = createOpenRouterGateway({
            apiKey: env.OPENROUTER_API_KEY,
        });
    }
    return openRouterCoderGateway;
}

// ─── Prompts ───────────────────────────────────────────────────────────────

const PLANNER_SYSTEM_PROMPT = `You are an elite Principal AI Architect for the "OnlyAlpha" platform — a Node.js/TypeScript, Express, Drizzle ORM, Postgres codebase.

When given a feature request, you must output ONLY a numbered list of strict, granular coding instructions.

RULES:
1. Each instruction MUST reference specific files by path (e.g., "backend/src/services/user.service.ts").
2. Each instruction MUST specify exactly what to add/modify/remove.
3. Keep instructions atomic — one logical change per numbered item.
4. Assume Clean Architecture: controllers → services → models.
5. Never use the \`any\` type — specify exact TypeScript interfaces.
6. Order instructions by dependency (imports/types first, then logic, then exports).
7. Output ONLY the numbered list. No markdown code blocks. No preamble. No explanations outside the list.`;

const CODER_SYSTEM_PROMPT = `You are an elite Senior TypeScript Developer for the "OnlyAlpha" platform (Node.js, Express, Drizzle ORM, Postgres).

You receive architectural instructions from the Planner and MUST output ONLY valid TypeScript code.

STRICT RULES:
1. Output ONLY raw TypeScript code. No markdown fences. No explanations. No comments outside code.
2. NEVER use the \`any\` type. Use generics, interfaces, or \`unknown\`.
3. Follow the numbered instructions EXACTLY as given — do not skip or merge them.
4. Match the existing codebase style: no semicolons or semicolons as the file uses, consistent indentation.
5. Include all necessary imports at the top of each file block.
6. If modifying existing code, output the COMPLETE file content, not just the diff.
7. Use proper error handling (try/catch for async operations).
8. Use Zod for runtime validation where applicable.

OUTPUT FORMAT:
For each file, start with: // FILE: <file-path>
Then write the complete file content.
Separate files with a blank line.`;

const QA_SYSTEM_PROMPT = `You are a strict QA Code Auditor for the "OnlyAlpha" platform.

You receive:
1. The Planner's original instructions (numbered list).
2. The Coder's generated TypeScript code.
3. Optional QA feedback from a previous iteration.

You MUST audit the code against the instructions and output a STRICT JSON object:

{
  "status": "PASSED" | "FAILED",
  "feedback": "string describing what failed, or null if passed"
}

AUDIT CHECKLIST:
1. ZERO \`any\` types anywhere in the generated code.
2. All numbered instructions from the Planner are implemented.
3. All imports are correct and resolve to existing modules.
4. TypeScript types are strict and specific (no \`any\`, no loose types).
5. Error handling is present for async operations.
6. The code follows Clean Architecture patterns.
7. No dead code, no commented-out code, no placeholders.
8. All file paths referenced in instructions have corresponding code blocks.

If status is FAILED, feedback MUST describe exactly what needs to be fixed.
Output ONLY the JSON object. No preamble. No markdown.`;

// ─── Nodes ─────────────────────────────────────────────────────────────────

async function plannerNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
    const gateway = getGLMGateway();

    const messages = [
        { role: 'system' as const, content: PLANNER_SYSTEM_PROMPT },
        {
            role: 'user' as const,
            content: `Feature Request:\n${state.featureRequest}\n\n${state.existingCode ? `Existing Code Context:\n${state.existingCode}` : ''}`,
        },
    ];

    const plan = await gateway.chatRaw({
        model: env.GLM_PLANNER_MODEL,
        messages,
        temperature: 0.2,
        maxTokens: 4096,
    });

    return { plan };
}

async function coderNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
    const gateway = getOpenRouterCoderGateway();

    let userContent = `PLANNER INSTRUCTIONS:\n${state.plan}`;

    if (state.qaFeedback) {
        userContent += `\n\nQA FEEDBACK (from previous iteration — MUST address these issues):\n${state.qaFeedback}`;
    }

    if (state.generatedCode) {
        userContent += `\n\nYOUR PREVIOUS CODE (revise this based on QA feedback):\n${state.generatedCode}`;
    }

    userContent += `\n\nRULES REMINDER:\n- Output ONLY TypeScript code. No markdown. No explanations.\n- Each file starts with: // FILE: <path>\n- ZERO \`any\` types. Use strict TypeScript.`;

    const messages = [
        { role: 'system' as const, content: CODER_SYSTEM_PROMPT },
        { role: 'user' as const, content: userContent },
    ];

    const generatedCode = await gateway.chatRaw({
        model: env.OPENROUTER_CODER_MODEL,
        messages,
        temperature: 0.1,
        maxTokens: 16384,
    });

    return { generatedCode };
}

async function qaNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
    const gateway = getGLMGateway();

    const messages = [
        { role: 'system' as const, content: QA_SYSTEM_PROMPT },
        {
            role: 'user' as const,
            content: `PLANNER INSTRUCTIONS:\n${state.plan}\n\nGENERATED CODE:\n${state.generatedCode}`,
        },
    ];

    const rawResult = await gateway.chat<QAResult>({
        model: env.GLM_QA_MODEL,
        messages,
        temperature: 0.0,
        responseFormat: { type: 'json_object' },
        maxTokens: 4096,
        maxRetries: 2,
    });

    const parsed = QAResultSchema.safeParse(rawResult);
    const qaResult: QAResult = parsed.success
        ? parsed.data
        : { status: 'FAILED', feedback: `QA output validation failed: ${JSON.stringify(parsed.error.issues)}` };

    return {
        qaResult,
        qaFeedback: qaResult.status === 'FAILED' && qaResult.feedback ? qaResult.feedback : '',
    };
}

// ─── Conditional Edge ──────────────────────────────────────────────────────

function shouldLoop(state: AgentStateType): string {
    if (
        state.qaResult !== null &&
        state.qaResult.status === 'FAILED' &&
        state.iterationCount < 3
    ) {
        return 'coder';
    }
    return END;
}

// ─── File Reader Utility ───────────────────────────────────────────────────

async function readExistingCode(filePath: string): Promise<string> {
    try {
        const absolutePath = resolve(process.cwd(), filePath);
        const content = await readFile(absolutePath, 'utf-8');
        return `// FILE: ${filePath}\n${content}`;
    } catch {
        return `// FILE: ${filePath}\n// (file not found or unreadable)`;
    }
}

// ─── Graph Compilation ─────────────────────────────────────────────────────

const workflow = new StateGraph(AgentState)
    .addNode('planner', plannerNode)
    .addNode('coder', coderNode)
    .addNode('qa', qaNode)
    .addEdge(START, 'planner')
    .addEdge('planner', 'coder')
    .addEdge('coder', 'qa')
    .addConditionalEdges('qa', shouldLoop, {
        coder: 'coder',
        [END]: END,
    });

const compiledGraph = workflow.compile();

// ─── Public API ────────────────────────────────────────────────────────────

export async function runAutonomousDevWorkflow(
    featureDescription: string,
    contextFiles?: string[],
): Promise<WorkflowOutput> {
    let existingCode = '';

    if (contextFiles && contextFiles.length > 0) {
        const fileContents = await Promise.all(contextFiles.map(readExistingCode));
        existingCode = fileContents.join('\n\n');
    }

    const initialState: AgentStateType = {
        featureRequest: featureDescription,
        plan: '',
        generatedCode: '',
        qaResult: null,
        qaFeedback: '',
        iterationCount: 0,
        existingCode,
    };

    const finalState = await compiledGraph.invoke(initialState, {
        configurable: {},
    });

    const result: QAResult = finalState.qaResult ?? { status: 'FAILED', feedback: 'QA node did not produce a result' };
    const iterationsUsed = finalState.iterationCount;

    return {
        featureRequest: finalState.featureRequest,
        plan: finalState.plan,
        generatedCode: finalState.generatedCode,
        qaResult: result,
        iterationsUsed,
        finalVerdict: result.status === 'PASSED' ? 'PASSED' : 'MAX_ITERATIONS_REACHED',
    };
}

export type { QAResult, WorkflowOutput };
