const STORAGE_KEY = "commit.tasks.v1";
const summary = document.querySelector("#summary");
const results = document.querySelector("#results");
const frame = document.querySelector("#test-app");
const originalTasks = localStorage.getItem(STORAGE_KEY);
const testPrefix = `Commit browser test ${Date.now()}`;
let passed = 0;
let failed = 0;

function report(name, error = null) {
  const item = document.createElement("li");
  item.className = error ? "fail" : "pass";
  item.textContent = `${error ? "FAIL" : "PASS"} — ${name}${error ? `: ${error.message}` : ""}`;
  results.append(item);
  if (error) failed += 1;
  else passed += 1;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function appDocument() {
  return frame.contentDocument;
}

function findTask(title) {
  return [...appDocument().querySelectorAll(".task-row")]
    .find((row) => row.querySelector(".task-name")?.textContent === title);
}

function click(selector, root = appDocument()) {
  const element = root.querySelector(selector);
  assert(element, `Could not find ${selector}`);
  element.click();
  return element;
}

function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function currentWeekDate(now) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const tuesday = new Date(monday);
  tuesday.setDate(tuesday.getDate() + 1);
  const wednesday = new Date(monday);
  wednesday.setDate(wednesday.getDate() + 2);
  return localDate(tuesday).startsWith(localDate(now)) ? localDate(wednesday) : localDate(tuesday);
}

function addTask(title, project, priority, dueDate) {
  click("[data-open-dialog]");
  const doc = appDocument();
  doc.querySelector("#task-title").value = title;
  doc.querySelector("#task-project").value = project;
  doc.querySelector("#task-priority").value = priority;
  doc.querySelector("#task-due").value = dueDate;
  click("#task-form .submit-button");
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  assert(saved.some((task) => task.title === title), `Task "${title}" was not saved`);
}

async function runTest(name, callback) {
  try {
    await callback();
    report(name);
  } catch (error) {
    report(name, error);
  }
}

async function runTests() {
  try {
    localStorage.setItem(STORAGE_KEY, "[]");
    await new Promise((resolve, reject) => {
      frame.addEventListener("load", resolve, { once: true });
      frame.addEventListener("error", () => reject(new Error("The app frame failed to load.")), { once: true });
      frame.src = "../index.html?browser-test=1";
    });

    await runTest("Today is the default view and Inbox is not shown", () => {
      assert(appDocument().querySelector("#page-title").textContent === "Today", "Today is not the initial view");
      assert(![...appDocument().querySelectorAll("[data-view-link]")].some((item) => item.textContent.includes("Inbox")), "Inbox navigation still exists");
    });

    await runTest("Whitespace-only task titles are rejected", () => {
      click("[data-open-dialog]");
      const doc = appDocument();
      doc.querySelector("#task-title").value = "   ";
      click("#task-form .submit-button");
      assert(doc.querySelector("#task-dialog").open, "The dialog closed after an invalid title");
      assert(JSON.parse(localStorage.getItem(STORAGE_KEY)).length === 0, "An invalid task was saved");
      click("[data-close-dialog]");
    });

    const now = new Date();
    const today = localDate(now);
    const todayTask = `${testPrefix} today`;
    await runTest("New task defaults to today and persists in local storage", () => {
      click("[data-open-dialog]");
      const doc = appDocument();
      doc.querySelector("#task-title").value = todayTask;
      assert(doc.querySelector("#task-due").value === today, "New tasks do not default to today's date");
      click("#task-form .submit-button");
      assert(findTask(todayTask), "Today's task is missing from the Today list");
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      assert(saved.some((task) => task.title === todayTask && task.dueDate === today), "Today's task was not saved");
    });

    await runTest("Tasks remain saved after refreshing the app", async () => {
      await new Promise((resolve) => {
        frame.addEventListener("load", resolve, { once: true });
        frame.contentWindow.location.reload();
      });
      assert(findTask(todayTask), "The saved task did not return after refresh");
    });

    const weekTask = `${testPrefix} week`;
    await runTest("This week filters tasks to the current Monday–Sunday week", () => {
      addTask(weekTask, "Work", "high", currentWeekDate(now));
      const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const daysUntilNextMonday = ((8 - nextMonday.getDay()) % 7) || 7;
      nextMonday.setDate(nextMonday.getDate() + daysUntilNextMonday);
      const nextWeekTask = `${testPrefix} next week`;
      addTask(nextWeekTask, "Work", "medium", localDate(nextMonday));
      click('[data-view-link="week"]');
      assert(findTask(weekTask), "A task dated this week is missing from This week");
      assert(!findTask(nextWeekTask), "A task dated next week appears in This week");
      click('[data-view-link="today"]');
      assert(!findTask(weekTask), "A task dated another day appears in Today");
    });

    const monthTask = `${testPrefix} month`;
    await runTest("This month includes tasks dated in the current month", () => {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      if (localDate(firstOfMonth) === today) firstOfMonth.setDate(2);
      addTask(monthTask, "Learning", "low", localDate(firstOfMonth));
      const nextMonthTask = `${testPrefix} next month`;
      const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      addTask(nextMonthTask, "Learning", "low", localDate(firstOfNextMonth));
      click('[data-view-link="month"]');
      assert(findTask(monthTask), "A task dated this month is missing from This month");
      assert(!findTask(nextMonthTask), "A task dated next month appears in This month");
    });

    await runTest("Tasks can be edited and the changes persist", () => {
      click('[data-view-link="today"]');
      const row = findTask(todayTask);
      assert(row, "The test task is missing before editing");
      click("[data-edit-task]", row);
      const doc = appDocument();
      doc.querySelector("#task-title").value = `${todayTask} edited`;
      doc.querySelector("#task-project").value = "Health";
      doc.querySelector("#task-priority").value = "high";
      click("#task-form .submit-button");
      assert(findTask(`${todayTask} edited`), "Edited task title was not rendered");
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      assert(saved.some((task) => task.title === `${todayTask} edited` && task.project === "Health" && task.priority === "high"), "Edited task fields were not persisted");
    });

    await runTest("Tasks can be completed and restored from Completed", () => {
      const row = findTask(`${todayTask} edited`);
      assert(row, "Edited task is missing before completion");
      click("[data-toggle-task]", row);
      click('[data-view-link="completed"]');
      assert(findTask(`${todayTask} edited`), "Completed task is missing from Completed");
    });

    await runTest("Deleting a task can be undone", () => {
      const row = findTask(`${todayTask} edited`);
      assert(row, "Completed task is missing before delete");
      click("[data-delete-task]", row);
      assert(!findTask(`${todayTask} edited`), "Deleted task is still visible");
      click("#undo-delete");
      assert(findTask(`${todayTask} edited`), "Undo did not restore the deleted task");
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      assert(saved.some((task) => task.title === `${todayTask} edited` && task.completed), "Undo did not persist the restored task");
    });
  } catch (error) {
    report("Test setup", error);
  } finally {
    if (originalTasks === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, originalTasks);
    summary.textContent = `${passed} passed, ${failed} failed. Your original task list has been restored.`;
    frame.remove();
  }
}

runTests();
