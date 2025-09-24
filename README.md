<div align="center">
  <h1> blocrun </h1>
</div>

<p align="center">
  <img src="https://img.shields.io/github/stars/marcuwynu23/blocrun.svg" alt="Stars Badge"/>
  <img src="https://img.shields.io/github/forks/marcuwynu23/blocrun.svg" alt="Forks Badge"/>
  <img src="https://img.shields.io/github/issues/marcuwynu23/blocrun.svg" alt="Issues Badge"/>
  <img src="https://img.shields.io/github/license/marcuwynu23/blocrun.svg" alt="License Badge"/>
</p>
A simple CLI tool to define and control groups of commands using block syntax in a `BLOCFILE`. It lets you start and stop named command groups with automatic PID tracking and process control.

## ✨ Features

- Block-based grouping of commands
- Easily run or kill a named group of tasks
- Track background or sustained processes (e.g. GUI apps, dev servers)
- Command-type prefix system for flexible control

---

## 📦 Installation

```bash
npm install -g blocrun
```

---

## 📂 File Structure

Create a `BLOCFILE` in your project root. This file defines **blocks** of commands:

```txt
dev {
  @ code .
  % vite
  $ echo "Development server launched"
}

build {
  % npm run build
}
```

---

## 🔣 Prefix Symbols

| Symbol | Description                                 | Tracked |
| ------ | ------------------------------------------- | ------- |
| `@`    | Sustained (servers, terminal commands, etc) | ✅ Yes  |
| `%`    | Tracked but auto-closing jobs (e.g. build)  | ✅ Yes  |
| `$`    | One-off commands (not tracked e.g. gui app) | ❌ No   |

---

## 🚀 Usage

### Run a block

```bash
blocrun run <block-name>
```

Example:

```bash
blocrun run dev
```

If the block is already running, it will not run again.

---

### Kill a block

```bash
blocrun kill <block-name>
```

This command:

- Terminates all tracked processes for the block
- Cleans up the `.blocks` PID tracking file

---

## 📁 File Summary

- `BLOCFILE` — Your command block definitions
- `.blocks` — Internal file storing tracked PIDs

---

## 📘 Full Example: BLOCFILE

```txt
dev {
  @ code .
  % npm run dev
  $ echo "Started successfully"
}

build {
  % vite build
}
```

---

## 💡 When to use each symbol

- `@` — GUI or server that should stay alive (`cmd /k`, VSCode, etc.)
- `%` — Script or tool that ends on its own (e.g. `vite build`)
- `$` — Logging or setup scripts you don’t need to track

---

## 🧠 Why use `blocrun`?

- Simpler than shell scripts
- Safer than PM2 for dev use
- Works on Windows/macOS/Linux
- Better UX for managing grouped tasks

---

## 🧩 License

[License here.](./LICENSE)
