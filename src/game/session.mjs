import { readFile,writeFile,rename,chmod,rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const sessionPath=fileURLToPath(new URL('../../.aiyl-session.json',import.meta.url));
export async function readSession() {
  try {return JSON.parse(await readFile(sessionPath,'utf8'));}
  catch(error) {if(error.code!=='ENOENT')throw new Error('Не удалось прочитать файл сессии. Удалите его для нового подключения.');}
  return null;
}
export async function saveSession(session){
  await writeFile(sessionPath+'.tmp',JSON.stringify(session),{mode:0o600});
  await chmod(sessionPath+'.tmp',0o600);await rename(sessionPath+'.tmp',sessionPath);
}
export const clearSession=()=>rm(sessionPath,{force:true});
