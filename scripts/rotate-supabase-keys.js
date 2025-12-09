#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawnSync } from "node:child_process";

const envPath = path.resolve(process.cwd(), process.argv[2] || ".env");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) =>
    rl.question(prompt, (answer) => resolve(answer.trim()))
  );
}

function updateEnv(content, key, value) {
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  const newline = content.endsWith("\n") ? "" : "\n";
  return `${content}${newline}${line}\n`;
}

function hasGhCli() {
  return spawnSync("gh", ["--version"], { stdio: "ignore" }).status === 0;
}

(async () => {
  console.log("Supabase key rotation helper\n===============================");
  const projectRef = await question("Supabase project ref (e.g. abcd1234): ");
  const newAnon = await question("New anon key: ");
  const newService = await question("New service-role key: ");

  if (!projectRef || !newAnon || !newService) {
    console.error("Project ref, anon key, and service key are required.");
    process.exit(1);
  }

  const envExists = fs.existsSync(envPath);
  const envContent = envExists ? fs.readFileSync(envPath, "utf8") : "";
  let updated = envContent;
  updated = updateEnv(updated, "SUPABASE_URL", `https://${projectRef}.supabase.co`);
  updated = updateEnv(updated, "SUPABASE_ANON_KEY", newAnon);
  fs.writeFileSync(envPath, updated, "utf8");
  console.log(`Updated ${envPath} with new Supabase URL/key.`);

  if (hasGhCli() && process.env.GITHUB_REPOSITORY) {
    console.log("Updating GitHub secrets via gh CLI...");
    spawnSync("gh", ["secret", "set", "SUPABASE_ANON_KEY", "--body", newAnon], {
      stdio: "inherit",
    });
    spawnSync(
      "gh",
      ["secret", "set", "SUPABASE_SERVICE_ROLE_KEY", "--body", newService],
      {
        stdio: "inherit",
      }
    );
  } else {
    console.log(
      `Add these secrets to your CI provider:\nSUPABASE_ANON_KEY=${newAnon}\nSUPABASE_SERVICE_ROLE_KEY=${newService}`
    );
  }

  console.log(
    "Remember to update Supabase Dashboard > Settings > API to rotate keys server-side."
  );
  rl.close();
})();
