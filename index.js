const input = document.getElementById("input");
const send = document.getElementById("send");
input.addEventListener("input", event => {
	const text = input.textContent.trim();
	const isEmpty = (text === "" || text == "\n");
	send.disabled = isEmpty;
	input.classList.toggle("empty", isEmpty)
});