(function () {
  const sectionsContainer = document.getElementById("sections-container");
  const outlineTree = document.getElementById("outline-tree");
  const inspectorFields = document.getElementById("inspector-fields");
  const inspectorBreadcrumb = document.getElementById("inspector-breadcrumb");
  const currentPageTitle = document.getElementById("current-page-title");
  const currentPageLabel = document.getElementById("current-page-label");
  const pagesList = document.getElementById("pages-list");
  const palette = document.getElementById("palette");
  const widgetPalette = document.getElementById("widget-palette");
  const builderRoot = document.getElementById("builder");
  const deviceWrapper = document.getElementById("device-wrapper");

  const seoFields = {
    title: document.getElementById("seo-title"),
    slug: document.getElementById("seo-slug"),
    desc: document.getElementById("seo-description"),
    status: document.getElementById("seo-status"),
  };

  const themeFields = {
    primary: document.getElementById("theme-primary"),
    background: document.getElementById("theme-background"),
    rounded: document.getElementById("theme-rounded"),
  };

  const templateLists = {
    section: document.getElementById("templates-sections-list"),
    page: document.getElementById("templates-pages-list"),
  };

  let state = {
    pages: [],
    currentPageId: null,
    templates: { sections: [], pages: [] },
    history: [],
    future: [],
    preview: false,
  };

  const makeId = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 9);

  function loadState() {
    try {
      const saved = localStorage.getItem("builder-pages");
      const templates = localStorage.getItem("builder-templates");
      if (saved) {
        state.pages = JSON.parse(saved);
        if (state.pages.length) state.currentPageId = state.pages[0].id;
      }
      if (!state.pages.length) {
        const newPage = createEmptyPage();
        state.pages.push(newPage);
        state.currentPageId = newPage.id;
      }
      if (templates) state.templates = JSON.parse(templates);
    } catch (e) {
      console.warn("Failed to load state", e);
      state.pages = [createEmptyPage()];
      state.currentPageId = state.pages[0].id;
    }
    pushHistory();
    render();
  }

  function persistPages() {
    localStorage.setItem("builder-pages", JSON.stringify(state.pages));
  }

  function persistTemplates() {
    localStorage.setItem("builder-templates", JSON.stringify(state.templates));
  }

  function createEmptyPage() {
    return {
      id: makeId(),
      title: "New page",
      slug: "new-page",
      status: "draft",
      description: "",
      sections: [],
    };
  }

  function getCurrentPage() {
    return state.pages.find((p) => p.id === state.currentPageId);
  }

  function setPage(page) {
    const existing = state.pages.findIndex((p) => p.id === page.id);
    if (existing >= 0) {
      state.pages[existing] = page;
    } else {
      state.pages.push(page);
    }
    state.currentPageId = page.id;
    persistPages();
    pushHistory();
    render();
  }

  function pushHistory() {
    const snapshot = JSON.stringify({ pages: state.pages, currentPageId: state.currentPageId });
    if (state.history.length && state.history[state.history.length - 1] === snapshot) return;
    state.history.push(snapshot);
    if (state.history.length > 30) state.history.shift();
    state.future = [];
  }

  function undo() {
    if (state.history.length <= 1) return;
    const current = state.history.pop();
    state.future.unshift(current);
    const previous = state.history[state.history.length - 1];
    const parsed = JSON.parse(previous);
    state.pages = parsed.pages;
    state.currentPageId = parsed.currentPageId;
    render();
  }

  function redo() {
    if (!state.future.length) return;
    const next = state.future.shift();
    const parsed = JSON.parse(next);
    state.pages = parsed.pages;
    state.currentPageId = parsed.currentPageId;
    state.history.push(next);
    render();
  }

  function render() {
    const page = getCurrentPage();
    if (!page) return;
    currentPageTitle.textContent = page.title;
    currentPageLabel.textContent = `${page.title} (${page.status})`;
    seoFields.title.value = page.title;
    seoFields.slug.value = page.slug;
    seoFields.desc.value = page.description || "";
    seoFields.status.value = page.status;

    sectionsContainer.innerHTML = "";
    if (!page.sections.length) sectionsContainer.classList.add("empty");
    else sectionsContainer.classList.remove("empty");

    page.sections.forEach((section) => {
      const sectionEl = document.createElement("section");
      sectionEl.className = "builder-element builder-section";
      sectionEl.dataset.builderType = "section";
      sectionEl.dataset.id = section.id;
      sectionEl.style.background = section.background || "";
      sectionEl.style.padding = section.padding || "2rem 1.5rem";

      section.rows.forEach((row) => {
        const rowEl = document.createElement("div");
        rowEl.className = "builder-element builder-row row";
        rowEl.dataset.builderType = "row";
        rowEl.dataset.id = row.id;

        row.cols.forEach((col) => {
          const colWrap = document.createElement("div");
          colWrap.className = `col-${col.span || 12} mb-3`;

          const colEl = document.createElement("div");
          colEl.className = "builder-element builder-col-inner";
          colEl.dataset.builderType = "column";
          colEl.dataset.id = col.id;
          colEl.style.textAlign = col.align || "left";
          colEl.style.background = col.background || "";

          if (!col.widgets.length) {
            const placeholder = document.createElement("div");
            placeholder.className = "column-placeholder";
            placeholder.textContent = "Drop widgets here";
            colEl.appendChild(placeholder);
          }

          col.widgets.forEach((widget) => {
            const widgetEl = document.createElement("div");
            widgetEl.className = "builder-element builder-widget";
            widgetEl.dataset.builderType = "widget";
            widgetEl.dataset.widgetType = widget.type;
            widgetEl.dataset.id = widget.id;

            const header = document.createElement("div");
            header.className = "builder-widget-header";
            header.innerHTML = `<span>${widget.type}</span><button class="btn btn-link btn-sm text-decoration-none btn-widget-remove" aria-label="Remove">×</button>`;
            widgetEl.appendChild(header);

            const body = document.createElement("div");
            body.className = "builder-widget-body";
            body.appendChild(renderWidgetContent(widget));
            widgetEl.appendChild(body);

            colEl.appendChild(widgetEl);
          });

          rowEl.appendChild(colWrap);
          colWrap.appendChild(colEl);
        });

        sectionEl.appendChild(rowEl);
      });

      sectionsContainer.appendChild(sectionEl);
    });

    renderOutline(page.sections);
    highlightSelection();
    renderTemplates();
    renderPagesList();
  }

  function renderWidgetContent(widget) {
    const frag = document.createDocumentFragment();
    switch (widget.type) {
      case "heading": {
        const h = document.createElement(widget.level || "h2");
        h.textContent = widget.text || "Heading";
        frag.appendChild(h);
        break;
      }
      case "text": {
        const p = document.createElement("p");
        p.textContent = widget.text || "Body copy";
        frag.appendChild(p);
        break;
      }
      case "button": {
        const btn = document.createElement("a");
        btn.className = `btn btn-${widget.variant || "primary"}`;
        btn.href = widget.href || "#";
        btn.textContent = widget.text || "Call to action";
        frag.appendChild(btn);
        break;
      }
      case "image": {
        const img = document.createElement("img");
        img.src = widget.src || "https://placehold.co/600x300";
        img.alt = widget.alt || "";
        img.className = "img-fluid rounded";
        frag.appendChild(img);
        break;
      }
      case "divider": {
        frag.appendChild(document.createElement("hr"));
        break;
      }
      default:
        frag.appendChild(document.createTextNode("Unknown widget"));
    }
    return frag;
  }

  function renderOutline(sections) {
    outlineTree.innerHTML = "";
    const rootUl = document.createElement("ul");
    sections.forEach((section) => {
      const li = document.createElement("li");
      li.appendChild(buildOutlineButton(section, "Section"));
      const rowsUl = document.createElement("ul");
      section.rows.forEach((row) => {
        const rowLi = document.createElement("li");
        rowLi.appendChild(buildOutlineButton(row, "Row"));
        const colsUl = document.createElement("ul");
        row.cols.forEach((col) => {
          const colLi = document.createElement("li");
          colLi.appendChild(buildOutlineButton(col, "Column"));
          const widgetsUl = document.createElement("ul");
          col.widgets.forEach((widget) => {
            const widgetLi = document.createElement("li");
            widgetLi.appendChild(buildOutlineButton(widget, widget.type));
            widgetsUl.appendChild(widgetLi);
          });
          colLi.appendChild(widgetsUl);
          colsUl.appendChild(colLi);
        });
        rowLi.appendChild(colsUl);
        rowsUl.appendChild(rowLi);
      });
      li.appendChild(rowsUl);
      rootUl.appendChild(li);
    });
    outlineTree.appendChild(rootUl);
  }

  function buildOutlineButton(element, label) {
    const btn = document.createElement("button");
    btn.innerHTML = `<span class="outline-tag">${label}</span> ${element.label || element.text || element.slug || element.type || "Element"}`;
    btn.addEventListener("click", () => selectElement(element));
    return btn;
  }

  function highlightSelection() {
    document.querySelectorAll(".builder-element").forEach((el) => el.classList.remove("selected"));
    if (!state.selected) return;
    const el = document.querySelector(`.builder-element[data-id="${state.selected.id}"]`);
    if (el) el.classList.add("selected");
    renderBreadcrumb();
    renderInspector();
  }

  function selectElement(element) {
    state.selected = { type: element.type || element.builderType, id: element.id };
    highlightSelection();
  }

  function findElementById(id) {
    const page = getCurrentPage();
    for (const section of page.sections) {
      if (section.id === id) return { element: section, parent: page, parentKey: "sections" };
      for (const row of section.rows) {
        if (row.id === id) return { element: row, parent: section, parentKey: "rows" };
        for (const col of row.cols) {
          if (col.id === id) return { element: col, parent: row, parentKey: "cols" };
          for (const widget of col.widgets) {
            if (widget.id === id) return { element: widget, parent: col, parentKey: "widgets" };
          }
        }
      }
    }
    return null;
  }

  function renderBreadcrumb() {
    inspectorBreadcrumb.innerHTML = "";
    if (!state.selected) return;
    const trail = [];
    const page = getCurrentPage();
    const selection = findElementById(state.selected.id);
    if (!selection) return;

    const addItem = (label, element) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.classList.toggle("active", element.id === state.selected.id);
      btn.addEventListener("click", () => selectElement(element));
      trail.push(btn);
    };

    const { element, parent } = selection;
    addItem("Page", page);
    if (parent && parent.id) addItem(parent.type || "Container", parent);
    addItem(element.type || element.builderType || "Element", element);

    trail.forEach((btn, idx) => {
      inspectorBreadcrumb.appendChild(btn);
      if (idx < trail.length - 1) {
        const sep = document.createElement("span");
        sep.textContent = "/";
        sep.className = "sep";
        inspectorBreadcrumb.appendChild(sep);
      }
    });
  }

  function renderInspector() {
    inspectorFields.innerHTML = "";
    if (!state.selected) return;
    const selection = findElementById(state.selected.id);
    if (!selection) return;
    const el = selection.element;

    const form = document.createElement("form");
    form.className = "vstack gap-2";

    const addField = (label, inputEl) => {
      const wrapper = document.createElement("div");
      wrapper.appendChild(createLabel(label));
      wrapper.appendChild(inputEl);
      form.appendChild(wrapper);
    };

    const addToggle = (label, checked, onChange) => {
      const div = document.createElement("div");
      div.className = "form-check form-switch";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "form-check-input";
      input.checked = checked;
      input.addEventListener("change", onChange);
      const lbl = document.createElement("label");
      lbl.className = "form-check-label";
      lbl.textContent = label;
      div.append(input, lbl);
      form.appendChild(div);
    };

    if (selection.parentKey === "sections") {
      const padding = createInput(el.padding || "2rem 1.5rem", (v) => updateElement(el.id, { padding: v }));
      addField("Padding", padding);
      const background = createInput(el.background || "", (v) => updateElement(el.id, { background: v }));
      addField("Background", background);
      const saveTemplate = document.createElement("button");
      saveTemplate.type = "button";
      saveTemplate.className = "btn btn-outline-secondary btn-sm";
      saveTemplate.textContent = "Save section as template";
      saveTemplate.addEventListener("click", () => saveSectionTemplate(el));
      form.appendChild(saveTemplate);
    }

    if (selection.parentKey === "cols") {
      const align = createSelect(
        [
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
        ],
        el.align || "left",
        (v) => updateElement(el.id, { align: v })
      );
      addField("Alignment", align);
      const background = createInput(el.background || "", (v) => updateElement(el.id, { background: v }));
      addField("Background", background);
    }

    if (selection.parentKey === "widgets") {
      if (el.type === "heading" || el.type === "text" || el.type === "button") {
        const text = document.createElement("textarea");
        text.className = "form-control form-control-sm";
        text.value = el.text || "";
        text.rows = 2;
        text.addEventListener("input", (e) => updateElement(el.id, { text: e.target.value }));
        addField("Text", text);
      }
      if (el.type === "heading") {
        const level = createSelect(
          [
            { value: "h1", label: "H1" },
            { value: "h2", label: "H2" },
            { value: "h3", label: "H3" },
          ],
          el.level || "h2",
          (v) => updateElement(el.id, { level: v })
        );
        addField("Heading level", level);
      }
      if (el.type === "button") {
        const href = createInput(el.href || "#", (v) => updateElement(el.id, { href: v }));
        addField("URL", href);
        const variant = createSelect(
          [
            { value: "primary", label: "Primary" },
            { value: "secondary", label: "Secondary" },
            { value: "outline-primary", label: "Outline" },
          ],
          el.variant || "primary",
          (v) => updateElement(el.id, { variant: v })
        );
        addField("Variant", variant);
      }
      if (el.type === "image") {
        const src = createInput(el.src || "https://placehold.co/600x300", (v) => updateElement(el.id, { src: v }));
        addField("Image URL", src);
        const alt = createInput(el.alt || "", (v) => updateElement(el.id, { alt: v }));
        addField("Alt text", alt);
      }
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-outline-danger btn-sm";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => removeElement(el.id));
    form.appendChild(deleteBtn);

    inspectorFields.appendChild(form);
  }

  function createLabel(text) {
    const lbl = document.createElement("label");
    lbl.className = "form-label";
    lbl.textContent = text;
    return lbl;
  }

  function createInput(value, onChange) {
    const input = document.createElement("input");
    input.className = "form-control form-control-sm";
    input.value = value;
    input.addEventListener("input", (e) => onChange(e.target.value));
    return input;
  }

  function createSelect(options, value, onChange) {
    const select = document.createElement("select");
    select.className = "form-select form-select-sm";
    options.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      select.appendChild(o);
    });
    select.value = value;
    select.addEventListener("change", (e) => onChange(e.target.value));
    return select;
  }

  function updateElement(id, values) {
    const result = findElementById(id);
    if (!result) return;
    Object.assign(result.element, values);
    persistPages();
    pushHistory();
    render();
    selectElement(result.element);
  }

  function removeElement(id) {
    const found = findElementById(id);
    if (!found) return;
    const { parent, parentKey } = found;
    parent[parentKey] = parent[parentKey].filter((item) => item.id !== id);
    state.selected = null;
    persistPages();
    pushHistory();
    render();
  }

  function createSection(template) {
    return {
      id: makeId(),
      type: "section",
      background: template?.background || "",
      padding: template?.padding || "2rem 1.5rem",
      rows: template?.rows ? template.rows.map(cloneRow) : [],
    };
  }

  function cloneRow(row) {
    return {
      id: makeId(),
      type: "row",
      cols: row.cols.map(cloneCol),
    };
  }

  function cloneCol(col) {
    return {
      id: makeId(),
      type: "column",
      span: col.span,
      align: col.align,
      background: col.background,
      widgets: col.widgets.map(cloneWidget),
    };
  }

  function cloneWidget(widget) {
    return { ...widget, id: makeId() };
  }

  function addSection(section) {
    const page = getCurrentPage();
    page.sections.push(section);
    persistPages();
    pushHistory();
    render();
  }

  function addWidgetToColumn(columnId, widget) {
    const col = findElementById(columnId)?.element;
    if (!col) return;
    col.widgets.push(widget);
    persistPages();
    pushHistory();
    render();
    selectElement(widget);
  }

  function setupPalette() {
    const sections = [
      {
        label: "Hero",
        build: () => {
          const section = createSection();
          section.rows.push({
            id: makeId(),
            type: "row",
            cols: [
              {
                id: makeId(),
                type: "column",
                span: 12,
                align: "left",
                background: "",
                widgets: [
                  { id: makeId(), type: "heading", text: "Welcome", level: "h1" },
                  { id: makeId(), type: "text", text: "Build pages visually." },
                  { id: makeId(), type: "button", text: "Get started", href: "#" },
                ],
              },
            ],
          });
          return section;
        },
      },
      {
        label: "Two columns",
        build: () => {
          const section = createSection();
          section.rows.push({
            id: makeId(),
            type: "row",
            cols: [
              { id: makeId(), type: "column", span: 6, align: "left", widgets: [{ id: makeId(), type: "text", text: "Left column" }] },
              { id: makeId(), type: "column", span: 6, align: "left", widgets: [{ id: makeId(), type: "text", text: "Right column" }] },
            ],
          });
          return section;
        },
      },
      {
        label: "Callout",
        build: () => {
          const section = createSection({ background: "#f0f4ff", padding: "2.5rem" });
          section.rows.push({
            id: makeId(),
            type: "row",
            cols: [
              {
                id: makeId(),
                type: "column",
                span: 12,
                align: "center",
                widgets: [
                  { id: makeId(), type: "heading", text: "Ready to publish?", level: "h2" },
                  { id: makeId(), type: "button", text: "Publish", href: "#", variant: "primary" },
                ],
              },
            ],
          });
          return section;
        },
      },
    ];

    const widgets = [
      { label: "Heading", type: "heading", defaults: { text: "New heading", level: "h2" } },
      { label: "Text", type: "text", defaults: { text: "Paragraph text" } },
      { label: "Button", type: "button", defaults: { text: "Button", href: "#", variant: "primary" } },
      { label: "Image", type: "image", defaults: { src: "https://placehold.co/600x300", alt: "" } },
      { label: "Divider", type: "divider", defaults: {} },
    ];

    palette.innerHTML = "";
    widgetPalette.innerHTML = "";

    sections.forEach((item) => {
      const card = createPaletteItem(item.label, () => {
        addSection(item.build());
      });
      palette.appendChild(card);
    });

    widgets.forEach((item) => {
      const card = createPaletteItem(item.label, () => {
        const colId = prompt("Add to which column? Enter column id from outline.");
        if (!colId) return;
        addWidgetToColumn(colId, { id: makeId(), type: item.type, ...item.defaults });
      });
      widgetPalette.appendChild(card);
    });
  }

  function createPaletteItem(label, onClick) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "palette-item";
    card.innerHTML = `<span class="palette-icon"></span><span class="palette-label">${label}</span>`;
    card.addEventListener("click", onClick);
    return card;
  }

  function renderPagesList() {
    pagesList.innerHTML = "";
    state.pages.forEach((page) => {
      const li = document.createElement("li");
      li.className = "list-group-item d-flex justify-content-between align-items-center";
      li.textContent = `${page.title} (${page.status})`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-sm btn-outline-secondary";
      btn.textContent = "Load";
      btn.addEventListener("click", () => {
        state.currentPageId = page.id;
        pushHistory();
        render();
      });
      li.appendChild(btn);
      pagesList.appendChild(li);
    });
  }

  function setupPageActions() {
    document.getElementById("btn-new-page").addEventListener("click", () => {
      const page = createEmptyPage();
      state.pages.push(page);
      state.currentPageId = page.id;
      persistPages();
      pushHistory();
      render();
    });

    document.getElementById("btn-dup-page").addEventListener("click", () => {
      const current = getCurrentPage();
      const clone = JSON.parse(JSON.stringify(current));
      clone.id = makeId();
      clone.title = `${current.title} copy`;
      clone.slug = `${current.slug}-copy`;
      clone.sections = clone.sections.map(createSectionFromTemplate);
      state.pages.push(clone);
      state.currentPageId = clone.id;
      persistPages();
      pushHistory();
      render();
    });

    document.getElementById("btn-del-page").addEventListener("click", () => {
      if (state.pages.length === 1) return alert("At least one page is required");
      state.pages = state.pages.filter((p) => p.id !== state.currentPageId);
      state.currentPageId = state.pages[0].id;
      persistPages();
      pushHistory();
      render();
    });
  }

  function createSectionFromTemplate(template) {
    return createSection(template);
  }

  function setupSeoFields() {
    Object.values(seoFields).forEach((input) => {
      input.addEventListener("input", () => {
        const page = getCurrentPage();
        page.title = seoFields.title.value;
        page.slug = seoFields.slug.value;
        page.description = seoFields.desc.value;
        page.status = seoFields.status.value;
        persistPages();
        pushHistory();
        render();
      });
    });
  }

  function setupThemeFields() {
    const applyTheme = () => {
      document.documentElement.style.setProperty("--builder-primary", themeFields.primary.value);
      document.documentElement.style.setProperty("--builder-bg", themeFields.background.value);
      builderRoot.classList.toggle("rounded-off", !themeFields.rounded.checked);
    };

    Object.values(themeFields).forEach((field) => field.addEventListener("input", applyTheme));
    themeFields.rounded.addEventListener("change", applyTheme);
  }

  function handleCanvasClicks() {
    sectionsContainer.addEventListener("click", (e) => {
      const widgetRemove = e.target.closest(".btn-widget-remove");
      if (widgetRemove) {
        const widgetEl = widgetRemove.closest(".builder-widget");
        if (widgetEl) removeElement(widgetEl.dataset.id);
        return;
      }
      const el = e.target.closest(".builder-element");
      if (el && el.dataset.id) {
        const match = findElementById(el.dataset.id);
        if (match) selectElement(match.element);
      }
    });
  }

  function setupToolbar() {
    document.getElementById("btn-undo").addEventListener("click", undo);
    document.getElementById("btn-redo").addEventListener("click", redo);
    document.getElementById("btn-save").addEventListener("click", () => {
      persistPages();
      alert("Page saved to localStorage.");
    });
    document.getElementById("btn-preview").addEventListener("click", togglePreview);
    document.getElementById("btn-export-json").addEventListener("click", exportJSON);

    document.getElementById("toggle-dark").addEventListener("change", (e) => {
      builderRoot.classList.toggle("dark", e.target.checked);
    });

    document.getElementById("toggle-grid").addEventListener("change", (e) => {
      sectionsContainer.classList.toggle("canvas-grid", e.target.checked);
    });

    document.getElementById("zoom-select").addEventListener("change", (e) => {
      const value = e.target.value;
      deviceWrapper.classList.remove("zoom-50", "zoom-75", "zoom-100", "zoom-125");
      deviceWrapper.classList.add(`zoom-${value}`);
    });

    document.getElementById("device-buttons").addEventListener("click", (e) => {
      if (e.target.dataset.device) {
        document.querySelectorAll("#device-buttons .btn").forEach((b) => b.classList.remove("active"));
        e.target.classList.add("active");
        deviceWrapper.classList.remove("device-desktop", "device-tablet", "device-mobile");
        deviceWrapper.classList.add(`device-${e.target.dataset.device}`);
      }
    });
  }

  function togglePreview() {
    state.preview = !state.preview;
    builderRoot.classList.toggle("preview-mode", state.preview);
  }

  function exportJSON() {
    const data = JSON.stringify(getCurrentPage(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${getCurrentPage().slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function saveSectionTemplate(section) {
    state.templates.sections.push({ ...section, id: makeId(), name: section.label || `Section ${state.templates.sections.length + 1}` });
    persistTemplates();
    renderTemplates();
    alert("Section template saved");
  }

  function savePageTemplate() {
    const page = getCurrentPage();
    const clone = JSON.parse(JSON.stringify(page));
    clone.id = makeId();
    clone.name = page.title;
    state.templates.pages.push(clone);
    persistTemplates();
    renderTemplates();
    alert("Page template saved");
  }

  function renderTemplates() {
    templateLists.section.innerHTML = "";
    templateLists.page.innerHTML = "";

    state.templates.sections.forEach((tpl) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "list-group-item list-group-item-action";
      item.textContent = tpl.name || "Section template";
      item.addEventListener("click", () => addSection(createSectionFromTemplate(tpl)));
      templateLists.section.appendChild(item);
    });

    state.templates.pages.forEach((tpl) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "list-group-item list-group-item-action";
      item.textContent = tpl.name || "Page template";
      item.addEventListener("click", () => {
        const clone = JSON.parse(JSON.stringify(tpl));
        clone.id = makeId();
        clone.slug = `${tpl.slug}-${Date.now()}`;
        clone.title = `${tpl.title} copy`;
        state.pages.push(clone);
        state.currentPageId = clone.id;
        persistPages();
        pushHistory();
        render();
      });
      templateLists.page.appendChild(item);
    });
  }

  function exportTemplates() {
    const data = JSON.stringify(state.templates, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `templates.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function setupTemplateActions() {
    document.getElementById("btn-save-page-template").addEventListener("click", savePageTemplate);
    document.getElementById("btn-export-templates-json").addEventListener("click", exportTemplates);
  }

  function init() {
    setupPalette();
    setupToolbar();
    handleCanvasClicks();
    setupSeoFields();
    setupThemeFields();
    setupPageActions();
    setupTemplateActions();
    loadState();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
