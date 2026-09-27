from __future__ import annotations

import io
import logging
import os
import threading
from pathlib import Path

import numpy as np
from flask import Flask, jsonify, request, send_file, send_from_directory
from PIL import Image, ImageOps, UnidentifiedImageError
from ai_edge_litert.interpreter import Interpreter


ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT / "frontend"
MODEL_DIR = ROOT / "Zero-DCE" / "model_trained"
MAX_IMAGE_PIXELS = 12_000_000
MODEL_INPUT_SIZE = (512, 512)
model = None
model_input_index = None
model_output_index = None
model_lock = threading.Lock()
inference_lock = threading.Lock()
app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.errorhandler(413)
def request_too_large(_error):
    return jsonify(error="The upload is too large. Images must be 25 MB or smaller."), 413


def load_model():
    global model, model_input_index, model_output_index
    if model is not None:
        return model

    with model_lock:
        if model is None:
            model_path = MODEL_DIR / "model.tflite"
            if not model_path.is_file():
                raise RuntimeError(f"TFLite model not found: {model_path}")
            interpreter = Interpreter(model_path=str(model_path), num_threads=2)
            input_details = interpreter.get_input_details()
            output_details = interpreter.get_output_details()
            if len(input_details) != 1:
                raise RuntimeError(f"Expected one model input, found {len(input_details)}.")
            image_outputs = [
                detail for detail in output_details
                if detail["name"].endswith(":1")
            ]
            if len(image_outputs) != 1:
                raise RuntimeError(
                    "Could not locate the enhanced-image output (StatefulPartitionedCall:1)."
                )
            model_input_index = input_details[0]["index"]
            model_output_index = image_outputs[0]["index"]
            interpreter.resize_tensor_input(model_input_index, [1, *MODEL_INPUT_SIZE, 3])
            interpreter.allocate_tensors()
            model = interpreter
    return model


@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/<path:asset_path>")
def frontend_asset(asset_path):
    return send_from_directory(FRONTEND_DIR, asset_path)


@app.get("/api/health")
def health():
    try:
        load_model()
    except Exception as error:
        logger.warning("Zero-DCE model is unavailable: %s", error)
        return jsonify(ready=False, error=str(error)), 503
    return jsonify(ready=True, model="Zero-DCE")


@app.post("/api/enhance")
def enhance():
    uploaded = request.files.get("file")
    if uploaded is None or not uploaded.filename:
        return jsonify(error="Choose an image file to enhance."), 400

    try:
        strength = float(request.form.get("strength", "72")) / 100
    except ValueError:
        return jsonify(error="Enhancement strength must be a number from 0 to 100."), 400
    if not 0 <= strength <= 1:
        return jsonify(error="Enhancement strength must be between 0 and 100."), 400

    try:
        with Image.open(uploaded.stream) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
            width, height = image.size
            if width * height > MAX_IMAGE_PIXELS:
                return jsonify(error="Images must be 12 megapixels or smaller."), 413
            input_pixels = np.asarray(image, dtype=np.float32) / 255.0
    except (UnidentifiedImageError, OSError, ValueError):
        return jsonify(error="The uploaded file is not a supported image."), 400

    try:
        loaded_model = load_model()
        image_tensor = np.asarray(
            Image.fromarray(np.uint8(input_pixels * 255)).resize(
                (MODEL_INPUT_SIZE[1], MODEL_INPUT_SIZE[0]),
                Image.Resampling.BILINEAR,
            ),
            dtype=np.float32,
        ) / 255.0
        with inference_lock:
            loaded_model.set_tensor(model_input_index, image_tensor[None, ...])
            loaded_model.invoke()
            enhanced = loaded_model.get_tensor(model_output_index)[0]
        enhanced = np.asarray(
            Image.fromarray(
                np.uint8(np.clip(enhanced, 0, 1) * 255)
            ).resize((width, height), Image.Resampling.BILINEAR),
            dtype=np.float32,
        ) / 255.0
        blended = (1 - strength) * input_pixels + strength * enhanced
        pixels = np.uint8(np.round(np.clip(blended, 0, 1) * 255))
    except Exception as error:
        logger.exception("Zero-DCE inference failed")
        return jsonify(error=f"Zero-DCE could not enhance this image: {error}"), 500

    output = io.BytesIO()
    Image.fromarray(pixels, mode="RGB").save(output, format="PNG")
    output.seek(0)
    return send_file(output, mimetype="image/png", download_name="enhanced.png")


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5001")), debug=False)
