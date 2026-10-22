const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

const pattern = /req\.body\.(user_id|userId|firebase_uid)|req\.query\.user_id|req\.params\.userId|req\.user\.id|owner_id|author_id|created_by/gi;

console.log("--- IDOR Search Results ---");
let total = 0;
for (const file of files) {
  const code = fs.readFileSync(path.join(routesDir, file), 'utf-8');
  let lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(pattern);
    if (match) {
      console.log(`${file}:${i + 1}: ${lines[i].trim()}`);
      total++;
    }
  }
}
console.log(`Total occurrences: ${total}`);
