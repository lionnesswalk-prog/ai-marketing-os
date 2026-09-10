import { run } from "@openai/agents";
import { orchestratorAgent } from "./marketingAgents";

async function main() {
  const result = await run(
    orchestratorAgent,
    "We have a ₹100,000 monthly budget. Create a sales-focused campaign plan and identify what data you need before launch."
  );
  console.log(result.finalOutput);
}

main().catch(console.error);
