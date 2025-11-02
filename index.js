const input = document.getElementById("input");
const send = document.getElementById("send");
const messages = document.getElementById("messages");
const API_KEY = localStorage.getItem("API_KEY");
let messageList = [];

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
	assistantMsg.innerHTML = `<div class="message-content"></div>`;
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
					contentDiv.textContent += content;
					messages.scrollTop = messages.scrollHeight;
				} catch (e) {}
			}
		}
	}
	
	messageList.push({role: "assistant", content: contentDiv.textContent});
}