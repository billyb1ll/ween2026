import fs from 'fs';
import { parse } from '@babel/parser';
import traversePkg from '@babel/traverse';

const traverse = traversePkg.default || traversePkg;

const code = fs.readFileSync('./src/pages/AdminDashboardPage.tsx', 'utf-8');
const ast = parse(code, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript'],
});

let found = false;

traverse(ast, {
  JSXElement(path) {
    const openingElement = path.node.openingElement;
    if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'Text') {
      path.traverse({
        JSXElement(innerPath) {
          const innerNameNode = innerPath.node.openingElement.name;
          if (innerNameNode.type === 'JSXIdentifier') {
            const innerName = innerNameNode.name;
            if (['Box', 'VStack', 'Stack', 'Flex', 'div'].includes(innerName)) {
              console.log(`Found <${innerName}> inside <Text> at line ${path.node.loc.start.line}`);
              found = true;
            }
          }
        }
      });
    }
  }
});

if (!found) console.log("No hydration errors found in AdminDashboardPage.");
