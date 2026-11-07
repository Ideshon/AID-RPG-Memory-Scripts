/* AID Memory Engine v1.8.0 — Output */
function amOutput(text,m){
  if(m.pendingUI!==null){const receipt=m.pendingUI;m.pendingUI=null;m.lastInput='';if(typeof state.message==='string'&&state.message.startsWith('[AID Memory')&&!/^AID Memory v1\.4\.5: Library и Input работают/.test(receipt))delete state.message;
    // A reset preview must be read-only, including the post-command card sync.
    if(!/^(?:ПЕРЕНОС ПАМЯТИ|(?:Нужно явное подтверждение\.\n)?ПРЕДПРОСМОТР СБРОСА(?:\s|$)|Story Cards доступно:|Plot \(предпросмотр\):|Plot в базе:|Снимок RPG:|Снимок Universal RPG ещё|AID Memory debug:|AID MEMORY DEBUG v|AID MEMORY — ПОСЛЕДНЕЕ ДОБАВЛЕНИЕ|Контекст Memory Engine не добавлен:|Нет диагностических данных)/.test(receipt))amCards(m);
    return {text:receipt||'Запрос обработан.'};}
  if(m.skipAutoTurn){m.skipAutoTurn=false;amDebugOutput(m,'внешняя техническая команда','не сюжет, счётчик пропусков не изменён');amDebugNotify(m);return {text:String(text||'')};}
  let s=String(text||''),match=s.match(/\[\[AIDM_UPDATE\]\]([\s\S]*?)\[\[\/AIDM_UPDATE\]\]/i);
  // If model returns an unterminated tag, strip it so it isn't shown to player.
  const start=s.indexOf(AM_TAG_START);
  if(start>=0)s=s.slice(0,start)+(match?s.slice(start+match[0].length):'');
  s=s.trim()||'Продолжение истории не получено.';
  // Raw scene fragments are a fallback when the narrator ignores the JSON protocol.
  const excerpt=amStr(s.replace(/^>\s*You[^\n]*\n?/i,''),260);
  if(excerpt.length>20&&!m.recent.some(x=>x.text===excerpt))m.recent.push({date:m.date||'без даты',text:excerpt});
  m.recent=m.recent.slice(-45);
  if(!m.config.auto){amCards(m);amDebugOutput(m,'автопамять отключена','художественный ответ без разбора JSON');amDebugNotify(m);return {text:s};}
  const signature=String((typeof info!=='undefined'&&info&&info.actionCount)||'')+'|'+amStr(s,100)+'|'+s.length;
  if(signature===m.lastSignature){amCards(m);amDebugOutput(m,'повтор хода','второй раз не обработан');amDebugNotify(m);return {text:s};}m.lastSignature=signature;
  if(!match){m.misses++;amCards(m);amDebugOutput(m,'нет маркера','AIDM_UPDATE не обнаружен');amDebugNotify(m);return {text:s};}
  const raw=match[1];if(raw.length>AM_CFG.reportChars){m.misses++;amCards(m);amDebugOutput(m,'отчёт слишком длинный',raw.length+' симв.');amDebugNotify(m);return {text:s};}
  // Never trust machine-generated facts as canonical without the player's decision.
  try{
    const val=JSON.parse(raw);
    if(amObj(val)!==val){m.misses++;amDebugOutput(m,'неверный формат','JSON должен быть объектом');}
    else{
      const staged=amReviewStage(m,val,s,typeof info!=='undefined'&&info?info.actionCount:null);
      amCards(m);
      if(staged.length)state.message=amReviewNotice(staged).trim();
      amDebugOutput(m,'JSON разобран','новых предложений '+staged.length+'; очередь '+m.reviewQueue.length);
      amDebugNotify(m);return {text:s};
    }
  }catch(e){m.misses++;amDebugOutput(m,'ошибка JSON',String(e&&e.message||e));}
  amCards(m);amDebugNotify(m);return {text:s};
}


/* ---------- v1.7.0: transfer confirmed memory between independent Adventures ----------
   The exchange never writes state.memory, RPG state, Plot UI or player Story Cards.
   Chunks are URL-safe Base64 of UTF-8 JSON, with length and dual checksums.
   Checksums detect copying errors, not malicious payloads. */
const modifier=(text)=>{
  try{if(typeof AM_ENGINE_BUILD==='undefined'||AM_ENGINE_BUILD!=='1.8.0')throw Error('Несовместимые вкладки Memory Engine: установи все четыре JS-файла v1.8.0 вместе.');return amOutput(text,amInit());}
  catch(err){
    const detail=String(err&&err.message||err).slice(0,300);
    if(typeof console!=='undefined'&&console.log)console.log('AID Memory Output: '+detail);
    if(state&&state.aidm&&state.aidm.pendingUI!==null){const pending=state.aidm.pendingUI;state.aidm.pendingUI=null;return {text:'[AID Memory Output: ошибка отображения] '+detail+'\n'+pending};}
    return {text:String(text||'').trim()+'\n[AID Memory: ошибка Output: '+detail+']'};
  }
};
modifier(text);
