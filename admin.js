let site = null;
let menu = [];
let currentUser = null;
let unsavedChanges = false;

const $ = (selector) => document.querySelector(selector);
const clone = (value) => JSON.parse(JSON.stringify(value));
const text = (value) => String(value ?? "");

function setStatus(message, error = false) {
  const element = $("#status");
  if (!element) return;
  element.textContent = message;
  element.style.color = error ? "#b13b2e" : "#267140";
}

function makeField(label, value, onChange, type = "text", full = false) {
  const wrapper = document.createElement("label");
  if (full) wrapper.className = "full";
  wrapper.append(document.createTextNode(label));

  const input = type === "textarea" ? document.createElement("textarea") : document.createElement("input");
  input.value = value ?? "";
  if (type !== "textarea") input.type = type;
  input.addEventListener("input", () => { unsavedChanges = true; onChange(input.value); });
  wrapper.append(input);
  return wrapper;
}

async function loadContent() {
  const [siteResponse, menuResponse] = await Promise.all([
    fetch("./content/site.json", { cache: "no-store" }),
    fetch("./content/menu.json", { cache: "no-store" })
  ]);
  if (!siteResponse.ok || !menuResponse.ok) throw new Error("Could not load content JSON files.");
  site = await siteResponse.json();
  menu = await menuResponse.json();
  unsavedChanges = false;
  renderAll();
}

function moveItem(items, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return;
  unsavedChanges = true;
  [items[index], items[target]] = [items[target], items[index]];
  items.forEach((item, position) => { item.order = position + 1; });
}

function renderSections() {
  const container = $("#sections");
  if (!container) return;
  container.innerHTML = "";

  site.sections.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  site.sections.forEach((section, index) => {
    const card = document.createElement("article");
    card.className = "editor-card";

    const header = document.createElement("div");
    header.className = "row";
    const title = document.createElement("b");
    title.textContent = `${String(section.type || "section").toUpperCase()} · ${section.id}`;
    const actions = document.createElement("span");

    const up = document.createElement("button");
    up.type = "button";
    up.textContent = "↑";
    up.onclick = () => { moveItem(site.sections, index, -1); renderSections(); };

    const down = document.createElement("button");
    down.type = "button";
    down.textContent = "↓";
    down.onclick = () => { moveItem(site.sections, index, 1); renderSections(); };

    const duplicate = document.createElement("button");
    duplicate.type = "button";
    duplicate.textContent = "Duplicate";
    duplicate.onclick = () => {
      unsavedChanges = true;
      const copy = clone(section);
      copy.id = `${section.type || "section"}-${Date.now()}`;
      copy.order = site.sections.length + 1;
      site.sections.push(copy);
      renderSections();
    };

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Delete";
    remove.onclick = () => {
      if (!window.confirm(`Delete ${section.id}?`)) return;
      unsavedChanges = true;
      site.sections.splice(index, 1);
      site.sections.forEach((item, position) => { item.order = position + 1; });
      renderSections();
    };

    actions.append(up, down, duplicate, remove);
    header.append(title, actions);
    card.append(header);

    const fields = document.createElement("div");
    fields.className = "fields";

    fields.append(
      makeField("Section ID", section.id, (value) => { section.id = value; }),
      makeField("Type", section.type, (value) => { section.type = value; }),
      makeField("Visible: true/false", String(section.visible !== false), (value) => { section.visible = value === "true"; }),
      makeField("Display order", section.order, (value) => { section.order = Number(value) || 0; }, "number")
    );

    Object.entries(section.content || {}).forEach(([key, value]) => {
      const isLongText = key === "body" || key === "title" || text(value).length > 100;
      fields.append(makeField(`Content: ${key}`, typeof value === "object" ? JSON.stringify(value) : value, (next) => {
        if (typeof value === "object") {
          try { section.content[key] = JSON.parse(next); } catch (_) { section.content[key] = next; }
        } else {
          section.content[key] = next;
        }
      }, isLongText ? "textarea" : "text", isLongText));
    });

    Object.entries(section.settings || {}).forEach(([key, value]) => {
      fields.append(makeField(`Layout: ${key}`, value, (next) => {
        section.settings[key] = next !== "" && !Number.isNaN(Number(next)) ? Number(next) : next;
      }));
    });

    card.append(fields);
    container.append(card);
  });
}

function renderMenu() {
  const container = $("#menu-items");
  if (!container) return;
  container.innerHTML = "";

  menu.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  menu.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "menu-editor";

    const header = document.createElement("div");
    header.className = "row";
    const title = document.createElement("b");
    title.textContent = item.name || "New menu item";
    const actions = document.createElement("span");

    const up = document.createElement("button");
    up.type = "button";
    up.textContent = "↑";
    up.onclick = () => { moveItem(menu, index, -1); renderMenu(); };

    const down = document.createElement("button");
    down.type = "button";
    down.textContent = "↓";
    down.onclick = () => { moveItem(menu, index, 1); renderMenu(); };

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Delete";
    remove.onclick = () => {
      if (!window.confirm("Delete this menu item?")) return;
      unsavedChanges = true;
      menu.splice(index, 1);
      renderMenu();
    };

    actions.append(up, down, remove);
    header.append(title, actions);
    card.append(header);

    const fields = document.createElement("div");
    fields.className = "fields";

    ["name", "category", "price", "currency", "description", "ingredients", "imageUrl", "tags", "visible", "order"].forEach((key) => {
      const value = key === "tags" ? (item.tags || []).join(", ") : item[key];
      const type = key === "description" || key === "ingredients" ? "textarea" : key === "order" ? "number" : "text";
      fields.append(makeField(key, value, (next) => {
        if (key === "tags") item.tags = next.split(",").map(tag => tag.trim()).filter(Boolean);
        else if (key === "visible") item.visible = next !== "false";
        else if (key === "order") item.order = Number(next) || 0;
        else item[key] = next;
      }, type, type === "textarea"));
    });

    card.append(fields);
    container.append(card);
  });
}

function renderTheme() {
  const container = $("#theme-form");
  if (!container) return;
  container.innerHTML = "";

  Object.entries(site.brand || {}).forEach(([key, value]) => {
    container.append(makeField(`Brand: ${key}`, value, (next) => { site.brand[key] = next; }));
  });

  Object.entries(site.theme || {}).forEach(([key, value]) => {
    container.append(makeField(`Theme: ${key}`, value, (next) => {
      site.theme[key] = next !== "" && !Number.isNaN(Number(next)) ? Number(next) : next;
    }));
  });

  Object.entries(site.footer || {}).forEach(([key, value]) => {
    if (typeof value !== "object") container.append(makeField(`Footer: ${key}`, value, (next) => { site.footer[key] = next; }));
  });
}

function renderAll() {
  renderSections();
  renderMenu();
  renderTheme();
}

async function publishFile(path, data) {
  const token = await currentUser.getIdToken(true);
  const response = await fetch("/api/publish", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: "save-json", path, data })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Publish failed with status ${response.status}`);
}

async function publishAll() {
  const button = $("#publish");
  const originalLabel = button ? button.textContent : "";
  try {
    if (button) { button.disabled = true; button.textContent = "Publishing…"; }
    setStatus("Publishing to GitHub…");
    await publishFile("content/site.json", site);
    await publishFile("content/menu.json", menu);
    unsavedChanges = false;
    setStatus("Published successfully. Cloudflare Pages will deploy the commit.");
  } catch (error) {
    console.error(error);
    setStatus(error.message, true);
  } finally {
    if (button) { button.disabled = false; button.textContent = originalLabel; }
  }
}

function addSection() {
  unsavedChanges = true;
  site.sections.push({
    id: `text-${Date.now()}`,
    type: "text",
    order: site.sections.length + 1,
    visible: true,
    settings: { background: "#FBF8F1", align: "left", animation: "fade-up", delay: 0 },
    content: { eyebrow: "New section", title: "New title", body: "Write your content here." }
  });
  renderSections();
}

function addMenuItem() {
  unsavedChanges = true;
  menu.push({
    id: `item-${Date.now()}`,
    order: menu.length + 1,
    visible: true,
    category: "Chaat",
    name: "New menu item",
    price: "0.00",
    currency: "$",
    description: "Description",
    ingredients: "Ingredients",
    tags: [],
    imageUrl: ""
  });
  renderMenu();
}

function setupMediaUpload() {
  $("#upload")?.addEventListener("click", async () => {
    const file = $("#media-file")?.files?.[0];
    const output = $("#upload-result");
    if (!file) { output.textContent = "Choose a file first."; return; }

    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]);
    const limit = file.type.startsWith("video/") ? 15 : 5;
    if (!allowed.has(file.type) || file.size > limit * 1024 * 1024) {
      output.textContent = `Unsupported file or file exceeds ${limit} MB.`;
      return;
    }

    try {
      const token = await currentUser.getIdToken(true);
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-");
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "upload-media", name: safeName, contentType: file.type, base64 })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed");
      output.textContent = `Uploaded: ${result.path}`;
    } catch (error) {
      output.textContent = error.message;
    }
  });
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(item => item.classList.remove("active"));
    tab.classList.add("active");
    document.querySelectorAll(".view").forEach(view => { view.hidden = view.id !== tab.dataset.view; });
  }));
}

$("#add-section")?.addEventListener("click", addSection);
$("#add-item")?.addEventListener("click", addMenuItem);
$("#publish")?.addEventListener("click", publishAll);
$("#logout")?.addEventListener("click", () => firebase.auth().signOut());
$("#signin")?.addEventListener("click", async () => {
  try {
    $("#auth-error").textContent = "";
    await firebase.auth().signInWithEmailAndPassword($("#email").value.trim(), $("#password").value);
  } catch (error) {
    $("#auth-error").textContent = `${error.code || "Login failed"}: ${error.message || "Check your credentials."}`;
  }
});

window.addEventListener("beforeunload", (event) => {
  if (!unsavedChanges) return;
  event.preventDefault();
  event.returnValue = "";
});

setupTabs();
setupMediaUpload();

firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) return;
  currentUser = user;
  $("#login").hidden = true;
  $("#app").hidden = false;
  $("#user").textContent = user.email || "Signed in";
  try { await loadContent(); } catch (error) { setStatus(error.message, true); }
});
