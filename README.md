# Commit

Commit is a calm, local-first to-do app for making steady progress. It runs in your browser without a server, account, build step, or third-party JavaScript dependencies.

## Project structure

```text
Commit/
├── index.html
├── README.md
├── src/
│   ├── app.js
│   └── styles.css
└── tests/
    ├── index.html
    └── tests.js
```

## Run it locally

1. Clone or download this repository.
2. Open `index.html` in a modern browser.

You can also serve the folder with any static file server, such as the VS Code Live Server extension. No install or build command is required.

## Features

- Create tasks with a project, priority, and optional due date.
- Edit tasks, mark them complete, restore them, or undo an accidental deletion.
- Start with Today, or browse this week (Monday through Sunday), this month, upcoming tasks, completed tasks, or a project.
- Tasks without a due date remain visible in Today, This week, and This month.
- Search task titles and sort by due date, priority, or date added.
- Track today's completion progress and completed-task count.
- Use `N` to add a task and `/` to focus search.
- Responsive layout, keyboard-friendly controls, and reduced-motion support.
- Tasks stay in this browser on this device using `localStorage`; nothing is sent to a server.

## Run the browser tests

Start the project with a local static server (for example, VS Code Live Server), then open `tests/index.html`. The test page exercises the app in an isolated frame and restores the browser's existing task data when finished. The same page is available under the `tests/` path of the GitHub Pages project URL.

## Data and privacy

Tasks are stored in your browser under the `commit.tasks.v1` local-storage key. Clearing browser data or using a different browser/device will not carry those tasks over. Commit does not include an account, cloud sync, or analytics.

## Built with

HTML, CSS, and vanilla JavaScript. The app has no runtime dependencies or build tooling.