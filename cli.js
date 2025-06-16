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

if (!command || !block) {
  console.error("Usage: node cli.js <run|kill> <block>");
  process.exit(1);
}

if (command === "run") {
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
} else {
  console.error(`Unknown command "${command}". Use "run" or "kill".`);
  process.exit(1);
}
