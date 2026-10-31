import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth/index.js";

// Better Auth owns everything under /api/auth. Lazy so the build never needs runtime secrets.
const handlers = () => toNextJsHandler(getAuth());
export const GET = (req) => handlers().GET(req);
export const POST = (req) => handlers().POST(req);
