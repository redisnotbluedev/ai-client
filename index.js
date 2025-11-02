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
			<div class="message-content">${msg.content}</div>
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
	if (isPendingChat) {
		const newId = `chat-${Date.now()}`;
		const chats = JSON.parse(localStorage.getItem("chats") || "{}");
		chats[newId] = {
			id: newId,
			title: text.slice(0, 50),
			created: Date.now(),
			messages: []
		};
		localStorage.setItem("chats", JSON.stringify(chats));
		currentChatId = newId;
		isPendingChat = false;
		localStorage.setItem("currentChatId", newId);
		renderChatList();
	}
	
	messageList.push({role: "user", content: text});
	messages.innerHTML += `
		<div class="message user">
			<div class="message-header">
				<div class="avatar">U</div>
			</div>
			<div class="message-content">${text}</div>
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
			model: "gpt-5",
			messages: messageList,
			stream: true
		})
	});

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let firstChunk = true;

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
					contentDiv.textContent += content;
					messages.scrollTop = messages.scrollHeight;
				} catch (e) {}
			}
		}
	}
	
	messageList.push({role: "assistant", content: contentDiv.textContent});
	saveCurrentChat();
}

function createNewChat() {
	if (currentChatId && !isPendingChat) {
		saveCurrentChat();
	}
	
	messageList = [];
	currentChatId = null;
	isPendingChat = true;
	renderMessages();
}

function renderChatList() {
	chatList.innerHTML = `<p class="seperator">Today</p>`;
	const chats = JSON.parse(localStorage.getItem("chats") || "{}");
	
	Object.keys(chats).forEach(chatId => {
		const container = document.createElement("div");
		container.className = "chat-item-container";
		
		const button = document.createElement("button");
		button.className = "chat-item flat";
		button.textContent = chats[chatId].title;
		button.addEventListener("click", () => switchChat(chatId));
		
		const menu = document.createElement("button");
		menu.className = "chat-options";
		menu.innerHTML = "⋮";
		menu.addEventListener("click", (e) => {
			e.stopPropagation();
			showChatOptions(chatId, e);
		});
		
		container.appendChild(button);
		container.appendChild(menu);
		chatList.appendChild(container);
	});
}

function showChatOptions(chatId, event) {
	// Create dropdown menu
	const menu = document.createElement("div");
	menu.className = "options-dropdown";
	menu.innerHTML = `
		<button onclick="renameChat('${chatId}')">Rename</button>
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

function renameChat(chatId) {
	let chats = JSON.parse(localStorage.getItem("chats") || "{}");
	chats[chatId].title = prompt("New title: ");
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

initializeApp();