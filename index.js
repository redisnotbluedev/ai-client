const input = document.getElementById("input");
const send = document.getElementById("send");
input.addEventListener("input", event => {
	const text = input.textContent.trim();
	send.disabled = (text === "" || text == "\n");
});