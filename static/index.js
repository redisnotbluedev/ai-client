const input = document.getElementById("input");
const send = document.getElementById("send");
const messages = document.getElementById("messages");
const chatList = document.getElementById("chatList");
const upload = document.getElementById("uploadButton");
const fileInput = document.getElementById("fileInput");
const attachments = document.getElementById("attachments")

const API_KEY = localStorage.getItem("API_KEY");

let messageList = [];
let currentChatId;
let isPendingChat = true;
let attachmentsList = [];

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
	messages.innerHTML = ""; // Clear existing
	
	messageList.forEach(msg => {
		const messageDiv = document.createElement("div");
		messageDiv.className = `message ${msg.role}`;
		messageDiv.innerHTML = `
			${msg.role === "user" ? `<div class="message-header">
				<div class="avatar">U</div>
			</div>` : ""}
			<div class="message-content">${format(msg.content)}</div>
		`;
		messages.appendChild(messageDiv);
	});
	
	messages.scrollTop = messages.scrollHeight;
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
	let isNew = false;
	let messageDict = {role: "user", content: [
		{type: "text", text: text}
	]};
	attachments.forEach(item => {
		if (item.type.startsWith("image/")) {
			messageDict.content.push({
				type: "image_url",
				image_url: {url: item.path}
			});
		} else {
			// attachment not supported
		}
	});
	messageList.push(messageDict);

	if (isPendingChat) {
		const newId = `chat-${Date.now()}`;
		const chats = JSON.parse(localStorage.getItem("chats") || "{}");
		chats[newId] = {
			id: newId,
			title: "Untitled chat", // Temporary placeholder
			created: Date.now(),
			lastUsed: Date.now(),
			messages: []
		};
		localStorage.setItem("chats", JSON.stringify(chats));
		currentChatId = newId;
		isPendingChat = false;
		localStorage.setItem("currentChatId", newId);
		renderChatList();
		isNew = true;
	}
	
	const userMsg = document.createElement("div");
	userMsg.className = "message user";
	userMsg.innerHTML = `
			<div class="message-header">
				<div class="avatar">U</div>
			</div>
			<div class="message-content">${format(text)}</div>
	`;
	messages.appendChild(userMsg);

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
			model: "gpt-5-chat",
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
	if (isNew) {
		generateTitle(messageList).then(title => {
			renameChat(currentChatId, title);
		});
	}
	
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
		categories.last7days.forEach(chat => renderChatItem(chat));
	}
	if (categories.older.length > 0) {
		const separator = document.createElement("p");
		separator.className = "separator";
		separator.textContent = "Older";
		chatList.appendChild(separator);
		categories.older.forEach(chat => renderChatItem(chat));
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
	if (text.trim() == "") {return}
	console.log(chatId, text);
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
	const titlePrompt = `You are an assistant that summarizes chat conversations in 3-8 words as a chat title.

- Output ONLY the concise, descriptive title for the conversation, nothing else.
- Do NOT say "I'm not sure", do NOT ask for more information, do NOT explain your choice.
- The title should use title case (capitalize all words, unless minor).
- Avoid generic phrases like "Help with" or "Question about".
- Be specific and informative if possible.

Examples:
User: "How do I sort an array in JavaScript?"
Title: Sorting arrays in JavaScript

User: "hi"
Title: Greeting Exchange

User: "I'm building a chat app but hitting rate limits"
Title: Chat App Rate Limit Solutions

User: "Can you explain how photosynthesis works?"
Title: Photosynthesis Explanation

You MUST respond with ONLY the title, no explanation.
IMPORTANT: Never explain or comment. Only output the title. Anything else is wrong.`;
	const tmp = [{role: "system", content: titlePrompt}];
	messages.forEach(msg => {
		tmp.push({role: "user", content: msg.content});
	})
	const resp = await fetch("https://api.mapleai.de/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${API_KEY}`
		},
		body: JSON.stringify({
			model: "mixtral-8x7b-instruct", // dumb model
			messages: tmp
		})
	});
	const json = await resp.json();
	return json.choices[0].message.content;
}

upload.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
	const file = fileInput.files[0];
	if (!file) return;

	const formData = new FormData();
	formData.append("file", file);

	try {
		const response = await fetch("/upload", {
			method: "POST",
			body: formData,
		});

		if (!response.ok) throw new Error("Upload failed");
		const data = await response.json();
		console.log("File uploaded:", data);

		const link = data.path;
		const mime = file.type;

		if (!mime.startsWith("image/")) throw new Error(`File of type ${mime} is not supported.`)

		var elem = document.createElement("div");
		elem.className = "attachment";
		attachments.style.display = "block";
		attachments.appendChild(elem);
	
		var button = document.createElement("button");
		button.className = "close-button";
		button.innerHTML = `<img src="/static/icons/close.svg">`;
		button.addEventListener("click", event => {
			elem.remove();
			const idx = attachmentsList.indexOf(data);
			if (idx !== -1) {
				attachmentsList.splice(idx, 1);
				if (attachmentsList.length === 0) {
					attachments.style.display = "none";
				}
			}
		});
		elem.appendChild(button);
		
		// Use conditionally after you add more upload types
		var img = document.createElement("img");
		img.className = "thumbnail";
		img.src = link;
		elem.appendChild(img);
		
		data.type = mime;
		attachmentsList.push(data);
	} catch (err) {
		console.error(err);
	} finally {
		fileInput.value = "";
	}
});

initializeApp();