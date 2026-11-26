import { formatPrice } from "../data";

export function createPriceCardImage(entry) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image canvas is not available in this browser.");

  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, "#075e38");
  background.addColorStop(1, "#0b7a49");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(255,255,255,0.12)";
  context.beginPath();
  context.arc(1080, 80, 210, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#d1fae5";
  context.font = "700 30px system-ui, sans-serif";
  context.fillText("MARKET EYE", 70, 76);
  context.fillStyle = "#ffffff";
  context.font = "800 54px system-ui, sans-serif";
  context.fillText(entry.item.slice(0, 32), 70, 170);
  context.font = "800 104px system-ui, sans-serif";
  context.fillText(formatPrice(entry.price, entry.currency), 70, 315, 1050);
  context.font = "600 34px system-ui, sans-serif";
  context.fillText(`${entry.market}${entry.city ? ` · ${entry.city}` : ""}`, 70, 395);
  context.font = "600 28px system-ui, sans-serif";
  context.fillText(entry.storeName || "Community price listing", 70, 455);
  const date = entry.createdAt ? new Date(entry.createdAt) : new Date();
  context.fillStyle = "#d1fae5";
  context.font = "500 24px system-ui, sans-serif";
  context.fillText(date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }), 70, 555);
  context.textAlign = "right";
  context.fillText("Check prices before you shop", 1130, 555);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not export the price card image."));
    }, "image/png");
  });
}
