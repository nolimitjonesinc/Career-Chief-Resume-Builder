import { handleCareerAI } from "../../shared/career-ai.mjs";

export default {
  fetch(request) {
    return handleCareerAI(request, { OPENAI_API_KEY: process.env.OPENAI_API_KEY });
  },
};
