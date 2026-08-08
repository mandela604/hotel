// services/poolbar-config.js

/* ═══════════════════════════════════════════════
   CONFIGURATION — change ONLY these lines
   for production readiness

   GOING LIVE: flip USE_DEMO to false. That's it — every function in
   poolbar-data.js already knows how to call the real backend; nothing
   in any poolbar-*.html page needs to change. Once you're confident
   you don't need demo data anymore, delete poolbar-demo-seed.js
   entirely — nothing else in the app imports from it.
═══════════════════════════════════════════════ */

export const CONFIG = {
  USE_DEMO: true,                          // ← flip to false for production
  API_BASE: 'https://api.yourdomain.com',  // ← change to your API
  API_KEY: '',                             // ← add if needed
  PAGE_SIZE: 10,
};