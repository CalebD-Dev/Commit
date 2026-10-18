# Commit

Commit is a calm, local-first to-do app for making steady progress. It runs in your browser without a server, account, build step, or third-party JavaScript dependencies.

## Project structure

```text
Commit/
├── index.html
├── README.md
└── src/
    ├── app.js
    └── styles.css
```

## Run it locally

1. Clone or download this repository.
2. Open `index.html` in a modern browser.

You can also serve the folder with any static file server, such as the VS Code Live Server extension. No install or build command is required.

## Features

- Create tasks with a project, priority, and optional due date.
- Mark tasks complete, restore them, or delete them.
- Browse your inbox, today's tasks, upcoming tasks, completed tasks, or an individual project.
- Search task titles and sort by due date, priority, or date added.
- Track today's completion progress and completed-task count.
- Use `N` to add a task and `/` to focus search.
- Responsive layout, keyboard-friendly controls, and reduced-motion support.
- Tasks stay in this browser on this device using `localStorage`; nothing is sent to a server.

## Data and privacy

Tasks are stored in your browser under the `commit.tasks.v1` local-storage key. Clearing browser data or using a different browser/device will not carry those tasks over. Commit does not include an account, cloud sync, or analytics.

## Built with

HTML, CSS, and vanilla JavaScript. The app has no runtime dependencies or build tooling.