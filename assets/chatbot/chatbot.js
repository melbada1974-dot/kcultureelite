/**
 * K-Culture Elite Floating Chatbot Widget (Vanilla JS).
 * Config via <script src="chatbot.js" data-worker="https://kc-chatbot....workers.dev"></script>
 */
(function () {
  "use strict";

  const scriptEl = document.currentScript;
  const WORKER = scriptEl?.dataset.worker;
  if (!WORKER) {
    console.error("[chatbot] data-worker attribute missing on script tag");
    return;
  }

  const STORAGE_KEY = "kc-chat-history";
  const MAX_TURNS = 50;
  const WELCOME =
    "Hi! Ask me anything about the K-Culture Elite Program — in any language you prefer.";

  const state = {
    messages: loadHistory(),
    sending: false,
  };

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(-MAX_TURNS * 2);
    } catch {
      return [];
    }
  }
  function saveHistory() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state.messages.slice(-MAX_TURNS * 2)),
      );
    } catch {
      /* storage disabled */
    }
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // --- build DOM ---
  const btn = el("button", "kc-chat-button", "💬");
  btn.setAttribute("aria-label", "Open K-Culture AI Assistant");
  btn.setAttribute("aria-expanded", "false");

  const panel = el("div", "kc-chat-panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "K-Culture AI Assistant");

  const header = el("div", "kc-chat-header");
  header.appendChild(el("span", null, "🤖 K-Culture Assistant"));
  const closeBtn = el("button", "kc-chat-close", "×");
  closeBtn.setAttribute("aria-label", "Close chat");
  header.appendChild(closeBtn);

  const messagesEl = el("div", "kc-chat-messages");

  const form = el("form", "kc-chat-form");
  const input = el("textarea", "kc-chat-input");
  input.rows = 1;
  input.placeholder = "Ask a question…";
  input.maxLength = 2000;
  const sendBtn = el("button", "kc-chat-send", "→");
  sendBtn.type = "submit";
  form.append(input, sendBtn);

  const footer = el(
    "div",
    "kc-chat-footer",
    "Powered by Claude · Your chat stays in your browser",
  );

  panel.append(header, messagesEl, form, footer);
  document.body.append(btn, panel);

  // --- render ---
  function render() {
    messagesEl.innerHTML = "";
    if (state.messages.length === 0) {
      messagesEl.appendChild(el("div", "kc-chat-msg assistant", WELCOME));
    } else {
      state.messages.forEach((m) => {
        messagesEl.appendChild(
          el("div", `kc-chat-msg ${m.role}`, m.content),
        );
      });
    }
    if (state.sending) {
      messagesEl.appendChild(el("div", "kc-chat-typing", "Assistant is typing…"));
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // --- events ---
  btn.addEventListener("click", () => {
    panel.classList.add("kc-open");
    btn.setAttribute("aria-expanded", "true");
    input.focus();
    render();
  });
  closeBtn.addEventListener("click", () => {
    panel.classList.remove("kc-open");
    btn.setAttribute("aria-expanded", "false");
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (state.sending) return;
    const text = input.value.trim();
    if (!text) return;
    state.messages.push({ role: "user", content: text });
    saveHistory();
    input.value = "";
    input.style.height = "auto";
    state.sending = true;
    sendBtn.disabled = true;
    render();

    try {
      const res = await fetch(`${WORKER}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: state.messages.slice(-20),
          language_hint: navigator.language?.slice(0, 2) ?? "en",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.reply) {
        throw new Error(data.error ?? "unknown error");
      }
      state.messages.push({ role: "assistant", content: data.reply });
      saveHistory();

      // Progressive Lead Capture: detect user email in latest message
      const lastUser = state.messages[state.messages.length - 2];
      const emailMatch = lastUser.content.match(
        /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/,
      );
      if (emailMatch) {
        const nameMatch = lastUser.content.match(
          /\bI['']?m\s+([A-Z][A-Za-z'-]{1,30})/,
        );
        fetch(`${WORKER}/lead`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: emailMatch[1],
            name: nameMatch?.[1] ?? "(unknown)",
            consent_type: "admissions_contact",
            language_pref: navigator.language?.slice(0, 2) ?? "en",
          }),
        }).catch((err) => console.warn("[chatbot] lead capture failed", err));
      }
    } catch (err) {
      console.error(err);
      state.messages.push({
        role: "assistant",
        content:
          "Sorry, I had trouble reaching the assistant. Please try again or email global@badaglobal-bli.com.",
      });
    } finally {
      state.sending = false;
      sendBtn.disabled = false;
      render();
    }
  });

  // initial render on first open — nothing on boot
})();
