import 'dotenv/config';
import { runAutonomousDevWorkflow } from '../src/services/ai/agent-workflow';

const FEATURE = process.argv[2];

if (!FEATURE) {
    console.error('Usage: npx ts-node scripts/run-agent.ts "<feature description>"');
    console.error('');
    console.error('Examples:');
    console.error('  npx ts-node scripts/run-agent.ts "Add airdrop claim validation endpoint"');
    console.error('  npx ts-node scripts/run-agent.ts "Create Telegram notification service"');
    process.exit(1);
}

async function main() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  OnlyAlpha — Autonomous Dev Agent');
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    console.log('Feature:', FEATURE);
    console.log('');
    console.log('[1/3] Planner (GLM-5-Turbo) — analyzing feature...');
    console.log('[2/3] Coder (Qwen Coder)   — generating code...');
    console.log('[3/3] QA Hunter (GLM-5-Turbo) — auditing code...');
    console.log('');
    console.log('⏳ Running workflow... (this may take 1-3 minutes)');
    console.log('─'.repeat(55));

    const startTime = Date.now();

    const result = await runAutonomousDevWorkflow(FEATURE);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('');
    console.log('═'.repeat(55));
    console.log('  RESULT:', result.finalVerdict);
    console.log('  Iterations:', result.iterationsUsed, '/ 3');
    console.log('  Time:', elapsed, 'seconds');
    console.log('═'.repeat(55));
    console.log('');

    console.log('📋 PLAN:');
    console.log('─'.repeat(40));
    console.log(result.plan);
    console.log('');

    if (result.qaResult.status === 'FAILED') {
        console.log('⚠️  QA FEEDBACK:');
        console.log('─'.repeat(40));
        console.log(result.qaResult.feedback ?? 'No feedback');
        console.log('');
    }

    console.log('💻 GENERATED CODE:');
    console.log('─'.repeat(40));
    console.log(result.generatedCode);
    console.log('');
}

main().catch((error: unknown) => {
    console.error('Workflow failed:', (error as Error).message);
    process.exit(1);
});
