#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {spawn, execSync} = require("child_process");

const BLOCK_FILE = ".blocks";
const BLOCFILE_PATH = path.resolve("Blocfile");
const command = process.argv[2];
const block = process.argv[3];

const fileExists = (filePath) => fs.existsSync(filePath);
const readFileUtf8 = (filePath) => fs.readFileSync(filePath, "utf8");

const readBlocks = () => {
  try {
    return JSON.parse(readFileUtf8(BLOCK_FILE));
  } catch {
    return {};
  }
};

const writeBlocks = (data) => {
  try {
    fs.writeFileSync(BLOCK_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to write .blocks:", e.message);
  }
};

const help = () =>
  console.log(`
Usage:
  blocr <command> [block]

Commands:
  init              Create a sample Blocfile
  run <block|all>   Run a block or all blocks
  kill <block|all>  Kill block or all running blocks
  list              Show all currently running blocks
  status <block|all> Show status of blocks
  clean             Delete the .blocks file
  help              Show this help
  version           Show CLI version

Blocfile Syntax:
  blockName {
    $ echo one-time
    % npm run persist
    @ echo CMD stay open (Windows only)
  }
`);

const handleInit = () => {
  if (fileExists(BLOCFILE_PATH)) return console.log("Blocfile already exists.");
  const template = `
dev {
  @ echo Starting Development Environment...
  % npm run dev
  % json-server --watch db.json --port 4000
  $ echo Development environment initialized.
}

api {
  % node server.js
  $ echo API server is up and running.
}

build {
  $ rm -rf dist
  $ npm run build
  $ echo Build completed successfully.
}

docs {
  % npm run docs:dev
  $ echo Docs preview running on http://localhost:3000
}
`;
  fs.writeFileSync(BLOCFILE_PATH, template, "utf8");
  console.log("✓ Blocfile created.");
};

const handleClean = () => {
  if (!fileExists(BLOCK_FILE)) return console.log("Nothing to clean.");
  fs.unlinkSync(BLOCK_FILE);
  console.log("✓ .blocks file deleted.");
};

const handleRun = () => {
  if (!fileExists(BLOCFILE_PATH)) return console.error("Blocfile not found.");
  if (!fileExists(BLOCK_FILE)) writeBlocks({});

  const fileContent = readFileUtf8(BLOCFILE_PATH);
  const blocks = readBlocks();
  const blockNames =
    block === "all"
      ? [...fileContent.matchAll(/^([a-zA-Z0-9_]+)\s*{[\s\S]*?^}/gm)].map(
          (m) => m[1]
        )
      : [block];

  const started = [];

  blockNames.forEach((blkName) => {
    if (blocks[blkName]) {
      console.error(`Block \"${blkName}\" already running.`);
      return;
    }

    const match = fileContent.match(
      new RegExp(`${blkName}\\s*{([\\s\\S]*?)}`, "m")
    );
    if (!match) return console.error(`No block \"${blkName}\" found.`);

    const lines = match[1]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && /[$%@]/.test(l[0]));

    const pids = [];

    for (const line of lines) {
      const [symbol, ...rest] = line.trim();
      let cmd = line.slice(1).trim();
      const type =
        symbol === "$"
          ? "exit"
          : symbol === "%"
          ? "sustain"
          : symbol === "@"
          ? "cmd"
          : null;
      if (!type) continue;
      if (type === "cmd") cmd = `cmd /k \"${cmd}\"`;

      const proc = spawn(cmd, {
        cwd: process.cwd(),
        shell: true,
        detached: true,
        stdio: ["ignore", "ignore", "ignore"],
      });

      if (type !== "exit") proc.unref();
      if (proc.pid && type !== "exit") pids.push(proc.pid);
    }

    if (pids.length) {
      blocks[blkName] = pids;
      started.push(blkName);
    }
  });

  if (started.length) writeBlocks(blocks);
  if (block === "all") console.log(`Started: [${started.join(", ")}].`);
};

const handleKill = () => {
  if (!fileExists(BLOCK_FILE)) return console.error("No running blocks.");
  const blocks = readBlocks();
  const toKill = block === "all" ? Object.keys(blocks) : [block];

  toKill.forEach((blkName) => {
    const pids = blocks[blkName];
    if (!pids) return console.warn(`Block \"${blkName}\" not found.`);
    pids.forEach((pid) => {
      try {
        process.platform === "win32"
          ? execSync(`taskkill /PID ${pid} /T /F`)
          : process.kill(-pid, "SIGTERM");
      } catch (e) {
        console.error(`Failed to kill PID ${pid}:`, e.message);
      }
    });
    delete blocks[blkName];
    console.log(`✓ Block \"${blkName}\" terminated.`);
  });

  Object.keys(blocks).length ? writeBlocks(blocks) : fs.unlinkSync(BLOCK_FILE);
};

const handleList = () => {
  if (!fileExists(BLOCK_FILE)) return console.log("No running blocks.");
  const blocks = readBlocks();
  console.log("Running blocks:");
  Object.entries(blocks).forEach(([name, pids]) => {
    console.log(`- ${name}: ${pids.join(", ")}`);
  });
};

const handleStatus = () => {
  if (!fileExists(BLOCK_FILE)) return console.log("No blocks are running.");
  const blocks = readBlocks();
  const toCheck = block === "all" ? Object.keys(blocks) : [block];

  toCheck.forEach((blkName) => {
    const pids = blocks[blkName];
    if (!pids) return console.log(`✗ Block \"${blkName}\" not found.`);
    const running = pids.filter((pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    });
    if (running.length === pids.length) console.log(`✓ ${blkName} is running`);
    else if (running.length > 0) console.log(`~ ${blkName} partially running`);
    else console.log(`✗ ${blkName} not running`);
  });
};

switch (command) {
  case "help":
    help();
    break;
  case "version":
    console.log(`blocrun v${require("./package.json").version}`);
    break;
  case "init":
    handleInit();
    break;
  case "clean":
    handleClean();
    break;
  case "run":
    handleRun();
    break;
  case "kill":
    handleKill();
    break;
  case "list":
    handleList();
    break;
  case "status":
    handleStatus();
    break;
  default:
    console.error(`Unknown command \"${command}\". Try \"blocr help\".`);
    process.exit(1);
}
