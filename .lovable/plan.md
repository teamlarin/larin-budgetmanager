

## Fix: "Unexpected end of JSON input" in fatture-in-cloud-oauth

### Causa

The edge function has two flows:
1. **OAuth callback** (GET from FIC with `code` + `state` params) — handled at line 30
2. **API requests** (POST from the app with JSON body) — handled at line 141

The problem: when the OAuth callback from FIC arrives as a GET request but without both `code` AND `state` (e.g., user denies authorization, or FIC sends an error), the function falls through to line 141 where `await req.json()` is called on a GET request with no body, causing `SyntaxError: Unexpected end of JSON input`.

Additionally, even successful callbacks after token save hit the same code path on the second invocation boot (the logs show two boots for the same request pattern).

### Fix

**`supabase/functions/fatture-in-cloud-oauth/index.ts`**

Wrap the `req.json()` call in a try-catch and add a guard for non-POST requests before trying to parse the body:

```typescript
// Line 141 area - replace:
const { action, appUrl } = await req.json();

// With:
if (req.method !== 'POST') {
  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

let action: string | undefined;
let appUrl: string | undefined;
try {
  const body = await req.json();
  action = body.action;
  appUrl = body.appUrl;
} catch {
  return new Response(
    JSON.stringify({ error: 'Invalid request body' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

This ensures:
- GET requests that don't match the OAuth callback pattern return a proper error instead of crashing
- Malformed POST requests get a clear 400 error
- No other files need changes

