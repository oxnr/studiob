import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('dist');
await rm(output, {recursive:true,force:true});
await mkdir(output,{recursive:true});
for (const name of ['index.html','redesign.css','app.js','translations.js','formsubmit-service.js','site-config.js','assets']) {
  await cp(resolve(name),resolve(output,name),{recursive:true});
}
console.log(`Static site prepared: ${output}`);
