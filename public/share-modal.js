// public/share-modal.js
(function () {
  function wire() {
    const triggers = document.querySelectorAll("[data-share-modal-trigger]");
    const closeBtns = document.querySelectorAll("[data-share-modal-close]");
    const modal = document.querySelector("#share-modal");

    if (!modal) return;

    triggers.forEach((el) => {
      el.addEventListener("click", () => {
        modal.showModal?.();
      });
    });

    closeBtns.forEach((el) => {
      el.addEventListener("click", () => {
        modal.close?.();
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
