#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");

const BLOCK_FILE = ".blocks";

function readBlocks() {
  const raw = fs.readFileSync(BLOCK_FILE);
  return JSON.parse(raw.toString("utf8"));
}

function writeBlocks(data) {
  const buffer = Buffer.from(JSON.stringify(data, null, 2), "utf8");
  fs.writeFileSync(BLOCK_FILE, buffer);
}

function isBlocFileNotExists(filePath) {
  return !fs.existsSync(filePath);
}

const command = process.argv[2]; // run or kill
const block = process.argv[3]; // block name
const filePath = path.resolve("Blocfile");

if (!command || !block) {
  console.error("Usage: node cli.js <run|kill> <block>");
  process.exit(1);
}

if (command === "run") {
  if (isBlocFileNotExists(BLOCK_FILE)) {
    writeBlocks({});
  }
  const blocks = readBlocks();

  if (blocks[block]) {
    console.error(`Block "${block}" is already running (PIDs: ${blocks[block].join(", ")})`);
    process.exit(0);
  }

  let file;
  try {
    if (isBlocFileNotExists(filePath)) {
      console.error(`Blocfile not found.`);
      process.exit(1);
    }
    file = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    console.error("Failed to read Blocfile:", err.message || err);
    process.exit(1);
  }

  const regex = new RegExp(`${block}\\s*{([\\s\\S]*?)}`, "m");
  const match = file.match(regex);

  if (!match) {
    console.error(`No "${block}" block found in Blocfile`);
    process.exit(1);
  }

  const lines = match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && /[$%@]/.test(line[0])); // Only accept $, %, @

  // console.log(`Running ${lines.length} commands from "${block}" block...\n`);
  const pids = [];

  for (const line of lines) {
    const symbol = line[0];
    let cmd = line.slice(1).trim();

    const type = symbol === "$" ? "exit" : symbol === "%" ? "sustain" : symbol === "@" ? "cmdwrap" : "unknown";

    if (type === "unknown") {
      console.warn(`Unknown symbol in line: ${line}`);
      continue;
    }

    if (type === "cmdwrap") {
      cmd = `cmd /k "${cmd}"`;
    }

    const child = spawn(cmd, {
      cwd: process.cwd(),
      shell: true,
      detached: true,
      stdio: type === "exit" || type === "cmdwrap" ? "inherit" : "ignore",
    });

    if (type !== "exit") child.unref();

    if (!child.pid) {
      console.error(`Failed to start "${cmd}"`);
      continue;
    }

    // console.log(`"${cmd}" started with PID: ${child.pid} (${type})`);
    if (type !== "exit") {
      pids.push(child.pid);
    }
  }

  blocks[block] = pids;
  writeBlocks(blocks);

  // console.log(`\nBlock "${block}" running. PIDs saved to .blocks`);
} else if (command === "kill") {
  if (isBlocFileNotExists(BLOCK_FILE)) {
    console.error(`.blocks not found. try to rerun block run <block>`);
    process.exit(1);
  }
  if (isBlocFileNotExists(filePath)) {
    console.error(`Blocfile not found.`);
    process.exit(1);
  }

  const blocks = readBlocks();

  if (!blocks[block]) {
    console.error(`Block "${block}" not found in .blocks`);
    process.exit(1);
  }

  // console.log(`Killing block "${block}" with ${blocks[block].length} processes...\n`);

  for (const pid of blocks[block]) {
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /PID ${pid} /T /F`);
      } else {
        process.kill(-pid, "SIGTERM");
      }
      // console.log(`Killed PID: ${pid}`);
    } catch (err) {
      console.error(`Failed to kill PID ${pid}:`, err.message);
    }
  }

  delete blocks[block];
  const hasOthers = Object.keys(blocks).length > 0;

  if (hasOthers) {
    writeBlocks(blocks);
    // console.log(`\nBlock "${block}" removed from .blocks`);
  } else {
    fs.unlinkSync(BLOCK_FILE);
    // console.log(`\nBlock "${block}" removed. All blocks cleared. Deleted .blocks`);
  }
} else {
  console.error(`Unknown command "${command}". Use "run" or "kill".`);
  process.exit(1);
}
