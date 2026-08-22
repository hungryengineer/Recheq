import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
console.log(process.argv[1] === __filename, process.argv[1], __filename);
