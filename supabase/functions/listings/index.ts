import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace("/listings", "").replace(/^\/+/, "");
  const pathParts = path.split("/").filter(Boolean);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  
  // Get auth header for user operations
  const authHeader = req.headers.get("Authorization");
  const supabase = createClient(supabaseUrl, authHeader ? supabaseKey : supabaseKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });

  try {
    // GET /listings - Browse all active listings
    if (req.method === "GET" && pathParts.length === 0) {
      const platform = url.searchParams.get("platform");
      const listingType = url.searchParams.get("type"); // sale, trade, wanted
      const condition = url.searchParams.get("condition");
      const maxPrice = url.searchParams.get("max_price");
      const country = url.searchParams.get("country");
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);
      const offset = parseInt(url.searchParams.get("offset") || "0", 10);

      let query = supabase
        .from("user_listings")
        .select(`
          id, game_key, title, asking_price_cents, currency, condition,
          listing_type, is_complete_in_box, photos, city, country_code,
          created_at, view_count, favorite_count,
          profiles:user_id (display_name, avatar_url)
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (listingType) query = query.eq("listing_type", listingType);
      if (condition) query = query.eq("condition", condition);
      if (country) query = query.eq("country_code", country);
      if (maxPrice) query = query.lte("asking_price_cents", parseInt(maxPrice, 10));

      const { data, error, count } = await query.range(offset, offset + limit - 1);

      if (error) throw error;

      return new Response(JSON.stringify({
        listings: data || [],
        pagination: { limit, offset, count: data?.length || 0 }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /listings/game/:gameKey - Get listings for a specific game
    if (req.method === "GET" && pathParts[0] === "game" && pathParts[1]) {
      const gameKey = decodeURIComponent(pathParts[1]);
      const listingType = url.searchParams.get("type") as any;
      const maxPrice = url.searchParams.get("max_price");
      const conditions = url.searchParams.get("conditions")?.split(",") as any[];

      const { data, error } = await supabase.rpc("get_game_listings", {
        p_game_key: gameKey,
        p_listing_type: listingType || null,
        p_max_price_cents: maxPrice ? parseInt(maxPrice, 10) : null,
        p_conditions: conditions || null,
      });

      if (error) throw error;

      return new Response(JSON.stringify({ listings: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /listings/:id - Get single listing details
    if (req.method === "GET" && pathParts.length === 1) {
      const listingId = pathParts[0];

      const { data, error } = await supabase
        .from("user_listings")
        .select(`
          *,
          profiles:user_id (id, display_name, avatar_url),
          market_price:listing_price_comparison!inner (
            market_loose_cents, market_cib_cents, price_vs_market_pct
          )
        `)
        .eq("id", listingId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return new Response(JSON.stringify({ error: "Listing not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw error;
      }

      // Increment view count
      await supabase
        .from("user_listings")
        .update({ view_count: (data.view_count || 0) + 1 })
        .eq("id", listingId);

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /listings - Create new listing (requires auth)
    if (req.method === "POST" && pathParts.length === 0) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Authentication required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const listing = {
        user_id: user.id,
        game_key: body.game_key,
        game_id: body.game_id || null,
        title: body.title,
        description: body.description || null,
        listing_type: body.listing_type || "sale",
        condition: body.condition || "good",
        condition_notes: body.condition_notes || null,
        is_complete_in_box: body.is_complete_in_box || false,
        includes_manual: body.includes_manual || false,
        includes_inserts: body.includes_inserts || false,
        asking_price_cents: body.asking_price_cents || null,
        currency: body.currency || "USD",
        is_price_negotiable: body.is_price_negotiable || false,
        photos: body.photos || [],
        country_code: body.country_code || null,
        city: body.city || null,
        region: body.region || null,
        ships_internationally: body.ships_internationally || false,
        shipping_price_cents: body.shipping_price_cents || null,
        local_pickup_only: body.local_pickup_only || false,
        trade_preferences: body.trade_preferences || null,
        trade_notes: body.trade_notes || null,
        status: body.status || "draft",
      };

      const { data, error } = await supabase
        .from("user_listings")
        .insert(listing)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT /listings/:id - Update listing (requires auth + ownership)
    if (req.method === "PUT" && pathParts.length === 1) {
      const listingId = pathParts[0];
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Authentication required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      
      // Remove fields that shouldn't be updated directly
      delete body.id;
      delete body.user_id;
      delete body.created_at;
      delete body.view_count;
      delete body.favorite_count;

      const { data, error } = await supabase
        .from("user_listings")
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq("id", listingId)
        .eq("user_id", user.id) // Ensure ownership
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return new Response(JSON.stringify({ error: "Listing not found or not owned by you" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw error;
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE /listings/:id - Delete listing (requires auth + ownership)
    if (req.method === "DELETE" && pathParts.length === 1) {
      const listingId = pathParts[0];
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Authentication required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase
        .from("user_listings")
        .delete()
        .eq("id", listingId)
        .eq("user_id", user.id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /listings/:id/favorite - Toggle favorite (requires auth)
    if (req.method === "POST" && pathParts[1] === "favorite") {
      const listingId = pathParts[0];
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Authentication required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already favorited
      const { data: existing } = await supabase
        .from("user_listing_favorites")
        .select("id")
        .eq("listing_id", listingId)
        .eq("user_id", user.id)
        .single();

      if (existing) {
        // Remove favorite
        await supabase
          .from("user_listing_favorites")
          .delete()
          .eq("id", existing.id);

        return new Response(JSON.stringify({ favorited: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        // Add favorite
        await supabase
          .from("user_listing_favorites")
          .insert({ listing_id: listingId, user_id: user.id });

        return new Response(JSON.stringify({ favorited: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
