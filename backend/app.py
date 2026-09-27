from __future__ import annotations

import io
import logging
import threading
from pathlib import Path

import numpy as np
from flask import Flask, jsonify, request, send_file, send_from_directory
from PIL import Image, ImageOps, UnidentifiedImageError

try:
    import tensorflow as tf
except ImportError as error:
    tf = None
    TENSORFLOW_IMPORT_ERROR = error
else:
    TENSORFLOW_IMPORT_ERROR = None


ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT / "frontend"
MODEL_DIR = ROOT / "Zero-DCE" / "model_trained"
MAX_IMAGE_PIXELS = 12_000_000
MODEL_INPUT_SIZE = (512, 512)
model = None
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
    global model
    if model is not None:
        return model
    if tf is None:
        raise RuntimeError(
            "TensorFlow is not installed. Install backend/requirements.txt with Python 3.10 or 3.11."
        ) from TENSORFLOW_IMPORT_ERROR

    with model_lock:
        if model is None:
            if not MODEL_DIR.is_dir():
                raise RuntimeError(f"SavedModel directory not found: {MODEL_DIR}")
            model = tf.saved_model.load(str(MODEL_DIR))
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
        original_tensor = tf.convert_to_tensor(input_pixels[None, ...], dtype=tf.float32)
        tensor = tf.image.resize(original_tensor, MODEL_INPUT_SIZE)
        with inference_lock:
            serving = getattr(loaded_model, "signatures", {}).get("serving_default")
            outputs = serving(tensor) if serving is not None else loaded_model(tensor)
        if isinstance(outputs, (tuple, list)):
            enhanced = outputs[1] if len(outputs) > 1 else outputs[0]
        elif isinstance(outputs, dict):
            enhanced = outputs.get("enhanced_image", outputs.get("output_1", outputs.get("output_0")))
            if enhanced is None:
                raise RuntimeError(
                    f"The SavedModel did not return an enhanced image (outputs: {', '.join(outputs)})."
                )
        else:
            enhanced = outputs

        enhanced = tf.convert_to_tensor(enhanced, dtype=tf.float32)
        if len(enhanced.shape) == 4:
            enhanced = enhanced[0]
        if enhanced.shape[0] != height or enhanced.shape[1] != width:
            enhanced = tf.image.resize(enhanced, (height, width))
        blended = (1 - strength) * original_tensor[0] + strength * enhanced
        pixels = tf.cast(tf.round(tf.clip_by_value(blended, 0, 1) * 255), tf.uint8).numpy()
    except Exception as error:
        logger.exception("Zero-DCE inference failed")
        return jsonify(error=f"Zero-DCE could not enhance this image: {error}"), 500

    output = io.BytesIO()
    Image.fromarray(pixels, mode="RGB").save(output, format="PNG")
    output.seek(0)
    return send_file(output, mimetype="image/png", download_name="enhanced.png")


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
