import { setTimeout as delay } from 'node:timers/promises';
import { ApiError,client } from './client.mjs';
import { loadSession,clearSession } from './session.mjs';
import { chooseAction } from './strategy.mjs';
import { chooseWithModel } from './llm.mjs';

async function main() {
  const api=client(await loadSession());
  console.log('Бот подключён. Ожидаем запуска партии организатором. Ctrl+C — остановить; повторный запуск продолжит игру.');
  let failures=0;
  for(;;) {
    try {
      const state=await api.state();
      if(state.actions.length) {
        const actionIndex=process.env.LLM_MODEL ? await chooseWithModel(state) : chooseAction(state);
        if(!Number.isInteger(actionIndex) || !state.actions[actionIndex])throw new Error('Стратегия вернула недопустимый индекс действия.');
        await api.act(state,actionIndex);
        console.log(`Партия ${state.gameNumber}: ${state.actions[actionIndex].type}`);
      }
      failures=0;
    } catch(error) {
      if(error instanceof ApiError && [401,404].includes(error.status)) {
        await clearSession();
        console.log('Доступ завершён: партия закончилась, место удалено или управление возвращено человеку. Для новой партии нужно новое приглашение.');return;
      }
      if(error instanceof ApiError && error.status===409)continue; // Re-read, never replay an old action.
      if(!(error instanceof ApiError) && error.name!=='TimeoutError' && error.name!=='TypeError')throw error;
      if(++failures>=5)throw new Error('Не удалось связаться с игрой после 5 попыток. Сессия сохранена; попробуйте запустить снова.');
      console.error('Нет ответа от игры. Повторим подключение.');
    }
    await delay(2000);
  }
}
main().catch(()=>{console.error('Агент остановлен. Проверьте сервер, приглашение и стратегию. Секреты в журнал не выводятся.');process.exitCode=1;});
