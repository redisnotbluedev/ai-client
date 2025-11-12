import os
from flask import Flask, request, send_from_directory, render_template
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = "uploads"

def allowed_file(filename):
	return "." in filename

@app.route("/upload", methods=["POST"])
def upload_file():
	if "file" not in request.files:
		return "No file part", 400
	file = request.files["file"]
	if file.filename == "":
		return "No selected file", 400
	
	if file and allowed_file(file.filename):
		filename = secure_filename(file.filename)
		path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
		file.save(path)
		# Just MITM it for now
		return {"path": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg"}, 201
		return {"path": f"/uploads/{filename}"}, 201
	
	return "Invalid request", 400

@app.route("/uploads/<filename>")
def uploaded_file(filename):
	return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

@app.route("/")
def home():
	return render_template("index.html")

if __name__ == "__main__":
	os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
	app.run(debug=True, port=8000)