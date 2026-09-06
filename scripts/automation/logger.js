import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

function getKoreanDateTime() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    dateStyle: "short",
    timeStyle: "medium",
    hour12: false,
  })
    .format(new Date())
    .replace(" ", "T");
}

function getLogFilePath() {
  const date = getKoreanDateTime().slice(0, 10);

  return path.join(config.logsDir, `autoPost-${date}.log`);
}

export function log(level, message, details = "") {
  fs.mkdirSync(config.logsDir, { recursive: true });

  const detailText = details ? ` | ${details}` : "";
  const line = `[${getKoreanDateTime()}] [${level}] ${message}${detailText}`;

  console.log(line);
  fs.appendFileSync(getLogFilePath(), `${line}\n`, "utf8");
}

export function logInfo(message, details) {
  log("INFO", message, details);
}

export function logWarning(message, details) {
  log("WARNING", message, details);
}

export function logError(message, details) {
  log("ERROR", message, details);
}
