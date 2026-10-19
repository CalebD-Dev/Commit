const STORAGE_KEY = "commit.tasks.v1";
const THEME_KEY = "commit.theme.v1";
const projects = ["Work", "Personal", "Learning", "Health"];
const projectClasses = {
  Work: "dot-work",
  Personal: "dot-personal",
  Learning: "dot-learning",
  Health: "dot-health",
};
const viewDetails = {
  today: { title: "Today", list: "Today's tasks", subtitle: "One thing at a time. You've got this." },
  week: { title: "This week", list: "This week's tasks", subtitle: "Your plans for the week, one day at a time." },
  month: { title: "This month", list: "This month's tasks", subtitle: "A little progress adds up over the month." },
  upcoming: { title: "Upcoming", list: "Coming up", subtitle: "A clear view of what's ahead." },
  completed: { title: "Completed", list: "You did that", subtitle: "Look at all the progress you've made." },
};

const elements = {
  breadcrumb: document.querySelector("#breadcrumb-view"),
  completedToday: document.querySelector("#completed-today"),
  currentDate: document.querySelector("#current-date"),
  dialog: document.querySelector("#task-dialog"),
  dialogKicker: document.querySelector("#dialog-kicker"),
  dialogTitle: document.querySelector("#dialog-title"),
  form: document.querySelector("#task-form"),
  listTitle: document.querySelector("#list-title"),
  pageSubtitle: document.querySelector("#page-subtitle"),
  pageTitle: document.querySelector("#page-title"),
  progressCount: document.querySelector("#progress-count"),
  progressFill: document.querySelector("#progress-fill"),
  progressLabel: document.querySelector("#progress-label"),
  progressTitle: document.querySelector("#progress-title"),
  progressTrack: document.querySelector(".progress-track"),
  search: document.querySelector("#search-input"),
  sort: document.querySelector("#sort-select"),
  submitLabel: document.querySelector("#submit-label"),
  storageMessage: document.querySelector("#storage-message"),
  taskList: document.querySelector("#task-list"),
  taskTotal: document.querySelector("#task-total"),
  themeToggle: document.querySelector("#theme-toggle"),
  toast: document.querySelector("#toast"),
  toastMessage: document.querySelector("#toast-message"),
  undoDelete: document.querySelector("#undo-delete"),
};

let tasks = loadTasks();
let activeView = "today";
let activeProject = null;
let searchTerm = "";
let toastTimer;
let editTaskId = null;
let pendingDeletion = null;

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

function loadTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch (error) {
    console.error("Commit could not load the saved theme.", error);
    showStorageMessage("Your display preference couldn't be read from this browser.");
    return "light";
  }
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = theme;
  elements.themeToggle.setAttribute("aria-pressed", String(isDark));
  elements.themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
  elements.themeToggle.title = `Switch to ${isDark ? "light" : "dark"} mode`;
  document.querySelector('meta[name="theme-color"]').content = isDark ? "#202720" : "#e9ece8";
}

function setTheme(theme) {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    console.error("Commit could not save the display preference.", error);
    showStorageMessage("Your theme changed, but this browser couldn't save the preference.");
  }
}

applyTheme(loadTheme());

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateRange(view, now = new Date()) {
  const today = localDateString(now);
  if (view === "today") return { start: today, end: today };

  if (view === "week") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start: localDateString(start), end: localDateString(end) };
  }

  const year = now.getFullYear();
  const month = now.getMonth();
  return {
    start: `${year}-${String(month + 1).padStart(2, "0")}-01`,
    end: localDateString(new Date(year, month + 1, 0)),
  };
}

function isInView(task, view, today = localDateString()) {
  if (view === "completed") return task.completed;
  if (view === "upcoming") return Boolean(task.dueDate && task.dueDate > today);
  if (task.completed) return false;
  if (!task.dueDate) return ["today", "week", "month"].includes(view);
  const range = getDateRange(view);
  return Boolean(range && task.dueDate >= range.start && task.dueDate <= range.end);
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
    return isInView(task, activeView, today);
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
    <div class="task-actions">
      <button class="edit-task" type="button" aria-label="Edit ${safeTitle}" title="Edit task" data-edit-task="${escapeHtml(task.id)}">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10.8 3.2 2 2-7.7 7.7-2.7.7.7-2.7 7.7-7.7Z" /><path d="m9.5 4.5 2 2" /></svg>
      </button>
      <button class="delete-task" type="button" aria-label="Delete ${safeTitle}" title="Delete task" data-delete-task="${escapeHtml(task.id)}">×</button>
    </div>
  </article>`;
}

function emptyMessage() {
  if (searchTerm) return { icon: "⌕", title: "No matches found", text: "Try a different search, or clear your search to see all tasks." };
  if (activeView === "completed") return { icon: "✓", title: "Your next win is waiting", text: "Tasks you complete will find their way here. Start with one small thing." };
  if (activeView === "today") return { icon: "☀", title: "A little breathing room", text: "Nothing due today. Enjoy the space, or add a task when you're ready." };
  if (activeView === "week") return { icon: "▦", title: "Your week has room to breathe", text: "Tasks due this week and tasks without a due date will show up here." };
  if (activeView === "month") return { icon: "▦", title: "A fresh month of possibilities", text: "Tasks due this month and tasks without a due date will show up here." };
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
  ["today", "week", "month"].forEach((view) => {
    const count = incomplete.filter((task) => isInView(task, view, today)).length;
    document.querySelector(`[data-count="${view}"]`).textContent = String(count);
  });
  document.querySelector('[data-count="upcoming"]').textContent = String(incomplete.filter((task) => task.dueDate && task.dueDate > today).length);
  projects.forEach((project) => {
    const count = incomplete.filter((task) => task.project === project).length;
    document.querySelector(`[data-project-count="${project}"]`).textContent = String(count);
  });

  const completedToday = tasks.filter((task) => task.completedAt && task.completedAt.startsWith(today)).length;
  const progressView = ["today", "week", "month"].includes(activeView) ? activeView : "today";
  const progressTasks = tasks.filter((task) =>
    (!activeProject || task.project === activeProject) &&
    (task.completed
      ? isInView(task, "completed") && isDueWithinRange(task, progressView)
      : isInView(task, progressView, today)),
  );
  const finishedTasks = progressTasks.filter((task) => task.completed).length;
  const progress = progressTasks.length ? Math.round((finishedTasks / progressTasks.length) * 100) : 0;
  const periodLabel = { today: "Today's progress", week: "This week's progress", month: "This month's progress" }[progressView];
  elements.completedToday.textContent = String(completedToday);
  elements.progressTitle.textContent = periodLabel;
  elements.progressLabel.textContent = `${progress}%`;
  elements.progressCount.textContent = `${finishedTasks} of ${progressTasks.length} tasks`;
  elements.progressFill.style.width = `${progress}%`;
  elements.progressTrack.setAttribute("aria-valuenow", String(progress));
  elements.progressTrack.setAttribute("aria-label", periodLabel);
}

function isDueWithinRange(task, view) {
  if (!task.dueDate) return ["today", "week", "month"].includes(view);
  const range = getDateRange(view);
  return Boolean(range && task.dueDate >= range.start && task.dueDate <= range.end);
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

function openDialog(taskId = null) {
  elements.form.reset();
  document.querySelector("#task-title").setCustomValidity("");
  const task = taskId ? tasks.find((item) => item.id === taskId) : null;
  if (taskId && !task) return;
  editTaskId = taskId;
  elements.dialogTitle.textContent = task ? "Edit task" : "Add a task";
  elements.dialogKicker.textContent = task ? "UPDATE YOUR TASK" : "MAKE A LITTLE PROGRESS";
  elements.submitLabel.textContent = task ? "Save changes" : "Add task";
  document.querySelector("#task-title").value = task?.title || "";
  document.querySelector("#task-project").value = task?.project || projects[0];
  document.querySelector("#task-priority").value = task?.priority || "medium";
  document.querySelector("#task-due").value = task?.dueDate || (task ? "" : localDateString());
  elements.dialog.showModal();
  document.querySelector("#task-title").focus();
}

function closeDialog() {
  elements.dialog.close();
}

function saveTask(formData) {
  const title = formData.get("title").trim();
  if (editTaskId) {
    tasks = tasks.map((task) => task.id === editTaskId
      ? {
        ...task,
        title,
        project: formData.get("project"),
        priority: formData.get("priority"),
        dueDate: formData.get("dueDate") || null,
      }
      : task);
    saveTasks();
    render();
    closeDialog();
    showToast("Changes saved.");
    editTaskId = null;
    return;
  }

  const task = {
    id: globalThis.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title,
    project: formData.get("project"),
    priority: formData.get("priority"),
    dueDate: formData.get("dueDate") || null,
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  tasks.unshift(task);
  saveTasks();
  activeView = "today";
  activeProject = null;
  searchTerm = "";
  elements.search.value = "";
  render();
  closeDialog();
  showToast("Task added.");
  editTaskId = null;
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
  const index = tasks.findIndex((task) => task.id === id);
  if (index === -1) return;
  pendingDeletion = { task: tasks[index], index };
  tasks.splice(index, 1);
  saveTasks();
  render();
  showUndoToast();
}

function undoDelete() {
  if (!pendingDeletion) return;
  const { task, index } = pendingDeletion;
  tasks.splice(Math.min(index, tasks.length), 0, task);
  pendingDeletion = null;
  clearTimeout(toastTimer);
  saveTasks();
  render();
  showToast("Task restored.");
}

function showToast(message) {
  pendingDeletion = null;
  elements.toastMessage.textContent = message;
  elements.undoDelete.hidden = true;
  elements.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2400);
}

function showUndoToast() {
  elements.toastMessage.textContent = "Task deleted.";
  elements.undoDelete.hidden = false;
  elements.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    pendingDeletion = null;
    elements.toast.classList.remove("is-visible");
  }, 5000);
}

function setView(view) {
  activeView = view;
  activeProject = null;
  render();
}

document.querySelectorAll("[data-open-dialog]").forEach((button) => button.addEventListener("click", () => openDialog()));
document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", closeDialog));
document.querySelectorAll("[data-view-link]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.viewLink)));
document.querySelector("[data-home-link]").addEventListener("click", (event) => {
  event.preventDefault();
  setView("today");
});
document.querySelectorAll("[data-project-link]").forEach((button) => button.addEventListener("click", () => {
  activeProject = button.dataset.projectLink;
  render();
}));

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!elements.form.reportValidity()) return;
  const titleInput = document.querySelector("#task-title");
  if (!titleInput.value.trim()) {
    titleInput.setCustomValidity("Please enter a task name.");
    titleInput.reportValidity();
    return;
  }
  saveTask(new FormData(elements.form));
});
document.querySelector("#task-title").addEventListener("input", (event) => event.target.setCustomValidity(""));

elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) closeDialog();
});

elements.taskList.addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit-task]");
  if (edit) {
    openDialog(edit.dataset.editTask);
    return;
  }
  const toggle = event.target.closest("[data-toggle-task]");
  if (toggle) {
    toggleTask(toggle.dataset.toggleTask);
    return;
  }
  const remove = event.target.closest("[data-delete-task]");
  if (remove) deleteTask(remove.dataset.deleteTask);
});
elements.undoDelete.addEventListener("click", undoDelete);
elements.themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
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
