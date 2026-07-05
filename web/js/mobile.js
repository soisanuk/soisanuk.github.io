// Mobile/touch detection. Must load before all other app scripts so the
// IS_MOBILE / IS_IOS globals and the body.mobile class are available to them.

// Coarse pointer = primary input is touch (phones/tablets). ontouchstart
// alone would also catch touch-screen laptops, which we want to treat as
// desktop, so the media query is the primary signal.
const IS_MOBILE = window.matchMedia("(pointer: coarse)").matches;

// iPadOS 13+ reports as MacIntel, but with maxTouchPoints > 1.
const IS_IOS =
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

if (IS_MOBILE) document.body.classList.add("mobile");
if (IS_IOS)    document.body.classList.add("ios");
