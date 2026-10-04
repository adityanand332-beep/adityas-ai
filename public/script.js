const STORAGE_KEY = "aditya-ai-chat-history-v1";
const messagesEl = document.getElementById("messages");
const input = document.getElementById("messageInput");
const form = document.getElementById("chatForm");
const historyEl = document.getElementById("history");
const sidebar = document.getElementById("sidebar");
const renameDialog = document.getElementById("renameDialog");
const renameForm = document.getElementById("renameForm");
const renameInput = document.getElementById("renameInput");
const sendButton = document.getElementById("sendButton");

let chats = loadChats();
let activeChat = createChat();
let pendingRenameId = null;
let isSending = false;

function createChat() {
  return {
    id: globalThis.crypto?.randomUUID?.() || `chat_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    title: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: []
  };
}

function loadChats() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) throw new Error("Saved chat history has an invalid format.");
    return parsed.filter(chat =>
      chat && typeof chat.id === "string" &&
      typeof chat.title === "string" &&
      typeof chat.createdAt === "string" &&
      typeof chat.updatedAt === "string" &&
      Array.isArray(chat.messages) &&
      chat.messages.every(message =>
        message && (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string"
      )
    );
  } catch (error) {
    console.error("Could not load saved chat history:", error);
    queueMicrotask(() => showNotice("Saved chat history could not be loaded. It may be damaged or unavailable."));
    return [];
  }
}

function saveChats() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    return true;
  } catch (error) {
    console.error("Could not save chat history:", error);
    showNotice("Could not save chat history in this browser. Check available storage.");
    return false;
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function titleFromMessage(message) {
  const normalized = message.replace(/\s+/g, " ").trim();
  const withoutIntro = normalized.replace(
    /^(?:(?:please\s+)?(?:can|could|would)\s+you\s+)?(?:please\s+)?(?:tell me about|tell me|talk about|explain|describe)\s+/i,
    ""
  );
  const source = withoutIntro.length >= 3 ? withoutIntro : normalized;
  const words = source.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [];
  const title = words.slice(0, 6).join(" ");
  if (!title) return "New conversation";
  const punctuated = title.replace(/[.,!?;:]+$/u, "");
  const isQuestion = /[?؟]\s*$/.test(normalized);
  if (isQuestion) return `${punctuated}${/[؟]/.test(normalized) ? "؟" : "?"}`;
  const titled = punctuated.replace(/\b\p{L}/gu, letter => letter.toLocaleUpperCase());
  return titled;
}

function formatGroup(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Previous 7 Days";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDifference = Math.floor((startOfToday - startOfDate) / 86400000);

  if (dayDifference <= 0) return "Today";
  if (dayDifference === 1) return "Yesterday";
  if (dayDifference < 7) return "Previous 7 Days";
  return "Older";
}

function renderHistory() {
  const orderedChats = [...chats].sort((left, right) =>
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
  const groups = new Map();

  for (const chat of orderedChats) {
    const group = formatGroup(chat.updatedAt);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(chat);
  }

  historyEl.replaceChildren();
  for (const [groupName, groupChats] of groups) {
    const group = document.createElement("section");
    group.className = "history-group";
    group.setAttribute("aria-label", groupName);

    const heading = document.createElement("h3");
    heading.className = "history-group-title sidebar-label";
    heading.textContent = groupName;
    group.append(heading);

    for (const chat of groupChats) {
      const item = document.createElement("div");
      item.className = `history-entry${chat.id === activeChat.id ? " active" : ""}`;
      item.dataset.chatId = chat.id;
      item.setAttribute("role", "listitem");

      const openButton = document.createElement("button");
      openButton.className = "history-open";
      openButton.type = "button";
      openButton.dataset.action = "open";
      openButton.title = chat.title;
      openButton.setAttribute("aria-current", chat.id === activeChat.id ? "true" : "false");
      openButton.innerHTML = `<span class="history-chat-icon" aria-hidden="true">◦</span><span class="history-title sidebar-label">${escapeHtml(chat.title || "New conversation")}</span>`;

      const menuButton = document.createElement("button");
      menuButton.className = "history-menu-button";
      menuButton.type = "button";
      menuButton.dataset.action = "menu";
      menuButton.setAttribute("aria-label", `Options for ${chat.title || "conversation"}`);
      menuButton.title = "Conversation options";
      menuButton.textContent = "⋯";

      item.append(openButton, menuButton);
      group.append(item);
    }
    historyEl.append(group);
  }
}

function renderMessage(message) {
  const row = document.createElement("article");
  row.className = `message-row ${message.role}`;
  row.dataset.messageId = message.id || "";

  if (message.role === "assistant") {
    const avatar = document.createElement("div");
    avatar.className = "msg-avatar ai-avatar-small";
    avatar.textContent = "✦";
    avatar.setAttribute("aria-hidden", "true");
    row.append(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (message.role === "assistant") bubble.innerHTML = renderAssistantMarkdown(message.content);
  else bubble.textContent = message.content;
  row.append(bubble);

  if (message.role === "user") {
    const avatar = document.createElement("div");
    avatar.className = "msg-avatar user-avatar";
    avatar.textContent = "A";
    avatar.setAttribute("aria-hidden", "true");
    row.append(avatar);
  }
  messagesEl.append(row);
  return row;
}

function renderAssistantMarkdown(markdown) {
  const escape = value => value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
  const inline = value => escape(value)
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  const blocks = markdown.trim().split(/\n{2,}/);

  return blocks.map(block => {
    const lines = block.split("\n").map(line => line.trim()).filter(Boolean);
    const heading = lines.length === 1 && lines[0].match(/^(#{1,3})\s+(.+)$/);
    if (heading) return `<h${heading[1].length + 2}>${inline(heading[2])}</h${heading[1].length + 2}>`;

    const rendered = [];
    let listTag = null;
    let listItems = [];
    const flushList = () => {
      if (listTag) rendered.push(`<${listTag}>${listItems.join("")}</${listTag}>`);
      listTag = null;
      listItems = [];
    };

    for (const line of lines) {
      const bullet = line.match(/^[-*]\s+(.+)$/);
      const numbered = line.match(/^\d+[.)]\s+(.+)$/);
      const nextListTag = bullet ? "ul" : numbered ? "ol" : null;
      if (nextListTag) {
        if (listTag && listTag !== nextListTag) flushList();
        listTag = nextListTag;
        listItems.push(`<li>${inline((bullet || numbered)[1])}</li>`);
      } else {
        flushList();
        rendered.push(`<p>${inline(line.replace(/^#{1,3}\s+/, ""))}</p>`);
      }
    }
    flushList();
    return rendered.join("");
  }).join("");
}

function renderTypingRow() {
  const row = document.createElement("article");
  row.className = "message-row assistant";
  row.innerHTML = '<div class="msg-avatar ai-avatar-small" aria-hidden="true">✦</div><div class="bubble typing" aria-label="Assistant is thinking"><span></span><span></span><span></span></div>';
  messagesEl.append(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return row;
}

function renderCurrentChat() {
  messagesEl.replaceChildren();
  if (activeChat.messages.length === 0) {
    const welcome = document.createElement("div");
    welcome.className = "welcome";
    welcome.id = "welcome";
    welcome.innerHTML = '<div class="welcome-mark" aria-hidden="true">✦</div><h1>Aditya\'s Assistant</h1><p>How can I help you today?</p>';
    messagesEl.append(welcome);
  } else {
    for (const message of activeChat.messages) renderMessage(message);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  renderHistory();
}

function persistActiveChat() {
  if (activeChat.messages.length === 0) return;
  activeChat.updatedAt = new Date().toISOString();
  if (!chats.some(chat => chat.id === activeChat.id)) chats.push(activeChat);
  saveChats();
  renderHistory();
}

function setActiveChat(chat) {
  activeChat = chat;
  renderCurrentChat();
  closeMobileSidebar();
}

function startNewChat() {
  if (isSending) return;
  persistActiveChat();
  activeChat = createChat();
  input.value = "";
  resizeInput();
  renderCurrentChat();
  input.focus();
  closeMobileSidebar();
}

function showNotice(message) {
  let notice = document.getElementById("appNotice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "appNotice";
    notice.className = "app-notice";
    notice.setAttribute("role", "status");
    document.body.append(notice);
  }
  notice.textContent = message;
  notice.classList.add("visible");
  clearTimeout(showNotice.timeout);
  showNotice.timeout = setTimeout(() => notice.classList.remove("visible"), 5000);
}

function closeMobileSidebar() {
  sidebar.classList.remove("mobile-open");
  document.body.classList.remove("drawer-open");
}

function openMobileSidebar() {
  sidebar.classList.add("mobile-open");
  document.body.classList.add("drawer-open");
}

function resizeInput() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
}

async function sendMessage(rawText) {
  const text = rawText.trim();
  if (!text || isSending) return;

  if (activeChat.messages.length === 0) {
    activeChat.title = titleFromMessage(text);
    activeChat.updatedAt = new Date().toISOString();
  }
  const chatForRequest = activeChat;
  chatForRequest.messages.push({ role: "user", content: text });
  persistActiveChat();
  if (activeChat.id === chatForRequest.id) {
    renderCurrentChat();
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  input.value = "";
  resizeInput();
  isSending = true;
  input.disabled = true;
  sendButton.disabled = true;
  const typingRow = activeChat.id === chatForRequest.id ? renderTypingRow() : null;
  const requestMessages = chatForRequest.messages.map(({ role, content }) => ({ role, content }));

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: requestMessages })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The request failed. Please try again.");

    chatForRequest.messages.push({ role: "assistant", content: data.reply });
    chatForRequest.updatedAt = new Date().toISOString();
    persistActiveChatFor(chatForRequest);
    if (activeChat.id === chatForRequest.id) {
      typingRow?.remove();
      renderCurrentChat();
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  } catch (error) {
    console.error("Chat request failed:", error);
    typingRow?.remove();
    if (activeChat.id === chatForRequest.id) showNotice(error.message || "The assistant could not reply. Please try again.");
  } finally {
    isSending = false;
    input.disabled = false;
    sendButton.disabled = false;
    if (activeChat.messages.length === 0) input.focus();
  }
}

function persistActiveChatFor(chat) {
  chat.updatedAt = new Date().toISOString();
  if (!chats.some(savedChat => savedChat.id === chat.id)) chats.push(chat);
  saveChats();
  renderHistory();
}

function renameChat(chatId) {
  const chat = chats.find(item => item.id === chatId);
  if (!chat) return;
  pendingRenameId = chatId;
  renameInput.value = chat.title;
  renameDialog.showModal();
  renameInput.focus();
  renameInput.select();
}

function deleteChat(chatId) {
  const chat = chats.find(item => item.id === chatId);
  if (isSending && activeChat.id === chatId) {
    showNotice("Wait for the current response before deleting this conversation.");
    return;
  }
  if (!chat || !window.confirm(`Delete "${chat.title}"? This conversation will be removed from this browser.`)) return;

  chats = chats.filter(item => item.id !== chatId);
  saveChats();
  if (activeChat.id === chatId) activeChat = createChat();
  renderCurrentChat();
}

form.addEventListener("submit", event => {
  event.preventDefault();
  void sendMessage(input.value);
});

input.addEventListener("input", resizeInput);
input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.getElementById("newChat").addEventListener("click", startNewChat);
document.getElementById("sidebarToggle").addEventListener("click", () => {
  sidebar.classList.add("collapsed");
  document.querySelector(".app").classList.add("sidebar-collapsed");
});
document.getElementById("desktopMenu").addEventListener("click", () => {
  sidebar.classList.remove("collapsed");
  document.querySelector(".app").classList.remove("sidebar-collapsed");
});
document.getElementById("mobileMenu").addEventListener("click", openMobileSidebar);
document.getElementById("sidebarBackdrop").addEventListener("click", closeMobileSidebar);
document.getElementById("themeBtn").addEventListener("click", () => {
  document.body.classList.toggle("light");
  try {
    localStorage.setItem("aditya-ai-theme", document.body.classList.contains("light") ? "light" : "dark");
  } catch (error) {
    console.error("Could not save theme preference:", error);
  }
});

historyEl.addEventListener("click", event => {
  const actionButton = event.target.closest("button[data-action]");
  if (!actionButton) return;
  const item = actionButton.closest(".history-entry");
  const chat = chats.find(savedChat => savedChat.id === item?.dataset.chatId);
  if (!chat) return;

  if (actionButton.dataset.action === "open") {
    setActiveChat(chat);
    return;
  }

  if (actionButton.dataset.action === "menu") {
    document.querySelectorAll(".chat-options").forEach(menu => menu.remove());
    const menu = document.createElement("div");
    menu.className = "chat-options";
    menu.setAttribute("role", "menu");
    for (const [action, label] of [["rename", "Rename"], ["delete", "Delete"]]) {
      const option = document.createElement("button");
      option.type = "button";
      option.dataset.chatAction = action;
      option.setAttribute("role", "menuitem");
      option.textContent = label;
      menu.append(option);
    }
    item.append(menu);
    menu.querySelector('[data-chat-action="rename"]').focus();
  }
});

historyEl.addEventListener("click", event => {
  const option = event.target.closest("button[data-chat-action]");
  if (!option) return;
  const item = option.closest(".history-entry");
  const chatId = item?.dataset.chatId;
  item?.querySelector(".chat-options")?.remove();
  if (option.dataset.chatAction === "rename") renameChat(chatId);
  if (option.dataset.chatAction === "delete") deleteChat(chatId);
});

document.addEventListener("click", event => {
  if (!event.target.closest(".history-entry")) {
    document.querySelectorAll(".chat-options").forEach(menu => menu.remove());
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeMobileSidebar();
    document.querySelectorAll(".chat-options").forEach(menu => menu.remove());
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    startNewChat();
  }
});

renameForm.addEventListener("submit", event => {
  if (event.submitter?.value !== "save") {
    pendingRenameId = null;
    return;
  }
  event.preventDefault();
  const title = renameInput.value.trim();
  const chat = chats.find(item => item.id === pendingRenameId);
  if (!title || !chat) return;

  chat.title = title;
  chat.updatedAt = new Date().toISOString();
  saveChats();
  pendingRenameId = null;
  renameDialog.close();
  renderHistory();
});

renameDialog.addEventListener("close", () => {
  pendingRenameId = null;
});

try {
  if (localStorage.getItem("aditya-ai-theme") === "light") document.body.classList.add("light");
} catch (error) {
  console.error("Could not load theme preference:", error);
}

renderCurrentChat();
resizeInput();
