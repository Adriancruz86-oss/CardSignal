"use client";

import { useEffect } from "react";

export default function SealedNavBridge() {
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".nav-tabs");
    if (!nav || nav.querySelector("[data-cs-sealed-nav]")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.csSealedNav = "true";
    button.textContent = "Sealed";
    button.title = "Sealed sports and Pokémon market";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign("/sealed");
    }, true);

    const portfolio = [...nav.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === "Portfolio",
    );
    if (portfolio?.nextSibling) nav.insertBefore(button, portfolio.nextSibling);
    else nav.appendChild(button);

    return () => button.remove();
  }, []);

  return null;
}
