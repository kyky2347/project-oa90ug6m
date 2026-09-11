import {cpSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const appRoot=resolve(import.meta.dirname,'..');
const target=resolve(appRoot,'.next/standalone/apps/web/.next/static');
mkdirSync(target,{recursive:true});cpSync(resolve(appRoot,'.next/static'),target,{recursive:true});
process.env.HOSTNAME='0.0.0.0';
await import(pathToFileURL(resolve(appRoot,'.next/standalone/apps/web/server.js')).href);
