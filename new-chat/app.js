const storageKey = "story-desk-project";
const themeStorageKey = "story-desk-theme";
const databaseName = "story-desk-database";
const databaseVersion = 1;
const projectStoreName = "projects";
const currentProjectKey = "current";
const appDataVersion = 4;
const maxChapters = 30;
const chapterStatuses = {
  draft: "下書き",
  clean: "清書",
  done: "完成"
};

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `story-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function createEmptyProject(title = "無題の長編") {
  const firstChapterId = createId();
  const timestamp = nowIso();
  return {
    id: createId(),
    title,
    subtitle: "",
    lineChars: 40,
    pageLines: 30,
    activeChapterId: firstChapterId,
    createdAt: timestamp,
    updatedAt: timestamp,
    chapters: [
      {
        id: firstChapterId,
        title: "第一話",
        body: "",
        outline: "",
        characters: "",
        world: "",
        status: "draft",
        updatedAt: timestamp
      }
    ]
  };
}

const elements = {
  projectTitle: document.querySelector("#projectTitle"),
  projectHeroTitle: document.querySelector("#projectHeroTitle"),
  projectSubtitleInput: document.querySelector("#projectSubtitleInput"),
  totalChars: document.querySelector("#totalChars"),
  chapterCount: document.querySelector("#chapterCount"),
  lineCharsInput: document.querySelector("#lineCharsInput"),
  pageLinesInput: document.querySelector("#pageLinesInput"),
  pageLinesHint: document.querySelector("#pageLinesHint"),
  indexLineCharsInput: document.querySelector("#indexLineCharsInput"),
  indexPageLinesInput: document.querySelector("#indexPageLinesInput"),
  chapterList: document.querySelector("#chapterList"),
  addChapterButton: document.querySelector("#addChapterButton"),
  newProjectButton: document.querySelector("#newProjectButton"),
  projectCreateButton: document.querySelector("#projectCreateButton"),
  projectMenuThemeButton: document.querySelector("#projectMenuThemeButton"),
  projectMenuBackupButton: document.querySelector("#projectMenuBackupButton"),
  projectMenuRestoreButton: document.querySelector("#projectMenuRestoreButton"),
  chapterMenuAddButton: document.querySelector("#chapterMenuAddButton"),
  chapterMenuExportButton: document.querySelector("#chapterMenuExportButton"),
  chapterTitle: document.querySelector("#chapterTitle"),
  editorChapterHeading: document.querySelector("#editorChapterHeading"),
  editorUpdatedAt: document.querySelector("#editorUpdatedAt"),
  chapterStatus: document.querySelector("#chapterStatus"),
  chapterBody: document.querySelector("#chapterBody"),
  writingGuide: document.querySelector("#writingGuide"),
  pageGuide: document.querySelector("#pageGuide"),
  saveState: document.querySelector("#saveState"),
  chapterStats: document.querySelector("#chapterStats"),
  projectListButton: document.querySelector("#projectListButton"),
  indexButton: document.querySelector("#indexButton"),
  backToProjectsButton: document.querySelector("#backToProjectsButton"),
  backToChaptersButton: document.querySelector("#backToChaptersButton"),
  editorBackButton: document.querySelector("#editorBackButton"),
  focusButton: document.querySelector("#focusButton"),
  focusExitButton: document.querySelector("#focusExitButton"),
  exportButton: document.querySelector("#exportButton"),
  backupButton: document.querySelector("#backupButton"),
  restoreButton: document.querySelector("#restoreButton"),
  restoreFileInput: document.querySelector("#restoreFileInput"),
  themeButton: document.querySelector("#themeButton"),
  themeColorMeta: document.querySelector("#themeColorMeta"),
  projectView: document.querySelector("#projectView"),
  projectList: document.querySelector("#projectList"),
  projectTotalCount: document.querySelector("#projectTotalCount"),
  editorView: document.querySelector("#editorView"),
  indexView: document.querySelector("#indexView"),
  chapterIndexList: document.querySelector("#chapterIndexList"),
  indexTotalChars: document.querySelector("#indexTotalChars"),
  shortcutButtons: document.querySelectorAll(".shortcut-button")
};

let appState = loadAppState();
let saveTimer = null;
let activeTheme = loadTheme();
let storyDbPromise = null;
let currentView = "projects";

applyTheme(activeTheme);

function normalizeChapter(chapter, index, fallbackUpdatedAt) {
  return {
    id: typeof chapter?.id === "string" && chapter.id ? chapter.id : createId(),
    title: typeof chapter?.title === "string" && chapter.title ? chapter.title : `第${index + 1}話`,
    body: typeof chapter?.body === "string" ? chapter.body : "",
    outline: typeof chapter?.outline === "string" ? chapter.outline : "",
    characters: typeof chapter?.characters === "string" ? chapter.characters : "",
    world: typeof chapter?.world === "string" ? chapter.world : "",
    status: chapterStatuses[chapter?.status] ? chapter.status : "draft",
    updatedAt: typeof chapter?.updatedAt === "string" ? chapter.updatedAt : fallbackUpdatedAt
  };
}

function normalizeProject(value, index = 0) {
  const fallback = createEmptyProject(index === 0 ? "無題の長編" : `無題の長編 ${index + 1}`);
  if (!value || typeof value !== "object") return fallback;

  const fallbackUpdatedAt = typeof value.updatedAt === "string" ? value.updatedAt : nowIso();
  const chapters = Array.isArray(value.chapters) && value.chapters.length
    ? value.chapters.slice(0, maxChapters).map((chapter, chapterIndex) => normalizeChapter(chapter, chapterIndex, fallbackUpdatedAt))
    : fallback.chapters;

  const activeChapterId = chapters.some((chapter) => chapter.id === value.activeChapterId)
    ? value.activeChapterId
    : chapters[0].id;

  return {
    id: typeof value.id === "string" && value.id ? value.id : createId(),
    title: typeof value.title === "string" && value.title ? value.title : fallback.title,
    subtitle: typeof value.subtitle === "string" ? value.subtitle : "",
    lineChars: normalizeLineChars(value.lineChars),
    pageLines: normalizePageLines(value.pageLines),
    activeChapterId,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : fallbackUpdatedAt,
    updatedAt: fallbackUpdatedAt,
    chapters
  };
}

function normalizeAppState(value) {
  if (value?.projects && Array.isArray(value.projects)) {
    const projects = value.projects.length
      ? value.projects.map((project, index) => normalizeProject(project, index))
      : [createEmptyProject()];
    const activeProjectId = projects.some((project) => project.id === value.activeProjectId)
      ? value.activeProjectId
      : projects[0].id;
    return {
      schemaVersion: appDataVersion,
      activeProjectId,
      projects,
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : newestProjectDate(projects)
    };
  }

  const migratedProject = normalizeProject(value || createEmptyProject(), 0);
  return {
    schemaVersion: appDataVersion,
    activeProjectId: migratedProject.id,
    projects: [migratedProject],
    updatedAt: migratedProject.updatedAt || nowIso()
  };
}

function loadAppState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return normalizeAppState(null);
  try {
    return normalizeAppState(JSON.parse(saved));
  } catch {
    return normalizeAppState(null);
  }
}

function cloneStateForSave() {
  const normalized = normalizeAppState(appState);
  return {
    ...normalized,
    schemaVersion: appDataVersion,
    updatedAt: nowIso()
  };
}

function currentProject() {
  let project = appState.projects.find((item) => item.id === appState.activeProjectId);
  if (!project) {
    project = appState.projects[0] || createEmptyProject();
    appState.projects = [project];
    appState.activeProjectId = project.id;
  }
  return project;
}

function activeChapter() {
  const project = currentProject();
  let chapter = project.chapters.find((item) => item.id === project.activeChapterId);
  if (!chapter) {
    chapter = project.chapters[0];
    project.activeChapterId = chapter.id;
  }
  return chapter;
}

function newestProjectDate(projects) {
  return projects.reduce((newest, project) => {
    const value = new Date(project.updatedAt || 0).getTime();
    return value > newest ? value : newest;
  }, 0) || Date.now();
}

function countCharacters(text) {
  return text.replace(/\s/g, "").length;
}

function projectCharacters(project) {
  return project.chapters.reduce((sum, chapter) => sum + countCharacters(chapter.body), 0);
}

function totalProjectCharacters() {
  return projectCharacters(currentProject());
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDateShort(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
}

function normalizeLineChars(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 40;
  return Math.max(1, parsed);
}

function normalizePageLines(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 30;
  return Math.max(1, parsed);
}

function parsePositiveIntegerInput(value) {
  const parsed = Number.parseInt(String(value).replace(/[^\d]/g, ""), 10);
  return Number.isNaN(parsed) ? null : Math.max(1, parsed);
}

function loadTheme() {
  const saved = localStorage.getItem(themeStorageKey);
  if (saved === "dark" || saved === "light") return saved;
  return "dark";
}

function applyTheme(theme) {
  activeTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = activeTheme;
  elements.themeColorMeta?.setAttribute("content", activeTheme === "dark" ? "#151616" : "#2f6f73");
  const isDark = activeTheme === "dark";
  elements.themeButton.textContent = isDark ? "☀" : "☾";
  elements.themeButton.title = isDark ? "ライトモードに切り替え" : "ダークモードに切り替え";
  elements.themeButton.setAttribute("aria-label", elements.themeButton.title);
  elements.projectMenuThemeButton.textContent = isDark ? "ライトモード" : "ダークモード";
}

function toggleTheme() {
  const nextTheme = activeTheme === "dark" ? "light" : "dark";
  localStorage.setItem(themeStorageKey, nextTheme);
  applyTheme(nextTheme);
}

function openStoryDb() {
  if (!("indexedDB" in window)) return Promise.resolve(null);
  if (storyDbPromise) return storyDbPromise;

  storyDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(projectStoreName)) db.createObjectStore(projectStoreName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return storyDbPromise;
}

async function saveStateToIndexedDb(snapshot) {
  const db = await openStoryDb();
  if (!db) return false;

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(projectStoreName, "readwrite");
    transaction.objectStore(projectStoreName).put(snapshot, currentProjectKey);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

  return true;
}

async function loadStateFromIndexedDb() {
  const db = await openStoryDb();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(projectStoreName, "readonly");
    const request = transaction.objectStore(projectStoreName).get(currentProjectKey);
    request.onsuccess = () => resolve(request.result ? normalizeAppState(request.result) : null);
    request.onerror = () => reject(request.error);
  });
}

function isStateNewer(candidate, current) {
  if (!candidate?.updatedAt) return false;
  if (!current?.updatedAt) return true;
  return new Date(candidate.updatedAt).getTime() > new Date(current.updatedAt).getTime();
}

function scheduleSave() {
  elements.saveState.textContent = "保存中...";
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveStateNow();
  }, 240);
}

async function saveStateNow(statusText = "保存済み（端末内）") {
  const snapshot = cloneStateForSave();
  appState = snapshot;

  let localStorageSaved = false;
  let indexedDbSaved = false;

  try {
    localStorage.setItem(storageKey, JSON.stringify(snapshot));
    localStorageSaved = true;
  } catch (error) {
    console.warn("localStorage save failed", error);
  }

  try {
    indexedDbSaved = await saveStateToIndexedDb(snapshot);
  } catch (error) {
    console.warn("IndexedDB save failed", error);
  }

  if (localStorageSaved || indexedDbSaved) {
    elements.saveState.textContent = statusText;
    return true;
  }

  elements.saveState.textContent = "保存エラー";
  window.alert("端末内保存に失敗しました。JSONバックアップを書き出してください。");
  return false;
}

async function hydrateFromIndexedDb() {
  try {
    const indexedState = await loadStateFromIndexedDb();
    if (indexedState && isStateNewer(indexedState, appState)) {
      appState = indexedState;
      render();
      await saveStateNow("IndexedDBから復元済み");
      return;
    }
    await saveStateNow("保存済み（端末内）");
  } catch (error) {
    console.warn("IndexedDB load failed", error);
    await saveStateNow("保存済み（localStorage）");
  }
}

function render() {
  const project = currentProject();
  const chapter = activeChapter();
  project.lineChars = normalizeLineChars(project.lineChars);
  project.pageLines = normalizePageLines(project.pageLines);

  elements.projectTitle.value = project.title;
  elements.projectHeroTitle.value = project.title;
  elements.projectSubtitleInput.value = project.subtitle || "";
  elements.lineCharsInput.value = project.lineChars;
  elements.pageLinesInput.value = project.pageLines;
  elements.indexLineCharsInput.value = project.lineChars;
  elements.indexPageLinesInput.value = project.pageLines;
  elements.pageLinesHint.textContent = `${project.pageLines}行ごとに改ページを表示`;
  elements.chapterTitle.value = chapter.title;
  elements.editorChapterHeading.value = chapter.title;
  elements.editorUpdatedAt.textContent = formatDateTime(chapter.updatedAt);
  elements.chapterStatus.value = chapter.status || "draft";
  elements.chapterBody.value = chapter.body;
  renderProjectList();
  renderChapterList();
  renderIndex();
  renderStats();
  renderWritingGuide();
  syncGuideScroll();
  renderView();
}

function renderProjectList() {
  elements.projectList.innerHTML = "";
  elements.projectTotalCount.textContent = appState.projects.length.toLocaleString("ja-JP");

  appState.projects.forEach((project) => {
    const item = document.createElement("article");
    item.className = `project-card${project.id === appState.activeProjectId ? " is-active" : ""}`;
    item.dataset.openProject = project.id;
    item.innerHTML = `
      <h3>${escapeHtml(project.title || "無題の長編")}</h3>
    `;
    elements.projectList.appendChild(item);
  });
}

function renderChapterList() {
  const project = currentProject();
  elements.chapterList.innerHTML = "";
  project.chapters.forEach((chapter, index) => {
    const button = document.createElement("button");
    button.className = `chapter-item${chapter.id === project.activeChapterId ? " is-active" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <strong>${escapeHtml(chapter.title || `第${index + 1}話`)}</strong>
      <small>${chapterStatuses[chapter.status] || "下書き"} / ${countCharacters(chapter.body)}字</small>
    `;
    button.addEventListener("click", () => {
      openChapterForWriting(chapter.id);
    });
    elements.chapterList.appendChild(button);
  });
}

function openChapterForWriting(chapterId) {
  const project = currentProject();
  project.activeChapterId = chapterId;
  currentView = "editor";
  render();
  setFocusMode(true);
  scheduleSave();
}

function backToChapterIndex() {
  setFocusMode(false);
  currentView = "index";
  render();
}

function renderIndex() {
  const project = currentProject();
  elements.chapterIndexList.innerHTML = "";
  elements.indexTotalChars.textContent = projectCharacters(project).toLocaleString("ja-JP");

  project.chapters.forEach((chapter, index) => {
    const row = document.createElement("tr");
    row.dataset.openChapter = chapter.id;
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>
        <button class="index-title-button" type="button" data-open-chapter="${escapeHtml(chapter.id)}">
          <span>${escapeHtml(chapter.title || `第${index + 1}話`)}</span>
        </button>
      </td>
      <td>${formatDateShort(chapter.updatedAt)}</td>
      <td>${escapeHtml(formatDateTime(chapter.updatedAt))}</td>
      <td>
        <select class="inline-status-select" data-status-chapter="${escapeHtml(chapter.id)}">
          ${Object.entries(chapterStatuses)
            .map(([value, label]) => `<option value="${value}"${chapter.status === value ? " selected" : ""}>${label}</option>`)
            .join("")}
        </select>
      </td>
      <td><button class="open-chapter-button" type="button" data-open-chapter="${escapeHtml(chapter.id)}">…</button></td>
    `;
    elements.chapterIndexList.appendChild(row);
  });
}

function renderView() {
  const showProjects = currentView === "projects";
  const showIndex = currentView === "index";
  if (showProjects || showIndex) document.body.classList.remove("focus-mode");
  document.body.classList.toggle("project-list-mode", showProjects);
  document.body.classList.toggle("chapter-list-mode", showIndex);
  elements.projectView.hidden = !showProjects;
  elements.indexView.hidden = !showIndex;
  elements.editorView.hidden = showProjects || showIndex;
  elements.projectListButton.hidden = showProjects;
  elements.indexButton.hidden = showProjects || showIndex;
  elements.projectListButton.textContent = showProjects ? "✎" : "□";
  elements.projectListButton.title = showProjects ? "編集へ戻る" : "作品一覧";
  elements.projectListButton.setAttribute("aria-label", elements.projectListButton.title);
  elements.indexButton.textContent = showIndex ? "✎" : "☷";
  elements.indexButton.title = showIndex ? "編集へ戻る" : "目次";
  elements.indexButton.setAttribute("aria-label", elements.indexButton.title);
  elements.focusButton.disabled = showProjects || showIndex;
}

function renderStats() {
  const project = currentProject();
  const chapter = activeChapter();
  const paragraphs = chapter.body.split(/\n+/).filter((line) => line.trim()).length;
  elements.totalChars.textContent = projectCharacters(project).toLocaleString("ja-JP");
  elements.chapterCount.textContent = project.chapters.length.toLocaleString("ja-JP");
  elements.chapterStats.textContent = `${countCharacters(chapter.body).toLocaleString("ja-JP")}文字 / ${paragraphs.toLocaleString("ja-JP")}段落`;
}

function renderWritingGuide() {
  const project = currentProject();
  const chapter = activeChapter();
  const lineChars = normalizeLineChars(project.lineChars);
  const pageLines = normalizePageLines(project.pageLines);
  const metrics = editorMetrics();
  project.lineChars = lineChars;
  project.pageLines = pageLines;
  elements.pageLinesHint.textContent = `${pageLines}行ごとに改ページを表示`;
  elements.writingGuide.style.setProperty("--word-line-width", `${lineChars}em`);
  elements.pageGuide.style.setProperty("--word-page-height", `${pageLines * metrics.lineHeight}px`);
  elements.writingGuide.innerHTML = buildWritingGuide(chapter.body, lineChars);
  elements.pageGuide.innerHTML = buildPageGuide(pageLines, metrics);
}

function buildWritingGuide(text, lineChars) {
  const safeLineChars = normalizeLineChars(lineChars);
  if (!text) {
    return '<span class="guide-placeholder">本文を書くと、Word上の改行位置と改ページ位置の目安が表示されます。</span>';
  }

  return text.split("\n").map((line) => {
    const chars = Array.from(line);
    if (!chars.length) return '<span class="empty-line-sentinel" aria-hidden="true"></span>';

    return chars.map((char, index) => {
      const escapedChar = escapeHtml(char);
      const isWordLineEnd = (index + 1) % safeLineChars === 0 && index < chars.length - 1;
      return isWordLineEnd
        ? `${escapedChar}<span class="wrap-mark" aria-hidden="true"></span>`
        : escapedChar;
    }).join("");
  }).join("\n");
}

function editorMetrics() {
  const computed = window.getComputedStyle(elements.chapterBody);
  const fontSize = Number.parseFloat(computed.fontSize) || 16;
  return {
    lineHeight: Number.parseFloat(computed.lineHeight) || fontSize * 1.8,
    paddingTop: Number.parseFloat(computed.paddingTop) || 0,
    paddingBottom: Number.parseFloat(computed.paddingBottom) || 0
  };
}

function buildPageGuide(pageLines, metrics) {
  const safePageLines = normalizePageLines(pageLines);
  const pageHeight = safePageLines * metrics.lineHeight;
  const viewportHeight = elements.chapterBody.clientHeight || 0;
  if (!viewportHeight || !pageHeight) return "";

  const marks = [];
  for (let pageIndex = 1; pageIndex <= 4; pageIndex += 1) {
    const top = metrics.paddingTop + pageHeight * pageIndex - 1;
    if (top > viewportHeight + metrics.lineHeight) break;
    marks.push(`<span class="page-mark" data-page="${pageIndex + 1}" style="top:${top}px"></span>`);
  }

  return `<span class="page-guide-spacer" style="height:${viewportHeight}px"></span>${marks.join("")}`;
}

function syncGuideScroll() {
  elements.writingGuide.scrollTop = elements.chapterBody.scrollTop;
  elements.writingGuide.scrollLeft = elements.chapterBody.scrollLeft;
  elements.pageGuide.scrollTop = 0;
  elements.pageGuide.scrollLeft = 0;
}

function cursorVisualLine(text, cursor, lineChars) {
  const safeLineChars = normalizeLineChars(lineChars);
  const beforeCursor = text.slice(0, cursor);
  const lines = beforeCursor.split("\n");
  let visualLine = 0;

  lines.forEach((line, index) => {
    const charCount = Array.from(line).length;
    const wrappedLines = Math.max(1, Math.ceil(charCount / safeLineChars));
    visualLine += index === lines.length - 1 ? Math.max(0, wrappedLines - 1) : wrappedLines;
  });

  return visualLine;
}

function keepCursorVisible() {
  const body = elements.chapterBody;
  const project = currentProject();
  const { lineHeight, paddingTop, paddingBottom } = editorMetrics();
  const shortcutHeight = document.body.classList.contains("editor-keyboard-active")
    ? Math.max(48, document.querySelector(".shortcut-bar")?.offsetHeight || 48)
    : 36;
  const extraBottomRoom = shortcutHeight + lineHeight * 1.8;
  const line = cursorVisualLine(body.value, body.selectionEnd, project.lineChars);
  const cursorTop = paddingTop + line * lineHeight;
  const cursorBottom = cursorTop + lineHeight;
  const visibleTop = body.scrollTop + paddingTop;
  const visibleBottom = body.scrollTop + body.clientHeight - paddingBottom - extraBottomRoom;

  if (cursorBottom > visibleBottom) {
    body.scrollTop += cursorBottom - visibleBottom;
  } else if (cursorTop < visibleTop) {
    body.scrollTop = Math.max(0, cursorTop - paddingTop);
  }

  syncGuideScroll();
}

function scheduleCursorScroll() {
  window.requestAnimationFrame(keepCursorVisible);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function touchProject(project = currentProject()) {
  project.updatedAt = nowIso();
  appState.updatedAt = project.updatedAt;
}

function updateActiveChapter(field, value) {
  const chapter = activeChapter();
  chapter[field] = value;
  chapter.updatedAt = nowIso();
  touchProject();
  if (field === "title") {
    elements.chapterTitle.value = value;
    elements.editorChapterHeading.value = value;
  }
  elements.editorUpdatedAt.textContent = formatDateTime(chapter.updatedAt);
  renderChapterList();
  renderProjectList();
  renderIndex();
  renderStats();
  renderWritingGuide();
  syncGuideScroll();
  if (field === "body") scheduleCursorScroll();
  scheduleSave();
}

function commitBodyChange(nextValue, selectionStart, selectionEnd) {
  elements.chapterBody.value = nextValue;
  const chapter = activeChapter();
  chapter.body = nextValue;
  chapter.updatedAt = nowIso();
  touchProject();
  elements.editorUpdatedAt.textContent = formatDateTime(chapter.updatedAt);
  elements.chapterBody.setSelectionRange(selectionStart, selectionEnd);
  renderChapterList();
  renderProjectList();
  renderIndex();
  renderStats();
  renderWritingGuide();
  syncGuideScroll();
  scheduleCursorScroll();
  scheduleSave();
}

function insertIntoBody(text) {
  const body = elements.chapterBody;
  const start = body.selectionStart;
  const end = body.selectionEnd;
  const nextValue = `${body.value.slice(0, start)}${text}${body.value.slice(end)}`;
  const cursor = start + text.length;
  commitBodyChange(nextValue, cursor, cursor);
  body.focus();
}

function wrapBodySelection(open, close) {
  const body = elements.chapterBody;
  const start = body.selectionStart;
  const end = body.selectionEnd;
  const selected = body.value.slice(start, end);
  const nextValue = `${body.value.slice(0, start)}${open}${selected}${close}${body.value.slice(end)}`;
  const cursorStart = start + open.length;
  const cursorEnd = selected ? cursorStart + selected.length : cursorStart;
  commitBodyChange(nextValue, cursorStart, cursorEnd);
  body.focus();
}

async function copyAllBody() {
  const text = elements.chapterBody.value;
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
  } else {
    elements.chapterBody.focus();
    elements.chapterBody.select();
    document.execCommand("copy");
  }
  elements.saveState.textContent = "全文をコピーしました";
}

function runEditorCommand(command) {
  elements.chapterBody.focus();
  document.execCommand(command);
  const chapter = activeChapter();
  chapter.body = elements.chapterBody.value;
  chapter.updatedAt = nowIso();
  touchProject();
  renderChapterList();
  renderIndex();
  renderStats();
  renderWritingGuide();
  syncGuideScroll();
  scheduleCursorScroll();
  scheduleSave();
}

function moveBodyCursor(direction) {
  const body = elements.chapterBody;
  const chars = Array.from(body.value);
  const offsets = [0];
  let offset = 0;

  chars.forEach((char) => {
    offset += char.length;
    offsets.push(offset);
  });

  const current = body.selectionDirection === "backward" ? body.selectionStart : body.selectionEnd;
  const currentIndex = offsets.findIndex((item) => item >= current);
  const safeIndex = currentIndex === -1 ? offsets.length - 1 : currentIndex;
  const nextIndex = direction < 0
    ? Math.max(0, safeIndex - 1)
    : Math.min(offsets.length - 1, safeIndex + 1);

  body.focus();
  body.setSelectionRange(offsets[nextIndex], offsets[nextIndex]);
}

function updateShortcutBarPosition() {
  if (!document.body.classList.contains("editor-keyboard-active")) return;
  const viewport = window.visualViewport;
  if (!viewport) {
    document.documentElement.style.setProperty("--shortcut-bar-bottom", "0px");
    return;
  }
  const keyboardInset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
  document.documentElement.style.setProperty("--shortcut-bar-bottom", `${keyboardInset}px`);
}

function setShortcutBarActive(isActive) {
  document.body.classList.toggle("editor-keyboard-active", isActive);
  if (isActive) updateShortcutBarPosition();
  else document.documentElement.style.setProperty("--shortcut-bar-bottom", "0px");
}

function safeFileName(value) {
  return String(value || "story-desk")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function timestampForFile() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function downloadBlob(content, fileName, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildPlainTextProject(project = currentProject()) {
  const lines = [
    project.title,
    `保存日時: ${new Date().toLocaleString("ja-JP")}`,
    `総文字数: ${projectCharacters(project).toLocaleString("ja-JP")}字`,
    ""
  ];

  project.chapters.forEach((chapter) => {
    lines.push("=".repeat(32));
    lines.push(chapter.title || "無題の話");
    lines.push("=".repeat(32), "");
    lines.push(`ステータス: ${chapterStatuses[chapter.status] || "下書き"}`);
    lines.push(`文字数: ${countCharacters(chapter.body).toLocaleString("ja-JP")}字`);
    lines.push(`最終更新: ${formatDateTime(chapter.updatedAt)}`, "");
    lines.push(chapter.body || "", "");
  });

  return lines.join("\n");
}

function exportProjectText() {
  const project = currentProject();
  downloadBlob(
    buildPlainTextProject(project),
    `${safeFileName(project.title)}-${timestampForFile()}-all.txt`,
    "text/plain;charset=utf-8"
  );
  saveStateNow("TXTを書き出しました");
}

async function exportStateBackup() {
  await saveStateNow("JSONバックアップ準備中");
  const project = currentProject();
  downloadBlob(
    buildPlainTextProject(project),
    `${safeFileName(project.title)}-${timestampForFile()}-all.txt`,
    "text/plain;charset=utf-8"
  );

  const backup = {
    app: "Story Desk",
    backupVersion: appDataVersion,
    exportedAt: nowIso(),
    state: cloneStateForSave()
  };

  downloadBlob(
    JSON.stringify(backup, null, 2),
    `story-desk-${timestampForFile()}-backup.json`,
    "application/json;charset=utf-8"
  );
  elements.saveState.textContent = "TXTとJSONを書き出しました";
}

async function restoreProjectFromFile(file) {
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const restoredState = normalizeAppState(parsed.state || parsed.appState || parsed.project || parsed);
    const confirmed = window.confirm("現在の端末内データを、選択したJSONバックアップで置き換えます。続けますか。");
    if (!confirmed) return;

    appState = {
      ...restoredState,
      updatedAt: nowIso()
    };
    currentView = "projects";
    render();
    await saveStateNow("JSONから復元済み");
    window.alert("JSONバックアップから復元しました。");
  } catch (error) {
    console.error(error);
    window.alert("JSONを読み込めませんでした。Story Deskのバックアップファイルを選んでください。");
  } finally {
    elements.restoreFileInput.value = "";
  }
}

elements.projectTitle.addEventListener("input", (event) => {
  const project = currentProject();
  project.title = event.target.value;
  elements.projectHeroTitle.value = project.title;
  touchProject(project);
  renderProjectList();
  scheduleSave();
});

elements.projectHeroTitle.addEventListener("input", (event) => {
  const project = currentProject();
  project.title = event.target.value;
  elements.projectTitle.value = project.title;
  touchProject(project);
  renderProjectList();
  scheduleSave();
});

elements.projectSubtitleInput.addEventListener("input", (event) => {
  const project = currentProject();
  project.subtitle = event.target.value;
  touchProject(project);
  scheduleSave();
});

elements.lineCharsInput.addEventListener("input", (event) => {
  const project = currentProject();
  const nextValue = parsePositiveIntegerInput(event.target.value);
  if (!nextValue) return;
  project.lineChars = nextValue;
  elements.indexLineCharsInput.value = nextValue;
  touchProject(project);
  renderWritingGuide();
  scheduleSave();
});

elements.pageLinesInput.addEventListener("input", (event) => {
  const project = currentProject();
  const nextValue = parsePositiveIntegerInput(event.target.value);
  if (!nextValue) return;
  project.pageLines = nextValue;
  elements.indexPageLinesInput.value = nextValue;
  elements.pageLinesHint.textContent = `${project.pageLines}行ごとに改ページを表示`;
  touchProject(project);
  renderWritingGuide();
  scheduleSave();
});

elements.indexLineCharsInput.addEventListener("input", (event) => {
  const project = currentProject();
  const nextValue = parsePositiveIntegerInput(event.target.value);
  if (!nextValue) return;
  project.lineChars = nextValue;
  elements.lineCharsInput.value = nextValue;
  touchProject(project);
  renderWritingGuide();
  scheduleSave();
});

elements.indexPageLinesInput.addEventListener("input", (event) => {
  const project = currentProject();
  const nextValue = parsePositiveIntegerInput(event.target.value);
  if (!nextValue) return;
  project.pageLines = nextValue;
  elements.pageLinesInput.value = nextValue;
  elements.pageLinesHint.textContent = `${project.pageLines}行ごとに改ページを表示`;
  touchProject(project);
  renderWritingGuide();
  scheduleSave();
});

elements.lineCharsInput.addEventListener("blur", () => {
  elements.lineCharsInput.value = normalizeLineChars(currentProject().lineChars);
});

elements.pageLinesInput.addEventListener("blur", () => {
  elements.pageLinesInput.value = normalizePageLines(currentProject().pageLines);
});

elements.indexLineCharsInput.addEventListener("blur", () => {
  elements.indexLineCharsInput.value = normalizeLineChars(currentProject().lineChars);
});

elements.indexPageLinesInput.addEventListener("blur", () => {
  elements.indexPageLinesInput.value = normalizePageLines(currentProject().pageLines);
});

elements.chapterTitle.addEventListener("input", (event) => updateActiveChapter("title", event.target.value));
elements.editorChapterHeading.addEventListener("input", (event) => updateActiveChapter("title", event.target.value));
elements.chapterStatus.addEventListener("change", (event) => updateActiveChapter("status", event.target.value));
elements.chapterBody.addEventListener("input", (event) => updateActiveChapter("body", event.target.value));
elements.chapterBody.addEventListener("scroll", syncGuideScroll);
elements.chapterBody.addEventListener("keyup", scheduleCursorScroll);
elements.chapterBody.addEventListener("click", scheduleCursorScroll);
elements.chapterBody.addEventListener("compositionend", scheduleCursorScroll);
elements.chapterBody.addEventListener("focus", () => setShortcutBarActive(true));
elements.chapterBody.addEventListener("blur", () => {
  window.setTimeout(() => {
    if (document.activeElement !== elements.chapterBody) setShortcutBarActive(false);
  }, 120);
});

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", updateShortcutBarPosition);
  window.visualViewport.addEventListener("resize", renderWritingGuide);
  window.visualViewport.addEventListener("scroll", updateShortcutBarPosition);
}

elements.addChapterButton.addEventListener("click", () => {
  const project = currentProject();
  if (project.chapters.length >= maxChapters) {
    window.alert(`1作品で管理できる話数は最大${maxChapters}話です。`);
    return;
  }

  const timestamp = nowIso();
  const chapter = {
    id: createId(),
    title: `第${project.chapters.length + 1}話`,
    body: "",
    outline: "",
    characters: "",
    world: "",
    status: "draft",
    updatedAt: timestamp
  };
  project.chapters.push(chapter);
  project.activeChapterId = chapter.id;
  touchProject(project);
  currentView = "index";
  render();
  scheduleSave();
});

async function createNewProject() {
  await saveStateNow("新規作品を作成中");
  const project = createEmptyProject(`新しい作品 ${appState.projects.length + 1}`);
  appState.projects.push(project);
  appState.activeProjectId = project.id;
  appState.updatedAt = project.updatedAt;
  currentView = "index";
  render();
  scheduleSave();
}

elements.newProjectButton.addEventListener("click", createNewProject);
elements.projectCreateButton.addEventListener("click", createNewProject);

elements.backToProjectsButton.addEventListener("click", () => {
  currentView = "projects";
  render();
});

elements.backToChaptersButton.addEventListener("click", () => {
  backToChapterIndex();
});

elements.editorBackButton.addEventListener("click", backToChapterIndex);

elements.projectListButton.addEventListener("click", () => {
  currentView = "projects";
  render();
});

elements.projectList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-project]");
  if (!button) return;
  appState.activeProjectId = button.dataset.openProject;
  currentView = "index";
  render();
  scheduleSave();
});

elements.indexButton.addEventListener("click", () => {
  currentView = "index";
  render();
});

elements.chapterIndexList.addEventListener("click", (event) => {
  if (event.target.closest("select")) return;
  const button = event.target.closest("[data-open-chapter]");
  if (!button) return;
  openChapterForWriting(button.dataset.openChapter);
});

elements.chapterIndexList.addEventListener("change", (event) => {
  const statusSelect = event.target.closest("[data-status-chapter]");
  if (!statusSelect) return;
  const project = currentProject();
  const chapter = project.chapters.find((item) => item.id === statusSelect.dataset.statusChapter);
  if (!chapter) return;
  chapter.status = statusSelect.value;
  chapter.updatedAt = nowIso();
  touchProject(project);
  if (chapter.id === project.activeChapterId) elements.chapterStatus.value = chapter.status;
  renderChapterList();
  renderIndex();
  renderProjectList();
  scheduleSave();
});

elements.themeButton.addEventListener("click", toggleTheme);
elements.projectMenuThemeButton.addEventListener("click", toggleTheme);
elements.exportButton.addEventListener("click", exportProjectText);
elements.chapterMenuExportButton.addEventListener("click", exportProjectText);
elements.backupButton.addEventListener("click", exportStateBackup);
elements.projectMenuBackupButton.addEventListener("click", exportStateBackup);
elements.restoreButton.addEventListener("click", () => elements.restoreFileInput.click());
elements.projectMenuRestoreButton.addEventListener("click", () => elements.restoreFileInput.click());
elements.restoreFileInput.addEventListener("change", (event) => restoreProjectFromFile(event.target.files?.[0]));
elements.chapterMenuAddButton.addEventListener("click", () => elements.addChapterButton.click());

elements.shortcutButtons.forEach((button) => {
  button.addEventListener("pointerdown", (event) => event.preventDefault());
  button.addEventListener("click", async () => {
    const pair = button.dataset.insertPair;
    if (pair) {
      const [open, close] = pair.split("|");
      wrapBodySelection(open, close);
      return;
    }
    if (button.dataset.insert) {
      insertIntoBody(button.dataset.insert);
      return;
    }
    if (button.dataset.action === "undo") {
      runEditorCommand("undo");
      return;
    }
    if (button.dataset.action === "redo") {
      runEditorCommand("redo");
      return;
    }
    if (button.dataset.action === "cursor-left") {
      moveBodyCursor(-1);
      return;
    }
    if (button.dataset.action === "cursor-right") {
      moveBodyCursor(1);
      return;
    }
    if (button.dataset.action === "copy-all") {
      await copyAllBody();
      elements.chapterBody.focus();
    }
  });
});

elements.focusButton.addEventListener("click", () => {
  setFocusMode(!document.body.classList.contains("focus-mode"));
});

elements.focusExitButton.addEventListener("click", () => {
  setFocusMode(false);
});

function setFocusMode(isActive) {
  document.body.classList.toggle("focus-mode", isActive);
  elements.focusButton.textContent = isActive ? "✕" : "⛶";
  elements.focusButton.title = isActive ? "集中モードを解除" : "集中";
  elements.focusButton.setAttribute("aria-label", elements.focusButton.title);
  currentView = "editor";
  renderView();
  elements.chapterBody.focus();
}

let serviceWorkerReloaded = false;

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (serviceWorkerReloaded) return;
    serviceWorkerReloaded = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .then((registration) => registration.update())
      .catch(() => {});
  });
}

render();
hydrateFromIndexedDb();
