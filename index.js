const input = document.getElementById("input");
const send = document.getElementById("send");
const messages = document.getElementById("messages");
const API_KEY = localStorage.getItem("API_KEY");

let messageList = [];
let currentChatId = 0;

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
	const chats = JSON.parse(localStorage.getItem("chats") || "{}");
	chats[currentChatId].messages = messageList;
	localStorage.setItem("chats", JSON.stringify(chats));
}

async function sendMessage(text) {
	messages.innerHTML += `
		<div class="message user">
			<div class="message-header">
				<div class="avatar">U</div>
			</div>
			<div class="message-content">${text}</div>
		</div>
	`;
	messageList.push({role: "user", content: text});

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
	if (currentChatId) {
		saveCurrentChat();
	}

	const newId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

	// Create new chat object
	const chats = JSON.parse(localStorage.getItem("chats") || "{}");
	chats[newId] = {
		id: newId,
		title: "New Chat", // Auto-name from first message later
		created: Date.now(),
		messages: []
	};
	localStorage.setItem("chats", JSON.stringify(chats));
	
	// Switch to it
	switchChat(newId);
	
	// Update sidebar
	//renderChatList();
}