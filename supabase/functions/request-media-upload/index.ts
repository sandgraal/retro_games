import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const DEFAULT_BUCKET = "media-pending";
const MIME_MAP: Record<string, string[]> = {
  image: ["image/png", "image/jpeg"],
  manual: ["application/pdf"],
  video: ["video/mp4"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const pendingBucket = Deno.env.get("SUPABASE_STORAGE_PENDING_BUCKET") || DEFAULT_BUCKET;

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Missing server configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const filename = (payload?.filename ?? "").toString();
  const contentType = (payload?.contentType ?? "").toString();
  const byteSize = Number(payload?.byteSize ?? 0);
  const assetType = (payload?.assetType ?? "image").toString();
  const regionCode = (payload?.regionCode ?? "NTSC").toString();

  if (!filename || !contentType || !Number.isFinite(byteSize)) {
    return new Response(
      JSON.stringify({ error: "filename, contentType, and byteSize are required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (byteSize <= 0 || byteSize > MAX_UPLOAD_BYTES) {
    return new Response(JSON.stringify({ error: "File exceeds 25MB limit" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const allowedTypes = MIME_MAP[assetType] || MIME_MAP.image;
  if (!allowedTypes.includes(contentType)) {
    return new Response(JSON.stringify({ error: "Unsupported file type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const extension = (() => {
    const fromName = filename.includes(".")
      ? `.${filename.split(".").pop()?.toLowerCase()}`
      : "";
    if (fromName) return fromName;
    if (contentType === "image/png") return ".png";
    if (contentType === "image/jpeg") return ".jpg";
    if (contentType === "application/pdf") return ".pdf";
    if (contentType === "video/mp4") return ".mp4";
    return "";
  })();

  const storagePath = `${assetType}/${crypto.randomUUID()}${extension}`;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.storage
    .from(pendingBucket)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    return new Response(
      JSON.stringify({ error: error?.message ?? "Failed to create upload URL" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({
      bucket: pendingBucket,
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
      contentType,
      byteSize,
      assetType,
      regionCode,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
