// Cloudflare Pages Function for Products API
// Location: functions/api/products.js

export async function onRequest(context) {
    const { request, env } = context;

    // Admin key for write operations (set this in Cloudflare dashboard as environment variable)
    // Go to: Pages > Your Project > Settings > Environment Variables
    // Add: ADMIN_KEY = "your-secret-key-here"
    // IMPORTANT: This fallback must match admin.html's ADMIN_KEY_HASH
    // For production, set ADMIN_KEY in Cloudflare: Pages > Settings > Environment Variables
    const ADMIN_KEY = env.ADMIN_KEY || "jojin2026";

    const KEY = "products";

    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    // Check KV binding
    if (!env.PRODUCTS_KV) {
        return new Response(
            JSON.stringify({ error: "KV binding PRODUCTS_KV is not configured" }),
            {
                status: 500,
                headers: { "Content-Type": "application/json", ...corsHeaders },
            }
        );
    }

    // GET - Public read access
    if (request.method === "GET") {
        try {
            const raw = await env.PRODUCTS_KV.get(KEY);
            const data = raw ? JSON.parse(raw) : [];
            return new Response(JSON.stringify(data), {
                headers: { 
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    ...corsHeaders 
                },
            });
        } catch (error) {
            return new Response(
                JSON.stringify({ error: "Failed to fetch products" }),
                {
                    status: 500,
                    headers: { "Content-Type": "application/json", ...corsHeaders },
                }
            );
        }
    }

    // PUT - Requires admin key
    if (request.method === "PUT") {
        // Verify admin key
        const providedKey = request.headers.get("X-Admin-Key");
        
        if (!providedKey || providedKey !== ADMIN_KEY) {
            return new Response(
                JSON.stringify({ error: "Unauthorized - Invalid admin key" }),
                {
                    status: 401,
                    headers: { "Content-Type": "application/json", ...corsHeaders },
                }
            );
        }

        try {
            const body = await request.json();

            // Validate that body is an array
            if (!Array.isArray(body)) {
                return new Response(
                    JSON.stringify({ error: "Request body must be an array of products" }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json", ...corsHeaders },
                    }
                );
            }

            // Validate each product has required fields
            for (const product of body) {
                if (!product.id || typeof product.id !== "string") {
                    return new Response(
                        JSON.stringify({ error: "Each product must have a string 'id' field" }),
                        {
                            status: 400,
                            headers: { "Content-Type": "application/json", ...corsHeaders },
                        }
                    );
                }
            }

            // Save to KV
            await env.PRODUCTS_KV.put(KEY, JSON.stringify(body));

            return new Response(
                JSON.stringify({ 
                    ok: true, 
                    count: body.length,
                    message: `Successfully saved ${body.length} products`
                }),
                {
                    headers: { "Content-Type": "application/json", ...corsHeaders },
                }
            );
        } catch (error) {
            return new Response(
                JSON.stringify({ error: "Failed to save products: " + error.message }),
                {
                    status: 500,
                    headers: { "Content-Type": "application/json", ...corsHeaders },
                }
            );
        }
    }

    // Method not allowed
    return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { 
            status: 405, 
            headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
    );
}
