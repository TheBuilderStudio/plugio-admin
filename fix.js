const fs = require('fs');
const files = [
  "src/app/login/page.tsx",
  "src/app/admin/users/page.tsx",
  "src/app/admin/users/[id]/page.tsx",
  "src/app/admin/dashboard/page.tsx",
  "src/app/admin/beta/page.tsx"
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/tranzinc/g, 'translate');
  fs.writeFileSync(file, content);
}
console.log("Fixed tranzinc replacements back to translate.");
