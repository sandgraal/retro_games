/**
 * Steam API Proxy Edge Function
 * Proxies requests to Steam API to avoid CORS issues
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Steam API key should be set in Edge Function secrets
const STEAM_API_KEY = Deno.env.get("STEAM_API_KEY");

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace("/steam/", "");

  // Check for API key
  if (!STEAM_API_KEY) {
    return new Response(JSON.stringify({ error: "Steam API key not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Route to appropriate Steam API endpoint
    switch (path) {
      case "resolve-vanity": {
        const vanityUrl = url.searchParams.get("vanityurl");
        if (!vanityUrl) {
          return new Response(JSON.stringify({ error: "Missing vanityurl parameter" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const steamUrl = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_API_KEY}&vanityurl=${encodeURIComponent(vanityUrl)}`;
        const response = await fetch(steamUrl);
        const data = await response.json();

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "owned-games": {
        const steamId = url.searchParams.get("steamid");
        if (!steamId) {
          return new Response(JSON.stringify({ error: "Missing steamid parameter" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Validate Steam ID format
        if (!/^\d{17}$/.test(steamId)) {
          return new Response(JSON.stringify({ error: "Invalid Steam ID format" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const steamUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true`;
        const response = await fetch(steamUrl);
        const data = await response.json();

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "player-summary": {
        const steamId = url.searchParams.get("steamid");
        if (!steamId) {
          return new Response(JSON.stringify({ error: "Missing steamid parameter" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const steamUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId}`;
        const response = await fetch(steamUrl);
        const data = await response.json();

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "recently-played": {
        const steamId = url.searchParams.get("steamid");
        if (!steamId) {
          return new Response(JSON.stringify({ error: "Missing steamid parameter" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const steamUrl = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}`;
        const response = await fetch(steamUrl);
        const data = await response.json();

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown endpoint" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Steam API error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch from Steam API",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
