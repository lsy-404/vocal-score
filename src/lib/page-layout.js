const SVG_NS = "http://www.w3.org/2000/svg";

function svgLength(value) {
  const match = String(value ?? "").trim().match(/^([+-]?(?:\d+\.?\d*|\.\d+))(.*)$/);
  return match ? { value: Number(match[1]), unit: match[2] } : null;
}

function makeText(group, value, x, y, size, family, anchor = "start", weight = "normal") {
  const node = document.createElementNS(SVG_NS, "text");
  node.setAttribute("x", String(x));
  node.setAttribute("y", String(y));
  node.setAttribute("font-size", String(size));
  node.setAttribute("font-family", family);
  node.setAttribute("text-anchor", anchor);
  node.setAttribute("font-weight", weight);
  node.setAttribute("fill", "#222");
  node.textContent = value;
  group.append(node);
  return node;
}

export function decoratePages(container, {
  title = "",
  header = "",
  by = "",
  showPageNumbers = true,
  fontFamily = "Times New Roman, SimSun, serif",
  headerFontSize = 12,
  titleFontSize = 20,
} = {}) {
  if (!container?.children) throw new TypeError("A page container is required.");
  const pages = Array.from(container.querySelectorAll("svg")).filter((svg) => !svg.parentElement?.closest("svg"));
  const reserveTop = title
    ? Number(headerFontSize) + Number(titleFontSize) + (by ? Number(headerFontSize) : 0) + 24
    : header || by ? Math.max(30, Number(headerFontSize) * (by ? 2 : 1) + 12) : 0;
  const reserveBottom = showPageNumbers ? 24 : 0;
  pages.forEach((svg, index) => {
    if (!svg.hasAttribute("data-base-viewbox")) svg.setAttribute("data-base-viewbox", svg.getAttribute("viewBox") || "0 0 900 1100");
    if (!svg.hasAttribute("data-base-height")) svg.setAttribute("data-base-height", svg.getAttribute("height") || "");
    const previousContent = svg.querySelector(":scope > .page-content");
    if (previousContent) while (previousContent.firstChild) svg.insertBefore(previousContent.firstChild, previousContent);
    previousContent?.remove();
    const values = svg.getAttribute("data-base-viewbox").trim().split(/[ ,]+/).map(Number);
    if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) return;
    const [x, y, width, height] = values;
    svg.querySelector(":scope > .page-decoration")?.remove();
    const content = document.createElementNS(SVG_NS, "g");
    content.setAttribute("class", "page-content");
    content.setAttribute("transform", `translate(0 ${reserveTop})`);
    while (svg.firstChild) {
      const child = svg.firstChild;
      if (child.nodeType === 1 && child.classList?.contains("page-content")) {
        svg.removeChild(child);
        continue;
      }
      content.append(child);
    }
    svg.append(content);
    const decoratedHeight = height + reserveTop + reserveBottom;
    svg.setAttribute("viewBox", `${x} ${y} ${width} ${decoratedHeight}`);
    const baseHeight = svgLength(svg.getAttribute("data-base-height"));
    const baseWidth = svgLength(svg.getAttribute("width"));
    if (baseHeight?.value > 0) {
      svg.setAttribute("height", `${baseHeight.value * decoratedHeight / height}${baseHeight.unit}`);
    } else if (baseWidth?.value > 0 && width > 0) {
      svg.setAttribute("height", `${baseWidth.value * decoratedHeight / width}${baseWidth.unit}`);
    } else {
      svg.setAttribute("height", String(decoratedHeight));
    }
    const decoration = document.createElementNS(SVG_NS, "g");
    decoration.setAttribute("class", "page-decoration");
    svg.append(decoration);
    if (header) makeText(decoration, header, x + 24, y + Number(headerFontSize), headerFontSize, fontFamily);
    if (index === 0 && title) makeText(decoration, title, x + width / 2, y + Number(headerFontSize) + Number(titleFontSize), titleFontSize, fontFamily, "middle", "600");
    if (index === 0 && by) {
      const byY = title ? y + Number(headerFontSize) + Number(titleFontSize) + Number(headerFontSize) + 10 : y + Number(headerFontSize) + 10;
      makeText(decoration, `by ${by}`, x + width / 2, byY, headerFontSize, fontFamily, "middle");
    }
    if (showPageNumbers) makeText(decoration, `${index + 1} / ${pages.length}`, x + width / 2, y + height + reserveTop + reserveBottom - 6, headerFontSize, fontFamily, "middle");
    svg.setAttribute("data-page-number", String(index + 1));
  });
  return pages;
}
