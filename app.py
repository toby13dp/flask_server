from flask import Flask, request, send_from_directory
import os
import layoutparser as lp
import fitz  # PyMuPDF
from werkzeug.utils import secure_filename

app = Flask(__name__)
UPLOAD_FOLDER = 'static'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@app.route('/')
def builder():
    return send_from_directory('static', 'builder.html')


@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)


@app.route('/convert', methods=['POST'])
def convert():
    if 'pdf' not in request.files:
        return "Geen bestand ontvangen", 400
    pdf_file = request.files['pdf']
    filename = secure_filename(pdf_file.filename)
    save_path = os.path.join(UPLOAD_FOLDER, filename)
    pdf_file.save(save_path)

    # Simpele layout parser (Dummy output voor demo)
    html_output_path = os.path.join(UPLOAD_FOLDER, filename.rsplit('.', 1)[0] + '.html')
    with fitz.open(save_path) as doc:
        text = ""
        for page in doc:
            blocks = page.get_text("dict")["blocks"]
            for b in blocks:
                if "lines" in b:
                    for line in b["lines"]:
                        for span in line["spans"]:
                            text += f"<p style='margin:0;padding:0'>{span['text']}</p>"

    with open(html_output_path, "w", encoding="utf-8") as f:
        f.write("<html><body>" + text + "</body></html>")

    with open(html_output_path, encoding="utf-8") as f:
        return f.read()


if __name__ == '__main__':
    app.run(debug=True)
