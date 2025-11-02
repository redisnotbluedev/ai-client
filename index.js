const input = document.getElementById("input");
const send = document.getElementById("send");
const messages = document.getElementById("messages");
const chatList = document.getElementById("chatList");

const API_KEY = localStorage.getItem("API_KEY");

let messageList = [];
let currentChatId;
let isPendingChat = true;

input.addEventListener("input", (e) => {
	const text = input.textContent.trim();
	const isEmpty = (text === "" || text == "\n");
	send.disabled = isEmpty;
	input.classList.toggle("empty", isEmpty)
});
input.addEventListener("keydown", (e) => {
	const text = input.innerText.trim();
	if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !(text === "" || text == "\n")) {
		e.preventDefault();
		sendMessage(text);
		input.textContent = "";
		send.disabled = true;
		input.classList.add("empty");
	}
});

marked.setOptions({
	highlight: function(code, lang) {
		if (Prism.languages[lang]) {
			return Prism.highlight(code, Prism.languages[lang], lang);
		}
		return code;
	}
});
Prism.plugins.autoloader.languages_path = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/';

function format(text) {
	const html = marked.parse(text);
	const withCopyButtons = html.replace(
		/<pre><code(.*?)>([\s\S]*?)<\/code><\/pre>/g,
		(match, attrs, code) => {
			const decodedCode = code
				.replace(/&lt;/g, '<')
				.replace(/&gt;/g, '>')
				.replace(/&amp;/g, '&')
				.replace(/&quot;/g, '"');
			return `
				<div class="code-block">
					<button class="copy-btn" onclick="
						navigator.clipboard.writeText(this.dataset.code);
						this.textContent='Copied!';
						setTimeout(()=>this.textContent='Copy',2000);
					" data-code="${decodedCode.replace(/"/g, '&quot;')}">Copy</button>
					<pre><code${attrs}>${code}</code></pre>
				</div>
			`;
		}
	);
	return DOMPurify.sanitize(withCopyButtons, {ADD_ATTR: ['onclick', 'data-code']});
}

function initializeApp() {
	let chats = JSON.parse(localStorage.getItem("chats") || "{}");
	let lastChatId = localStorage.getItem("currentChatId");
	
	if (lastChatId && chats[lastChatId]) {
		switchChat(lastChatId);
		isPendingChat = false;
	} else {
		// Start with blank pending chat
		messageList = [];
		currentChatId = null;
		isPendingChat = true;
	}
	
	renderChatList();
}

function switchChat(chatId) {
	if (currentChatId) {
		saveCurrentChat();
	}
	
	const chats = JSON.parse(localStorage.getItem("chats") || "{}");
	const chat = chats[chatId];
	
	if (chat) {
		currentChatId = chatId;
		messageList = chat.messages;
		renderMessages();
		renderChatList();
	}
}

function renderMessages() {
	const messagesContainer = document.querySelector(".messages");
	messagesContainer.innerHTML = ""; // Clear existing
	
	messageList.forEach(msg => {
		const messageDiv = document.createElement("div");
		messageDiv.className = `message ${msg.role}`;
		messageDiv.innerHTML = `
			${msg.role === "user" ? `<div class="message-header">
				<div class="avatar">U</div>
			</div>` : ""}
			<div class="message-content">${format(msg.content)}</div>
		`;
		messagesContainer.appendChild(messageDiv);
	});
	
	messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function saveCurrentChat() {
	if (!currentChatId) return; // Guard clause
	
	const chats = JSON.parse(localStorage.getItem("chats") || "{}");
	
	if (!chats[currentChatId]) {
		console.error(`Chat ${currentChatId} doesn't exist!`);
		return;
	}
	
	chats[currentChatId].messages = messageList;
	localStorage.setItem("chats", JSON.stringify(chats));
}

async function sendMessage(text) {
	messageList.push({role: "user", content: text});
	if (isPendingChat) {
		const newId = `chat-${Date.now()}`;
		const chats = JSON.parse(localStorage.getItem("chats") || "{}");
		chats[newId] = {
			id: newId,
			title: await generateTitle(messageList),
			created: Date.now(),
			lastUsed: Date.now(), // Add this
			messages: []
		};
		localStorage.setItem("chats", JSON.stringify(chats));
		currentChatId = newId;
		isPendingChat = false;
		localStorage.setItem("currentChatId", newId);
		renderChatList();
	}
	
	messages.innerHTML += `
		<div class="message user">
			<div class="message-header">
				<div class="avatar">U</div>
			</div>
			<div class="message-content">${format(text)}</div>
		</div>
	`;

	const assistantMsg = document.createElement("div");
	assistantMsg.className = "message assistant";
	assistantMsg.innerHTML = `<div class="message-content"><div class="thinking">Thinking...</div></div>`;
	messages.appendChild(assistantMsg);
	const contentDiv = assistantMsg.querySelector(".message-content");

	messages.scrollTop = messages.scrollHeight;

	const response = await fetch("https://api.mapleai.de/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${API_KEY}`
		},
		body: JSON.stringify({
			model: "claude-4.5-sonnet",
			messages: messageList,
			stream: true
		})
	});

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let firstChunk = true;
	let message = "";

	while (true) {
		const {done, value} = await reader.read();
		if (done) break;

		const chunk = decoder.decode(value);
		const lines = chunk.split("\n").filter(line => line.trim() !== "");

		for (const line of lines) {
			if (line.startsWith("data: ")) {
				const data = line.slice(6);
				if (data === "[DONE]") break;

				try {
					const parsed = JSON.parse(data);
					const content = parsed.choices[0]?.delta?.content || "";
					if (content && firstChunk) {
						contentDiv.innerHTML = "";
						firstChunk = false;
					}
					message += content;
					contentDiv.innerHTML = format(message);
					messages.scrollTop = messages.scrollHeight;
				} catch (e) {}
			}
		}
	}
	
	messageList.push({role: "assistant", content: message});
	saveCurrentChat();
	renameChat(currentChatId, await generateTitle(messageList))
	
	const chats = JSON.parse(localStorage.getItem("chats") || "{}");
	if (chats[currentChatId]) {
		chats[currentChatId].lastUsed = Date.now();
		chats[currentChatId].messages = messageList;
		localStorage.setItem("chats", JSON.stringify(chats));
		renderChatList();
	}
}

function createNewChat() {
	if (currentChatId && !isPendingChat) {
		saveCurrentChat();
	}
	
	messageList = [];
	currentChatId = null;
	isPendingChat = true;
	renderMessages();
	renderChatList();
}

function renderChatList() {
	chatList.innerHTML = "";
	const chats = JSON.parse(localStorage.getItem("chats") || "{}");
	
	// Categorize chats by calendar date (using lastUsed instead of created)
	const now = new Date();
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	const yesterdayStart = todayStart - (24 * 60 * 60 * 1000);
	const last7daysStart = todayStart - (7 * 24 * 60 * 60 * 1000);

	const categories = {
		today: [],
		yesterday: [],
		last7days: [],
		older: []
	};

	Object.values(chats).forEach(chat => {
		const lastUsed = chat.lastUsed || chat.created;
		
		if (lastUsed >= todayStart) {
			categories.today.push(chat);
		} else if (lastUsed >= yesterdayStart) {
			categories.yesterday.push(chat);
		} else if (lastUsed >= last7daysStart) {
			categories.last7days.push(chat);
		} else {
			categories.older.push(chat);
		}
	});

	Object.keys(categories).forEach(key => {
		categories[key].sort((a, b) => {
			const aTime = a.lastUsed || a.created;
			const bTime = b.lastUsed || b.created;
			return bTime - aTime; // Descending order (newest first)
		});
	});
	
	// Render each category
	if (categories.today.length > 0) {
		const separator = document.createElement("p");
		separator.className = "separator";
		separator.textContent = "Today";
		chatList.appendChild(separator);
		categories.today.forEach(chat => renderChatItem(chat));
	}
	if (categories.yesterday.length > 0) {
		const separator = document.createElement("p");
		separator.className = "separator";
		separator.textContent = "Yesterday";
		chatList.appendChild(separator);
		categories.yesterday.forEach(chat => renderChatItem(chat));
	}
	if (categories.last7days.length > 0) {
		const separator = document.createElement("p");
		separator.className = "separator";
		separator.textContent = "Last 7 days";
		chatList.appendChild(separator);
		categories.yesterday.forEach(chat => renderChatItem(chat));
	}
	if (categories.older.length > 0) {
		const separator = document.createElement("p");
		separator.className = "separator";
		separator.textContent = "Older";
		chatList.appendChild(separator);
		categories.yesterday.forEach(chat => renderChatItem(chat));
	}
}

function renderChatItem(chat) {
    const container = document.createElement("div");
    container.className = "chat-item-container";
    const button = document.createElement("button");
    button.className = "chat-item flat";
    
    // Add active class if this is the current chat
    if (chat.id === currentChatId) {
        button.classList.add("active");
    }
    
    button.textContent = chat.title;
    button.addEventListener("click", () => switchChat(chat.id));
    const menu = document.createElement("button");
    menu.className = "chat-options";
    menu.innerHTML = "⋮";
    menu.addEventListener("click", (e) => {
        e.stopPropagation();
        showChatOptions(chat.id, e);
    });
    container.appendChild(button);
    container.appendChild(menu);
    chatList.appendChild(container);
}

function showChatOptions(chatId, event) {
	// Create dropdown menu
	const menu = document.createElement("div");
	menu.className = "options-dropdown";
	menu.innerHTML = `
		<button onclick="renameChat('${chatId}', prompt('New name: '))">Rename</button>
		<button onclick="deleteChat('${chatId}')">Delete</button>
	`;
	
	menu.style.position = "absolute";
	menu.style.top = `${event.clientY}px`;
	menu.style.left = `${event.clientX}px`;
	
	document.body.appendChild(menu);
	
	setTimeout(() => {
		document.addEventListener("click", () => menu.remove(), {once: true});
	}, 0);
}

function renameChat(chatId, text) {
	let chats = JSON.parse(localStorage.getItem("chats") || "{}");
	chats[chatId].title = text;
	localStorage.setItem("chats", JSON.stringify(chats));
	renderChatList();
}

function deleteChat(chatId) {
	if (confirm("Are you sure you would like to delete this chat?")) {
		let chats = JSON.parse(localStorage.getItem("chats") || "{}");
		delete chats[chatId];
		localStorage.setItem("chats", JSON.stringify(chats));
		renderChatList();
	}
}

async function generateTitle(messages) {
	const titlePrompt = `Generate a concise, descriptive title for this conversation based on the following messages. The title should:
- Be 3-8 words maximum
- Capture the main topic or intent
- Use sentence case (capitalize first word only, unless proper nouns)
- Avoid generic phrases like "Help with" or "Question about"
- Be specific and informative

Examples:
User: "How do I sort an array in JavaScript?"
Title: "Sorting arrays in JavaScript"

User: "I'm building a chat app but hitting rate limits"
Title: "Chat app rate limit solutions"

User: "Can you explain how photosynthesis works?"
Title: "Photosynthesis explanation"

Respond with ONLY the title, no explanation or punctuation.`;
	messages.unshift(titlePrompt);
	const resp = await fetch("https://api.mapleai.de/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${API_KEY}`
		},
		body: JSON.stringify({
			model: "gpt-5",
			messages: messages
		})
	});
	const json = await resp.json();
	return json.choices[0].message.content;
}

initializeApp();