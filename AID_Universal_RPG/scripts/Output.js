/* AID Universal RPG v2.31 — Output. */
const modifier = (text) => {
  if(state.aidUniversalRpgRemoved){
    const notice=state.aidUniversalRpgNotice;
    delete state.aidUniversalRpgNotice;
    return {text:notice?'[RPG] '+notice:String(text||'')};
  }
  const r=rpgInit();
  if(r.pendingUI!==null){
    const preview=!!r.pendingMaintenancePreview;
    delete r.pendingMaintenancePreview;
    const msg=r.pendingUI;
    r.pendingUI=null;
    if(!preview){r.pendingRoll=null;r.pendingSecondaryRoll=null;}
    const notices=preview?'':(r.modifierNotices||[]).splice(0).join('\n');
    return {text:(/^\[RPG(?: DEBUG)?\]/.test(msg)?msg:'[RPG] '+msg)+(notices?'\n'+notices:'')};
  }
  let cleanOutput=String(text||'');
  if(r.pendingSmart && r.config.autoJudge && r.config.smartJudge){
    const judged=rpgSmartResolve(r,cleanOutput);
    cleanOutput=judged.text;
    r.pendingSmart=null;
    if(r.config.debug) {
      state.message='[RPG DEBUG] '+judged.debug.slice(0,450);
      cleanOutput+='\n\n[RPG DEBUG] '+judged.debug;
    }
  }
  // v2.31: enforce failed precomputed rolls regardless of narrator wording.
  // Must run BEFORE RPG_DELTA, status reconciliation, auto-accounting and history
  // capture, otherwise a fabricated positive result can pollute RPG state.
  // Manual :check, :auto classic/narrative/cautious and detailed dual rolls use
  // the same rule. The d20 result, XP and time costs remain unchanged.
  if(r.pendingRoll && (!r.pendingRoll.success || (r.pendingSecondaryRoll && !r.pendingSecondaryRoll.success))){
    cleanOutput=rpgStrictOutcome(r,r.pendingRoll,r.pendingSecondaryRoll);
    rpgDebugLog(r,'Строгий отказ: текст рассказчика заменён результатом судьи.');
  }
  if(r.config.ledger){
    const delta=cleanOutput.match(/<RPG_DELTA>([\s\S]*?)<\/RPG_DELTA>/i);
    if(delta){
      try {
        const changes=rpgApplyDelta(r,JSON.parse(delta[1]));
        if(changes.length)state.message='RPG: '+changes.join('; ').slice(0,500);
      } catch(e){if(typeof log==='function')log('RPG ledger JSON rejected: '+e.message);}
      cleanOutput=cleanOutput.replace(delta[0],'').trim();
    }
  }
  // v2.20: move storyteller's proposed mechanical changes into labelled
  // review notices. Never silently discard useful quest reminders.
  const review=rpgReviewCapture(r,cleanOutput);
  cleanOutput=review.text;
  // Do not display or retain script-injected technical blocks accidentally echoed by the model.
  cleanOutput=cleanOutput.replace(/\[Подтверждённый бросок судьи:[^\]]*\]/gi,'')
    .replace(/\[СИСТЕМНАЯ КОМАНДА RPG ВЫПОЛНЕНА[^\]]*\]/gi,'').trim();
  const financeFeedback=r.pendingEffects&&r.pendingEffects.financeFeedback||'';
  const changes=rpgAutoSettle(r,cleanOutput);
  if(changes.length){
    if(r.config.debug){
      cleanOutput+='\n\n[RPG DEBUG] АВТОУЧЁТ: '+changes.join('; ');
    }else if(changes.some(x=>x.startsWith('НЕ УЧТЕНО'))){
      state.message='[RPG] '+changes.filter(x=>x.startsWith('НЕ УЧТЕНО')).join('; ');
    }
  }
  if(review.notices.length)cleanOutput+='\n\n'+review.notices.join('\n');
  // Finance was settled by Input, never by narration. Display after the story, once.
  if(financeFeedback)cleanOutput+='\n\n'+financeFeedback;
  // Time-limited skill modifiers expire according to the saved game clock.
  if(r.modifierNotices&&r.modifierNotices.length)cleanOutput+='\n\n'+r.modifierNotices.splice(0).join('\n');
  // XP events are calculated by rpgCheck, never from the narration.
  if(r.xp.notices&&r.xp.notices.length){
    cleanOutput+='\n\n'+r.xp.notices.join('\n');
    r.xp.notices=[];
  }
  // The model's recent history must contain STORY only, not warnings or
  // engine status. Otherwise unconfirmed claims contaminate future narration.
  const clean=rpgClean(review.text.replace(/\[RPG(?: DEBUG)?\][^\n]*/g,''),180);
  if(clean&&!/^\[RPG\]/i.test(clean)){
    r.recent.push(clean);
    if(r.recent.length>RPG_CFG.briefMemory)r.recent.shift();
  }
  if(r.pendingRoll){
    if(r.config.debug){
      const label=rpgRollLabel(r.pendingRoll);
      if(typeof log==='function')log('[RPG DEBUG] '+label);
      cleanOutput+='\n\n[RPG DEBUG] '+(r.lastJudgement&&r.lastJudgement.includes('ВЫБОР:')?r.lastJudgement:label);
    }
    r.pendingRoll=null;
    r.pendingSecondaryRoll=null;
  }
  // AID does not allow an empty output string.
  return {text:cleanOutput || String(text||'')};
};
modifier(text);
