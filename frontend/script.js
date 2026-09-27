const dropzone = document.querySelector("#dropzone");
const fileInput = document.querySelector("#file-input");
const fileHint = document.querySelector("#file-hint");
const fileTitle = document.querySelector("#file-title");
const originalImage = document.querySelector("#original-image");
const originalVideo = document.querySelector("#original-video");
const comparison = document.querySelector("#comparison");
const previewEmpty = document.querySelector("#preview-empty");
const enhancedImage = document.querySelector("#enhanced-image");
const enhancedEmpty = document.querySelector("#enhanced-empty");
const resolution = document.querySelector("#resolution");
const strength = document.querySelector("#strength");
const strengthValue = document.querySelector("#strength-value");
const enhanceButton = document.querySelector("#enhance-button");
const downloadButton = document.querySelector("#download-button");
const toast = document.querySelector("#toast");
const originalLabel = document.querySelector("#original-label");
const enhancedLabel = document.querySelector(".compare-label.after");
const modelStatus = document.querySelector("#model-status");
const modelStatusDot = document.querySelector("#model-status-dot");
const modelDetail = document.querySelector("#model-detail");

let selectedType = "image";
let currentObjectUrl = null;
let enhancedObjectUrl = null;
let selectedFile = null;
let loadId = 0;
let enhancementId = 0;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function setComparison(value) {
  const percentage = `${Math.max(4, Math.min(96, value))}%`;
  comparison.style.setProperty("--split", percentage);
}

function clearEnhancedPreview() {
  enhancementId += 1;
  if (enhancedObjectUrl) {
    URL.revokeObjectURL(enhancedObjectUrl);
    enhancedObjectUrl = null;
  }
  enhancedImage.removeAttribute("src");
  enhancedImage.hidden = true;
  enhancedEmpty.hidden = false;
  downloadButton.disabled = true;
  enhanceButton.disabled = false;
  enhanceButton.innerHTML = '<span class="button-icon">✦</span> Enhance <span class="button-arrow">→</span>';
}

function setModelStatus(ready, detail) {
  modelStatus.textContent = ready ? "Model ready" : "Model unavailable";
  modelDetail.textContent = detail;
  modelStatusDot.classList.toggle("status-off", !ready);
}

async function checkModelStatus() {
  try {
    const response = await fetch("/api/health");
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ready) {
      throw new Error(result.error || "Start the local backend with python backend/app.py.");
    }
    setModelStatus(true, "Zero-DCE inference is available");
  } catch (error) {
    setModelStatus(false, error.message === "Failed to fetch"
      ? "Run python backend/app.py to connect"
      : error.message);
  }
}

function loadFile(file) {
  if (!file) {
    return;
  }

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if ((selectedType === "image" && !isImage) || (selectedType === "video" && !isVideo)) {
    showToast(`Please choose a ${selectedType} file.`);
    return;
  }

  const nextObjectUrl = URL.createObjectURL(file);
  const thisLoad = ++loadId;

  function activatePreview(width, height) {
    if (thisLoad !== loadId) {
      URL.revokeObjectURL(nextObjectUrl);
      return;
    }

    const previousObjectUrl = currentObjectUrl;
    currentObjectUrl = nextObjectUrl;
    selectedFile = file;
    previewEmpty.hidden = true;
    originalImage.hidden = !isImage;
    originalVideo.hidden = !isVideo;
    originalLabel.hidden = false;
    enhancedLabel.hidden = false;
    comparison.classList.add("has-media");

    if (isImage) {
      originalVideo.pause();
      originalVideo.removeAttribute("src");
      originalVideo.load();
      originalImage.src = nextObjectUrl;
      originalImage.alt = `Original preview of ${file.name}`;
      resolution.textContent = `${width} × ${height}`;
    } else {
      originalImage.removeAttribute("src");
      originalVideo.pause();
      originalVideo.src = nextObjectUrl;
      resolution.textContent = `${width} × ${height}`;
    }

    fileTitle.textContent = file.name;
    fileHint.textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB · ready to preview`;
    clearEnhancedPreview();
    showToast(`${file.name} loaded into the preview.`);
    if (previousObjectUrl) {
      URL.revokeObjectURL(previousObjectUrl);
    }
  }

  if (isImage) {
    const image = new Image();
    image.onload = () => activatePreview(image.naturalWidth, image.naturalHeight);
    image.onerror = () => {
      URL.revokeObjectURL(nextObjectUrl);
      if (thisLoad === loadId) {
        showToast("This image could not be opened. Try a PNG, JPG, or WebP file.");
      }
    };
    image.src = nextObjectUrl;
  } else {
    const video = document.createElement("video");
    video.onloadedmetadata = () => activatePreview(video.videoWidth, video.videoHeight);
    video.onerror = () => {
      URL.revokeObjectURL(nextObjectUrl);
      if (thisLoad === loadId) {
        showToast("This video could not be opened in your browser.");
      }
    };
    video.src = nextObjectUrl;
  }
}

fileInput.addEventListener("change", () => {
  loadFile(fileInput.files[0]);
  fileInput.value = "";
});

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
  fileTitle.textContent = `Drop your ${selectedType} here`;
  fileHint.textContent = selectedType === "image" ? "PNG, JPG up to 25 MB" : "MP4, MOV up to 500 MB";
  fileInput.accept = selectedType === "image" ? "image/*" : "video/*";
}));

strength.addEventListener("input", () => {
  strengthValue.textContent = `${strength.value}%`;
  strength.style.background = `linear-gradient(90deg, var(--mint) ${strength.value}%, #2b4054 ${strength.value}%)`;
});

document.querySelector("#sample-button").addEventListener("click", () => {
  showToast("Choose an image from your device to preview it.");
  fileInput.click();
});

enhanceButton.addEventListener("click", async () => {
  if (!selectedFile) {
    showToast("Select an image or video first.");
    return;
  }
  if (selectedType !== "image") {
    showToast("Video enhancement is not available in the image model yet.");
    return;
  }

  const thisEnhancement = ++enhancementId;
  const formData = new FormData();
  formData.append("file", selectedFile);
  formData.append("strength", strength.value);
  enhanceButton.disabled = true;
  enhanceButton.innerHTML = '<span class="button-icon">◌</span> Enhancing...';
  downloadButton.disabled = true;

  try {
    const response = await fetch("/api/enhance", { method: "POST", body: formData });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || `Enhancement failed (${response.status}).`);
    }

    const resultBlob = await response.blob();
    if (thisEnhancement !== enhancementId) {
      return;
    }
    const nextEnhancedUrl = URL.createObjectURL(resultBlob);
    const previousEnhancedUrl = enhancedObjectUrl;
    enhancedObjectUrl = nextEnhancedUrl;
    enhancedImage.src = nextEnhancedUrl;
    enhancedImage.hidden = false;
    enhancedEmpty.hidden = true;
    enhancedImage.onload = () => {
      comparison.style.setProperty("--preview-width", `${comparison.clientWidth}px`);
    };
    comparison.style.setProperty("--preview-width", `${comparison.clientWidth}px`);
    downloadButton.disabled = false;
    if (previousEnhancedUrl) {
      URL.revokeObjectURL(previousEnhancedUrl);
    }
    showToast("Image enhanced with Zero-DCE.");
  } catch (error) {
    if (thisEnhancement === enhancementId) {
      showToast(error.message.includes("Failed to fetch")
        ? "Cannot reach the inference service. Start it with python backend/app.py."
        : error.message);
    }
  } finally {
    if (thisEnhancement === enhancementId) {
      enhanceButton.disabled = false;
      enhanceButton.innerHTML = '<span class="button-icon">✦</span> Enhance <span class="button-arrow">→</span>';
    }
  }
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

downloadButton.addEventListener("click", () => {
  if (!enhancedObjectUrl || !selectedFile) return;
  const name = selectedFile.name.replace(/\.[^.]+$/, "") || "enhanced-image";
  const link = document.createElement("a");
  link.href = enhancedObjectUrl;
  link.download = `${name}-enhanced.png`;
  link.click();
});

window.addEventListener("resize", () => {
  comparison.style.setProperty("--preview-width", `${comparison.clientWidth}px`);
});
checkModelStatus();
