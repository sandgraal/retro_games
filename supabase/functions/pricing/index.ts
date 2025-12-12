import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

interface PriceSnapshot {
  game_key: string;
  game_name: string;
  platform: string;
  loose_price_cents: number | null;
  cib_price_cents: number | null;
  new_price_cents: number | null;
  snapshot_date: string;
  source: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace("/pricing", "").replace(/^\/+/, "");
  const pathParts = path.split("/").filter(Boolean);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Route: GET /pricing/latest - Get all latest prices
    if (pathParts.length === 0 || pathParts[0] === "latest") {
      const platform = url.searchParams.get("platform");
      const limit = parseInt(url.searchParams.get("limit") || "100", 10);
      const offset = parseInt(url.searchParams.get("offset") || "0", 10);

      let query = supabase.from("game_price_latest").select("*").order("game_name");

      if (platform) {
        query = query.ilike("platform", platform);
      }

      const { data, error } = await query.range(offset, offset + limit - 1);

      if (error) throw error;

      return new Response(
        JSON.stringify({
          prices: data,
          pagination: { limit, offset, count: data?.length || 0 },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Route: GET /pricing/game/:gameKey - Get price for specific game
    if (pathParts[0] === "game" && pathParts[1]) {
      const gameKey = decodeURIComponent(pathParts[1]);
      const days = parseInt(url.searchParams.get("days") || "30", 10);
      const region = url.searchParams.get("region") || "NTSC-U";

      // Get current price
      const { data: current, error: currentError } = await supabase
        .from("game_price_latest")
        .select("*")
        .eq("game_key", gameKey)
        .single();

      if (currentError && currentError.code !== "PGRST116") throw currentError;

      // Get price history using the function
      const { data: history, error: historyError } = await supabase.rpc(
        "get_price_history",
        {
          p_game_key: gameKey,
          p_days: days,
          p_region_code: region,
        }
      );

      if (historyError) throw historyError;

      // Get price trends
      const { data: trends, error: trendsError } = await supabase.rpc(
        "get_price_trends",
        { p_game_key: gameKey }
      );

      if (trendsError) throw trendsError;

      return new Response(
        JSON.stringify({
          game_key: gameKey,
          current: current || null,
          history: history || [],
          trends: trends?.[0] || null,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Route: GET /pricing/stats - Get marketplace statistics
    if (pathParts[0] === "stats") {
      const { data, error } = await supabase
        .from("marketplace_stats")
        .select("*")
        .single();

      if (error && error.code !== "PGRST116") throw error;

      return new Response(JSON.stringify(data || {}), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Route: GET /pricing/bulk - Get prices for multiple games
    if (pathParts[0] === "bulk") {
      const gameKeys = url.searchParams.get("keys")?.split(",") || [];

      if (gameKeys.length === 0) {
        return new Response(JSON.stringify({ error: "No game keys provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (gameKeys.length > 50) {
        return new Response(JSON.stringify({ error: "Maximum 50 games per request" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("game_price_latest")
        .select("*")
        .in("game_key", gameKeys);

      if (error) throw error;

      // Return as a map for easy lookup
      const priceMap: Record<string, PriceSnapshot> = {};
      for (const price of data || []) {
        priceMap[price.game_key] = price;
      }

      return new Response(JSON.stringify({ prices: priceMap }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Route: GET /pricing/search - Search games by name with prices
    if (pathParts[0] === "search") {
      const query = url.searchParams.get("q") || "";
      const limit = parseInt(url.searchParams.get("limit") || "20", 10);

      if (query.length < 2) {
        return new Response(
          JSON.stringify({ error: "Query must be at least 2 characters" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data, error } = await supabase
        .from("game_price_latest")
        .select("*")
        .ilike("game_name", `%${query}%`)
        .order("game_name")
        .limit(limit);

      if (error) throw error;

      return new Response(JSON.stringify({ results: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
