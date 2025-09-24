/**
 * @deprecated This file is deprecated. Use the CLI interface instead:
 * 
 * Single bot: ts-node src-functional/cli.ts <model> <token>
 * Multiple bots: Use ./start-bots.sh or npm start
 * 
 * Examples:
 *   ts-node src-functional/cli.ts geminisearch YOUR_BOT_TOKEN
 *   ./start-bots.sh
 */

console.warn('⚠️  DEPRECATED: This entry point is deprecated.');
console.warn('');
console.warn('Use the CLI interface instead:');
console.warn('  Single bot: ts-node src-functional/cli.ts <model> <token>');
console.warn('  Multiple bots: ./start-bots.sh or npm start');
console.warn('');
console.warn('Examples:');
console.warn('  ts-node src-functional/cli.ts geminisearch YOUR_BOT_TOKEN');
console.warn('  ./start-bots.sh');
console.warn('');

process.exit(1);
