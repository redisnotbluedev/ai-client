(async () => {
	const title = document.getElementById("title");
	const text = document.getElementById("text");
	const buttons = document.getElementById("buttons");	

	let data;
	try {
		data = await fetch("english.json").then(response => response.json());
	} catch (error) {
		alert(`Error: Failed to fetch game data: ${error.message}`);
		throw error;
	}

	window.navigateTo = function(nodeName) {
		let node = data[nodeName];

		if (!node) {
			alert(`Error: scene ${nodeName} not found!`)
		}

		title.innerText = node.title;
		text.innerHTML = node.text;
		buttons.innerHTML = "";

		node.choices.forEach(choice => {
			let button = document.createElement("button");
			button.innerText = choice.text;
			button.setAttribute("onclick", `navigateTo('${choice.next}')`);
			buttons.appendChild(button);
		});
	}
	navigateTo("start")
})();