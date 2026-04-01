// =====================
// STATE
// =====================
var chatHistory = [];
var currentChatId = null;
var currentUser = null;

// =====================
// THEME
// =====================
function toggleTheme() {
  var body = document.body;
  var btn = document.getElementById("theme-toggle");
  if (body.classList.contains("light")) {
    body.classList.remove("light");
    btn.textContent = "🌙";
    localStorage.setItem("theme", "dark");
  } else {
    body.classList.add("light");
    btn.textContent = "☀️";
    localStorage.setItem("theme", "light");
  }
}

function loadTheme() {
  var savedTheme = localStorage.getItem("theme");
  var btn = document.getElementById("theme-toggle");
  if (savedTheme === "light") {
    document.body.classList.add("light");
    if (btn) btn.textContent = "☀️";
  } else {
    if (btn) btn.textContent = "🌙";
  }
}

// =====================
// AUTH
// =====================
function checkAuth() {
  firebase.auth().onAuthStateChanged(function(user) {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    currentUser = user;
    console.log("Logged in as:", user.displayName, user.email);

    var avatar = document.getElementById("user-avatar");
    if (avatar) {
      avatar.src = user.photoURL
        ? user.photoURL
        : "https://ui-avatars.com/api/?name=" + encodeURIComponent(user.displayName || "User") + "&background=6c63ff&color=fff";
      avatar.onerror = function() {
        avatar.src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(user.displayName || "User") + "&background=6c63ff&color=fff";
      };
    }

    var nameEl = document.getElementById("user-name");
    if (nameEl) nameEl.textContent = user.displayName || "User";

    var emailEl = document.getElementById("user-email");
    if (emailEl) emailEl.textContent = user.email || "";

    newChat();
    loadSidebar();
  });
}

function logoutUser() {
  if (confirm("Are you sure you want to sign out?")) {
    firebase.auth().signOut().then(function() {
      window.location.href = "login.html";
    });
  }
}

// =====================
// BACKEND URL
// =====================
var BACKEND_URL = "https://veda-ai-backend-69j6.onrender.com";

// =====================
// CHAT STORAGE
// =====================
async function saveChatToStorage(smartTitle) {
  if (!currentChatId || chatHistory.length === 0 || !currentUser) return;
  var title = smartTitle || getChatTitle();
  db.collection("users").doc(currentUser.uid).collection("chats").doc(currentChatId).set({
    id: currentChatId,
    title: title,
    messages: chatHistory,
    timestamp: Date.now()
  }).then(function() {
    console.log("Chat saved to Firebase!");
    loadSidebar();
  }).catch(function(error) {
    console.error("Error saving:", error);
  });
}

function getChatTitle() {
  for (var i = 0; i < chatHistory.length; i++) {
    if (chatHistory[i].role === "user") {
      var title = chatHistory[i].content;
      return title.length > 30 ? title.substring(0, 30) + "..." : title;
    }
  }
  return "New Chat";
}

async function generateSmartTitle(message) {
  try {
    var response = await fetch(BACKEND_URL + "/generate-title", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message })
    });
    var data = await response.json();
    console.log("Generated title:", data.title);
    return data.title || "New Chat";
  } catch(e) {
    console.error("Title generation failed:", e);
    return getChatTitle();
  }
}

function generateChatId() {
  return "chat_" + Date.now();
}

// =====================
// SIDEBAR
// =====================
function loadSidebar() {
  if (!currentUser) return;
  var historyList = document.getElementById("history-list");
  historyList.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 4px;">Loading...</div>';

  db.collection("users").doc(currentUser.uid).collection("chats")
    .orderBy("timestamp", "desc")
    .get()
    .then(function(snapshot) {
      historyList.innerHTML = "";
      if (snapshot.empty) {
        historyList.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 4px;">No chats yet</div>';
        return;
      }
      snapshot.forEach(function(doc) {
        var chat = doc.data();
        var item = document.createElement("div");
        item.className = "history-item" + (chat.id === currentChatId ? " active" : "");
        item.dataset.chatId = chat.id;
        item.innerHTML =
          '<span class="history-item-title">💬 ' + chat.title + '</span>' +
          '<div class="history-actions">' +
          '<button class="history-action-btn rename" onclick="renameChat(event,\'' + chat.id + '\',\'' + chat.title.replace(/'/g, "\\'") + '\')" title="Rename">✏️</button>' +
          '<button class="history-action-btn delete" onclick="deleteChat(event,\'' + chat.id + '\')" title="Delete">🗑️</button>' +
          '</div>';
        item.addEventListener("click", function(e) {
          if (e.target.closest(".history-actions")) return;
          loadChat(chat.id);
        });
        historyList.appendChild(item);
      });
    })
    .catch(function(error) {
      console.error("Error loading:", error);
      historyList.innerHTML = '<div style="font-size:12px;color:#ff6b6b;padding:8px 4px;">Error loading chats</div>';
    });
}

function loadChat(chatId) {
  if (!currentUser) return;
  db.collection("users").doc(currentUser.uid).collection("chats").doc(chatId).get()
    .then(function(doc) {
      if (!doc.exists) return;
      var chat = doc.data();
      currentChatId = chatId;
      chatHistory = chat.messages;
      var messagesEl = document.getElementById("messages");
      messagesEl.innerHTML = "";
      chat.messages.forEach(function(msg) {
        var div = document.createElement("div");
        div.className = "message " + (msg.role === "user" ? "user" : "ai");
        var emoji = msg.role === "user" ? "🧑" : "🤖";
        var content = msg.role === "user" ? msg.content : formatReply(msg.content);
        div.innerHTML = '<div class="avatar">' + emoji + '</div><div class="bubble">' + content + '</div>';
        messagesEl.appendChild(div);
      });
      messagesEl.scrollTop = messagesEl.scrollHeight;
      loadSidebar();
    })
    .catch(function(error) {
      console.error("Error loading chat:", error);
    });
}

function deleteChat(event, chatId) {
  if (!currentUser) return;
  event.stopPropagation();
  db.collection("users").doc(currentUser.uid).collection("chats").doc(chatId).delete()
    .then(function() {
      if (chatId === currentChatId) {
        newChat();
      } else {
        loadSidebar();
      }
    })
    .catch(function(error) {
      console.error("Error deleting:", error);
    });
}

function renameChat(event, chatId, currentTitle) {
  event.stopPropagation();
  var item = document.querySelector('[data-chat-id="' + chatId + '"]');
  if (!item) return;
  var titleSpan = item.querySelector(".history-item-title");
  var actionsDiv = item.querySelector(".history-actions");
  var input = document.createElement("input");
  input.type = "text";
  input.className = "rename-input";
  input.value = currentTitle.replace("💬 ", "");
  titleSpan.replaceWith(input);
  actionsDiv.style.display = "none";
  input.focus();
  input.select();
  input.addEventListener("keydown", function(e) {
    if (e.key === "Enter") saveRename(chatId, input.value.trim());
    if (e.key === "Escape") loadSidebar();
  });
  input.addEventListener("blur", function() {
    saveRename(chatId, input.value.trim());
  });
}

function saveRename(chatId, newTitle) {
  if (!newTitle || !currentUser) { loadSidebar(); return; }
  db.collection("users").doc(currentUser.uid).collection("chats").doc(chatId).update({
    title: newTitle
  }).then(function() {
    loadSidebar();
  }).catch(function(error) {
    console.error("Rename error:", error);
    loadSidebar();
  });
}

function clearAllChats() {
  if (!currentUser) return;
  if (confirm("Are you sure you want to delete all chats?")) {
    db.collection("users").doc(currentUser.uid).collection("chats").get()
      .then(function(snapshot) {
        var batch = db.batch();
        snapshot.forEach(function(doc) { batch.delete(doc.ref); });
        return batch.commit();
      })
      .then(function() { newChat(); })
      .catch(function(error) { console.error("Error clearing:", error); });
  }
}

// =====================
// NEW CHAT
// =====================
function newChat() {
  chatHistory = [];
  currentChatId = generateChatId();
  document.getElementById("messages").innerHTML =
    '<div class="welcome">' +
    '<h2>Hey! I am Veda, your AI Assistant 🌟</h2>' +
    '<p>Ask me anything — I am here to help!</p>' +
    '</div>';
  if (currentUser) loadSidebar();
}

// =====================
// KEYBOARD & RESIZE
// =====================
function handleKey(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 150) + "px";
}

// =====================
// COPY CODE
// =====================
function copyCode(btn) {
  var codeEl = btn.closest(".code-block").querySelector("code");
  var text = codeEl.innerText;
  navigator.clipboard.writeText(text).then(function() {
    btn.textContent = "✅ Copied!";
    btn.style.background = "#1a3a1a";
    btn.style.color = "#4caf50";
    btn.style.border = "1px solid #4caf50";
    btn.disabled = true;
    setTimeout(function() {
      btn.textContent = "📋 Copy";
      btn.style.background = "#2a2a2a";
      btn.style.color = "#aaa";
      btn.style.border = "none";
      btn.disabled = false;
    }, 2500);
  }).catch(function() {
    btn.textContent = "❌ Failed";
    setTimeout(function() { btn.textContent = "📋 Copy"; }, 2000);
  });
}

// =====================
// FORMAT REPLY
// =====================
function formatReply(text) {
  var codeBlocks = [];
  text = text.replace(/```(\w+)?\n?([\s\S]*?)```/g, function(match, lang, code) {
    var language = lang || "code";
    var escapedCode = code.trim()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    var html =
      '<div class="code-block">' +
      '<div class="code-header">' +
      '<span class="code-lang">' + language + '</span>' +
      '<button class="copy-btn" onclick="copyCode(this)">📋 Copy</button>' +
      '</div>' +
      '<pre><code>' + escapedCode + '</code></pre>' +
      '</div>';
    codeBlocks.push(html);
    return "%%CODEBLOCK_" + (codeBlocks.length - 1) + "%%";
  });
  text = text.replace(/`(.*?)`/g, "<code class='inline-code'>$1</code>");
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");
  text = text.replace(/^### (.+)/gm, "<h3>$1</h3>");
  text = text.replace(/^## (.+)/gm, "<h2>$1</h2>");
  text = text.replace(/^\d+\.\s(.+)/gm, "<li>$1</li>");
  text = text.replace(/^[•\-\*]\s(.+)/gm, "<li>$1</li>");
  text = text.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");
  text = text.replace(/<\/ul>\s*<ul>/g, "");
  text = text.replace(/\n{2,}/g, "<div class='spacer'></div>");
  text = text.replace(/\n/g, "<br>");
  codeBlocks.forEach(function(block, i) {
    text = text.replace("%%CODEBLOCK_" + i + "%%", block);
  });
  return text;
}

// =====================
// ADD MESSAGE
// =====================
function addMessage(role, text) {
  var welcome = document.querySelector(".welcome");
  if (welcome) welcome.remove();
  var messages = document.getElementById("messages");
  var div = document.createElement("div");
  div.className = "message " + role;
  var emoji = role === "user" ? "🧑" : "🤖";
  var formattedText = role === "ai" ? formatReply(text) : text;
  div.innerHTML =
    '<div class="avatar">' + emoji + '</div>' +
    '<div class="bubble">' + formattedText + '</div>';
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function showTyping() {
  var messages = document.getElementById("messages");
  var div = document.createElement("div");
  div.className = "message ai typing";
  div.id = "typing-indicator";
  div.innerHTML =
    '<div class="avatar">🤖</div>' +
    '<div class="bubble">' +
    '<div class="dot"></div>' +
    '<div class="dot"></div>' +
    '<div class="dot"></div>' +
    '</div>';
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function removeTyping() {
  var el = document.getElementById("typing-indicator");
  if (el) el.remove();
}

// =====================
// SEND MESSAGE
// =====================
async function sendMessage() {
  var input = document.getElementById("user-input");
  var sendBtn = document.getElementById("send-btn");
  var userMessage = input.value.trim();

  if (!userMessage) return;

  input.value = "";
  input.style.height = "auto";
  sendBtn.disabled = true;

  addMessage("user", userMessage);
  chatHistory.push({ role: "user", content: userMessage });

  showTyping();

  try {
    var response = await fetch(BACKEND_URL + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userMessage,
        history: chatHistory.slice(-10)
      })
    });

    removeTyping();

    var welcome = document.querySelector(".welcome");
    if (welcome) welcome.remove();

    var messages = document.getElementById("messages");
    var div = document.createElement("div");
    div.className = "message ai";
    div.innerHTML =
      '<div class="avatar">🤖</div>' +
      '<div class="bubble" id="streaming-bubble"><span class="cursor"></span></div>';
    messages.appendChild(div);

    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var fullText = "";
    var savedSourcesBox = null;

    while (true) {
      var result = await reader.read();
      if (result.done) break;

      var chunk = decoder.decode(result.value);
      var lines = chunk.split("\n");

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.startsWith("data: ")) {
          try {
            var jsonData = JSON.parse(line.slice(6));

            if (jsonData.searching) {
              var bubble = document.getElementById("streaming-bubble");
              if (bubble) {
                bubble.innerHTML = '<span style="color:#6c63ff;font-size:13px;">🔍 Searching the web for latest information...</span>';
              }
            }
            else if (jsonData.sources) {
              var sourcesHtml = '<div class="sources-box"><div class="sources-title">🌐 Sources</div>';
              jsonData.sources.forEach(function(source) {
                sourcesHtml += '<a href="' + source.url + '" target="_blank" class="source-link">🔗 ' + source.title + '</a>';
              });
              sourcesHtml += '</div>';
              savedSourcesBox = sourcesHtml;
            }
            else if (jsonData.done) {
              var bubble = document.getElementById("streaming-bubble");
              if (bubble) {
                bubble.id = "";
                bubble.style.whiteSpace = "";
                bubble.innerHTML = formatReply(fullText);
                if (savedSourcesBox) {
                  bubble.innerHTML += savedSourcesBox;
                }
              }
            }
            else if (jsonData.token) {
              fullText += jsonData.token;
              var bubble = document.getElementById("streaming-bubble");
              if (bubble) {
                bubble.innerText = fullText;
                bubble.style.whiteSpace = "pre-wrap";
                messages.scrollTop = messages.scrollHeight;
              }
            }
          } catch(e) {}
        }
      }
    }

    chatHistory.push({ role: "assistant", content: fullText });

    var userMessages = chatHistory.filter(function(m) { return m.role === "user"; });
    if (userMessages.length === 1) {
      generateSmartTitle(userMessages[0].content).then(function(smartTitle) {
        saveChatToStorage(smartTitle);
      });
    } else {
      saveChatToStorage();
    }

  } catch(error) {
    removeTyping();
    addMessage("ai", "⚠️ Sorry, something went wrong. Make sure your backend server is running!");
  }

  sendBtn.disabled = false;
  input.focus();
}

// =====================
// ON PAGE LOAD
// =====================
window.onload = function() {
  loadTheme();
  checkAuth();
}