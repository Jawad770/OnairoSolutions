(function () {
  "use strict";

  const form = document.getElementById("reviewForm");
  const nameInput = document.getElementById("reviewName");
  const reviewInput = document.getElementById("reviewText");
  const websiteInput = document.getElementById("reviewWebsite");
  const submitButton = document.getElementById("reviewSubmit");
  const status = document.getElementById("reviewStatus");
  const count = document.getElementById("reviewCount");
  const approvedWrap = document.getElementById("approvedReviews");
  const grid = document.getElementById("testimonialsGrid");

  if (!form || !reviewInput || !status || !submitButton || !approvedWrap || !grid) return;

  function setStatus(message, type) {
    status.textContent = message || "";
    status.classList.toggle("is-success", type === "success");
    status.classList.toggle("is-error", type === "error");
  }

  function renderReview(item) {
    const article = document.createElement("article");
    article.className = "testimonial reveal";

    const quote = document.createElement("p");
    quote.textContent = `“${String(item.review || "")}”`;

    const who = document.createElement("div");
    who.className = "who";
    who.textContent = String(item.name || "");

    article.append(quote, who);
    return article;
  }

  async function loadApprovedReviews() {
    try {
      const response = await fetch("/api/reviews", {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      const data = await response.json();
      if (!response.ok || !data.ok || !Array.isArray(data.reviews)) return;

      grid.replaceChildren();
      data.reviews.forEach((review) => grid.appendChild(renderReview(review)));
      approvedWrap.hidden = data.reviews.length === 0;

      if (data.reviews.length && window.ONAIRO?.observeReveals) {
        window.ONAIRO.observeReveals(approvedWrap);
      }
    } catch (_error) {
      // Submission remains usable if the optional approved-review feed is unavailable.
    }
  }

  reviewInput.addEventListener("input", () => {
    count.textContent = String(reviewInput.value.length);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("", "");

    if (!form.reportValidity()) return;

    submitButton.disabled = true;
    submitButton.classList.add("is-loading");
    submitButton.setAttribute("aria-busy", "true");

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: nameInput.value,
          review: reviewInput.value,
          website: websiteInput ? websiteInput.value : "",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "We could not submit your review. Please try again.");
      }

      form.reset();
      count.textContent = "0";
      setStatus(
        data.message || "Thanks for your review!",
        "success"
      );
    } catch (error) {
      setStatus(error.message || "We could not submit your review. Please try again.", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.classList.remove("is-loading");
      submitButton.removeAttribute("aria-busy");
    }
  });

  loadApprovedReviews();
})();
