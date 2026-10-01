import { handleCareerAI } from "../../shared/career-ai.mjs";
import { aiEnvFrom } from "../../shared/ai-guard.mjs";

export default {
  fetch(request) {
    return handleCareerAI(request, aiEnvFrom(process.env));
  },
};
