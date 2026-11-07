/* AID Universal RPG v2.32 — Context: invisible rules + computed judge result. */
const modifier = (text) => {
  if(state.aidUniversalRpgRemoved)return {text:String(text||'')};
  const r=rpgInit();
  const original=String(text||'');
  const memLen=Math.max(0,Math.min(original.length,Number(info.memoryLength)||0));
  const memory=original.slice(0,memLen);
  // Remove legacy prompts and previous visible debug blocks from MODEL context only.
  // Existing actions already displayed in the player's history cannot be deleted by scripts.
  const recent=original.slice(memLen)
    .replace(/\[СИСТЕМНАЯ КОМАНДА RPG ВЫПОЛНЕНА[^\]]*\]/gi,'')
    .replace(/\[Подтверждённый бросок судьи:[^\]]*\]/gi,'')
    .replace(/\[RPG DEBUG\][^\n]*/gi,'')
    .replace(/\[RPG\] (?:Баланс|долг|Долг)[^\n]*/g,'')
    .replace(/\[RPG\] (?:ПРОВЕРЬТЕ ИЗМЕНЕНИЯ|СВЕРЕНО СО СОХРАНЕНИЕМ)[^\n]*/g,'');
  const mechanical='\n'+rpgMemory(r)+'\n';
  const maxChars=(typeof info.maxChars==='number'&&info.maxChars>4000)?info.maxChars:60000;
  const keepRecent=Math.max(0,maxChars-memory.length-mechanical.length);
  // AI Dungeon gives Front Memory at the END of the model context.
  // Put the protocol immediately before generation, not ahead of story history.
  const result=memory+(keepRecent?recent.slice(-keepRecent):'')+mechanical;
  rpgDebugLog(r,'Context: '+result.length+' символов; исходный: '+original.length);
  return {text:result||original};
};
modifier(text);
