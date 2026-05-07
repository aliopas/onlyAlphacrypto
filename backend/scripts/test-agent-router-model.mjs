#!/usr/bin/env node

async function loadDotenvIfAvailable() {
  try {
    const dotenv = await import("dotenv");
    dotenv.config();
    return true;
  } catch {
    return false;
  }
}

const dotenvLoaded = await loadDotenvIfAvailable();

const API_KEY =
  process.env.AGENTROUTER_API_KEY ||
  process.env.AGENT_ROUTER_TOKEN ||
  "";

const BASE_URL =
  process.env.AGENTROUTER_BASE_URL || "https://agentrouter.org/v1";

const ANTHROPIC_BASE_URL =
  process.env.ANTHROPIC_BASE_URL || "https://agentrouter.org";

function diagnoseApiKey(key) {
  const length = key.length;
  const startsWithSk = key.startsWith("sk-");
  const firstCharCode = key.charCodeAt(0);
  const hasNonAscii = [...key].some((ch) => ch.charCodeAt(0) > 127);
  const containsStar = key.includes("*");

  console.log("API Key Diagnostics:");
  console.log(`  Length:          ${length}`);
  console.log(`  Starts with sk-: ${startsWithSk}`);
  console.log(`  First char code: ${firstCharCode}`);
  console.log(`  Has non-ASCII:   ${hasNonAscii}`);
  console.log(`  Contains "*":    ${containsStar}`);
  console.log("");

  if (hasNonAscii) {
    console.error("AGENTROUTER_API_KEY contains non-ASCII characters.");
    console.error(
      "This usually means a placeholder or invalid copied value is being used."
    );
    process.exit(1);
  }

  if (!startsWithSk) {
    console.warn(
      'WARNING: API key does not start with "sk-". This may indicate an unexpected key format.'
    );
    console.warn("");
  }
}

diagnoseApiKey(API_KEY);

if (!API_KEY) {
  console.error("Missing AGENTROUTER_API_KEY (or AGENT_ROUTER_TOKEN).");
  console.error("");
  console.error("PowerShell usage:");
  console.error('$env:AGENTROUTER_API_KEY="your_key_here"');
  console.error("node scripts/test-agent-router-model.mjs");
  console.error("");
  console.error("Or add to backend/.env:");
  console.error("AGENTROUTER_API_KEY=your_key_here");
  console.error("AGENTROUTER_BASE_URL=https://agentrouter.org/v1");
  console.error("AGENT_ROUTER_TOKEN=your_key_here   (fallback)");
  console.error("ANTHROPIC_BASE_URL=https://agentrouter.org  (optional)");
  console.error("");
  console.error(`dotenv loaded: ${dotenvLoaded}`);
  process.exit(1);
}

const IDE_HEADERS = {
  "User-Agent": "Codex/0.1.0",
  "X-Title": "OnlyAlpha AgentRouter Model Test",
  "HTTP-Referer": "https://github.com",
};

const candidateModels = [
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "glm-4.5",
  "glm-4.6",
  "deepseek-v3.1",
  "deepseek-chat",
  "deepseek-reasoner",
  "gemini-2.5-flash",
  "google/gemini-2.5-flash",
  "gemini-2.5-pro",
  "google/gemini-2.5-pro",
  "claude-sonnet-4-5-20250929",
  "claude-sonnet-4-5-20250514",
  "claude-haiku-4-5-20251001",
  "claude-3-5-haiku-20241022",
  "claude-haiku-4-5",
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-haiku-4-5",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safePreview(value, maxLength = 500) {
  if (typeof value === "string") {
    return value.slice(0, maxLength);
  }

  try {
    return JSON.stringify(value).slice(0, maxLength);
  } catch {
    return String(value).slice(0, maxLength);
  }
}

function buildOpenAIHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
    ...IDE_HEADERS,
    ...extra,
  };
}

async function getModelsFromEndpoint() {
  try {
    const response = await fetch(`${BASE_URL}/models`, {
      method: "GET",
      headers: buildOpenAIHeaders(),
    });

    const text = await response.text();

    if (!response.ok) {
      console.warn(`GET /models failed with HTTP ${response.status}`);
      console.warn(safePreview(text));
      return [];
    }

    const json = JSON.parse(text);

    if (!Array.isArray(json.data)) {
      console.warn("GET /models returned unexpected shape.");
      console.warn(safePreview(json));
      return [];
    }

    return json.data
      .map((item) => item && item.id)
      .filter((id) => typeof id === "string" && id.length > 0);
  } catch (error) {
    console.warn(
      "GET /models error:",
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}

async function testModel(model) {
  const startedAt = Date.now();

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: buildOpenAIHeaders(),
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a strict JSON responder. Return valid compact JSON only.",
          },
          {
            role: "user",
            content: `Return exactly this JSON shape: {"ok":true,"model":"${model}","useCase":"test"}`,
          },
        ],
        temperature: 0,
        max_tokens: 80,
      }),
    });

    const latencyMs = Date.now() - startedAt;
    const text = await response.text();

    if (!response.ok) {
      return {
        model,
        ok: false,
        status: response.status,
        latencyMs,
        error: safePreview(text, 500),
      };
    }

    let sample = text;

    try {
      const json = JSON.parse(text);
      sample = json.choices?.[0]?.message?.content || text;
    } catch {
      sample = text;
    }

    return {
      model,
      ok: true,
      status: response.status,
      latencyMs,
      sample: safePreview(sample, 500),
    };
  } catch (error) {
    return {
      model,
      ok: false,
      status: "NETWORK_ERROR",
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function smokeGetModels(label, headers) {
  process.stdout.write(`  ${label} ... `);
  try {
    const response = await fetch(`${BASE_URL}/models`, {
      method: "GET",
      headers,
    });
    const text = await response.text();
    console.log(`${response.status} ${safePreview(text, 200)}`);
    return { status: response.status, body: text };
  } catch (error) {
    console.log(
      `ERROR ${error instanceof Error ? error.message : String(error)}`
    );
    return { status: "NETWORK_ERROR", body: "" };
  }
}

async function smokePostChatCompletions(label, headers) {
  process.stdout.write(`  ${label} ... `);
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gpt-5",
        messages: [
          {
            role: "user",
            content: "Return exactly: OK",
          },
        ],
        temperature: 0,
        max_tokens: 10,
      }),
    });
    const text = await response.text();
    console.log(`${response.status} ${safePreview(text, 200)}`);
    return { status: response.status, body: text };
  } catch (error) {
    console.log(
      `ERROR ${error instanceof Error ? error.message : String(error)}`
    );
    return { status: "NETWORK_ERROR", body: "" };
  }
}

async function smokeAnthropicMessages() {
  const Anthropic_HEADERS = {
    "x-api-key": API_KEY,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
    "anthropic-beta": "claude-code-20250219",
  };

  const payload = {
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 80,
    messages: [
      {
        role: "user",
        content: "Return exactly: OK",
      },
    ],
  };

  const endpoints = [
    `${ANTHROPIC_BASE_URL}/v1/messages`,
    `${ANTHROPIC_BASE_URL}/messages`,
  ];

  for (const endpoint of endpoints) {
    const shortPath = endpoint.replace(ANTHROPIC_BASE_URL, "");
    process.stdout.write(`  Anthropic ${shortPath} ... `);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: Anthropic_HEADERS,
        body: JSON.stringify(payload),
      });
      const text = await response.text();
      console.log(`${response.status} ${safePreview(text, 200)}`);

      if (response.status !== 404) {
        return { status: response.status, body: text };
      }
    } catch (error) {
      console.log(
        `ERROR ${error instanceof Error ? error.message : String(error)}`
      );
      return { status: "NETWORK_ERROR", body: "" };
    }
  }

  return { status: "ALL_404", body: "" };
}

function pickFirstWorking(workingModels, preferences) {
  for (const pref of preferences) {
    if (workingModels.includes(pref)) {
      return pref;
    }
  }

  return workingModels[0] || "";
}

async function main() {
  console.log("AgentRouter model test");
  console.log("======================");
  console.log(`Base URL:     ${BASE_URL}`);
  console.log(`Anthropic URL: ${ANTHROPIC_BASE_URL}`);
  console.log(`Key source:   ${process.env.AGENTROUTER_API_KEY ? "AGENTROUTER_API_KEY" : "AGENT_ROUTER_TOKEN"}`);
  console.log(`dotenv loaded: ${dotenvLoaded}`);
  console.log("");

  console.log("==============================");
  console.log("AUTH SMOKE TESTS");
  console.log("==============================");
  console.log("");

  await smokeGetModels("A) GET /models (normal headers)", {
    Authorization: `Bearer ${API_KEY}`,
  });

  await smokeGetModels("B) GET /models (IDE-like headers)", buildOpenAIHeaders());

  await smokePostChatCompletions(
    "C) POST /chat/completions gpt-5 (IDE-like headers)",
    buildOpenAIHeaders()
  );

  console.log("");

  console.log("==============================");
  console.log("ANTHROPIC-COMPATIBLE SMOKE TEST");
  console.log("==============================");
  console.log("");

  await smokeAnthropicMessages();

  console.log("");

  const discoveredModels = await getModelsFromEndpoint();

  if (discoveredModels.length > 0) {
    console.log(`Discovered ${discoveredModels.length} models from /models:`);
    for (const model of discoveredModels) {
      console.log(`- ${model}`);
    }
  } else {
    console.log("No models discovered from /models. Testing candidate list only.");
  }

  const modelsToTest = Array.from(
    new Set([...discoveredModels, ...candidateModels])
  );

  console.log("");
  console.log(`Testing ${modelsToTest.length} models...`);
  console.log("");

  const results = [];

  for (const model of modelsToTest) {
    process.stdout.write(`Testing ${model} ... `);

    const result = await testModel(model);
    results.push(result);

    if (result.ok) {
      console.log(`OK ${result.latencyMs}ms`);
    } else {
      console.log(`FAIL ${result.status}`);
    }

    await sleep(700);
  }

  const working = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const workingModelNames = working.map((r) => r.model);

  const allOpenAI401 =
    results.length > 0 && results.every((r) => r.status === 401);

  console.log("");
  console.log("==============================");
  console.log("WORKING MODELS");
  console.log("==============================");

  if (working.length === 0) {
    console.log("No working models found.");
  } else {
    for (const r of working) {
      console.log(`${r.model} | ${r.latencyMs}ms | ${r.sample}`);
    }
  }

  console.log("");
  console.log("==============================");
  console.log("FAILED MODELS");
  console.log("==============================");

  if (failed.length === 0) {
    console.log("No failed models.");
  } else {
    for (const r of failed) {
      console.log(`${r.model} | ${r.status} | ${r.error || ""}`);
    }
  }

  if (allOpenAI401) {
    console.log("");
    console.log("==============================");
    console.log("AUTH WARNING");
    console.log("==============================");
    console.log("AgentRouter is rejecting this client before model selection.");
    console.log("This is an authentication/client authorization problem, not a model-name problem.");
  }

  const writer = pickFirstWorking(workingModelNames, [
    "gpt-5",
    "glm-4.6",
    "glm-4.5",
    "gemini-2.5-flash",
    "google/gemini-2.5-flash",
  ]);

  const triage = pickFirstWorking(workingModelNames, [
    "gpt-5-nano",
    "gpt-4.1-nano",
    "glm-4.5",
    "deepseek-v3.1",
  ]);

  const minor = pickFirstWorking(workingModelNames, [
    "gpt-5-nano",
    "gpt-4.1-mini",
    "glm-4.5",
    "deepseek-v3.1",
  ]);

  const chat = pickFirstWorking(workingModelNames, [
    "gpt-5",
    "glm-4.6",
    "glm-4.5",
    "deepseek-v3.1",
  ]);

  console.log("");
  console.log("==============================");
  console.log("RECOMMENDED ENV TEMPLATE");
  console.log("==============================");

  if (workingModelNames.length === 0) {
    console.log("WARNING: No working models found. Cannot recommend models.");
    console.log("");
    console.log("AGENTROUTER_TRIAGE_MODEL=");
    console.log("AGENTROUTER_MINOR_MODEL=");
    console.log("AGENTROUTER_WRITER_MODEL=");
    console.log("AGENTROUTER_CHAT_MODEL=");
  } else {
    console.log(`AGENTROUTER_TRIAGE_MODEL=${triage}`);
    console.log(`AGENTROUTER_MINOR_MODEL=${minor}`);
    console.log(`AGENTROUTER_WRITER_MODEL=${writer}`);
    console.log(`AGENTROUTER_CHAT_MODEL=${chat}`);
  }
}

main().catch((error) => {
  console.error("Fatal error:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
