const dropzone = document.querySelector("#dropzone");
const fileInput = document.querySelector("#file-input");
const fileKind = document.querySelector("#file-kind");
const fileHint = document.querySelector("#file-hint");
const originalImage = document.querySelector("#original-image");
const enhancedLayer = document.querySelector("#enhanced-layer");
const comparison = document.querySelector("#comparison");
const comparisonHandle = document.querySelector("#comparison-handle");
const strength = document.querySelector("#strength");
const strengthValue = document.querySelector("#strength-value");
const downloadButton = document.querySelector("#download-button");
const toast = document.querySelector("#toast");
let selectedType = "image";
let objectUrl = null;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function setComparison(value) {
  const percentage = `${Math.max(4, Math.min(96, value))}%`;
  enhancedLayer.style.width = percentage;
  comparisonHandle.style.left = percentage;
}

function loadFile(file) {
  if (!file) return;
  if (selectedType === "image" && !file.type.startsWith("image/")) {
    showToast("Please choose an image file.");
    return;
  }
  if (selectedType === "video" && !file.type.startsWith("video/")) {
    showToast("Please choose a video file.");
    return;
  }
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  if (selectedType === "image") {
    originalImage.src = objectUrl;
    dropzone.querySelector("strong").firstChild.textContent = "Ready to enhance: ";
    fileHint.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
    downloadButton.disabled = false;
  } else {
    fileHint.textContent = `${file.name} · ready for video enhancement`;
    showToast("Video loaded. Enhance to start processing.");
  }
}

fileInput.addEventListener("change", (event) => loadFile(event.target.files[0]));
["dragenter", "dragover"].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropzone.classList.add("dragover");
}));
["dragleave", "drop"].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragover");
}));
dropzone.addEventListener("drop", (event) => loadFile(event.dataTransfer.files[0]));

document.querySelectorAll(".media-tab").forEach((tab) => tab.addEventListener("click", () => {
  document.querySelector(".media-tab.active").classList.remove("active");
  tab.classList.add("active");
  selectedType = tab.dataset.type;
  fileKind.textContent = selectedType;
  fileHint.textContent = selectedType === "image" ? "PNG, JPG up to 25 MB" : "MP4, MOV up to 500 MB";
  fileInput.accept = selectedType === "image" ? "image/*" : "video/*";
}));

strength.addEventListener("input", () => {
  strengthValue.textContent = `${strength.value}%`;
  strength.style.background = `linear-gradient(90deg, var(--mint) ${strength.value}%, #2b4054 ${strength.value}%)`;
});

document.querySelectorAll(".toggle").forEach((toggle) => toggle.addEventListener("click", () => toggle.classList.toggle("on")));

document.querySelector("#sample-button").addEventListener("click", () => {
  originalImage.src = "Zero-DCE/samples/dragon_inp.jpg";
  fileHint.textContent = "dragon_inp.jpg · sample image";
  downloadButton.disabled = false;
  showToast("Sample image loaded.");
});

document.querySelector("#enhance-button").addEventListener("click", () => {
  const button = document.querySelector("#enhance-button");
  button.disabled = true;
  button.innerHTML = '<span class="button-icon">◌</span> Enhancing...';
  window.setTimeout(() => {
    button.disabled = false;
    button.innerHTML = '<span class="button-icon">✦</span> Enhance <span class="button-arrow">→</span>';
    downloadButton.disabled = false;
    showToast("Enhancement complete — drag the divider to compare.");
  }, 850);
});

comparison.addEventListener("pointermove", (event) => {
  if (event.buttons !== 1) return;
  const bounds = comparison.getBoundingClientRect();
  setComparison(((event.clientX - bounds.left) / bounds.width) * 100);
});
comparison.addEventListener("pointerdown", (event) => {
  comparison.setPointerCapture(event.pointerId);
  const bounds = comparison.getBoundingClientRect();
  setComparison(((event.clientX - bounds.left) / bounds.width) * 100);
});
comparisonHandle.addEventListener("pointerdown", (event) => event.stopPropagation());

downloadButton.addEventListener("click", () => showToast("Download is ready when the local model is connected."));
