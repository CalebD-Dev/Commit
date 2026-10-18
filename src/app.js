const STORAGE_KEY = "commit.tasks.v1";
const projects = ["Work", "Personal", "Learning", "Health"];
const projectClasses = {
  Work: "dot-work",
  Personal: "dot-personal",
  Learning: "dot-learning",
  Health: "dot-health",
};
const viewDetails = {
  inbox: { title: "Inbox", list: "All tasks", subtitle: "A little progress goes a long way." },
  today: { title: "Today", list: "Today's tasks", subtitle: "One thing at a time. You've got this." },
  upcoming: { title: "Upcoming", list: "Coming up", subtitle: "A clear view of what's ahead." },
  completed: { title: "Completed", list: "You did that", subtitle: "Look at all the progress you've made." },
};

const elements = {
  breadcrumb: document.querySelector("#breadcrumb-view"),
  completedToday: document.querySelector("#completed-today"),
  currentDate: document.querySelector("#current-date"),
  dialog: document.querySelector("#task-dialog"),
  form: document.querySelector("#task-form"),
  listTitle: document.querySelector("#list-title"),
  pageSubtitle: document.querySelector("#page-subtitle"),
  pageTitle: document.querySelector("#page-title"),
  progressCount: document.querySelector("#progress-count"),
  progressFill: document.querySelector("#progress-fill"),
  progressLabel: document.querySelector("#progress-label"),
  progressTrack: document.querySelector(".progress-track"),
  search: document.querySelector("#search-input"),
  sort: document.querySelector("#sort-select"),
  storageMessage: document.querySelector("#storage-message"),
  taskList: document.querySelector("#task-list"),
  taskTotal: document.querySelector("#task-total"),
  toast: document.querySelector("#toast"),
};

let tasks = loadTasks();
let activeView = "inbox";
let activeProject = null;
let searchTerm = "";
let toastTimer;

function isTask(value) {
  return value &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    projects.includes(value.project) &&
    ["low", "medium", "high"].includes(value.priority) &&
    typeof value.completed === "boolean" &&
    typeof value.createdAt === "string" &&
    (value.dueDate === null || typeof value.dueDate === "string") &&
    (value.completedAt === null || typeof value.completedAt === "string");
}

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || !parsed.every(isTask)) {
      throw new Error("Saved task data has an unexpected format.");
    }
    return parsed;
  } catch (error) {
    console.error("Commit could not load saved tasks.", error);
    showStorageMessage("Saved tasks couldn't be read. Your existing browser data was left untouched.");
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    elements.storageMessage.hidden = true;
    return true;
  } catch (error) {
    console.error("Commit could not save tasks.", error);
    showStorageMessage("Changes couldn't be saved on this device. Check your browser's storage settings.");
    return false;
  }
}

function showStorageMessage(message) {
  elements.storageMessage.textContent = message;
  elements.storageMessage.hidden = false;
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateString, options = { month: "short", day: "numeric" }) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, options).format(new Date(year, month - 1, day));
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function visibleTasks() {
  const today = localDateString();
  let result = tasks.filter((task) => {
    if (activeProject && task.project !== activeProject) return false;
    if (activeView === "completed") return task.completed;
    if (task.completed) return false;
    if (activeView === "today") return task.dueDate === today;
    if (activeView === "upcoming") return task.dueDate && task.dueDate > today;
    return true;
  });

  if (searchTerm) {
    result = result.filter((task) => task.title.toLocaleLowerCase().includes(searchTerm));
  }

  const sortMode = elements.sort.value;
  return result.sort((a, b) => {
    if (activeView === "completed") return (b.completedAt || "").localeCompare(a.completedAt || "");
    if (sortMode === "priority") {
      const rank = { high: 0, medium: 1, low: 2 };
      return rank[a.priority] - rank[b.priority] || compareDueDates(a, b);
    }
    if (sortMode === "created") return b.createdAt.localeCompare(a.createdAt);
    return compareDueDates(a, b) || b.createdAt.localeCompare(a.createdAt);
  });
}

function compareDueDates(a, b) {
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
}

function getDueLabel(task) {
  if (!task.dueDate) return "";
  const today = localDateString();
  if (task.dueDate === today) return "Today";
  if (task.dueDate < today && !task.completed) return "Overdue · " + formatDate(task.dueDate);
  return formatDate(task.dueDate);
}

function renderTask(task) {
  const dueLabel = getDueLabel(task);
  const overdue = dueLabel.startsWith("Overdue");
  const completed = task.completed;
  const safeTitle = escapeHtml(task.title);
  const projectClass = projectClasses[task.project];
  return `<article class="task-row${completed ? " is-complete" : ""}" data-task-id="${escapeHtml(task.id)}">
    <button class="task-check" type="button" aria-label="${completed ? "Mark incomplete" : "Complete"}: ${safeTitle}" aria-pressed="${completed}" data-toggle-task="${escapeHtml(task.id)}">
      <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2 6 2.5 2.5L10 3" /></svg>
    </button>
    <div class="task-main">
      <p class="task-name">${safeTitle}</p>
      <div class="task-meta">
        <span class="task-project"><span class="project-dot ${projectClass}"></span>${task.project}</span>
        ${dueLabel ? `<span class="meta-divider" aria-hidden="true"></span><span class="due-label${overdue ? " is-overdue" : ""}">${escapeHtml(dueLabel)}</span>` : ""}
      </div>
    </div>
    <span class="priority-label priority-${task.priority}">${task.priority}</span>
    <button class="delete-task" type="button" aria-label="Delete ${safeTitle}" title="Delete task" data-delete-task="${escapeHtml(task.id)}">×</button>
  </article>`;
}

function emptyMessage() {
  if (searchTerm) return { icon: "⌕", title: "No matches found", text: "Try a different search, or clear your search to see all tasks." };
  if (activeView === "completed") return { icon: "✓", title: "Your next win is waiting", text: "Tasks you complete will find their way here. Start with one small thing." };
  if (activeView === "today") return { icon: "☀", title: "A little breathing room", text: "Nothing due today. Enjoy the space, or add a task when you're ready." };
  if (activeView === "upcoming") return { icon: "↗", title: "Clear skies ahead", text: "Tasks with a future due date will show up here." };
  return { icon: "✳", title: "Make room for what matters", text: "Your list is a fresh start. Add a task and take the first small step." };
}

function renderList() {
  const list = visibleTasks();
  elements.taskTotal.textContent = String(list.length);
  if (list.length === 0) {
    const empty = emptyMessage();
    elements.taskList.innerHTML = `<div class="empty-state"><span class="empty-icon" aria-hidden="true">${empty.icon}</span><h3>${empty.title}</h3><p>${empty.text}</p></div>`;
  } else {
    elements.taskList.innerHTML = list.map(renderTask).join("");
  }
}

function renderCounts() {
  const today = localDateString();
  const incomplete = tasks.filter((task) => !task.completed);
  document.querySelector('[data-count="inbox"]').textContent = String(incomplete.length);
  document.querySelector('[data-count="today"]').textContent = String(incomplete.filter((task) => task.dueDate === today).length);
  document.querySelector('[data-count="upcoming"]').textContent = String(incomplete.filter((task) => task.dueDate && task.dueDate > today).length);
  projects.forEach((project) => {
    const count = incomplete.filter((task) => task.project === project).length;
    document.querySelector(`[data-project-count="${project}"]`).textContent = String(count);
  });

  const todaysTasks = tasks.filter((task) => task.dueDate === today);
  const completedToday = tasks.filter((task) => task.completedAt && task.completedAt.startsWith(today)).length;
  const finishedToday = todaysTasks.filter((task) => task.completed).length;
  const progress = todaysTasks.length ? Math.round((finishedToday / todaysTasks.length) * 100) : 0;
  elements.completedToday.textContent = String(completedToday);
  elements.progressLabel.textContent = `${progress}%`;
  elements.progressCount.textContent = `${finishedToday} of ${todaysTasks.length} tasks`;
  elements.progressFill.style.width = `${progress}%`;
  elements.progressTrack.setAttribute("aria-valuenow", String(progress));
}

function render() {
  const detail = viewDetails[activeView];
  const heading = activeProject || detail.title;
  elements.breadcrumb.textContent = heading;
  elements.pageTitle.textContent = heading;
  elements.pageSubtitle.textContent = activeProject ? `A little progress in ${activeProject.toLowerCase()} goes a long way.` : detail.subtitle;
  elements.listTitle.textContent = activeProject ? `${activeProject} tasks` : detail.list;
  document.querySelectorAll("[data-view-link]").forEach((button) => {
    const selected = !activeProject && button.dataset.viewLink === activeView;
    button.classList.toggle("is-active", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  document.querySelectorAll("[data-project-link]").forEach((button) => {
    const selected = button.dataset.projectLink === activeProject;
    button.classList.toggle("is-active", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  renderCounts();
  renderList();
}

function openDialog() {
  elements.form.reset();
  elements.dialog.showModal();
  document.querySelector("#task-title").focus();
}

function closeDialog() {
  elements.dialog.close();
}

function createTask(formData) {
  const task = {
    id: globalThis.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: formData.get("title").trim(),
    project: formData.get("project"),
    priority: formData.get("priority"),
    dueDate: formData.get("dueDate") || null,
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  tasks.unshift(task);
  saveTasks();
  activeView = "inbox";
  activeProject = null;
  searchTerm = "";
  elements.search.value = "";
  render();
  closeDialog();
  showToast("Task added. One step closer.");
}

function toggleTask(id) {
  tasks = tasks.map((task) => {
    if (task.id !== id) return task;
    const completed = !task.completed;
    return { ...task, completed, completedAt: completed ? new Date().toISOString() : null };
  });
  saveTasks();
  render();
}

function deleteTask(id) {
  tasks = tasks.filter((task) => task.id !== id);
  saveTasks();
  render();
  showToast("Task deleted.");
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2400);
}

function setView(view) {
  activeView = view;
  activeProject = null;
  render();
}

document.querySelectorAll("[data-open-dialog]").forEach((button) => button.addEventListener("click", openDialog));
document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", closeDialog));
document.querySelectorAll("[data-view-link]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.viewLink)));
document.querySelectorAll("[data-project-link]").forEach((button) => button.addEventListener("click", () => {
  activeView = "inbox";
  activeProject = button.dataset.projectLink;
  render();
}));

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!elements.form.reportValidity()) return;
  createTask(new FormData(elements.form));
});

elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) closeDialog();
});

elements.taskList.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-toggle-task]");
  if (toggle) {
    toggleTask(toggle.dataset.toggleTask);
    return;
  }
  const remove = event.target.closest("[data-delete-task]");
  if (remove) deleteTask(remove.dataset.deleteTask);
});

elements.search.addEventListener("input", () => {
  searchTerm = elements.search.value.trim().toLocaleLowerCase();
  renderList();
});
elements.sort.addEventListener("change", renderList);

document.addEventListener("keydown", (event) => {
  const typing = event.target instanceof HTMLElement &&
    (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName));
  if (event.key === "Escape" && elements.dialog.open) closeDialog();
  if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key.toLocaleLowerCase() === "n") {
    event.preventDefault();
    openDialog();
  }
  if (event.key === "/") {
    event.preventDefault();
    elements.search.focus();
  }
});

elements.currentDate.textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(new Date());

render();
