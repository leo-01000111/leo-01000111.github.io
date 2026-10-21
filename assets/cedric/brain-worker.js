/* Runs WebLLM's engine off the main thread so Cedric's animation doesn't jank.
   Module worker, started by brain.js. Keep the version in sync with brain.js (WEBLLM). */
import { WebWorkerMLCEngineHandler } from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm";

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = msg => handler.onmessage(msg);
