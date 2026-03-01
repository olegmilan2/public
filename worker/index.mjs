export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Minimal CORS so the hosted app can call the worker.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (request.method !== "POST" || url.pathname !== "/send") {
      return new Response("Not found", { status: 404, headers: corsHeaders(request) });
    }

    const botToken = (env.TELEGRAM_BOT_TOKEN || "").trim();
    const chatId = (env.TELEGRAM_CHAT_ID || "").trim();
    if (!botToken || !chatId) {
      return json({ ok: false, error: "telegram_not_configured" }, 500, request);
    }

    const requiredKey = (env.STOPLIST_API_KEY || "").trim();
    if (requiredKey) {
      const got = (request.headers.get("x-stoplist-key") || "").trim();
      if (got !== requiredKey) return json({ ok: false, error: "unauthorized" }, 401, request);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ ok: false, error: "invalid_json" }, 400, request);
    }

    const text = String(body && body.text ? body.text : "").trim();
    if (!text) return json({ ok: false, error: "empty_text" }, 400, request);
    if (text.length > 3500) return json({ ok: false, error: "text_too_long" }, 400, request);

    const parseMode = String(body && body.parseMode ? body.parseMode : "HTML").trim() || "HTML";

    const tgResp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true
      })
    });

    let tgJson = null;
    try {
      tgJson = await tgResp.json();
    } catch (e) {
      // ignore
    }

    if (!tgResp.ok || !tgJson || tgJson.ok !== true) {
      const desc = tgJson && tgJson.description ? String(tgJson.description) : `HTTP ${tgResp.status}`;
      return json({ ok: false, error: "telegram_failed", description: desc }, 502, request);
    }

    return json({ ok: true }, 200, request);
  }
};

function corsHeaders(request) {
  const origin = request.headers.get("origin") || "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-stoplist-key",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
}

function json(obj, status, request) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(request)
    }
  });
}
