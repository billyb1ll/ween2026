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
          if (hasAsProp) return;

          path.traverse({
            JSXElement(innerPath) {
              const innerNameNode = innerPath.node.openingElement.name;
              if (innerNameNode.type === 'JSXIdentifier') {
                const innerName = innerNameNode.name;
                if (['VStack', 'Stack', 'Flex', 'div', 'chakra.div'].includes(innerName)) {
                  // Ignore if inner element has as="span"
                  const innerHasAsSpan = innerPath.node.openingElement.attributes.some(attr => 
                    attr.type === 'JSXAttribute' && attr.name.name === 'as' && attr.value?.value === 'span'
                  );
                  if (!innerHasAsSpan) {
                    console.log(`Found <${innerName}> inside <Text> at ${file}:${path.node.loc.start.line}`);
                  }
                }
              }
            }
          });
        }
      }
    });
  } catch (e) {}
});
