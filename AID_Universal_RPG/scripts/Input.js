/* AID Universal RPG v2.29 — Input. Install Library.js first. */
const modifier = (text) => {
  // Another script owns ;mem. Pass it through unchanged; never treat it as an RPG action.
  const raw=String(text||'');
  const candidate=raw.replace(/^>\s*You(?:\s+say\s+[\"'“]?)?\s*/i,'').trim();
  if(/^;mem(?:\s|$)/i.test(candidate))return {text:raw};
  const command=rpgParseCommand(text);
  if(state.aidUniversalRpgRemoved){
    if(command && command.cmd==='rpg' && /^reset confirm$/i.test(command.arg)){
      delete state.aidUniversalRpgRemoved;
    }else{
      if(command && command.cmd==='rpg'){
        state.aidUniversalRpgNotice='RPG отключена и state.rpg удалён. Удали четыре JS-файла; '+
          'для возобновления работы используй :rpg reset confirm.';
        return {text:'> Ты сверяешь сведения персонажа.'};
      }
      return {text:String(text||'')};
    }
  }
  const r=rpgInit();
  // Maintenance commands are processed before generic per-turn clearing.
  // A preview is read-only; confirmed operations calculate counts before clearing.
  // Output consumes preview UI without discarding pending dice or notices.
  if(command && command.cmd==='rpg'){
    const confirmed=/^(?:memory clear|reset|uninstall) confirm$/i.test(command.arg);
    const info=rpgCommand(r,'rpg',command.arg);
    if(!confirmed)r.pendingMaintenancePreview=true;
    return {text:rpgUI(r,info)};
  }
  // Export is a card-side operation; do not clear pending rolls, notices or RPG data.
  if(command && command.cmd==='aidm'){
    const info=rpgCommand(r,'aidm',command.arg);
    r.pendingMaintenancePreview=true;
    return {text:rpgUI(r,info)};
  }
  // Choice survives only until a new :check interaction; any other action invalidates it.
  if(!command || command.cmd!=='check')r.pendingCheck=null;
  r.pendingUI=null;
  r.pendingRoll=null;
  r.pendingSecondaryRoll=null;
  r.pendingAction=null;
  r.pendingSmart=null;
  r.pendingEffects=null;
  r.xp.notices=[];
  delete state.message;
  if(command){
    const result=rpgCommand(r,command.cmd,command.arg);
    if(result && typeof result==='object' && result.dice){
      const action=rpgClean(result.action || 'совершить действие',180);
      r.turn++;
      r.lastAction=action;
      // Dice data stays in state and is injected ONLY through Context, not visible input.
      rpgDebugLog(r,'Ручная проверка: '+rpgRollLabel(result));
      // state.message shows debug without waiting for narrator's Output hook.
      if(r.config.debug)state.message='[RPG DEBUG] '+rpgRollLabel(result);
      return {text:'> Ты пытаешься '+action+'.'};
    }
    if(command.cmd==='use' && r.pendingAction){
      const action=r.pendingAction;
      r.pendingAction=null;
      r.turn++;
      r.lastAction=action;
      return {text:'> Ты '+action+'.'};
    }
    const info=typeof result==='string'?result:'Команда выполнена.';
    const placeholder=rpgUI(r,info);
    rpgDebugLog(r,'Команда :'+command.cmd+' → '+info.slice(0,150));
    return {text:placeholder};
  }
  if(String(text||'').trim()){
    r.turn++;
    r.lastAction=rpgClean(text,160);
    r.pendingEffects={turn:r.turn,action:r.lastAction};
    if(r.config.autoJudge && r.config.narrativeJudge){
      const decision=rpgNarrativePreflight(r,text);
      if(decision.kind==='blocked'){r.pendingEffects=null;return {text:rpgUI(r,decision.reason)};}
      if(decision.kind==='check' && r.config.debug)state.message='[RPG DEBUG] '+rpgRollLabel(decision.roll);
    } else if(r.config.autoJudge && r.config.cautiousJudge){
      const cautious=rpgCautiousCheck(r,text);
      if(cautious&&r.config.debug)state.message='[RPG DEBUG] '+rpgRollLabel(cautious);
    } else if(r.config.autoJudge && r.config.smartJudge){
      r.pendingSmart={action:r.lastAction,turn:r.turn};
      rpgDebugLog(r,'Семантическая проверка запроса: '+r.lastAction);
    } else {
      const autoResult=rpgAutoCheck(r,text);
      if(autoResult && r.config.debug)state.message='[RPG DEBUG] '+rpgRollLabel(autoResult);
    }
  }
  // Only explicit player action may change money or debt; never model text.
  if(String(text||'').trim() && !r.pendingUI && r.pendingEffects){
    const transaction=rpgPlayerTransaction(r.lastAction,r);
    if(transaction && !r.config.economy){
      if(r.config.debug)r.pendingEffects.financeFeedback='[RPG DEBUG] ФИНАНСЫ: операция не выполнена — :economy off; баланс и долг без изменений.';
    }else if(transaction){
      const result=rpgFinanceApply(r,transaction,r.lastAction);
      if(result.error){
        r.pendingEffects=null;
        // The action did not take effect. Surface the reason even with debug off:
        // otherwise the narrator could falsely describe a successful payment.
        return {text:rpgUI(r,r.config.debug?rpgFinanceDisplay(r,result):result.error)};
      }
      r.pendingEffects.financeTransaction=result;
      r.pendingEffects.financeFeedback=rpgFinanceDisplay(r,result);
      if(r.config.debug)rpgDebugLog(r,'Финансы: '+(result.details||result.note));
    }else if(rpgFinanceIntent(r.lastAction) && r.config.debug){
      r.pendingEffects.financeFeedback='[RPG DEBUG] ФИНАНСЫ: реплика похожа на финансовое действие, но операция не распознана или сформулирована как вопрос/намерение; изменений нет.';
    }
  }
  // Do input in AI Dungeon may include English framing even when action is Russian.
  // This is a best-effort replacement of literal prefixes, not control over client UI.
  let updated=String(text||'');
  if(/[А-Яа-яЁё]/.test(updated)){
    updated=updated.replace(/^>\s*You try to\s+/i,'> Ты пытаешься ')
      .replace(/^>\s*You\s+/i,'> Ты ');
  }
  return {text:updated};
};
modifier(text);
