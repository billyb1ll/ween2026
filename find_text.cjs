const fs = require('fs');
const code = fs.readFileSync('/Users/bill/Documents/ween2026/src/pages/AdminDashboardPage.tsx', 'utf8');

let lines = code.split('\n');
let inText = false;
let textStart = 0;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<Text') && !lines[i].includes('/>') && !lines[i].includes('</Text>')) {
        inText = true;
        textStart = i + 1;
    }
    if (inText && lines[i].includes('</Text>')) {
        inText = false;
    }
    if (inText && (lines[i].includes('<VStack') || lines[i].includes('<Box') || lines[i].includes('<Flex') || lines[i].includes('<Stack'))) {
        console.log(`Found nested block element in <Text> around line ${textStart} to ${i+1}`);
    }
}
