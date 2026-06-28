(function () {
  const fileInput = document.getElementById("bookFile");
  const textArea = document.getElementById("bookText");
  const titleInput = document.getElementById("bookTitle");
  const importForm = document.getElementById("bookImportForm");
  const importButton = document.getElementById("bookImportButton");
  const importStatus = document.getElementById("bookImportStatus");

  if (!fileInput || !textArea) {
    return;
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }

    if (file.type.startsWith("text/") || file.name.toLowerCase().endsWith(".txt")) {
      textArea.value = await file.text();
    }

    if (!titleInput.value.trim()) {
      titleInput.value = file.name.replace(/\.[^.]+$/, "");
    }
  });

  importForm?.addEventListener("submit", () => {
    if (importButton) {
      importButton.disabled = true;
      importButton.textContent = "Importing...";
    }

    if (importStatus) {
      importStatus.textContent = "Importing your book. Large PDFs can take a little while.";
    }
  });

  document.querySelectorAll(".library-delete-form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      if (!window.confirm("Delete this imported book from your local library?")) {
        event.preventDefault();
      }
    });
  });
})();
