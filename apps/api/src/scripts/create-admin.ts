import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createAdminUser } from "./admin-user-provisioning";

type CliOptions = {
  email: string;
  name: string;
};

function readOption(args: string[], name: string): string | undefined {
  const equalsPrefix = `${name}=`;
  const equalsValue = args.find((arg) => arg.startsWith(equalsPrefix));
  if (equalsValue) return equalsValue.slice(equalsPrefix.length);

  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function parseOptions(args: string[]): CliOptions {
  const email = readOption(args, "--email");
  const name = readOption(args, "--name");
  const allowed = new Set(["--email", "--name"]);
  const hasUnknownOption = args.some((arg, index) => {
    if (index > 0 && (args[index - 1] === "--email" || args[index - 1] === "--name")) return false;
    return arg.startsWith("--") && !allowed.has(arg) && !arg.startsWith("--email=") && !arg.startsWith("--name=");
  });

  if (!email || !name || email.startsWith("--") || name.startsWith("--") || hasUnknownOption) {
    throw new Error("Usage: pnpm --filter api users:create-admin -- --email <email> --name <name>");
  }

  return { email, name };
}

async function promptForPassword(label: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("A TTY is required to enter the password securely.");
  }

  process.stdout.write(`${label}: `);
  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let password = "";

    const finish = (error?: Error) => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(password);
    };

    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u0003") return finish(new Error("Cancelled."));
        if (character === "\u007f" || character === "\b") {
          password = password.slice(0, -1);
          continue;
        }
        password += character;
      }
    };

    process.stdin.on("data", onData);
  });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set.");

  const options = parseOptions(process.argv.slice(2));
  const password = await promptForPassword("New password");
  const confirmedPassword = await promptForPassword("Confirm password");
  if (password !== confirmedPassword) throw new Error("Passwords do not match.");
  const prisma = new PrismaClient();

  try {
    const user = await createAdminUser(prisma.user, { ...options, password });
    console.log(`Created ADMIN user id=${user.id} email=${user.email} name=${user.name}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("users:create-admin failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
