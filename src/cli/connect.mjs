import { loadSession,clearSession } from '../game/session.mjs';
import { client,ApiError } from '../game/client.mjs';
try {
  let session=await loadSession();
  try {await client(session).state();}
  catch(error) {
    if(!(error instanceof ApiError) || ![401,404].includes(error.status))throw error;
    await clearSession();session=await loadSession();await client(session).state();
  }
  console.log('Подключение сохранено. Можно запускать бота или MCP.');
} catch {console.error('Не удалось подключиться. Проверьте приглашение и доступность игры.');process.exitCode=1;}
