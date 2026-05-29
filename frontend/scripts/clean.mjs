import { rmSync } from 'node:fs';

for (const target of ['dist', 'server.js']) {
  rmSync(target, { force: true, recursive: true });
}
