import { createInterface } from 'node:readline/promises';
import { readFile,writeFile,rename,chmod,rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { exchange } from './client.mjs';
const sessionPath=fileURLToPath(new URL('../../.aiyl-session.json',import.meta.url));
export async function loadSession(interactive=true) {
  try {return JSON.parse(await readFile(sessionPath,'utf8'));}
  catch(error) {if(error.code!=='ENOENT')throw new Error('Не удалось прочитать файл сессии. Удалите его для нового подключения.');}
  if(!interactive)throw new Error('Сначала выполните npm run connect.');
  const prompt=createInterface({input:process.stdin,output:process.stdout});
  let invitation;
  try {invitation=await prompt.question('Ссылка-приглашение из лобби: ');}finally{prompt.close();}
  const session=await exchange(invitation);
  await writeFile(sessionPath+'.tmp',JSON.stringify(session),{mode:0o600});
  await chmod(sessionPath+'.tmp',0o600);await rename(sessionPath+'.tmp',sessionPath);
  return session;
}

export const clearSession=()=>rm(sessionPath,{force:true});
