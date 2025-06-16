#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {spawn, execSync} = require("child_process");

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

function help() {
  console.log(`
Usage:
  blocr <command> [block]

Commands:
  run <block>       Run the specified block from Blocfile
  run all           Run all blocks defined in Blocfile
  kill <block>      Kill the processes started by the given block
  kill all          Kill all running blocks
  list              List all currently running blocks and their PIDs
  status <block>    Check if the processes in a specific block are still running
  status all        Check the status of all running blocks

Blocfile Syntax:
  Each block should be defined like this:

    dev {
      @ echo Stay open in terminal (Windows only)
      % serve -p 3000 .
      % python3 -m http.server 8000
      $ echo One-time command
    }

  Symbols:
    @  → Runs in Windows CMD and stays open (cmd /k)
    %  → Starts a background/sustained process
    $  → Executes and waits (like a one-off script)

Examples:
  blocr run dev
  blocr run all
  blocr kill dev
  blocr list
  blocr status dev

Notes:
  - All running process IDs are saved to .blocks
  - Use 'kill' to terminate background tasks
`);
}

if (!command) {
  console.error(`Run "blocr help" to see available commands.`);
  process.exit(1);
}
if (command === "help") {
  help();
  process.exit(0);
} else if (command === "run") {
  if (isBlocFileNotExists(BLOCK_FILE)) {
    writeBlocks({});
  }

  const blocks = readBlocks();

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

  // Match all blocks if 'all' is used
  const blockNames =
    block === "all"
      ? [...file.matchAll(/^(\w+)\s*{[\s\S]*?^}/gm)].map((m) => m[1])
      : [block];

  const totalBlocksToRun = [];

  for (const blkName of blockNames) {
    if (blocks[blkName]) {
      console.error(
        `Block "${blkName}" is already running (PIDs: ${blocks[blkName].join(
          ", "
        )})`
      );
      continue;
    }

    const regex = new RegExp(`${blkName}\\s*{([\\s\\S]*?)}`, "m");
    const match = file.match(regex);
    if (!match) {
      console.error(`No "${blkName}" block found in Blocfile`);
      continue;
    }

    const lines = match[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && /[$%@]/.test(line[0]));

    const pids = [];

    for (const line of lines) {
      const symbol = line[0];
      let cmd = line.slice(1).trim();

      const type =
        symbol === "$"
          ? "exit"
          : symbol === "%"
          ? "sustain"
          : symbol === "@"
          ? "cmdwrap"
          : "unknown";

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

      if (type !== "exit") {
        pids.push(child.pid);
      }
    }

    if (pids.length) {
      blocks[blkName] = pids;
      totalBlocksToRun.push(blkName);
    }
  }

  if (totalBlocksToRun.length) {
    writeBlocks(blocks);
  }

  if (block === "all") {
    if (totalBlocksToRun.length) {
      console.log(`Blocks [${totalBlocksToRun.join(", ")}] running.`);
    } else {
      console.log(`No blocks were started.`);
    }
  }
} else if (command === "kill") {
  if (isBlocFileNotExists(BLOCK_FILE)) {
    console.error(`.blocks not found. Try to rerun "blocrun run <block>"`);
    process.exit(1);
  }

  const blocks = readBlocks();

  const blocksToKill = block === "all" ? Object.keys(blocks) : [block];

  if (blocksToKill.length === 0) {
    console.log("No blocks are currently running.");
    process.exit(0);
  }

  for (const blkName of blocksToKill) {
    if (!blocks[blkName]) {
      console.warn(`Block "${blkName}" not found in .blocks`);
      continue;
    }

    for (const pid of blocks[blkName]) {
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

    delete blocks[blkName];
    console.log(`✓ Block "${blkName}" terminated.`);
  }

  const hasOthers = Object.keys(blocks).length > 0;

  if (hasOthers) {
    writeBlocks(blocks);
  } else {
    fs.unlinkSync(BLOCK_FILE);
    console.log(`✓ All blocks cleared. Deleted .blocks`);
  }
} else if (command === "list") {
  if (isBlocFileNotExists(BLOCK_FILE)) {
    console.log("No blocks are currently running.");
    process.exit(0);
  }

  const blocks = readBlocks();

  if (Object.keys(blocks).length === 0) {
    console.log("No blocks are currently running.");
    process.exit(0);
  }

  console.log("Running blocks:");
  for (const [blkName, pids] of Object.entries(blocks)) {
    console.log(`- ${blkName}: ${pids.join(", ")}`);
  }
} else if (command === "status") {
  if (isBlocFileNotExists(BLOCK_FILE)) {
    console.log("No blocks are currently running.");
    process.exit(0);
  }

  const blocks = readBlocks();
  const blocksToCheck = block === "all" ? Object.keys(blocks) : [block];

  if (blocksToCheck.length === 0) {
    console.log("No blocks found.");
    process.exit(0);
  }

  for (const blkName of blocksToCheck) {
    const pids = blocks[blkName];
    if (!pids) {
      console.log(`✗ Block "${blkName}" not found in .blocks`);
      continue;
    }

    const stillRunning = pids.filter((pid) => {
      try {
        process.kill(pid, 0); // Check signal only
        return true;
      } catch {
        return false;
      }
    });

    if (stillRunning.length === pids.length) {
      console.log(`✓ Block "${blkName}" is running (${pids.join(", ")})`);
    } else if (stillRunning.length > 0) {
      console.log(
        `~ Block "${blkName}" is partially running (${stillRunning.join(", ")})`
      );
    } else {
      console.log(`✗ Block "${blkName}" is not running`);
    }
  }
} else {
  console.error(
    `Unknown command "${command}". Run "blocr help" to see available commands.`
  );
  process.exit(1);
}
