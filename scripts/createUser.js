import 'dotenv/config';
import readline from 'node:readline';
import { connectDb } from '../server/db.js';
import { registerUser } from '../server/auth.js';

function promptVisible(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Masks keystrokes with '*' so the password doesn't land in scrollback, and
// is never passed as a CLI arg so it doesn't land in shell history either.
function promptHidden(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl._writeToOutput = (chunk) => {
      rl.output.write(rl.stdoutMuted ? '*' : chunk);
    };
    rl.question(query, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    rl.stdoutMuted = true;
  });
}

async function main() {
  const [, , argUsername] = process.argv;
  const username = argUsername || (await promptVisible('Username: '));
  if (!username) {
    console.error('Username is required');
    process.exit(1);
  }

  const password = await promptHidden('Password: ');
  if (!password) {
    console.error('Password is required');
    process.exit(1);
  }

  await connectDb();

  try {
    await registerUser(username, password);
    console.log(`Created user "${username}"`);
    process.exit(0);
  } catch (err) {
    console.error(`Failed to create user: ${err.message}`);
    process.exit(1);
  }
}

main();
