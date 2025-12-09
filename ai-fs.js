const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = process.cwd();

function safePath(p) {
  const final = path.resolve(ROOT, p.replace(/^\//, ""));
  if (!final.startsWith(ROOT)) throw new Error("Unsafe path blocked: " + p);
  return final;
}

function ensureDir(p) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

module.exports = {
  createFile(filePath, content = "") {
    const fp = safePath(filePath);
    ensureDir(fp);
    fs.writeFileSync(fp, content, "utf8");
    return `Created file: ${filePath}`;
  },

  editFile(filePath, content) {
    const fp = safePath(filePath);
    ensureDir(fp);
    fs.writeFileSync(fp, content, "utf8");
    return `Updated file: ${filePath}`;
  },

  appendToFile(filePath, content) {
    const fp = safePath(filePath);
    ensureDir(fp);
    fs.appendFileSync(fp, content, "utf8");
    return `Appended to: ${filePath}`;
  },

  readFile(filePath) {
    const fp = safePath(filePath);
    return fs.existsSync(fp) ? fs.readFileSync(fp, "utf8") : null;
  },

  deleteFile(filePath) {
    const fp = safePath(filePath);
    if (fs.existsSync(fp)) {
      fs.unlinkSync(fp);
      return `Deleted file: ${filePath}`;
    }
    return `File not found: ${filePath}`;
  },

  createFolder(folderPath) {
    const fp = safePath(folderPath);
    if (!fs.existsSync(fp)) fs.mkdirSync(fp, { recursive: true });
    return `Created folder: ${folderPath}`;
  },

  deleteFolder(folderPath) {
    const fp = safePath(folderPath);
    if (fs.existsSync(fp)) {
      fs.rmSync(fp, { recursive: true, force: true });
      return `Deleted folder: ${folderPath}`;
    }
    return `Folder not found: ${folderPath}`;
  },

  renamePath(oldPath, newPath) {
    const fp1 = safePath(oldPath);
    const fp2 = safePath(newPath);
    ensureDir(fp2);
    fs.renameSync(fp1, fp2);
    return `Renamed: ${oldPath} → ${newPath}`;
  },

  listTree(start = ".") {
    const walk = (dir) => {
      const full = safePath(dir);
      const stat = fs.statSync(full);
      if (stat.isFile()) {
        return { type: "file", name: path.basename(dir) };
      }
      return {
        type: "dir",
        name: path.basename(dir),
        children: fs.readdirSync(full).map((c) =>
          walk(path.join(dir, c))
        ),
      };
    };
    return walk(start);
  },

  searchInFiles(keyword, startDir = ".") {
    const results = [];
    const walk = (dir) => {
      const full = path.join(ROOT, dir);
      const entries = fs.readdirSync(full);
      for (const entry of entries) {
        const file = path.join(dir, entry);
        const abs = safePath(file);
        const stat = fs.statSync(abs);
        if (stat.isDirectory()) walk(file);
        else {
          const content = fs.readFileSync(abs, "utf8");
          if (content.includes(keyword)) results.push(file);
        }
      }
    };
    walk(startDir);
    return { keyword, matches: results };
  },

  runCommand(cmd) {
    return execSync(cmd, { encoding: "utf8" }).trim();
  }
};
