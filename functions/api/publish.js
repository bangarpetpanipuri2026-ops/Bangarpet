const JSON_PATHS = new Set(["content/site.json", "content/menu.json"]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_VIDEO = 15 * 1024 * 1024;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

async function requireAdmin(request, env) {
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  const idToken = header.slice(7);
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_WEB_API_KEY}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken })
  });
  if (!response.ok) return null;
  const user = (await response.json()).users?.[0];
  return user?.localId === env.ADMIN_UID ? user : null;
}

async function github(env, path, method, body) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      "authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "accept": "application/vnd.github+json",
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) throw new Error(`GitHub request failed: ${response.status}`);
  return response.json();
}

export async function onRequestPost({ request, env }) {
  try {
    if (!(await requireAdmin(request, env))) return json({ error: "Unauthorized" }, 401);
    const input = await request.json();
    const { action } = input;

    if (action === "save-json") {
      if (!JSON_PATHS.has(input.path) || typeof input.data !== "object") return json({ error: "Invalid content path or data" }, 400);
      const current = await github(env, input.path, "GET");
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(input.data, null, 2) + "\n")));
      await github(env, input.path, "PUT", { message: `Admin update: ${input.path}`, content, sha: current.sha, branch: "main" });
      return json({ ok: true });
    }

    if (action === "upload-media") {
      const { name, contentType, base64 } = input;
      if (!/^[a-z0-9][a-z0-9._-]{0,100}$/i.test(name) || typeof base64 !== "string") return json({ error: "Invalid filename or data" }, 400);
      const byteLength = Math.floor(base64.length * 0.75);
      const isImage = IMAGE_TYPES.has(contentType), isVideo = VIDEO_TYPES.has(contentType);
      if ((!isImage && !isVideo) || (isImage && byteLength > MAX_IMAGE) || (isVideo && byteLength > MAX_VIDEO)) return json({ error: "Unsupported file type or file too large" }, 400);
      const path = isImage ? `photos/images/${name}` : `photos/videos/${name}`;
      let sha;
      try { sha = (await github(env, path, "GET")).sha; } catch (_) {}
      await github(env, path, "PUT", { message: `Admin media upload: ${name}`, content: base64, sha, branch: "main" });
      return json({ ok: true, path: `./${path}` });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: "Publish failed" }, 500);
  }
}