const input = document.getElementById("input");
input.addEventListener("input", event => {
    const text = input.textContent.trim();
    input.disabled = (text === "" || text == "\n");
});