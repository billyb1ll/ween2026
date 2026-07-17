import fs from 'fs';
import { globSync } from 'glob';
import { parse } from '@babel/parser';
import traversePkg from '@babel/traverse';

const traverse = traversePkg.default || traversePkg;

const files = globSync('./src/**/*.tsx');

files.forEach(file => {
  const code = fs.readFileSync(file, 'utf-8');
  try {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    traverse(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'Text') {
          // Check if it has 'as' prop
          const hasAsProp = openingElement.attributes.some(attr => attr.type === 'JSXAttribute' && attr.name.name === 'as');
          if (hasAsProp) return; // if it has 'as="div"', it's fine

          path.traverse({
            JSXElement(innerPath) {
              const innerNameNode = innerPath.node.openingElement.name;
              if (innerNameNode.type === 'JSXIdentifier') {
                const innerName = innerNameNode.name;
                if (['Box', 'VStack', 'Stack', 'Flex', 'div'].includes(innerName)) {
                  console.log(`Found <${innerName}> inside <Text> at ${file}:${path.node.loc.start.line}`);
                }
              }
            }
          });
        }
      }
    });
  } catch (e) {}
});
