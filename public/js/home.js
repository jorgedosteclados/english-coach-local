const pathSteps = document.querySelectorAll(".coach-step:not(.locked)");

function closePathSteps(exceptStep = null) {
  pathSteps.forEach((step) => {
    if (step === exceptStep) {
      return;
    }

    step.classList.remove("selected");
    step.querySelector(".coach-step-detail")?.setAttribute("aria-hidden", "true");
  });
}

pathSteps.forEach((step) => {
  function toggleStep(event) {
    if (event.target.closest(".coach-step-detail a")) {
      return;
    }

    event.stopPropagation();
    const shouldOpen = !step.classList.contains("selected");
    closePathSteps(step);
    step.classList.toggle("selected", shouldOpen);
    step
      .querySelector(".coach-step-detail")
      ?.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
  }

  step.addEventListener("click", toggleStep);
  step.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleStep(event);
    }
  });
});

document.addEventListener("click", () => closePathSteps());
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closePathSteps();
  }
});
