const fs = require('fs');
const files = [
  "src/app/not-found.tsx",
  "src/app/login/page.tsx",
  "src/app/unauthorized/page.tsx"
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/#0F172A/g, '#18181b');
  fs.writeFileSync(file, content);
}
console.log("Fixed dark blue hex colors.");
