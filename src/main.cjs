const { Plugin, Protyle } = require("siyuan");
import { mount, render, supports } from "pele";

const selector = '[data-subtype="mermaid"][data-content]';
let logos;
let loadingLogos;
function icons(name) {
  if (!name.startsWith("logos:") || !logos) return;
  const icon = logos.icons[name.slice(6)];
  if (!icon?.body) return;
  const width = Number(icon.width || logos.width || 16);
  const height = Number(icon.height || logos.height || 16);
  return `<svg width="24" height="24" viewBox="0 0 ${width} ${height}">${icon.body}</svg>`;
}

function math(tex, size) {
  const svg = window.MathJax?.tex2svg?.(tex, {display: false})?.querySelector("svg");
  if (!svg) return;
  const box = svg.viewBox.baseVal;
  if (!box.width || !box.height) return;
  return {svg: svg.outerHTML, width: box.width * size / 1000, height: box.height * size / 1000};
}

const options = { icons, math, autoDirection: false, responsive: true, links: true, images: true };
const viewOptions = {
  ...options, zoom: "auto",
  sanitize(svg) {
    return window.DOMPurify.sanitize(svg, {
      USE_PROFILES: {svg: true, svgFilters: true},
      ADD_TAGS: ["style", "use"], RETURN_DOM_FRAGMENT: true
    });
  }
};

module.exports = class PelePlugin extends Plugin {
  onload() {
    this.views = new Map();
    this.dialogs = new Set();
    this.patch = () => {
      const api = window.mermaid;
      if (!api?.render || this.api === api) return;
      const original = api.render;
      const wrapped = async function(id, source, container) {
        // SiYuan passes a temporary offscreen div for each native block.
        if (container?.parentElement === document.body && container.style.left === "-100000px"
            && /^mermaid/.test(id) && supports(source)) {
          try {
            const { svg } = render(source, {...options, idPrefix: id});
            return {svg: svg.replace("<svg ", '<svg data-siyuan-pele-static="true" ')};
          } catch { /* Delegate syntax outside Pele's parser to SiYuan. */ }
        }
        return original.apply(this, arguments);
      };
      api.render = wrapped;
      this.api = api;
      this.restore = () => { if (api.render === wrapped) api.render = original; };
    };
    this.patch();
    document.addEventListener("load", this.patch, true);
    this.observer = new MutationObserver(records => {
      const dirty = new Set();
      let removed = false;
      for (const record of records) {
        const block = record.target.closest?.(selector);
        if (block && !record.target.closest(".siyuan-pele")) dirty.add(block);
        if (record.type === "attributes" && this.views.has(record.target)) dirty.add(record.target);
        for (const el of record.addedNodes) {
          if (el.nodeType !== 1 || el.closest(".siyuan-pele")) continue;
          if (el.matches(selector)) dirty.add(el);
          el.querySelectorAll(selector).forEach(item => dirty.add(item));
        }
        removed ||= record.removedNodes.length > 0;
      }
      if (removed) for (const block of this.views.keys()) if (!block.isConnected) this.drop(block);
      for (const block of dirty) this.sync(block);
    });
    this.observer.observe(document.body, {subtree: true, childList: true, attributes: true,
      attributeFilter: ["data-content", "data-subtype", "custom-mermaid-layout"]});
    document.querySelectorAll(selector).forEach(block => this.sync(block));
  }

  sync(block) {
    const slot = block.querySelector(":scope > .protyle-icons + * > div[contenteditable=false]");
    const raw = block.getAttribute("data-content");
    const layout = block.getAttribute("custom-mermaid-layout");
    const previous = this.views.get(block);
    if (previous && previous.host.parentElement === slot?.parentElement && previous.slot === slot
        && previous.raw === raw && previous.layout === layout && block.matches(selector)) return;
    this.drop(block);
    if (!slot || !raw || !block.matches(selector) || !block.isConnected) return;
    let source = window.Lute.UnEscapeHTMLStr(raw);
    if (["dagre", "cose-bilkent", "tidy-tree"].includes(layout))
      source += '\n%%{init: ' + JSON.stringify({layout}) + '}%%';
    if (!supports(source) || !window.DOMPurify) return;
    const host = document.createElement("section");
    host.className = "siyuan-pele";
    host.contentEditable = "false";
    slot.before(host);
    const view = {host, slot, raw, layout};
    if (source.includes("logos:") && !logos) {
      loadingLogos ??= fetch("/stage/protyle/js/mermaid/icons.json")
        .then(response => response.ok ? response.json() : undefined)
        .then(pack => { logos = pack; }).catch(() => {});
      loadingLogos.then(() => {
        if (logos && this.views.get(block) === view) view.diagram?.refresh();
      });
    }
    this.views.set(block, view);
    try {
      view.diagram = mount(host, source, {...viewOptions,
        onRender: () => { host.hidden = false; slot.classList.add("siyuan-pele-original"); },
        onError: () => { host.hidden = true; slot.classList.remove("siyuan-pele-original"); }
      });
      host.addEventListener("dblclick", event => {
        if (!event.target.closest("a, button")) this.expand(source);
      });
    } catch {
      host.hidden = true;
      slot.classList.remove("siyuan-pele-original");
    }
  }

  expand(source) {
    const dialog = document.createElement("dialog");
    dialog.className = "siyuan-pele-dialog";
    const host = document.createElement("div");
    host.className = "siyuan-pele";
    const close = document.createElement("button");
    close.textContent = "×";
    close.setAttribute("aria-label", "Close");
    close.onclick = () => dialog.close();
    dialog.append(close, host);
    document.body.append(dialog);
    dialog.showModal();
    const diagram = mount(host, source, {...viewOptions, zoom: {always: true}});
    this.dialogs.add(dialog);
    dialog.addEventListener("close", () => {
      diagram.destroy();
      dialog.remove();
      this.dialogs.delete(dialog);
    }, {once: true});
  }

  drop(block) {
    const view = this.views.get(block);
    if (!view) return;
    view.diagram?.destroy();
    view.host.remove();
    view.slot.classList.remove("siyuan-pele-original");
    this.views.delete(block);
  }

  onunload() {
    this.observer.disconnect();
    document.removeEventListener("load", this.patch, true);
    this.restore?.();
    for (const dialog of this.dialogs) dialog.close();
    for (const block of this.views.keys()) this.drop(block);
    document.querySelectorAll(selector).forEach(block => {
      if (block.querySelector("[data-siyuan-pele-static]")) {
        block.removeAttribute("data-render");
        Protyle.mermaidRender(block);
      }
    });
  }
};
