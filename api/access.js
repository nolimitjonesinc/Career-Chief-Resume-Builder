// Vercel adapter for the access-code check. The logic lives in shared/access.mjs.
import { handleAccess } from "../shared/access.mjs";
import { aiEnvFrom } from "../shared/ai-guard.mjs";

export default {
  fetch(request) {
    return handleAccess(request, aiEnvFrom(process.env));
  },
};
