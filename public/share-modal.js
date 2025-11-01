(function () {
  if (typeof window === "undefined") {
    return;
  }

  function query(selector) {
    return document.querySelector(selector);
  }

  const trigger = query("[data-share-btn]");
  const dialog = query("[data-share-dialog]");

  if (!trigger || !dialog) {
    return;
  }

  const closeButton = dialog.querySelector("[data-share-close]");
  const overlay = dialog.querySelector("[data-share-overlay]");

  const open = () => {
    dialog.removeAttribute("hidden");
    dialog.setAttribute("aria-hidden", "false");
  };

  const close = () => {
    dialog.setAttribute("hidden", "");
    dialog.setAttribute("aria-hidden", "true");
  };

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    open();
  });

  if (closeButton) {
    closeButton.addEventListener("click", close);
  }

  if (overlay) {
    overlay.addEventListener("click", close);
  }

  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
    }
  });
})();
