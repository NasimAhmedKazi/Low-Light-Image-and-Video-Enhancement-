const dropzone = document.querySelector("#dropzone");
const fileInput = document.querySelector("#file-input");
const fileHint = document.querySelector("#file-hint");
const fileTitle = document.querySelector("#file-title");
const originalImage = document.querySelector("#original-image");
const originalVideo = document.querySelector("#original-video");
const comparison = document.querySelector("#comparison");
const previewEmpty = document.querySelector("#preview-empty");
const resolution = document.querySelector("#resolution");
const strength = document.querySelector("#strength");
const strengthValue = document.querySelector("#strength-value");
const downloadButton = document.querySelector("#download-button");
const toast = document.querySelector("#toast");
const originalLabel = document.querySelector("#original-label");
const enhancedLabel = document.querySelector(".compare-label.after");

let selectedType = "image";
let currentObjectUrl = null;
let selectedFile = null;
let loadId = 0;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function setComparison(value) {
  const percentage = `${Math.max(4, Math.min(96, value))}%`;
  comparison.style.setProperty("--split", percentage);
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
    downloadButton.disabled = true;
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

document.querySelectorAll(".toggle").forEach((toggle) => toggle.addEventListener("click", () => toggle.classList.toggle("on")));

document.querySelector("#sample-button").addEventListener("click", () => {
  showToast("Choose an image from your device to preview it.");
  fileInput.click();
});

document.querySelector("#enhance-button").addEventListener("click", () => {
  if (!selectedFile) {
    showToast("Select an image or video first.");
    return;
  }
  showToast("The Zero-DCE inference service is not connected to this frontend yet.");
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

downloadButton.addEventListener("click", () => showToast("No enhanced output is available to download yet."));
