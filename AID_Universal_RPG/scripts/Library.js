/* AID Universal RPG v2.31 — shared functions. Paste into Library tab. */
const RPG_CFG = {
  autoJudge: false,
  debug: false,
  magic: false,
  briefMemory: 6,
  maxNotes: 100,
  maxBio: 1500,
  maxDream: 300,
  maxJournalText: 400,
  maxQuests: 60,
  maxContextChars: 6000,
  maxRolls: 12,
  startingHP: 100,
  startingStamina: 100,
  maxItems: 50
};
const RPG_STATS = ['Сила','Ловкость','Выносливость','Интеллект','Восприятие','Воля','Обаяние','Смекалка','Внешность'];
const RPG_SKILLS = ['Атлетика','Бдительность','Вождение','Воровство','Выживание','Драка','Запугивание','Компьютеры','Кулинария','Лидерство','Лингвистика','Медицина','Наука','Огнестрельное оружие','Переговоры','Право','Расследование','Ремесло','Скрытность','Технологии','Уличные знания','Финансы','Хитрость','Холодное оружие','Эмпатия','Этикет','Магия'];
const RPG_SKILL_ATTRS = {
  'Атлетика':'Сила','Бдительность':'Восприятие','Вождение':'Ловкость','Воровство':'Ловкость',
  'Выживание':'Восприятие','Драка':'Сила','Запугивание':'Воля','Компьютеры':'Интеллект',
  'Кулинария':'Смекалка','Лидерство':'Обаяние','Лингвистика':'Интеллект','Медицина':'Интеллект',
  'Наука':'Интеллект','Огнестрельное оружие':'Ловкость','Переговоры':'Обаяние','Право':'Интеллект',
  'Расследование':'Восприятие','Ремесло':'Смекалка','Скрытность':'Ловкость',
  'Технологии':'Интеллект','Уличные знания':'Смекалка','Финансы':'Интеллект','Хитрость':'Обаяние',
  'Холодное оружие':'Сила','Эмпатия':'Восприятие','Этикет':'Обаяние','Магия':'Воля'
};
const RPG_CHAR_BASE_BUDGET=12, RPG_CHAR_REFUND_CAP=6;
function rpgSkillList(r){
  return RPG_SKILLS.concat(Object.keys(r.customSkills||{}).filter(x=>!rpgName(RPG_SKILLS,x)));
}
function rpgSkillName(r,text){return rpgName(rpgSkillList(r),text);}
function rpgCharStatBudget(stats){
  const spend=RPG_STATS.reduce((a,k)=>a+Math.max(0,(stats[k]??10)-10),0);
  const returned=RPG_STATS.reduce((a,k)=>a+Math.max(0,10-(stats[k]??10)),0);
  return {spend,returned,refund:Math.min(RPG_CHAR_REFUND_CAP,returned),limit:RPG_CHAR_BASE_BUDGET+Math.min(RPG_CHAR_REFUND_CAP,returned)};
}
function rpgSkillWords(raw){
  if(!raw||!raw.trim())return [];
  const words=raw.split(',').map(x=>rpgClean(x,32).toLowerCase().replace(/ё/g,'е')).filter(Boolean);
  if(words.length>8||words.some(x=>x.length<3||/[|:]/.test(x)))return null;
  return [...new Set(words)];
}
/* Match configured stems at the START of a word (or phrase), not inside
 * unrelated words. Example: "арт" matches "арт-проект" but NOT "картой".
 * Use an explicit Unicode boundary because JS \b does not handle Cyrillic. */
function rpgCustomKeywordMatch(text,key){
  if(typeof key!=='string'||key.length<3)return false;
  const escaped=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp('(?:^|[^\\p{L}\\p{N}_])'+escaped,'u').test(text);
}
function rpgCustomMatch(r,action){
  const text=String(action||'').toLowerCase().replace(/ё/g,'е');
  let best=null;
  for(const name of Object.keys(r.customSkills||{})){
    const entry=r.customSkills[name];
    if(!entry||!rpgName(RPG_STATS,entry.attr)||!Array.isArray(entry.keywords))continue;
    for(const key of entry.keywords){
      if(rpgCustomKeywordMatch(text,key)){
        // Longest specific keyword wins. Users intentionally configure the match phrases.
        if(!best||key.length>best.length)best={name,attr:entry.attr,length:key.length};
      }
    }
  }
  return best?{kind:'custom',attr:best.attr,skill:best.name,dc:14,custom:true}:null;
}
function rpgCustomSkillCommand(r,arg){
  const m=String(arg||'').match(/^(add|remove|delete|info|bind|attr|list|help)\b\s*(.*)$/i);
  if(!m)return null;
  const mode=m[1].toLowerCase(),value=m[2].trim();
  if(mode==='help')return rpgHelp(r,'skill');
  if(mode==='list')return rpgSkillListText(r);
  if(mode==='add'){
    const parts=value.split('|').map(x=>x.trim());
    if(parts.length<2||parts.length>3)return 'Формат: :skill add Акробатика | Ловкость | акробат,сальто';
    const name=rpgClean(parts[0],40),attr=rpgName(RPG_STATS,parts[1]),words=rpgSkillWords(parts[2]||'');
    if(name.length<2||name.length>40||!attr||words===null||/[|:]/.test(name))return 'Название 2–40 символов, характеристика из :help stat, ключевые слова 3–32 символа (до 8).';
    if(rpgSkillName(r,name))return 'Навык «'+name+'» уже существует. Используй :skill info '+name;
    if(Object.keys(r.customSkills).length>=40)return 'Лимит: 40 пользовательских навыков.';
    r.customSkills[name]={attr,keywords:words};r.skills[name]=0;
    if(r.characterDraft)r.characterDraft.skills[name]=0;
    return 'Навык добавлен: '+name+' ('+attr+').'+(words.length?' Автораспознавание: '+words.join(', ')+'.':' Для автосудьи укажи фразы командой :skill bind '+name+' | фраза1,фраза2.');
  }
  if(mode==='info'){
    const name=rpgSkillName(r,value);
    if(!name)return 'Неизвестный навык. :help skill';
    const entry=r.customSkills[name];
    return name+' — '+(entry?'пользовательский':'стандартный')+' навык, характеристика '+(entry?entry.attr:RPG_SKILL_ATTRS[name])+', уровень '+(r.skills[name]||0)+', модификатор d20 '+(rpgModifierDelta(r,name,'skills')>=0?'+':'')+rpgModifierDelta(r,name,'skills')+', бонус навыка '+(rpgSkillBonus(r,name)>=0?'+':'')+rpgSkillBonus(r,name)+(entry?'; ключевые фразы: '+(entry.keywords.join(', ')||'нет'):'; для стандартных навыков характеристику выбирает судья по действию')+'.';
  }
  if(mode==='remove'||mode==='delete'){
    const name=rpgName(Object.keys(r.customSkills),value);
    if(!name)return 'Удалять можно только пользовательские навыки: :skill remove Название';
    delete r.customSkills[name];delete r.skills[name];if(r.xp&&r.xp.skills)delete r.xp.skills[name];
    if(r.characterDraft)delete r.characterDraft.skills[name];
    return 'Пользовательский навык «'+name+'» удалён из этой игры и персонажа.';
  }
  if(mode==='attr'||mode==='bind'){
    const parts=value.split('|').map(x=>x.trim());
    if(parts.length!==2)return 'Формат: :skill '+mode+' Название | '+(mode==='attr'?'Ловкость':'акробат,сальто');
    const name=rpgName(Object.keys(r.customSkills),parts[0]);
    if(!name)return 'Настраивать можно только пользовательские навыки: :help skill';
    if(mode==='attr'){
      const a=rpgName(RPG_STATS,parts[1]);if(!a)return 'Неизвестная характеристика. :help stat';
      r.customSkills[name].attr=a;return name+': характеристика '+a;
    }
    const words=rpgSkillWords(parts[1]);if(words===null)return 'До 8 ключевых фраз по 3–32 символа через запятую.';
    r.customSkills[name].keywords=words;
    return name+': ключевые фразы '+(words.join(', ')||'удалены')+'.';
  }
  return null;
}
function rpgSkillListText(r){
  return 'СТАНДАРТНЫЕ НАВЫКИ (27)\n'+RPG_SKILLS.map(x=>x+' ('+RPG_SKILL_ATTRS[x]+', '+(r.skills[x]||0)+')').join('; ')+
    '\nПОЛЬЗОВАТЕЛЬСКИЕ ('+Object.keys(r.customSkills||{}).length+')\n'+
    (Object.keys(r.customSkills||{}).map(x=>x+' ('+r.customSkills[x].attr+', '+(r.skills[x]||0)+'; '+(r.customSkills[x].keywords.join(', ')||'без ключевых фраз')+')').join('; ')||'нет')+
    '\n:help skill — синтаксис создания, настройки и удаления.';
}
/* v2.8: one hundredth is the smallest money unit. Never use rpgInt for currency. */
function rpgMoneyRound(value){return Math.round((Number(value)+Number.EPSILON)*100)/100;}
function rpgMoneyFormat(value){return String(rpgMoneyRound(value));}
function rpgMoneyParse(raw){
  const v=String(raw||'').trim().replace(/[\u00a0\u202f]/g,' ');
  if(!/^[+-]?\d+(?:[.,]\d{1,2})?$/.test(v))return null;
  const n=Number(v.replace(',','.'));
  return Number.isFinite(n)?rpgMoneyRound(n):null;
}
function rpgMoneyFromProse(raw){
  const t=String(raw||'').replace(/[\u00a0\u202f]/g,' ').replace(/\s+/g,' ').trim();
  return rpgMoneyParse(t.replace(/(?<=\d) (?=\d{3}(?:\D|$))/g,''));
}
function rpgInt(v, low, high) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(low, Math.min(high, Math.round(n))) : low;
}
function rpgClean(s, n) { return String(s || '').replace(/[\r\n\[\]<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n || 140); }
function rpgName(list, needle) {
  const key = rpgClean(needle, 90).toLowerCase();
  return list.find(x => x.toLowerCase() === key) || null;
}
// Create exactly the same baseline for a new scenario and for :rpg reset.
// rpgInit completes defaults/migrations, including initial scenario placeholders.
function rpgDefaultState(){
  const r={
    version:1,config:{autoJudge:RPG_CFG.autoJudge,magic:RPG_CFG.magic,ledger:false,debug:false},
    hp:RPG_CFG.startingHP,maxHP:RPG_CFG.startingHP,
    stamina:RPG_CFG.startingStamina,maxStamina:RPG_CFG.startingStamina,
    money:0,timeMinutes:12*60,day:1,location:'не определена',
    stats:{},skills:{},items:{},notes:[],recent:[],rolls:[],
    pendingRoll:null,pendingUI:null,turn:0,lastAction:''
  };
  RPG_STATS.forEach(k=>{r.stats[k]=10;});
  RPG_SKILLS.forEach(k=>{r.skills[k]=0;});
  return r;
}
function rpgInit() {
  if (!state.rpg || state.rpg.version !== 1)state.rpg=rpgDefaultState();
  const r=state.rpg;
  if(!r.config)r.config={autoJudge:false,magic:false,ledger:false};
  if(typeof r.config.debug!=='boolean')r.config.debug=false;
  // Default for already-running v1.3 adventures: smart adjudication when auto is on.
  if(typeof r.config.smartJudge!=='boolean')r.config.smartJudge=true;
  // v1.6 migration: prefer single-pass narrative judging over brittle model JSON.
  // Previous explicit classic mode stays classic; optional smart mode remains selectable.
  if(typeof r.config.narrativeJudge!=='boolean'){
    r.config.narrativeJudge=!!r.config.smartJudge;
    if(r.config.narrativeJudge)r.config.smartJudge=false;
  }
  if(typeof r.config.cautiousJudge!=='boolean')r.config.cautiousJudge=false;
  if(typeof r.config.editor!=='boolean')r.config.editor=true;
  if(typeof r.config.inventoryStrict!=='boolean')r.config.inventoryStrict=true;
  if(!['safe','story','strict'].includes(r.config.fallback))r.config.fallback='safe';
  if(!['simple','weighted','detailed'].includes(r.config.judgeCombo))r.config.judgeCombo='weighted';
  if(r.nextJudgeOverride&&(!RPG_STATS.includes(r.nextJudgeOverride.attr)||r.nextJudgeOverride.skill&&!rpgSkillName(r,r.nextJudgeOverride.skill)))r.nextJudgeOverride=null;
  if(!r.character)r.character=rpgReadInitialCharacter();
  rpgMigrateCharacter(r.character);
  if(r.characterDraft&&r.characterDraft.character)rpgMigrateCharacter(r.characterDraft.character);
  // Non-destructive v1.7 migration: preserve HP, stats, items, notes and money.
  if(!r.needs)r.needs={hunger:0,thirst:0,fatigue:0,hungerRemainder:0,thirstRemainder:0,fatigueRemainder:0};
  for(const k of ['hunger','thirst','fatigue','hungerRemainder','thirstRemainder','fatigueRemainder']){
    if(!Number.isFinite(r.needs[k]))r.needs[k]=0;
  }
  if(!r.customSkills||typeof r.customSkills!=='object'||Array.isArray(r.customSkills))r.customSkills={};
  if(!r.skills||typeof r.skills!=='object')r.skills={};
  for(const name of RPG_SKILLS)if(!Number.isFinite(r.skills[name]))r.skills[name]=0;
  for(const name of Object.keys(r.customSkills)){
    const entry=r.customSkills[name];
    if(!entry||!rpgName(RPG_STATS,entry.attr)||!Array.isArray(entry.keywords)||rpgName(RPG_SKILLS,name)){
      delete r.customSkills[name];continue;
    }
    if(!Number.isFinite(r.skills[name]))r.skills[name]=0;
    if(r.characterDraft&&r.characterDraft.skills&&!Number.isFinite(r.characterDraft.skills[name]))r.characterDraft.skills[name]=0;
  }
  rpgMigrateJournal(r);
  rpgMigrateQuests(r);
  if(!r.flags)r.flags={};
  if(typeof r.config.needs!=='boolean')r.config.needs=true;
  if(typeof r.config.economy!=='boolean')r.config.economy=true;
  if(typeof r.config.combat!=='boolean')r.config.combat=true;
  rpgXpInit(r);
  rpgModifiersInit(r);
  // v2.12 migration: retire legacy invoices, without changing any funds.
  if(Object.prototype.hasOwnProperty.call(r,'pendingBill'))delete r.pendingBill;
  if(Object.prototype.hasOwnProperty.call(r,'lastBillDiagnostic'))delete r.lastBillDiagnostic;
  if(typeof r.money!=='number'||!Number.isFinite(r.money))r.money=0;
  r.money=rpgMoneyRound(r.money);
  // v2.12: debt belongs to the player and is independent of the wallet.
  if(!Number.isFinite(r.debt)||r.debt<0)r.debt=0;
  r.debt=rpgMoneyRound(r.debt);
  if(!Array.isArray(r.financeLog))r.financeLog=[];
  if(!Array.isArray(r.autoEvents))r.autoEvents=[];
  // v2.20: narrative claims are suggestions, NOT validated state changes.
  if(!Array.isArray(r.reviewItems))r.reviewItems=[];
  if(!Number.isInteger(r.nextReviewId)||r.nextReviewId<1)r.nextReviewId=r.reviewItems.reduce((v,x)=>Math.max(v,Number(x.id)||0),0)+1;
  // v2.17: reconcile the saved game clock with need accrual at every hook.
  // On migration establish a baseline; never invent needs for past, already-played turns.
  rpgNeedsReconcileClock(r);
  rpgModifiersExpire(r);
  return r;
}
function rpgReadInitialCharacter(){
  const answers=Array.isArray(state.placeholders)?state.placeholders:[];
  const answer=(key)=>{
    const found=answers.find(p=>String(p.question||'').toLowerCase()===key.toLowerCase());
    return found?rpgClean(found.answer,120):'';
  };
  return {name:answer('character.name')||'не задано',gender:answer('character.gender')||'не задан',
    age:null,job:'не указана',background:'не указана',dream:'не указана'};
}
function rpgRoll(sides) { return 1 + Math.floor(Math.random() * sides); }
function rpgCalendar(r){
  const d=Math.max(1,Math.floor(r.day||1))-1;
  return {year:Math.floor(d/360)+1,month:Math.floor((d%360)/30)+1,day:(d%30)+1};
}
function rpgClock(r){
  const d=rpgCalendar(r);
  return 'год '+d.year+', месяц '+d.month+', день '+d.day+', '+String(Math.floor(r.timeMinutes/60)).padStart(2,'0')+':'+String(r.timeMinutes%60).padStart(2,'0');
}
function rpgMigrateCharacter(c){
  if(!c||typeof c!=='object')return;
  if(!c.dream||c.dream==='не указана')c.dream=c.goal&&c.goal!=='не указана'?c.goal:'не указана';
  // goal is a legacy alias; dream is the single source of truth.
  delete c.goal;
  if(typeof c.background!=='string')c.background='не указана';
}
function rpgMigrateJournal(r){
  if(!Array.isArray(r.journal)){
    r.journal=[];r.nextNoteId=1;
    for(const text of Array.isArray(r.notes)?r.notes:[]){
      if(typeof text==='string'&&text.trim())rpgJournalAdd(r,'факт',text,false);
    }
    r.notes=[];
  }
  if(!Number.isInteger(r.nextNoteId)||r.nextNoteId<=0){r.nextNoteId=r.journal.reduce((max,x)=>Math.max(max,Number(x.id)||0),0)+1;}
}
function rpgMigrateQuests(r){
  if(!Array.isArray(r.quests))r.quests=[];
  if(!Number.isInteger(r.nextQuestId)||r.nextQuestId<=0)r.nextQuestId=r.quests.reduce((max,x)=>Math.max(max,Number(x.id)||0),0)+1;
}
function rpgLimitedText(s,limit,label){
  const v=String(s||'').replace(/[\r\n]+/g,' ').replace(/[<>]/g,'').replace(/\s+/g,' ').trim();
  if(!v)return {error:'Укажи текст для «'+label+'».'};
  if(Array.from(v).length>limit)return {error:'Превышен лимит '+label+': '+Array.from(v).length+'/'+limit+' символов. Текст НЕ изменён.'};
  return {value:v};
}
const RPG_NOTE_TYPES=['факт','npc','событие','обещание','место','квест','мир'];
function rpgJournalAdd(r,type,text,pinned){
  const cleaned=rpgLimitedText(text,RPG_CFG.maxJournalText,'заметки');
  if(cleaned.error)return cleaned.error;
  const category=rpgName(RPG_NOTE_TYPES,type)||'факт';
  if(r.journal.length>=RPG_CFG.maxNotes){
    const idx=r.journal.findIndex(x=>!x.pinned);
    if(idx<0)return 'Журнал заполнен закреплёнными заметками. Сними закрепление или удали запись.';
    r.journal.splice(idx,1);
  }
  const item={id:r.nextNoteId++,type:category,text:cleaned.value,pinned:!!pinned,day:r.day,timeMinutes:r.timeMinutes};
  r.journal.push(item);return 'Заметка #'+item.id+' ['+category+'] добавлена.';
}
function rpgJournalList(r,arg){
  const query=String(arg||'').toLowerCase().trim();
  let selected=r.journal;
  if(query==='pinned')selected=selected.filter(x=>x.pinned);
  else if(query&&query!=='all'&&query!=='list')selected=selected.filter(x=>x.type===query);
  const shown=selected.slice(query==='all'?-50:-20);
  return 'ЖУРНАЛ ('+selected.length+'/'+r.journal.length+', показано '+shown.length+')\n'+(shown.map(x=>'#'+x.id+' ['+x.type+']'+(x.pinned?' [ВАЖНО]':'')+' '+x.text).join('\n')||'Нет записей.')+'\n:help note — редактирование, поиск, закрепление.';
}
function rpgJournalCommand(r,cmd,arg){
  const v=String(arg||'').trim();
  if(cmd==='notes')return rpgJournalList(r,v);
  if(!v)return rpgJournalList(r,'');
  const m=v.match(/^(add|edit|remove|delete|pin|unpin|search|clear|list|help)\b\s*([\s\S]*)$/i);
  if(!m)return rpgJournalAdd(r,'факт',v,false);
  const action=m[1].toLowerCase(),rest=m[2].trim();
  if(action==='help')return rpgHelp(r,'note');
  if(action==='list')return rpgJournalList(r,rest);
  if(action==='search'){
    const needle=rest.replace(/[.!?]+\s*$/,'').trim();
    if(!needle)return 'Пример: :note search охранник';
    const rows=r.journal.filter(x=>x.text.toLowerCase().includes(needle.toLowerCase())||x.type.includes(needle.toLowerCase()));
    return 'ПОИСК ('+rows.length+')\n'+(rows.slice(-30).map(x=>'#'+x.id+' ['+x.type+'] '+x.text).join('\n')||'Не найдено.');
  }
  if(action==='add'){
    const pair=rest.split('|');
    if(pair.length<2)return 'Пример: :note add npc | Охранник помнит лицо героя';
    const type=rpgName(RPG_NOTE_TYPES,pair.shift().trim());
    if(!type)return 'Неизвестная категория. '+RPG_NOTE_TYPES.join(', ');
    return rpgJournalAdd(r,type,pair.join('|').trim(),false);
  }
  if(action==='clear'){
    if(rest.toLowerCase()!=='confirm')return 'Очистка необратима. Введи :note clear confirm для удаления ВСЕХ заметок.';
    const count=r.journal.length;r.journal=[];return 'Удалено '+count+' записей журнала.';
  }
  const match=rest.match(/^(\d+)(?:\s*\|\s*([\s\S]*))?$/);
  if(!match)return 'Укажи ID записи; для редактирования: :note edit 3 | новый текст';
  const id=+match[1],note=r.journal.find(x=>x.id===id);
  if(!note)return 'Заметка #'+id+' не найдена. :notes';
  if(action==='edit'){
    const cleaned=rpgLimitedText(match[2],RPG_CFG.maxJournalText,'заметки');if(cleaned.error)return cleaned.error;
    note.text=cleaned.value;return 'Заметка #'+id+' обновлена.';
  }
  if(action==='remove'||action==='delete'){
    r.journal=r.journal.filter(x=>x.id!==id);return 'Заметка #'+id+' удалена.';
  }
  if(action==='pin'||action==='unpin'){
    note.pinned=action==='pin';return 'Заметка #'+id+': '+(note.pinned?'закреплена':'откреплена')+'.';
  }
  return rpgHelp(r,'note');
}
function rpgQuestCommand(r,arg){
  const v=String(arg||'').trim(),m=v.match(/^(add|list|info|status|edit|remove|due|help)\b\s*([\s\S]*)$/i);
  if(!m)return rpgQuestList(r,'active');
  const cmd=m[1].toLowerCase(),rest=m[2].trim();
  if(cmd==='help')return rpgHelp(r,'quest');
  if(cmd==='list')return rpgQuestList(r,rest||'active');
  if(cmd==='add'){
    const parts=rest.split('|').map(x=>x.trim()),title=rpgLimitedText(parts[0],100,'названия задания');
    if(title.error)return title.error;
    const description=parts[1]?rpgLimitedText(parts.slice(1).join('|'),600,'описания задания'):{value:''};
    if(description.error)return description.error;
    if(r.quests.length>=RPG_CFG.maxQuests)return 'Лимит: '+RPG_CFG.maxQuests+' заданий.';
    const q={id:r.nextQuestId++,title:title.value,description:description.value,status:'active',createdDay:r.day};
    r.quests.push(q);return 'Задание #'+q.id+' добавлено: '+q.title+'. Статус: active.';
  }
  const x=rest.match(/^(\d+)(?:\s+([\s\S]*))?$/);
  if(!x)return 'Укажи номер задания. :quest list, :help quest';
  const q=r.quests.find(q=>q.id===+x[1]);if(!q)return 'Задание #'+x[1]+' не найдено.';
  const tail=String(x[2]||'').trim();
  if(cmd==='info')return '#'+q.id+' ['+q.status+'] '+q.title+'\n'+(q.description||'Описание не задано.')+'\nСоздано: абсолютный день '+q.createdDay+'.'+(q.due?('\nСрок: '+rpgQuestDueLabel(q.due)+(rpgQuestOverdue(r,q)?' [ПРОСРОЧЕНО]':'')):'');
  if(cmd==='due'){
    if(tail.toLowerCase()==='clear'){delete q.due;return 'Срок задания #'+q.id+' очищен.';}
    const parts=tail.replace(/^\|\s*/,'').match(/^(\d{1,4})\s+(\d{1,2})\s+(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/);
    if(!parts)return 'Пример: :quest due '+q.id+' | 2 4 15 18:00 (или :quest due '+q.id+' clear)';
    const [yr,mon,day,hh,mm]=parts.slice(1).map(v=>v===undefined?null:+v);
    if(yr<1||yr>9999||mon<1||mon>12||day<1||day>30||hh!==null&&(hh>23||mm>59))return 'Недопустимая дата: год 1–9999, месяц 1–12, день 1–30, часы 00–23, минуты 00–59.';
    q.due={day:(yr-1)*360+(mon-1)*30+day,timeMinutes:hh===null?1439:hh*60+mm};
    return 'Срок #'+q.id+': '+rpgQuestDueLabel(q.due)+'.';
  }
  if(cmd==='status'){
    if(!['active','done','failed','cancelled'].includes(tail.toLowerCase()))return 'Статусы: active / done / failed / cancelled. Пример: :quest status 2 done';
    q.status=tail.toLowerCase();rpgJournalAdd(r,'квест','Задание «'+q.title+'»: статус '+q.status+'.',false);
    return 'Задание #'+q.id+': '+q.status+'.';
  }
  if(cmd==='edit'){
    const parts=tail.replace(/^\|\s*/,'').split('|').map(x=>x.trim());
    const title=rpgLimitedText(parts[0],100,'названия задания');if(title.error)return title.error;
    const d=parts.length>1?rpgLimitedText(parts.slice(1).join('|'),600,'описания задания'):{value:q.description};if(d.error)return d.error;
    q.title=title.value;q.description=d.value;return 'Задание #'+q.id+' изменено.';
  }
  if(cmd==='remove'){
    if(tail!=='confirm')return 'Удаление необратимо. Подтверди: :quest remove '+q.id+' confirm';
    r.quests=r.quests.filter(x=>x.id!==q.id);return 'Задание #'+q.id+' удалено.';
  }
  return rpgHelp(r,'quest');
}
function rpgQuestDueLabel(due){return rpgClock({day:due.day,timeMinutes:due.timeMinutes});}
function rpgQuestOverdue(r,q){return !!(q.due&&q.status==='active'&&(r.day>q.due.day||r.day===q.due.day&&r.timeMinutes>q.due.timeMinutes));}
function rpgQuestList(r,filter){
  const f=String(filter||'active').toLowerCase();
  if(!['all','active','done','failed','cancelled'].includes(f))return 'Фильтр: active/done/failed/cancelled/all';
  const arr=r.quests.filter(x=>f==='all'||x.status===f);
  return 'ЗАДАНИЯ ('+arr.length+')\n'+(arr.slice(-30).map(q=>'#'+q.id+' ['+q.status+'] '+q.title+(q.due?' — до '+rpgQuestDueLabel(q.due)+(rpgQuestOverdue(r,q)?' [ПРОСРОЧЕНО]':''):'')).join('\n')||'Нет заданий.')+'\n:quest info ID — подробности.';
}
function rpgJournalContext(r){
  const pinned=r.journal.filter(x=>x.pinned).slice(-8),latest=r.journal.filter(x=>!x.pinned).slice(-8);
  // Priority: pinned first, then recent ordinary entries; full text stays in persistent journal.
  const taken=[...pinned,...latest];
  return taken.map(x=>'#'+x.id+' ['+x.type+'] '+x.text).join(' | ').slice(0,1700);
}
function rpgQuestContext(r){
  return r.quests.filter(x=>x.status==='active').slice(-8).map(q=>'#'+q.id+' '+q.title+(q.due?' (срок '+rpgQuestDueLabel(q.due)+(rpgQuestOverdue(r,q)?', просрочено':'')+')':'')+(q.description?' — '+q.description:'')).join(' | ').slice(0,900);
}
function rpgDateCommand(r,arg){
  const s=String(arg||'').trim(),parts=s.split(/\s+/);
  if(!s||/^show$/i.test(s))return 'Игровая дата: '+rpgClock(r)+'. Условный календарь: 12 месяцев по 30 дней; не привязан к реальным датам.';
  if(/^set$/i.test(parts[0])){
    const m=s.match(/^set\s+(\d{1,4})\s+(\d{1,2})\s+(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/i);
    if(!m)return 'Пример: :date set 2 4 15 09:30 (год месяц день часы:минуты)';
    const [yr,mon,day,hh,mm]=m.slice(1).map(v=>v===undefined?null:+v);
    if(yr<1||yr>9999||mon<1||mon>12||day<1||day>30||hh!==null&&(hh>23||mm>59))return 'Год 1–9999, месяц 1–12, день 1–30, часы 00–23, минуты 00–59.';
    r.day=(yr-1)*360+(mon-1)*30+day;
    if(hh!==null)r.timeMinutes=hh*60+mm;
    rpgNeedsSyncCheckpoint(r); // editing a clock is not elapsed time
    return 'Игровая дата установлена: '+rpgClock(r)+'. Потребности при переносе даты НЕ пересчитываются.';
  }
  const advance=s.match(/^(?:advance|next)\s+(\d{1,2})$/i);
  if(advance){const days=+advance[1];if(days<1||days>30)return 'Можно пропустить 1–30 дней.';
    if(r.day+days>9999*360)return 'Превышен максимальный год 9999.';
    for(let remaining=days*1440;remaining>0;){const chunk=Math.min(remaining,10080);rpgAdvanceTime(r,chunk,'normal');remaining-=chunk;}
    return 'Дата продвинута на '+days+' дн.: '+rpgClock(r)+'. Потребности учтены.';
  }
  return 'Примеры: :date show; :date set 2 4 15 09:30; :date advance 3';
}

/* ---------- v2.15: deterministic use-based progression ---------- */
const RPG_XP_SPEED={slow:0.5,normal:1,fast:2};
const RPG_XP_SPEED_MIN=0.1, RPG_XP_SPEED_MAX=10;
// Existing saves keep their named presets; a custom speed is a numeric multiplier.
// Only decimal numbers with at most two digits after the separator are accepted.
function rpgXpSpeedParse(raw){
  const text=String(raw===undefined||raw===null?'':raw).trim().toLowerCase();
  if(Object.prototype.hasOwnProperty.call(RPG_XP_SPEED,text))
    return {value:text,multiplier:RPG_XP_SPEED[text]};
  if(!/^(?:\d+(?:[.,]\d{1,2})?|[.,]\d{1,2})$/.test(text))return null;
  const multiplier=Number(text.replace(',','.'));
  if(!Number.isFinite(multiplier)||multiplier<RPG_XP_SPEED_MIN||multiplier>RPG_XP_SPEED_MAX)return null;
  return {value:multiplier,multiplier};
}
function rpgXpSpeedLabel(speed){
  const parsed=rpgXpSpeedParse(speed);
  return parsed?(typeof parsed.value==='number'?'ручная ':'')+parsed.value+' (×'+parsed.multiplier+')':'normal (×1)';
}
const RPG_XP_SPEED_HELP='slow (×0.5), normal (×1), fast (×2) или число от 0.1 до 10, не более 2 знаков после точки/запятой. Пример: :xp speed 1.5';
function rpgXpInit(r){
  if(!r.xp||typeof r.xp!=='object'||Array.isArray(r.xp))r.xp={};
  for(const field of ['skills','attrPoints','practice']){
    if(!r.xp[field]||typeof r.xp[field]!=='object'||Array.isArray(r.xp[field]))r.xp[field]={};
  }
  for(const k of RPG_STATS){
    if(!Number.isInteger(r.xp.attrPoints[k])||r.xp.attrPoints[k]<0)r.xp.attrPoints[k]=0;
    if(!Number.isInteger(r.xp.practice[k])||r.xp.practice[k]<0)r.xp.practice[k]=0;
  }
  for(const k of rpgSkillList(r))if(!Number.isInteger(r.xp.skills[k])||r.xp.skills[k]<0)r.xp.skills[k]=0;
  if(!Array.isArray(r.xp.recent))r.xp.recent=[];
  if(!Array.isArray(r.xp.log))r.xp.log=[];
  if(!Array.isArray(r.xp.notices))r.xp.notices=[];
  if(typeof r.config.xpEnabled!=='boolean')r.config.xpEnabled=true;
  if(!['instant','rest','manual'].includes(r.config.xpMode))r.config.xpMode='rest';
  const speed=rpgXpSpeedParse(r.config.xpSpeed);
  r.config.xpSpeed=speed?speed.value:'normal';
}
function rpgXpSkillThreshold(level){return 25+2*Math.max(0,level);}
function rpgXpAttrThreshold(level){return 6+2*Math.max(0,level-10);}
function rpgXpSkillAttribute(r,skill){return r.customSkills[skill]?r.customSkills[skill].attr:RPG_SKILL_ATTRS[skill];}
function rpgXpActionKey(action){
  return String(action||'').toLowerCase().replace(/ё/g,'е').replace(/^\s*>?\s*(?:you|ты)\s+/i,'')
    .replace(/\d+(?:[.,]\d+)?/g,'#').replace(/[^а-яa-z#]+/gi,' ').trim().slice(0,105);
}
function rpgXpReady(r){
  let ready=0;
  for(const skill of rpgSkillList(r)){
    let xp=r.xp.skills[skill]||0,lev=r.skills[skill]||0;
    while(lev<50 && xp>=rpgXpSkillThreshold(lev)){xp-=rpgXpSkillThreshold(lev);lev++;ready++;}
  }
  return ready;
}
function rpgXpApply(r){
  rpgXpInit(r);
  const events=[];
  let changed=false;
  // Apply trained skill levels first, then transfer 1 mastery point to their configured attribute.
  for(const skill of rpgSkillList(r)){
    let lev=r.skills[skill]||0, xp=r.xp.skills[skill]||0, steps=0;
    while(lev<50 && xp>=rpgXpSkillThreshold(lev) && steps<50){
      xp-=rpgXpSkillThreshold(lev);lev++;steps++;changed=true;
      const attr=rpgXpSkillAttribute(r,skill);
      if(attr&&RPG_STATS.includes(attr))r.xp.attrPoints[attr]=(r.xp.attrPoints[attr]||0)+1;
    }
    if(steps){
      r.skills[skill]=lev;r.xp.skills[skill]=xp;
      events.push('[RPG] Навык «'+skill+'» +'+steps+' → '+lev+'.');
    }
    if(lev>=50)r.xp.skills[skill]=0;
  }
  for(const attr of RPG_STATS){
    let level=r.stats[attr]||10, pts=r.xp.attrPoints[attr]||0,steps=0;
    while(level<30&&pts>=rpgXpAttrThreshold(level)){
      pts-=rpgXpAttrThreshold(level);level++;steps++;changed=true;
    }
    if(steps){r.stats[attr]=level;events.push('[RPG] Характеристика «'+attr+'» +'+steps+' → '+level+'.');}
    r.xp.attrPoints[attr]=level>=30?0:pts;
  }
  if(changed){r.xp.log.push('ход '+r.turn+': '+events.join(' '));r.xp.log=r.xp.log.slice(-20);}
  return events;
}
function rpgXpAward(r,roll){
  rpgXpInit(r);
  if(!r.config.xpEnabled||!roll||roll.dc<10)return;
  if(!roll.skill&&!RPG_STATS.includes(roll.attr))return;
  const key=rpgXpActionKey(roll.action),skill=roll.skill;
  // Repetition is tracked only for the same normalized action + skill.
  // First repetition within 8 turns earns half XP; later repetitions earn zero.
  const recent=r.xp.recent.filter(x=>x&&r.turn-x.turn<=8&&r.turn>=x.turn);
  const repeats=recent.filter(x=>x.key===key&&x.skill===skill).length;
  r.xp.recent=recent.concat([{key,skill,turn:r.turn}]).slice(-32);
  let base=roll.dice===20&&roll.success?8:roll.success&&roll.dc>=18?6:roll.success?4:2;
  let amount=Math.round(base*rpgXpSpeedParse(r.config.xpSpeed).multiplier);
  if(repeats===1)amount=Math.floor(amount/2);
  if(repeats>=2)amount=0;
  const attr=skill?rpgXpSkillAttribute(r,skill):roll.attr;
  if(amount>0){
    if(skill&&r.skills[skill]<50)r.xp.skills[skill]=(r.xp.skills[skill]||0)+amount;
    // Attribute-only checks also train slowly; skill checks train by practice
    // and additionally by each actual trained skill level increase.
    const activeAttr=RPG_STATS.includes(roll.attr)?roll.attr:attr;
    if(activeAttr&&r.stats[activeAttr]<30){
      r.xp.practice[activeAttr]=(r.xp.practice[activeAttr]||0)+1;
      if(r.xp.practice[activeAttr]>=6){
        r.xp.practice[activeAttr]-=6;
        r.xp.attrPoints[activeAttr]=(r.xp.attrPoints[activeAttr]||0)+1;
      }
    }
  }
  if(r.config.debug){
    r.xp.notices.push('[RPG DEBUG] ОПЫТ: '+(skill||roll.attr)+' '+(amount?'+'+amount+' XP':(repeats?'0 XP (повторение)':'0 XP (округление)'))+
      (skill?' ('+(r.xp.skills[skill]||0)+'/'+rpgXpSkillThreshold(r.skills[skill]||0)+')':'')+
      '; '+(roll.success?'успех':'неудача')+', DC '+roll.dc+'.');
  }
  if(r.config.xpMode==='instant'&&amount>0)r.xp.notices.push(...rpgXpApply(r));
}
function rpgXpCommand(r,arg){
  rpgXpInit(r);
  const m=String(arg||'').trim().match(/^(on|off|mode|speed|apply|skill|stat|log|help)\b\s*(.*)$/i);
  if(!m){
    const active=rpgSkillList(r).filter(k=>r.xp.skills[k]>0).sort((a,b)=>r.xp.skills[b]-r.xp.skills[a]);
    return 'РАЗВИТИЕ: '+(r.config.xpEnabled?'on':'off')+'; скорость '+rpgXpSpeedLabel(r.config.xpSpeed)+'; повышение '+r.config.xpMode+'.\n'+
      'Готово повышений навыков: '+rpgXpReady(r)+'.\nОпыт навыков: '+(active.slice(0,12).map(k=>k+' '+r.xp.skills[k]+'/'+rpgXpSkillThreshold(r.skills[k]||0)).join('; ')||'пока нет')+'.\n'+
      'Очки характеристик: '+(RPG_STATS.filter(k=>r.xp.attrPoints[k]).map(k=>k+' '+r.xp.attrPoints[k]+'/'+rpgXpAttrThreshold(r.stats[k])).join('; ')||'пока нет')+'.\n:help xp — команды.';
  }
  const op=m[1].toLowerCase(),v=m[2].trim();
  if(op==='help')return rpgHelp(r,'xp');
  if(op==='on'||op==='off'){
    r.config.xpEnabled=op==='on';
    const applied=r.config.xpEnabled&&r.config.xpMode==='instant'?rpgXpApply(r):[];
    return 'Развитие: '+op+'. Опыт сохранён.'+(applied.length?'\n'+applied.join('\n'):'');
  }
  if(op==='mode'){
    if(!['instant','rest','manual'].includes(v))return 'Варианты: :xp mode instant | rest | manual';
    r.config.xpMode=v;
    const applied=v==='instant'&&r.config.xpEnabled?rpgXpApply(r):[];
    return 'Повышение: '+v+'. Накопленный XP сохранён.'+(applied.length?'\n'+applied.join('\n'):'');
  }
  if(op==='speed'){
    const parsed=rpgXpSpeedParse(v);
    if(!parsed)return 'Допустимые скорости: '+RPG_XP_SPEED_HELP;
    r.config.xpSpeed=parsed.value;return 'Скорость накопления XP: '+rpgXpSpeedLabel(r.config.xpSpeed)+'. Накопленный XP не пересчитан.';
  }
  if(op==='apply'){
    if(!r.config.xpEnabled)return 'Развитие отключено. Сначала :xp on.';
    const leveled=rpgXpApply(r);return leveled.length?leveled.join('\n'):'Пока нет готовых повышений. :xp — прогресс.';
  }
  if(op==='skill'){
    const skill=rpgSkillName(r,v);if(!skill)return 'Неизвестный навык. :help skill';
    return skill+': уровень '+r.skills[skill]+'; опыт '+(r.xp.skills[skill]||0)+'/'+rpgXpSkillThreshold(r.skills[skill]||0)+
      '; характеристика '+rpgXpSkillAttribute(r,skill)+'.';
  }
  if(op==='stat'){
    const attr=rpgName(RPG_STATS,v);if(!attr)return 'Неизвестная характеристика. :help stat';
    return attr+': '+r.stats[attr]+'; развитие '+r.xp.attrPoints[attr]+'/'+rpgXpAttrThreshold(r.stats[attr])+
      '; практика '+r.xp.practice[attr]+'/6.';
  }
  if(op==='log')return 'ИСТОРИЯ РАЗВИТИЯ\n'+(r.xp.log.slice(-15).join('\n')||'Повышений пока нет.');
  return rpgHelp(r,'xp');
}
/* v2.23 — unified signed modifiers for the D20 ROLL, never for levels.
 * Command: :mod add Skill, Attribute | +2 or -2 | minutes | reason.
 * Migrates v2.21 effects whose amounts measured SKILL LEVELS to dice points.
 * IDs are active-list-local: reuse the lowest unoccupied positive integer.
 * Surviving effects keep their original IDs; when all are removed/expired,
 * the next effect starts again at #1. */
function rpgModifierSyncId(r){
  // The next available ID is bounded by active effect count, not by lifetime
  // creations. Existing IDs are never changed (including migrated v2.21 IDs).
  const occupied=new Set((r.modifiers||[]).map(x=>x.id));
  let candidate=1;
  while(occupied.has(candidate))candidate++;
  r.nextModifierId=candidate;
  return candidate;
}
function rpgModifiersInit(r){
  if(!Array.isArray(r.modifiers))r.modifiers=[];
  if(!Array.isArray(r.modifierNotices))r.modifierNotices=[];
  const converted=[];
  for(const old of r.modifiers){
    if(!old||!Number.isInteger(old.id)||!Number.isFinite(old.expiresAt))continue;
    const skills=(Array.isArray(old.skills)?old.skills:[]).map(x=>rpgSkillName(r,x)).filter(Boolean);
    const stats=(Array.isArray(old.stats)?old.stats:[]).map(x=>rpgName(RPG_STATS,x)).filter(Boolean);
    if(!skills.length&&!stats.length)continue;
    let delta;
    if(Number.isInteger(old.delta)&&old.delta!==0){
      delta=old.delta;
    }else if((old.kind==='buff'||old.kind==='debuff')&&Number.isInteger(old.amount)&&old.amount>0){
      // v2.21 amount was in skill-level points, not d20 points.
      // Convert 10 levels -> +1/-1 to preserve the common case.
      delta=(old.kind==='buff'?1:-1)*Math.max(1,Math.ceil(old.amount/10));
    }else continue;
    if(Math.abs(delta)>20)delta=Math.sign(delta)*20;
    converted.push({id:old.id,skills:[...new Set(skills)],stats:[...new Set(stats)],delta,
      expiresAt:old.expiresAt,reason:rpgClean(String(old.reason||'Эффект'),80)});
  }
  r.modifiers=converted.slice(-30);
  rpgModifierSyncId(r);
}
function rpgModifierTargets(x){return (x.skills||[]).concat(x.stats||[]);}
function rpgModifiersExpire(r){
  if(!Array.isArray(r.modifiers)||!r.modifiers.length){rpgModifierSyncId(r);return [];}
  const minute=rpgAbsoluteMinute(r),expired=r.modifiers.filter(x=>x.expiresAt<=minute);
  if(expired.length){
    r.modifiers=r.modifiers.filter(x=>x.expiresAt>minute);
    rpgModifierSyncId(r);
    if(!Array.isArray(r.modifierNotices))r.modifierNotices=[];
    for(const x of expired)r.modifierNotices.push('[RPG] Модификатор #'+x.id+' ('+
      (x.delta>0?'+':'')+x.delta+' к d20, «'+x.reason+'») завершён: '+rpgModifierTargets(x).join(', ')+'.');
    r.modifierNotices=r.modifierNotices.slice(-30);
  }
  return expired;
}
function rpgModifierDelta(r,target,field){
  if(!target)return 0;
  const now=rpgAbsoluteMinute(r);
  // Cap combined effects to keep adjudication bounded, not individual skills/stats.
  const raw=(r.modifiers||[]).reduce((sum,x)=>sum+(x.expiresAt>now&&(x[field]||[]).includes(target)?x.delta:0),0);
  return Math.max(-20,Math.min(20,raw));
}
// The following read BASE levels only: modifier effects never change them.
function rpgSkillEffective(r,skill){return skill?(r.skills[skill]||0):0;}
function rpgSkillBonus(r,skill){return skill?Math.floor((r.skills[skill]||0)/10):0;}
function rpgModifierLabel(r,x){
  const left=Math.max(0,Math.ceil(x.expiresAt-rpgAbsoluteMinute(r)));
  return '#'+x.id+' '+(x.delta>0?'БАФ':'ДЕБАФ')+' '+(x.delta>0?'+':'')+x.delta+
    ' к d20 ['+rpgModifierTargets(x).join(', ')+']; осталось '+left+' мин'+(x.reason?'; '+x.reason:'');
}
function rpgModifiersList(r,kind){
  const list=(r.modifiers||[]).filter(x=>x.expiresAt>rpgAbsoluteMinute(r)&&
    (!kind||(kind==='buff'?x.delta>0:x.delta<0)));
  return 'МОДИФИКАТОРЫ БРОСКОВ ('+list.length+')\n'+(list.map(x=>rpgModifierLabel(r,x)).join('\n')||'Активных эффектов нет.')+
    '\nУровни навыков, характеристики и XP не изменяются. :help mod';
}
function rpgModifierCommand(r,cmd,arg){
  const value=String(arg||'').trim();
  // v2.21 compatibility: old commands are valid for LIST and REMOVAL.
  // Old :buff/:debuff ADD syntax is deliberately retired because effects now
  // modify d20 directly instead of temporary skill levels.
  const kind=cmd==='buff'?'buff':cmd==='debuff'?'debuff':null;
  if(!value||/^(?:list|status)$/i.test(value))return rpgModifiersList(r,kind);
  if(/^help$/i.test(value))return rpgHelp(r,'mod');
  const remove=value.match(/^(?:remove|delete)\s+#?(\d+)$/i);
  if(remove){
    const id=+remove[1],idx=r.modifiers.findIndex(x=>x.id===id&&
      (!kind||(kind==='buff'?x.delta>0:x.delta<0)));
    if(idx<0)return 'Модификатор #'+id+' не найден'+(kind?' в списке '+(kind==='buff'?'бафов':'дебафов'):'')+'. :mod';
    const old=r.modifiers.splice(idx,1)[0];
    rpgModifierSyncId(r);
    return 'Модификатор #'+id+' ('+(old.delta>0?'+':'')+old.delta+', '+old.reason+') снят. Базовые значения и XP не изменены.';
  }
  if(/^clear(?:\s+confirm)?$/i.test(value)){
    if(!/^clear\s+confirm$/i.test(value))return 'Для удаления введи :'+cmd+' clear confirm.';
    const before=r.modifiers.length;
    r.modifiers=r.modifiers.filter(x=>kind&&(kind==='buff'?x.delta<0:x.delta>0));
    rpgModifierSyncId(r);
    return 'Снято модификаторов: '+(before-r.modifiers.length)+'. Базовые значения и XP сохранены.';
  }
  if(kind)return 'Команды :buff и :debuff для добавления заменены на :mod add Скрытность | '+
    (kind==='buff'?'+2':'-2')+' | 120 | Причина. Удаление старых эффектов работает: :'+cmd+' remove ID, :'+cmd+' clear confirm.';
  if(/^add(?:\s|$)/i.test(value)){
    const parts=value.replace(/^add\s*/i,'').split('|').map(x=>x.trim());
    if(parts.length!==4)return 'Формат: :mod add Скрытность, Сила | -2 | 120 | Травма';
    const requested=parts[0].split(',').map(x=>x.trim()).filter(Boolean);
    if(!requested.length||requested.length>8)return 'Укажи от 1 до 8 навыков и/или характеристик через запятую.';
    const skills=[],stats=[];
    for(const name of requested){
      const skill=rpgSkillName(r,name),attr=rpgName(RPG_STATS,name);
      if(!skill&&!attr)return 'Неизвестный навык или характеристика «'+rpgClean(name,40)+'». :skill list, :help stat';
      if(attr){if(!stats.includes(attr))stats.push(attr);}
      else if(!skills.includes(skill))skills.push(skill);
    }
    if(!/^[+-]?[1-9]\d?$/.test(parts[1])||Math.abs(Number(parts[1]))>10)
      return 'Модификатор к d20 должен быть целым от -10 до -1 либо от +1 до +10 (без нуля).';
    if(!/^[1-9]\d{0,4}$/.test(parts[2])||+parts[2]>10080)
      return 'Длительность: 1–10080 игровых минут.';
    const reason=rpgClean(parts[3],80);
    if(!reason||/[|:]/.test(reason))return 'Укажи причину эффекта (1–80 символов, без | и :).';
    if(r.modifiers.length>=30)return 'Лимит: 30 одновременных эффектов.';
    const x={id:rpgModifierSyncId(r),skills,stats,delta:+parts[1],
      expiresAt:rpgAbsoluteMinute(r)+Number(parts[2]),reason};
    r.modifiers.push(x);
    rpgModifierSyncId(r);
    return 'Добавлен '+(x.delta>0?'баф':'дебаф')+': '+rpgModifierLabel(r,x)+
      '.\nБазовые уровни навыков, характеристики и XP не меняются.';
  }
  return 'Используй :mod add Навык/Характеристика | +2/-2 | 120 | Причина; :mod [list/remove ID/clear confirm].';
}

function rpgCheck(r, attr, dc, skill, action, options) {
  options=options||{};
  const supportSkill=options.supportSkill&&rpgSkillName(r,options.supportSkill)!==skill?options.supportSkill:'';
  const supportBonus=supportSkill&&(r.skills[supportSkill]||0)>=10?1:0;
  const statBase=r.stats[attr]??10,statMod=Math.floor((statBase-10)/2);
  const skillBase=skill?(r.skills[skill]||0):0,skillMod=rpgSkillBonus(r,skill);
  const attrEffect=rpgModifierDelta(r,attr,'stats');
  const skillEffect=rpgModifierDelta(r,skill,'skills');
  // A supporting skill has at most +1 BASE support, but its signed external
  // effects apply separately, so a debuff also matters while supporting.
  const supportEffect=supportSkill?rpgModifierDelta(r,supportSkill,'skills'):0;
  const conditionPenalty= ((r.needs&&r.needs.fatigue>=70)?-2:(r.needs&&r.needs.fatigue>=40)?-1:0)+
    ((r.needs&&r.needs.hunger>=75)?-1:0)+((r.needs&&r.needs.thirst>=65)?-2:0);
  const dice=rpgRoll(20),total=dice+statMod+skillMod+attrEffect+skillEffect+supportBonus+supportEffect+conditionPenalty;
  const success=dice===20?true:dice===1?false:total>=dc;
  const obj={attr,skill:skill||'',dc,dice,statMod,statBase,statEffective:statBase,skillMod,
    skillBase,skillEffective:skillBase,attrEffect,skillEffect,supportEffect,
    conditionPenalty,total,success,supportSkill:supportSkill||'',supportBonus,
    action:rpgClean(action,180),turn:r.turn};
  r.rolls.push(obj);if(r.rolls.length>RPG_CFG.maxRolls)r.rolls.shift();
  r.pendingRoll=obj;
  rpgXpAward(r,obj);
  return obj;
}
function rpgRollLabel(x){
  const sign=n=>(n>=0?'+':'')+n;
  const applied=[];
  if(x.attrEffect)applied.push(x.attr+' '+sign(x.attrEffect));
  if(x.skillEffect)applied.push(x.skill+' '+sign(x.skillEffect));
  if(x.supportEffect)applied.push(x.supportSkill+' (поддержка) '+sign(x.supportEffect));
  return 'ПРОВЕРКА '+x.attr+(x.skill?'/'+x.skill:'')+': d20='+x.dice+
    ', характеристика '+sign(x.statMod)+', навык '+sign(x.skillMod)+
    (x.conditionPenalty?', состояние '+x.conditionPenalty:'')+
    (x.supportBonus?', поддержка '+x.supportSkill+' +'+x.supportBonus:'')+
    (applied.length?', временные модификаторы d20: '+applied.join(', '):'')+
    ', итог '+x.total+' vs DC '+x.dc+' = '+(x.success?'УСПЕХ':'ПРОВАЛ')+
    (x.action?'; действие: '+x.action:'');
}
function rpgInventoryLine(r) {
  const entries = Object.keys(r.items).sort((a,b)=>a.localeCompare(b,'ru'))
    .map(k => k+' ×'+r.items[k]);
  return entries.length?entries.join(', '):'пусто';
}
function rpgStatus(r) {
  const chars = RPG_STATS.map(k=>k+':'+r.stats[k]).join(', ');
  const learned = rpgSkillList(r).filter(k=>(r.skills[k]||0)>0).map(k=>k+':'+r.skills[k]).join(', ')||'нет';
  return 'ЛИСТ ПЕРСОНАЖА\nГерой: '+rpgCharacterSummary(r.character)+
    '\n\nХарактеристики: '+chars+
    '\nНавыки: '+learned+
    '\n\n'+r.location+'; '+rpgClock(r)+
    '\nЗдоровье '+r.hp+'/'+r.maxHP+'; Усталость '+r.stamina+'/'+r.maxStamina+
    '\nСостояние: голод '+r.needs.hunger+'/100, жажда '+r.needs.thirst+'/100, усталость '+r.needs.fatigue+'/100.'+
    '\nБаланс: '+rpgMoneyFormat(r.money)+'; Долг: '+rpgMoneyFormat(r.debt)+'.'+
    '\nИнвентарь: '+rpgInventoryLine(r)+
    '\n\nАвтоучёт: потребности '+(r.config.needs?'on':'off')+', бой '+(r.config.combat?'on':'off')+', деньги '+(r.config.economy?'on':'off')+'.'+
    '\nМагия: '+(r.config.magic?'возможна':'отключена')+
    '\nРазвитие: '+(r.config.xpEnabled?'on':'off')+', '+rpgXpSpeedLabel(r.config.xpSpeed)+', '+r.config.xpMode+'; готово уровней '+rpgXpReady(r)+'.'+
    '\nСудья: '+r.config.judgeCombo+'.'+
    '\nМодификаторы d20: '+(r.modifiers||[]).filter(x=>x.expiresAt>rpgAbsoluteMinute(r)).length+' активных (:mod).';
}
function rpgMemory(r) {
  let str='[ДАННЫЕ ИГРОВОГО ДВИЖКА — приоритет над предположениями рассказчика]\n'+
    'Герой: '+rpgCharacterSummary(r.character)+'.\nВремя: '+rpgClock(r)+'. Место: '+r.location+'. HP '+r.hp+'/'+r.maxHP+
    ', выносливость '+r.stamina+'/'+r.maxStamina+', деньги '+rpgMoneyFormat(r.money)+', долг '+rpgMoneyFormat(r.debt)+'.\n'+
    'Состояние героя: голод '+r.needs.hunger+'/100, жажда '+r.needs.thirst+'/100, усталость '+r.needs.fatigue+'/100.\n'+
    'Инвентарь: '+rpgInventoryLine(r)+'.\n'+
    'Характеристики: '+RPG_STATS.map(k=>k+' '+r.stats[k]).join('; ')+'.\n'+
    'Ненулевые навыки: '+(rpgSkillList(r).filter(k=>r.skills[k]>0).map(k=>k+' '+r.skills[k]).join('; ')||'нет')+'.\n'+
    'Дополнительные навыки: '+(Object.keys(r.customSkills).map(k=>k+' — '+r.customSkills[k].attr+'; фразы '+(r.customSkills[k].keywords.join(', ')||'не заданы')).join(' | ')||'нет')+'.\n'+
    'Временные модификаторы бросков d20 (не меняют характеристики и уровни): '+((r.modifiers||[]).filter(x=>x.expiresAt>rpgAbsoluteMinute(r)).map(x=>x.reason+' '+(x.delta>0?'+':'')+x.delta+' к d20 ['+rpgModifierTargets(x).join(',')+'] до '+x.expiresAt+' мин.').join('; ')||'нет')+'.\n'+
    'Магия в мире: '+(r.config.magic?'может существовать, но не доступна автоматически':'не вводи магию, пока игрок не включит её')+'.\n';
  const notes=rpgJournalContext(r);if(notes)str+='Записи журнала (подтверждённые факты): '+notes+'.\n';
  const quests=rpgQuestContext(r);if(quests)str+='Активные задания (не объявлять выполненными без проверки): '+quests+'.\n';
  if(r.recent.length)str+='Недавние фрагменты истории (не являются полной хроникой): '+r.recent.slice(-RPG_CFG.briefMemory).join(' | ').slice(-500)+'.\n';
  if(r.pendingRoll)str+='РЕЗУЛЬТАТ УЖЕ ВЫЧИСЛЕН, НЕ ПЕРЕБРАСЫВАТЬ: '+rpgRollLabel(r.pendingRoll)+'.\n';
  if(r.pendingSecondaryRoll)str+='ВТОРОЙ НЕЗАВИСИМЫЙ РИСК — отдельный итог, не перебрасывать: '+rpgRollLabel(r.pendingSecondaryRoll)+'.\n';
  str+='[ПРАВИЛА РАССКАЗЧИКА]\n'+
    'Опиши последствия намерения, не объявляй намерение игрока гарантированным успехом. '+
    'Результат рассчитанной проверки обязателен; не подменяй его новым броском. При ПРОВАЛЕ заявленная цель НЕ ДОСТИГНУТА: ни успеха с ценой, ни частичного достижения той же цели, ни немедленного обходного успеха. Допускаются только последствия отказа и новые возможности на будущие ходы. '+
    'Не действуй и не говори от лица героя за игрока. NPC имеют собственные мотивы и ограниченные знания. '+
    'Не создавай предметы, деньги, умения или лечение только потому, что герой этого хочет. ' +
    'Изменения денег и долга происходят ТОЛЬКО из явных реплик игрока или команд; твои описания цен, чеков, долгов, наград не меняют числа. ' +
    'Не описывай неоплаченные покупки как совершённые. '+
    'Опыт и уровни рассчитываются самим движком по проверкам; не объявляй повышение навыков от себя. '+
    'Бафы и дебафы изменяют только итог броска d20, никогда не уровни навыков или характеристики. Отрицательный модификатор работает и при навыке 0. Только игрок назначает эффекты командой :mod add. '+
    'Если упоминаешь изменение денег или завершение задания, не считай его подтверждённым механически: движок сверит отдельное заявление и при расхождении покажет игроку напоминание. '+
    (r.pendingEffects&&r.pendingEffects.financeTransaction&&!r.pendingEffects.financeTransaction.duplicate?'ТЕКУЩИЙ ХОД: '+r.pendingEffects.financeTransaction.note+'; операция УЖЕ учтена движком, не требуй её повторения. ':'')+
    (r.config.ledger && !(r.pendingSmart&&r.config.smartJudge)?'Числа движка могут обновляться из проверяемого блока RPG_DELTA. ':'Изменения чисел движка происходят командами игрока, а не литературным текстом. ')+
    'Историческую эпоху, жанр, магию и устройство мира задаёт сценарий, а не этот скрипт. '+
    'Не объявляй задание выполненным только из-за желания героя; соблюдай подтверждённое состояние заданий. Не заменяй сюжет таблицами правил. Отвечай по-русски, если игрок не попросил иначе.\n';
  if(r.config.ledger && !(r.pendingSmart&&r.config.smartJudge)) str+='Для автоматического учёта в самом конце после истории добавь ОДИН блок '+
    '<RPG_DELTA>{"hp":-5,"stamina":0,"money":0,"time":5,'+
    '"items":[{"name":"ключ","qty":1}],"notes":["краткий достоверный факт"]}</RPG_DELTA>. '+
    'Включай только РЕАЛЬНО описанные изменения; не включай поля, которые не менялись. '+
    'Не меняй способности/характеристики, не делай несуществующих предметов, не записывай предположения как факты. '+
    'Теги будут скрыты игроком; если ничего не произошло, блок не пиши.\n';
  str+='[/ДАННЫЕ ДВИЖКА]';
  if(r.pendingRoll){
    str+='\n[СУДЬЯ RPG: ИСХОД УЖЕ ОПРЕДЕЛЁН]\n'+
      'На этот ход бросок проведён программой ДО генерации. '+rpgRollLabel(r.pendingRoll)+'. '+
      (r.pendingSecondaryRoll?'ВТОРАЯ НЕЗАВИСИМАЯ ПРОВЕРКА: '+rpgRollLabel(r.pendingSecondaryRoll)+'. Обе проверки обязательны, успех одной не отменяет провал другой. ':'')+
      'Немедленно продолжи рассказ обычной художественной прозой, строго соблюдая исход. '+
      'ПРОВАЛ = жёсткий отказ: заявленная цель не достигается ни напрямую, ни в виде «да, но», частичного успеха или бесплатного альтернативного успеха в том же ходе. Нельзя писать, что герой всё-таки получил искомый предмет, доступ, согласие, сведения или позицию. Не обязательно описывать катастрофу. УСПЕХ означает, что цель проверки достигнута, но последствия допустимы. '+
      'Персонаж игрока принимает решения и говорит только по вводу игрока. '+
      'Не выводи JSON, RPG_TURN, расчёты кубиков или пояснения судьи. '+
      'Если действие требует отсутствующего у героя предмета, не приписывай ему предмет.\n'+
      '[/СУДЬЯ RPG]';
  }
  if(r.pendingSmart && r.config.autoJudge && r.config.smartJudge){
    str+='\n[СУДЬЯ RPG — ОБЯЗАТЕЛЬНЫЙ ФОРМАТ ОТВЕТА]\n'+
      'Это текущий ход, а не художественная инструкция. Оцени риск и факты сцены. Обыденное действие — check:null; рискованное — характеристика/навык/DC (6–24). ' +
      'Для рискованного действия напиши два КОРОТКИХ (по 1–3 предложения) взаимоисключающих исхода: success и failure. ИИ НЕ бросает кубик: движок выберет один. ' +
      'Укажи в requires все необходимые ЛИЧНЫЕ предметы персонажа, даже если их нет; предметы окружающей сцены НЕ указывай. ' +
      'magic:true только когда описывается сверхъестественный эффект; в обычном мире магия запрещена. ' +
      'Пиши ТОЛЬКО JSON (без markdown) в тегах <RPG_TURN>...</RPG_TURN>, ' +
      'например: <RPG_TURN>{"check":{"attr":"Ловкость","skill":"Скрытность","dc":14},"requires":[],"magic":false,"success":"Тебя не замечают.","failure":"Охранник замечает движение."}</RPG_TURN>. ' +
      'Для действий без риска: <RPG_TURN>{"check":null,"requires":[],"magic":false,"narration":"Обычный результат действия."}</RPG_TURN>. ' +
      'Не добавляй объяснений и кодовых блоков. Предыдущие требования писать обычную прозу не действуют для текущего ответа: сюжет покажет движок из выбранного поля.\n'+
      '[/СУДЬЯ RPG]';
  }
  // Keep the adjudication protocol and narrator constraints even with a long biography/journal.
  if(str.length>RPG_CFG.maxContextChars){
    const marker='[ПРАВИЛА РАССКАЗЧИКА]';
    const idx=str.indexOf(marker);
    if(idx>=0){
      const critical=str.slice(idx);
      const budget=Math.max(0,RPG_CFG.maxContextChars-critical.length-40);
      str=str.slice(0,budget).replace(/\s+\S*$/,'')+'\n[ЧАСТЬ ПАМЯТИ ОПУЩЕНА ИЗ-ЗА ЛИМИТА]\n'+critical;
    }
  }
  return str.slice(0,RPG_CFG.maxContextChars);
}
function rpgUI(r, message) {
  // The AI Dungeon input/output hooks cannot reliably suppress a history action.
  // Keep the player-visible input innocuous; command results replace AI output.
  r.pendingUI = String(message);
  delete state.message;
  return '> Ты сверяешь сведения персонажа.';
}
function rpgDebugLog(r,msg){
  if(r.config.debug && typeof log==='function')log('[RPG DEBUG] '+String(msg).slice(0,650));
}
function rpgCharacterSummary(c){
  if(!c)return 'не создан';
  return [c.name||'не задано',c.gender||'пол не задан',
    c.age ? c.age+' лет':'',c.job&&c.job!=='не указана' ? 'занятие: '+c.job:'',
    c.background&&c.background!=='не указана'?'биография: '+c.background:'',
    c.dream&&c.dream!=='не указана'?'мечта: '+c.dream:''].filter(Boolean).join('; ');
}
function rpgDraftSummary(r){
  const d=r.characterDraft;
  if(!d)return 'Создание персонажа не начато. Используй :char create или :help char. Текущий: '+rpgCharacterSummary(r.character);
  const b=rpgCharStatBudget(d.stats);
  const skillCost=rpgSkillList(r).reduce((acc,k)=>acc+(d.skills[k]||0),0);
  return 'ЧЕРНОВИК ПЕРСОНАЖА\n'+rpgCharacterSummary(d.character)+
    '\nОчки характеристик: потрачено '+b.spend+'/'+b.limit+' (основа 12, возврат '+b.refund+'/6; диапазон 6–16).'+
    ' Навыки: '+skillCost+'/60 (максимум 30 на один).'+
    '\nХарактеристики: '+RPG_STATS.map(k=>k+' '+d.stats[k]).join(', ')+
    '\nНавыки: '+(rpgSkillList(r).filter(k=>d.skills[k]).map(k=>k+' '+d.skills[k]).join(', ')||'нет')+
    '\n:char done — сохранить, :char cancel — отменить';
}
function rpgCharacterCommand(r,arg){
  const m=String(arg||'').match(/^(\S+)(?:\s+([\s\S]*))?$/);
  const cmd=m?m[1].toLowerCase():'',value=m?String(m[2]||'').trim():'';
  if(!cmd || cmd==='show')return rpgDraftSummary(r);
  if(cmd==='info')return 'ПЕРСОНАЖ\n'+rpgCharacterSummary(r.character)+'\nБиография: '+Array.from(r.character.background||'').length+'/'+RPG_CFG.maxBio+' символов; мечта: '+Array.from(r.character.dream||'').length+'/'+RPG_CFG.maxDream+'.';
  if(cmd==='help')return rpgHelp(r,'char');
  if(cmd==='create'){
    r.characterDraft={character:Object.assign({},r.character),stats:{},skills:{}};
    RPG_STATS.forEach(k=>r.characterDraft.stats[k]=10);
    rpgSkillList(r).forEach(k=>r.characterDraft.skills[k]=0);
    return 'Черновик создан. Характеристики 6–16, начальные 10. Бюджет 12 + до 6 очков от снижения характеристик; навыки 60 очков. :char help — подсказка.';
  }
  if(cmd==='cancel'){delete r.characterDraft;return 'Создание персонажа отменено; прежние характеристики сохранены.';}
  // Biography/dream are editable on the live character without restarting the character builder.
  const charTarget=r.characterDraft?r.characterDraft.character:r.character;
  if(['bio','background','dream','goal'].includes(cmd)){
    const isBio=cmd==='bio'||cmd==='background',field=isBio?'background':'dream',cap=isBio?RPG_CFG.maxBio:RPG_CFG.maxDream;
    if(!value||/^show$/i.test(value))return (isBio?'БИОГРАФИЯ':'МЕЧТА')+' ('+Array.from(charTarget[field]||'').length+'/'+cap+' символов)\n'+(charTarget[field]||'не указана');
    let content=value,mode='set';
    const modeMatch=value.match(/^(set|add|clear)\b(?:\s+([\s\S]*))?$/i);
    if(modeMatch){mode=modeMatch[1].toLowerCase();content=modeMatch[2]||'';}
    if(mode==='clear'){
      if(content.toLowerCase()!=='confirm')return 'Подтверди очистку: :char '+(isBio?'bio':'dream')+' clear confirm';
      charTarget[field]='не указана';return (isBio?'Биография':'Мечта')+' очищена.';
    }
    if(mode==='add'&&!isBio)return 'Дополнение событий поддерживается только для биографии: :char bio add ...';
    const old=charTarget[field]==='не указана'?'':(charTarget[field]||'');
    const joined=mode==='add'&&old?old+'; '+content:content;
    const checked=rpgLimitedText(joined,cap,isBio?'биографии':'мечты');if(checked.error)return checked.error;
    charTarget[field]=checked.value;
    return (isBio?'Биография':'Мечта')+' сохранена ('+Array.from(checked.value).length+'/'+cap+' символов).'+(r.characterDraft?' В черновике, до :char done.':' Без пересоздания персонажа.');
  }
  const d=r.characterDraft;
  if(!d)return 'Начни с команды :char create.';
  if(cmd==='done'){
    const b=rpgCharStatBudget(d.stats);
    const kc=rpgSkillList(r).reduce((a,k)=>a+(d.skills[k]||0),0);
    if(b.spend>b.limit||kc>60)return 'Лимит очков превышен; исправь распределение.';
    if(RPG_STATS.some(k=>!Number.isInteger(d.stats[k])||d.stats[k]<6||d.stats[k]>16))return 'Неверное значение характеристики. Диапазон 6–16.';
    if(rpgSkillList(r).some(k=>!Number.isInteger(d.skills[k])||d.skills[k]<0||d.skills[k]>30))return 'Неверное значение навыка. Диапазон 0–30.';
    if(!d.character.name||d.character.name==='не задано')return 'Укажи имя: :char name Имя';
    r.character=Object.assign({},d.character);
    r.stats=Object.assign({},d.stats);
    r.skills=Object.assign({},d.skills);
    r.xp=null;rpgXpInit(r); // a newly created hero has fresh XP counters
    delete r.characterDraft;
    return 'Персонаж создан: '+rpgCharacterSummary(r.character)+'. Характеристики и навыки сохранены; текущий инвентарь, время и ресурсы не сброшены.';
  }
  const fields={name:'name',gender:'gender',job:'job'};
  if(fields[cmd]){
    if(!value)return 'Укажи значение после :char '+cmd;
    d.character[fields[cmd]]=rpgClean(value,120);
    return 'Записано '+cmd+': '+d.character[fields[cmd]];
  }
  if(cmd==='age'){
    if(!/^\d+$/.test(value) || +value<1 || +value>120)return 'Возраст: целое число от 1 до 120.';
    d.character.age=+value;return 'Возраст: '+value;
  }
  if(cmd==='stat'||cmd==='skill'){
    const v=value.match(/^([\s\S]+?)\s+(\d+)$/);
    if(!v)return 'Пример: :char '+cmd+' '+(cmd==='stat'?'Ловкость 14':'Скрытность 20');
    const name=cmd==='stat'?rpgName(RPG_STATS,v[1]):rpgSkillName(r,v[1]);
    const num=Number(v[2]);
    if(!name)return 'Неизвестная характеристика/навык. :help '+cmd;
    if(cmd==='skill' && name==='Магия' && !r.config.magic)return 'Магия выключена. Включи :magic on для магического мира.';
    if(!Number.isInteger(num)||num<(cmd==='stat'?6:0)||num>(cmd==='stat'?16:30))return cmd==='stat'?'Характеристика 6–16':'Навык 0–30';
    const container=d[cmd==='stat'?'stats':'skills'];
    const original=container[name];container[name]=num;
    const b=rpgCharStatBudget(d.stats);
    const total=cmd==='stat'?b.spend:rpgSkillList(r).reduce((a,k)=>a+(d.skills[k]||0),0);
    const limit=cmd==='stat'?b.limit:60;
    if(total>limit){container[name]=original;return 'Недостаточно очков: потрачено '+total+', доступно '+limit+'.'+(cmd==='stat'?' Возврат за снижение характеристик ограничен 6 очками.':'');}
    return name+' = '+num+', потрачено '+total+'/'+limit+(cmd==='stat'?' (возврат '+b.refund+'/6)':'')+'.';
  }
  return 'Неизвестная команда создания. :help char';
}
function rpgParseCommand(text) {
  // Inputs may arrive as "> You :status" or "> You say ":status"".
  let s = String(text || '').trim();
  s=s.replace(/^>\s*You\s+say\s+["'“]?/i,'').replace(/^>\s*You\s*/i,'');
  s=s.replace(/["'”]\s*$/,'').trim();
  // AI Dungeon's Do mode often adds a final period: ":stat Ловкость 15."
  // Remove that sentence punctuation from mechanical commands only.
  // Leave :note / :place untouched so meaningful prose punctuation survives.
  if(/^:(?:setup|help|status|notes|date|quest|review|debt|xp|judge|magic|auto|fallback|ledger|debug|editor|inventory|char|stat|skill|give|take|rename|use|hp|stamina|money|time|roll|check|needs|combat|economy|effects|rest|mod|modifiers|buff|debuff|batch|rpg|aidm)\b/i.test(s)) {
    s=s.replace(/[.!?]+\s*$/,'').trim();
  }
  if(/^:note\s+(?:pin|unpin|remove|delete|clear|help|list)\b/i.test(s))s=s.replace(/[.!?]+\s*$/,'').trim();
  // Unknown one-word commands with AI Dungeon's trailing punctuation must
  // still be routed to the command error, never forwarded as story text.
  if(/^:[a-z]+[.!?]+$/i.test(s))s=s.replace(/[.!?]+$/,'');
  if(!s.startsWith(':'))return null;
  const m=s.match(/^:([a-z]+)(?:\s+([\s\S]*))?$/i);
  return m?{cmd:m[1].toLowerCase(),arg:(m[2]||'').trim()}:null;
}
/* ---------- v1.7: deterministic needs/economy + conservative combat settlement ---------- */
/* v2.17: all elapsed time uses this single needs accrual path. */
function rpgAbsoluteMinute(r){
  return (Math.max(1,Math.floor(r.day||1))-1)*1440 + rpgInt(r.timeMinutes,0,1439);
}
function rpgNeedsAccrue(r,m,mode){
  if(!r.config.needs||m<=0)return;
  const n=r.needs;
  // Hunger +2/hour, thirst +3/hour, fatigue +1/hour awake.
  // Keep fractional minutes in remainders across turns.
  for(const [key,rem,rate] of [['hunger','hungerRemainder',2],['thirst','thirstRemainder',3],['fatigue','fatigueRemainder',1]]){
    if(key==='fatigue' && (mode==='sleep'||mode==='rest'))n[rem]=0;
    else n[rem]+=m*rate;
    const whole=Math.floor(n[rem]/60);n[rem]%=60;
    if(key==='fatigue' && mode==='sleep')n.fatigue=Math.max(0,n.fatigue-Math.ceil(m/60)*12);
    else if(key==='fatigue' && mode==='rest')n.fatigue=Math.max(0,n.fatigue-Math.ceil(m/60)*4);
    else n[key]=rpgInt(n[key]+whole,0,100);
  }
  if(mode==='sleep')r.stamina=rpgInt(r.stamina+Math.ceil(m/60)*13,0,r.maxStamina);
  if(mode==='rest')r.stamina=rpgInt(r.stamina+Math.ceil(m/60)*8,0,r.maxStamina);
}
function rpgNeedsSyncCheckpoint(r){r.needsClockMinute=rpgAbsoluteMinute(r);}
function rpgNeedsReconcileClock(r){
  const now=rpgAbsoluteMinute(r);
  if(!Number.isFinite(r.needsClockMinute)){
    // Old adventures lack a checkpoint; do not retroactively charge needs.
    r.needsClockMinute=now;return;
  }
  const elapsed=now-r.needsClockMinute;
  // Defensive fallback in case an old/experimental path changed clock directly.
  // A full seven days already saturates hunger/thirst/fatigue to their upper caps.
  if(elapsed>0)rpgNeedsAccrue(r,Math.min(elapsed,10080),'normal');
  r.needsClockMinute=now;
}
function rpgAdvanceTime(r,mins,mode){
  const m=rpgInt(mins,0,10080);if(!m)return;
  // If a third-party integration changed the clock, reconcile first.
  rpgNeedsReconcileClock(r);
  const sum=r.timeMinutes+m;r.day+=Math.floor(sum/1440);r.timeMinutes=sum%1440;
  rpgNeedsAccrue(r,m,mode);
  // Record consumed game time even with :needs off, preventing retroactive growth.
  rpgNeedsSyncCheckpoint(r);
  rpgModifiersExpire(r);
}
function rpgAutoCostKind(action){
  const t=String(action||'').toLowerCase();
  if(/(?:^|[^\p{L}])(?:сплю|засыпаю|отправляюсь спать|ложусь спать)(?=$|[^\p{L}])|\b(?:sleep|slept)\b/iu.test(t))return 'sleep';
  if(/отдыхаю|сижу.*отдыха|делаю привал|rest for/i.test(t))return 'rest';
  if(/бегу|убега|спринт|мчусь|гонюсь|преследую|run away|sprint/i.test(t))return 'run';
  if(/атакую|напада|бью|ударя|рублю|стреля|сража|дерусь|бросаюсь с .*меч|attack|punch|slash/i.test(t))return 'combat';
  if(/карабка|прыга|перелез|таскаю тяж|плыву|поднимаюсь в гору/i.test(t))return 'effort';
  if(/путешеству|долг.*иду|еду|добираю|проезжаю|перехожу в другой район/i.test(t))return 'travel';
  return 'normal';
}
function rpgTimeHint(action,kind){
  const t=String(action||'').toLowerCase();
  // Use durations written by the PLAYER, not elapsed time invented in narration.
  const explicitActivity=/(?:жду|ожидаю|провожу|занимаюсь|тренируюсь|работаю|рисую|пишу|читаю|готовлю|еду|иду|гуляю|отрабатываю|упражняюсь|практикуюсь|смотрю|путешествую|сплю|засыпаю|отдыхаю|делаю привал)/iu.test(t);
  let duration=null;
  if(explicitActivity){
    const number=t.match(/(?:^|\s)(\d{1,4}(?:[.,]\d{1,2})?)\s*(час(?:а|ов)?|ч|минут(?:ы|у)?|мин)(?=\s|[.,;!?]|$)/iu);
    if(number){const value=Number(number[1].replace(',','.'));duration=Math.round(value*(number[2].startsWith('ч')?60:1));}
    else if(/полтора\s+часа/iu.test(t))duration=90;
    else if(/полчаса/iu.test(t))duration=30;
  }
  if(kind==='sleep')return duration!==null?Math.max(60,Math.min(720,duration)):480;
  if(kind==='rest')return duration!==null?Math.max(5,Math.min(720,duration)):30;
  if(duration!==null)return Math.max(1,Math.min(10080,duration));
  return ({combat:1,run:5,effort:5,travel:30,normal:3})[kind]||3;
}
function rpgAutoClockAndCost(r,action,events,ledgerTime,ledgerNeedsChanges){
  const kind=rpgAutoCostKind(action),minutes=ledgerTime||rpgTimeHint(action,kind);
  const beforeNeeds=r.needs&&{hunger:r.needs.hunger,thirst:r.needs.thirst,fatigue:r.needs.fatigue};
  // v2.17: the model's RPG_DELTA time has already been applied. No +3 min on top.
  if(!ledgerTime)rpgAdvanceTime(r,minutes,kind);
  events.push('время +'+minutes+' мин'+(ledgerTime?' (RPG_DELTA)':''));
  if(ledgerTime && Array.isArray(ledgerNeedsChanges))events.push(...ledgerNeedsChanges);
  if(r.config.needs&&beforeNeeds){
    for(const k of ['hunger','thirst','fatigue'])if(beforeNeeds[k]!==r.needs[k])
      events.push(({hunger:'голод',thirst:'жажда',fatigue:'усталость'})[k]+' '+beforeNeeds[k]+'→'+r.needs[k]);
  }
  if(!r.config.combat || kind==='sleep' || kind==='rest')return;
  const staminaCost=({combat:4,run:7,effort:5,travel:3})[kind]||0;
  if(staminaCost){const before=r.stamina;r.stamina=rpgInt(before-staminaCost,0,r.maxStamina);
    if(before!==r.stamina)events.push('выносливость '+before+'→'+r.stamina);}
  if(r.config.needs){const add=({combat:2,run:4,effort:3,travel:1})[kind]||0;
    if(add){r.needs.fatigue=rpgInt(r.needs.fatigue+add,0,100);events.push('усталость +'+add);}}
}
/* v2.12: Wallet and debt are the ONLY financial state. No unpaid invoices. */
function rpgFinanceIntent(action){
  return /(?:оплач(?:ива|у|и|ен)|оплат(?:ил|ила|или)|запла(?:чу|ти)|заплат(?:ил|ила|или)|плат(?:ить|еж)|плачу|расплач|рассчитыва|рассчитаюсь|перевож[у]|покупаю|приобретаю|выкуплю|буду\s+долж|запишите\s+на\s+мой\s+сч[её]т|погашаю\s+долг)/iu.test(String(action||''));
}
/* v2.12 — the sole authority for ordinary game-world finances is the PLAYER'S
 * explicitly stated, present-tense instruction. Narrator output is never financial input.
 * Debt is a separate liability; putting purchases "on my tab" does not affect cash. */
function rpgPlayerTransaction(action,r){
  let t=String(action||'').trim().replace(/^(?:>\s*)?(?:You|Ты)\s+/iu,'').trim();
  // v2.19: A Do action may begin with direct speech, followed by the player action:
  // «Мне не неделю» Я оплатила 380 кредитов.
  // Ignore ONLY a complete leading quotation. Speech alone must never debit money.
  const quoted=/^(?:"[^"\r\n]{1,160}"|«[^»\r\n]{1,160}»|„[^“”\r\n]{1,160}[“”]|'[^'\r\n]{1,160}')\s*[,;:—–-]?\s*/u;
  for(let i=0;i<2;i++){
    const q=t.match(quoted);
    if(!q)break;
    t=t.slice(q[0].length).trim();
  }
  t=t.replace(/^(?:я|мы)\s+/iu,'').trim();
  t=t.replace(/[.!?]+$/,'').trim();
  t=t.replace(/^(?:(?:снова|ещ[её]\s+раз)\s+)/iu,'');
  // A payment method is not the action verb. Players often prefix a Do action
  // with a quoted spoken response: «Картой» Оплачиваю 7.50.
  t=t.replace(/^(?:[«»„“”"']\s*)?(?:картой|наличными|безналично|по\s+карте|с\s+карты)(?:\s*[«»„“”"'])?(?:\s*[,;:]\s*|\s+)/iu,'').trim();
  if(/^(?:не\s+|хочу\s+|собираюсь\s+|думаю\s+|планирую\s+|пытаюсь\s+|спрашиваю\s+|можно\s+|сколько\s+|если\s+|собираюсь\s+)/iu.test(t))return null;
  const options=[
    {kind:'loan',rx:/^(?:беру\s+взаймы|занимаю\s+денег|получаю\s+за[её]м)(?=\s|$|[,.;:!?])/iu},
    {kind:'debtPay',rx:/^(?:погашаю|выплачиваю|возвращаю|закрываю|оплачиваю)\s+(?:свой\s+)?долг(?=\s|$|[,.;:!?])/iu},
    {kind:'debtAdd',rx:/^(?:запишите|запиши|записываю|запишем)(?:\s+это|\s+покупку)?\s+на\s+мой\s+сч[её]т(?=\s|$|[,.;:!?])/iu},
    {kind:'debtAdd',rx:/^(?:буду|останусь|остаюсь|теперь)\s+долж(?:ен|на)(?=\s|$|[,.;:!?])/iu},
    {kind:'debtAdd',rx:/^(?:покупаю|беру|оформляю)\s+(?:товар\s+)?в\s+долг(?=\s|$|[,.;:!?])/iu},
    {kind:'income',rx:/^(?:получаю|получил(?:а)?|зарабатываю|заработал(?:а)?|мне\s+заплатили|мне\s+передали)(?=\s|$|[,.;:!?])/iu},
    {kind:'pay',rx:/^(?:сейчас\s+|сразу\s+)?(?:оплачиваю|оплачу|оплатил(?:а)?|плачу|заплатил(?:а)?|расплачиваюсь|рассчитываюсь|перевожу|трачу|списываю)(?=\s|$|[,.;:!?])/iu},
    {kind:'pay',rx:/^(?:сразу\s+)?(?:покупаю|приобретаю|купил(?:а)?)(?=\s|$|[,.;:!?])/iu, purchase:true}
  ];
  const matched=options.map(o=>({o,m:t.match(o.rx)})).find(x=>x.m);
  if(!matched)return null;
  const {o,m}=matched;
  const body=t.slice(m[0].length).trim();
  if(/(?:^|\s)[-−]\s*\d/.test(body))return {error:'Отрицательную сумму в обычной реплике указывать нельзя. Для исправления баланса используй :money -N.'};
  // For "покупаю 2 кофе за 4.5" only the explicit total after "за" is relevant.
  const purchase=o.purchase?body.match(/(?:^|\s)за\s+(\d{1,9}(?:[.,]\d{1,5})?)/iu):null;
  if(o.purchase&&!purchase)return null;
  const preferred=body.match(/(?:на\s+сумму|в\s+размере|за\s+сумму|итого)\s*[:—–-]?\s*(\d{1,9}(?:[.,]\d{1,5})?)/iu);
  if(o.kind==='income'&&/(?:^|\s)(?:сч[её]т|чек|квитанци|прайс|ценник|заказ|товар|вещь)(?:\s|$)/iu.test(body))return null;
  const number=purchase||preferred||body.match(/(?:^|[^\d.,])(\d{1,9}(?:[.,]\d{1,5})?)(?![\d.,])/u);
  if(!number){
    return {error:'Сумма не указана. Пример: «оплачиваю счёт 4,50», «буду должен 20» или «запишите на мой счёт 12». Без суммы деньги не меняются.'};
  }
  const amount=rpgMoneyParse(number[1]);
  if(amount===null)return {error:'Некорректная сумма «'+rpgClean(number[1],30)+'». Используй 7.5 или 7,50; максимум две цифры после разделителя.'};
  if(amount<=0||amount>50000)return {error:'Сумма должна быть больше 0 и не превышать 50000.'};
  return {kind:o.kind,amount};
}
function rpgFinanceApply(r,tx,action,manual){
  if(!tx)return null;
  if(tx.error)return {error:'ОШИБКА ФИНАНСОВ: '+tx.error};
  if(!r.config.economy&&!manual)return {error:'Финансовый учёт отключён. Используй :economy on.'};
  const amount=tx.amount,kind=tx.kind,oldMoney=r.money,oldDebt=r.debt;
  // Consecutive identical commands from a generative UI can be duplicates.
  // Explicit "снова" / "ещё раз" overrides this when two real purchases coincide.
  const key=String(action||'').toLowerCase().replace(/\s+/g,' ').trim();
  const repeat=r.lastFinance && r.lastFinance.key===key && r.lastFinance.turn===r.turn-1 && !/\b(?:снова|ещ[её]\s+раз)\b/iu.test(key);
  if(repeat){r.lastFinance.turn=r.turn;return {duplicate:true,amount,kind,note:'Повтор той же операции пропущен; если это новая покупка, добавь «снова»'};}
  if((kind==='pay'||kind==='debtPay') && r.money<amount)
    return {error:'ОШИБКА ФИНАНСОВ: недостаточно средств. Нужно '+rpgMoneyFormat(amount)+', баланс '+rpgMoneyFormat(r.money)+'.'};
  if(kind==='debtPay' && r.debt<amount)
    return {error:'ОШИБКА ФИНАНСОВ: погашение '+rpgMoneyFormat(amount)+' превышает долг '+rpgMoneyFormat(r.debt)+'.'};
  if(kind==='pay'||kind==='debtPay')r.money=rpgMoneyRound(r.money-amount);
  if(kind==='income'||kind==='loan')r.money=rpgMoneyRound(r.money+amount);
  if(kind==='debtAdd'||kind==='loan')r.debt=rpgMoneyRound(r.debt+amount);
  if(kind==='debtPay')r.debt=rpgMoneyRound(r.debt-amount);
  if(!Number.isFinite(r.money)||r.money>100000000||!Number.isFinite(r.debt)||r.debt>100000000){
    r.money=oldMoney;r.debt=oldDebt;return {error:'ОШИБКА ФИНАНСОВ: превышен лимит баланса или долга (100000000).'};
  }
  r.lastFinance={key,kind,amount,turn:r.turn};
  const labels={pay:'Оплачено',income:'Получено',debtAdd:'Записано в долг',debtPay:'Погашено долга',loan:'Получено взаймы'};
  const note=labels[kind]+' '+rpgMoneyFormat(amount);
  const details=note+'; баланс '+rpgMoneyFormat(oldMoney)+'→'+rpgMoneyFormat(r.money)+', долг '+rpgMoneyFormat(oldDebt)+'→'+rpgMoneyFormat(r.debt);
  r.financeLog.push('ход '+r.turn+': '+details);
  r.financeLog=r.financeLog.slice(-30);
  r.autoEvents.push('ход '+r.turn+': '+details);
  r.autoEvents=r.autoEvents.slice(-15);
  return {amount,kind,note,details,before:oldMoney,after:r.money,oldDebt,debt:r.debt};
}
/* v2.13: shared money feedback. Short form contains ONLY changed balances.
 * Verbose form includes the accepted transaction and exact old/new totals. */
function rpgFinanceSigned(value){
  const n=rpgMoneyRound(value);
  return n>0?'+'+rpgMoneyFormat(n):n<0?'−'+rpgMoneyFormat(-n):'0';
}
function rpgFinanceSummary(tx){
  if(!tx||tx.error||tx.duplicate)return '';
  const changed=[];
  const m=rpgMoneyRound(tx.after-tx.before), d=rpgMoneyRound(tx.debt-tx.oldDebt);
  if(m)changed.push('Баланс '+rpgFinanceSigned(m));
  if(d)changed.push('долг '+rpgFinanceSigned(d));
  return changed.join('; ');
}
function rpgFinanceDisplay(r,tx){
  if(!tx)return '';
  if(r.config.debug){
    if(tx.error)return '[RPG DEBUG] ФИНАНСЫ: ОТКЛОНЕНО — '+tx.error;
    if(tx.duplicate)return '[RPG DEBUG] ФИНАНСЫ: '+tx.note;
    return '[RPG DEBUG] ФИНАНСЫ: '+tx.details+'; изменения: '+rpgFinanceSummary(tx);
  }
  const summary=rpgFinanceSummary(tx);
  return summary?'[RPG] '+summary+'.':'';
}
function rpgDebtCommand(r,arg){
  const v=String(arg||'').trim();
  if(!v||/^(show|status)$/iu.test(v))return 'ДОЛГ: '+rpgMoneyFormat(r.debt)+'. Баланс: '+rpgMoneyFormat(r.money)+'. :help debt — операции.';
  if(/^(log|history)$/iu.test(v))return 'ЖУРНАЛ ФИНАНСОВ\n'+(r.financeLog.slice(-15).join('\n')||'Операций ещё нет.');
  const m=v.match(/^(set|add|pay)\s+(.+)$/iu);
  if(!m)return 'ОШИБКА ДОЛГА: команды :debt; :debt add 7,5; :debt pay 5; :debt set 10; :debt log.';
  const value=rpgMoneyParse(m[2]);
  if(value===null||value<0||value>100000000)return 'ОШИБКА ДОЛГА: сумма 0–100000000, до двух знаков после запятой или точки.';
  if(m[1]==='set'){
    const old=r.debt;r.debt=value;
    const delta=rpgMoneyRound(value-old);
    if(delta){
      r.financeLog.push('ход '+r.turn+': установлен долг '+rpgMoneyFormat(old)+'→'+rpgMoneyFormat(value));
      r.financeLog=r.financeLog.slice(-30);
    }
    if(r.config.debug)return '[RPG DEBUG] ФИНАНСЫ: ручная установка долга '+rpgMoneyFormat(old)+'→'+rpgMoneyFormat(value)+'; изменение '+rpgFinanceSigned(delta)+'.';
    return delta?'[RPG] долг '+rpgFinanceSigned(delta)+'.':'Долг не изменён.';
  }
  if(value<=0||value>50000)return 'ОШИБКА ДОЛГА: для добавления или погашения требуется сумма больше 0 и не более 50000.';
  const tx=rpgFinanceApply(r,{kind:m[1]==='add'?'debtAdd':'debtPay',amount:value},':debt '+v,true);
  return tx.error||rpgFinanceDisplay(r,tx)||'Операция не изменила состояние.';
}
function rpgConfirmedPlayerHit(text){
  // v1.9. Explicit, completed contact with the PLAYER only. Do not equate
  // a threat, a wind-up, pain alone, or an injury to a NPC with player damage.
  // Russian narration often uses polite 2nd-person «вы/вас/вам» and passive
  // forms «удар приходится вам в скулу» instead of «ударил тебя».
  const raw=String(text||'').replace(/\[RPG DEBUG\][^\n]*/g,'');
  const sentences=raw.match(/[^.!?\n]+(?:[.!?]+|$)/g)||[];
  const directObject=String.raw`(?:тебя|вас|по\s+(?:тебе|вам)|в\s+(?:тебя|вас)|вам|тебе)`;
  const possessive=String.raw`(?:тво(?:ё|е|ю|я|й|им|их|ему|его|ей)|ваш(?:у|е|а|и|ей|его|ему|им|их)?)`;
  const body=String.raw`(?:лиц[оауе]|скул[ауеы]|щёк[ауеуы]|щек[ауеуы]|челюст[ьи]|голов[ауеы]|носу|нос|ребр[аоу]|бок|живот|плеч[оуе]|рук[ауеуы]|ног[ауеуы]|спин[аеу]|груд[ьи]|бедр[оуе]|тел[оауе]|ше[юеию])`;
  const contact=String.raw`(?:ударил(?:а|и)?|ударив|ударяет|бь[её]т|бил[аи]?|пинает|попал[аи]?|попада(?:ет|ют)|ранил(?:а|и)?|ранит|пронз(?:ает|ил)|задевает|задел(?:а|и)?|вреза(?:ется|лся|лась))`;
  const passive=String.raw`(?:приход(?:ится|ился|илась|илось)|приш[её]л(?:ся)?|попада(?:ет|ют)|вреза(?:ется|лся|лась)|достигает)`;
  const negated=/(?:не|ни разу не|едва не)\s+(?:попал|попада(?:ет|ют)|попадет|задел|задевает|ударил|бь[её]т|ранил|достиг|достигает|приш[её]л|приходится|коснул|врезался)|(?:промах(?:нулся|ивается|нулась|ивается)?|уклон(?:илась|ился|яетесь|яешься|яется)|парир(?:овал|уешь|уете|ует)|отбил(?:а|и)?\s+удар|заблокировал[аи]?)/i;
  const direct=[
    // Transitive forms: «ударил вас», «попадает вам в плечо».
    // Keep the target near the verb: «ударил NPC, затем подошёл к вам» is NOT a hit.
    new RegExp(contact+String.raw`(?:\s+(?:сильно|резко|кулаком|ногой|копь[её]м|мечом|ножом|внезапно|прямо|изо\s+всей\s+силы)){0,3}\s+`+directObject,'i'),
    // Inverted order: «вас ударил охранник», «по вам попал камень».
    new RegExp(String.raw`(?:тебя|вас|по\s+(?:тебе|вам))\s+(?:внезапно\s+)?`+contact,'i'),
    // Passive constructions: «удар, пусть и не сильный, приходится вам в скулу».
    new RegExp(String.raw`(?:удар|кулак|нога|клинок|пуля|снаряд|копь[её]|нож)[^.!?\n]{0,75}?`+passive+String.raw`\s+(?:по\s+|в\s+)?`+directObject,'i'),
    // «попадает в вашу руку», «удар приходится по вашей скуле».
    new RegExp(passive+String.raw`[^.!?\n]{0,22}?(?:в|по)\s+`+possessive+String.raw`\s+`+body,'i'),
    // «вашу скулу задел кулак».
    new RegExp(String.raw`(?:в|по)\s+`+possessive+String.raw`\s+`+body+String.raw`[^.!?\n]{0,35}?`+contact,'i'),
    // «вы получили удар», «ты получила травму».
    /(?:ты|вы)\s+(?:получа(?:ешь|ете)|получил[аи]?|ранен[аы]?|ранены)\s+(?:удар|ранени|травм|поврежден|по\s+лиц)/i
  ];
  for(let i=0;i<sentences.length;i++){
    // Parse individual sentences/clauses to avoid an unrelated NPC wound
    // determining the severity of a confirmed hit against the player.
    const parts=sentences[i].split(/\s+(?:однако|зато|но\s+затем|а\s+затем)\s+/i);
    for(const part of parts){
      if(!direct.some(rx=>rx.test(part)))continue;
      if(negated.test(part))continue;
      if(/\b(?:пыта(?:ется|лся|лась)|замахива(?:ется|лся)|собира(?:ется|лся)|летит\s+в\s+сторону)\b/i.test(part) &&
         !/(?:попада|ударил|приходится|приш[её]л|задевает|получ(?:аешь|аете|ил)|достигает)/i.test(part))continue;
      if(/тяж[её]л(?:ое|ая|ый)\s+ранени|сильн[^.!?\n]{0,35}кровотеч|глубок[^.!?\n]{0,35}ран|сломал[аи]?\s+(?:тебе|вам)/i.test(part))return 16;
      if(/царап|поверхностн|слегка\s+задевает|скользящ(?:ий|им)\s+удар/i.test(part))return 3;
      return 8;
    }
  }
  return 0;
}
/* v2.16 — consumption. Read actions from the player and confirmed acts from
 * the narrator. Never parse a quoted NPC's first-person speech as the hero.
 * JavaScript's \b word-boundary is ASCII-centric; do NOT use it for Cyrillic. */
function rpgFoodDrinkIntent(action,output){
  const a=String(action||'').replace(/^(?:>\s*)?You\s+/iu,'').replace(/^я\s+/iu,'').trim();
  const o=String(output||'');
  const foodWords='(?:ем|ел|ела|кушаю|съедаю|доедаю|съел[аи]?|поел[аи]?|завтракаю|позавтракал[аи]?|обедаю|пообедал[аи]?|ужинаю|поужинал[аи]?|перекусываю|перекусил[аи]?)';
  const drinkWords=String.raw`(?:пью|пил|пила|выпиваю|допиваю|отпиваю|выпил[аи]?|попил[аи]?|попиваю|делаю\s+глоток)`;
  const actionFood=new RegExp('(?:^|[\\s,;.!?])'+foodWords+'(?=$|[\\s,;.!?])','iu');
  const actionDrink=new RegExp('(?:^|[\\s,;.!?])'+drinkWords+'(?=$|[\\s,;.!?])','iu');
  // First-person action statements, including "сажусь и ем", not plans or questions.
  const plans=/(?:(?:^|\s)(?:хочу|планирую|собираюсь|пытаюсь|собиралась|намереваюсь)\s+(?:\S+\s+){0,3}(?:поесть|пообедать|перекусить|попить|выпить|съесть)|(?:^|\s)(?:можно|хочу\s+ли|сможешь)\s+(?:поесть|выпить))/iu;
  const isPlan=plans.test(a)||/^\s*(?:не\s+|если\s+|когда\s+|спрашиваю\s+|вопрос\s*[:])/iu.test(a);
  const foodA=!isPlan&&actionFood.test(a);
  const drinkA=!isPlan&&actionDrink.test(a);
  // Only the hero is consuming: immediately after "ты/вы" (optionally an
  // adverb). "Ты видишь, как Оля выпила" must NOT count as the hero drinking.
  const adv='(?:(?:снова|наконец|неторопливо|медленно|быстро|слегка|уже|жадно|с\\s+удовольствием|затем|сразу)\\s+){0,3}';
  const narratorFood=new RegExp('(?:^|[.!?\\n]\\s*)(?:ты|вы)\\s+'+adv+'(?:съел[аи]?|съедаешь|съедаете|поел[аи]?|поели|ешь|едите|обедаешь|обедаете|ужинаешь|ужинаете|завтракаешь|завтракаете|доедаешь|доедаете|перекусываешь|перекусываете)(?=$|[\\s,;.!?])','iu');
  const narratorDrink=new RegExp('(?:^|[.!?\\n]\\s*)(?:ты|вы)\\s+'+adv+'(?:пь[её]шь|пь[её]те|выпил[аи]?|выпили|выпиваешь|выпиваете|попил[аи]?|попили|допиваешь|допиваете|делаешь\\s+глоток|делаете\\s+глоток)(?=$|[\\s,;.!?])','iu');
  const foodO=narratorFood.test(o),drinkO=narratorDrink.test(o);
  const badFood=/(?:не\s+удал(?:ось|ось\s+вам)|не\s+смог(?:ла|ли|ли\s+вы)?|не\s+получилось)\s+[^.!?\n]{0,70}?(?:поесть|съесть|перекусить|пообедать)|(?:ты|вы)\s+не\s+(?:поел[аи]?|съел[аи]?|ели)/iu.test(o);
  const badDrink=/(?:не\s+удал(?:ось|ось\s+вам)|не\s+смог(?:ла|ли|ли\s+вы)?|не\s+получилось)\s+[^.!?\n]{0,70}?(?:попить|выпить|напиться)|(?:ты|вы)\s+не\s+(?:пил[аи]?|выпил[аи]?|пили)/iu.test(o);
  return {food:(foodA||foodO)&&!badFood,drink:(drinkA||drinkO)&&!badDrink};
}
function rpgAutoFoodAndDrink(r,action,output,events){
  if(!r.config.needs)return;
  const intent=rpgFoodDrinkIntent(action,output);
  if(intent.food){
    const old=r.needs.hunger;r.needs.hunger=Math.max(0,old-22);
    events.push(old!==r.needs.hunger?'еда: голод '+old+'→'+r.needs.hunger:'еда учтена, голод уже 0');
  }
  if(intent.drink){
    const old=r.needs.thirst;r.needs.thirst=Math.max(0,old-28);
    events.push(old!==r.needs.thirst?'питьё: жажда '+old+'→'+r.needs.thirst:'питьё учтено, жажда уже 0');
  }
}
function rpgAutoSettle(r,output){
  if(!r.pendingEffects || r.lastAutoSettledTurn===r.pendingEffects.turn)return [];
  const pending=r.pendingEffects;r.pendingEffects=null;
  // Commands, blocked actions and failed model generations don't settle.
  if(!String(output||'').trim() || /^\[RPG\]/.test(String(output).trim()))return [];
  const events=[];
  rpgAutoClockAndCost(r,pending.action,events,pending.ledgerTimeApplied||0,pending.ledgerNeedsChanges);
  if(r.config.combat){const damage=rpgConfirmedPlayerHit(output);
    if(damage){const before=r.hp;r.hp=rpgInt(before-damage,0,r.maxHP);
      events.push('HP '+before+'→'+r.hp+' (подтверждённое попадание по герою)');}
  }
  // v2.12: narrator output cannot modify wallet or debt.
  // pendingEffects.financeTransaction was already committed by Input.
  if(r.config.economy&&pending.financeTransaction&&pending.financeTransaction.duplicate)
    events.push('повторная идентичная финансовая операция пропущена');
  // A failed check cannot also confirm food/drink consumption in the same
  // narrated action. Attempts may still cost time/energy.
  const failedCheck=r.pendingRoll && (!r.pendingRoll.success || (r.pendingSecondaryRoll && !r.pendingSecondaryRoll.success));
  if(!failedCheck)rpgAutoFoodAndDrink(r,pending.action,output,events);
  // Session-local awareness: relevant for subsequent stealth near an alerted guard.
  if(/охранник|страж|дозор|патрул/i.test(output) &&
    /(?:замечает|заметил|заметила|окликает|потребовал|преграждает|насторожил|кричит.*страж)/i.test(output) &&
    !/(?:не\s+замечает|не\s+заметил|не\s+насторожил)/i.test(output)){
    r.flags.guardAlertTurn=r.turn;events.push('охрана насторожена (до 6 ходов)');
  }
  r.lastAutoSettledTurn=pending.turn;
  if(events.length){r.autoEvents.push('ход '+r.turn+': '+events.join('; '));
    r.autoEvents=r.autoEvents.slice(-15);}
  return events;
}

/* v2.20: preserve storyteller's mechanical statements as reviewable hints.
 * NEVER apply any changes here: only onInput and explicit commands change money/quests.
 * Recognise complete status lines, not dialogue, hypotheticals or prose that
 * happens to contain a number. Store only unconfirmed claims in :review. */
function rpgReviewClaim(r,raw){
  const line=String(raw||'').trim();
  let m=line.match(/^(Деньги|Баланс)\s*[:：]\s*([+-]?\d+(?:[.,]\d{1,2})?)\s*(?:→|->|⇒)\s*([+-]?\d+(?:[.,]\d{1,2})?)\s*[.!]?\s*$/iu);
  if(m){
    const from=rpgMoneyParse(m[2]),to=rpgMoneyParse(m[3]);
    if(from===null||to===null)return null;
    const same=rpgMoneyRound(r.money)===to;
    const label=m[1]+': '+rpgMoneyFormat(from)+' → '+rpgMoneyFormat(to);
    return {kind:'money',source:label,matched:same,
      detail:same?'сумма совпадает с балансом сохранения '+rpgMoneyFormat(r.money):
        'в сохранении баланс '+rpgMoneyFormat(r.money)+'; изменение не подтверждено',
      command:same?'':'Проверить :status и :debt log; при необходимости исправить через :money +/-сумма'};
  }
  m=line.match(/^(?:Задание|Квест)\s*#(\d{1,5})\s*[:：]\s*(done|failed|active|cancelled|завершено|выполнено|провалено|отменено)\s*[.!]?\s*$/iu);
  if(m){
    const id=+m[1];
    const word=m[2].toLowerCase();
    const status=({завершено:'done',выполнено:'done',провалено:'failed',отменено:'cancelled'})[word]||word;
    const q=(r.quests||[]).find(x=>x.id===id);
    const matched=!!q&&q.status===status;
    return {kind:'quest',source:'Задание #'+id+': '+status,matched,
      detail:q?(matched?'совпадает с сохранением ('+q.title+')':
        'в сохранении #'+id+' «'+q.title+'» — '+q.status+', а не '+status):
        'задания #'+id+' нет в сохранении',
      command:matched?'':q?':quest info '+id+'; если подтверждено: :quest status '+id+' '+status:':quest list all; проверь номер задания'};
  }
  return null;
}
function rpgReviewCapture(r,output){
  const notices=[];
  const lines=String(output||'').split('\n');
  const kept=[];
  let count=0;
  for(const line of lines){
    let claim=count<8?rpgReviewClaim(r,line):null;
    // Some models append a mechanical line after a complete prose sentence.
    // Split only a final standalone claim, never quoted speech or a dialogue.
    let prose='';
    if(!claim && count<8){
      const inline=line.match(/^([\s\S]*?[.!?])\s+((?:Деньги|Баланс)\s*[:：][^\n]+|(?:Задание|Квест)\s*#\d+\s*[:：][^\n]+)$/iu);
      if(inline){
        const maybe=rpgReviewClaim(r,inline[2]);
        if(maybe){prose=inline[1];claim=maybe;}
      }
    }
    if(!claim){kept.push(line);continue;}
    if(prose)kept.push(prose);
    count++;
    if(claim.matched){
      // Matching the current value does not prove the narrator caused it.
      notices.push('[RPG] СВЕРЕНО СО СОХРАНЕНИЕМ: '+claim.source+' ('+claim.detail+').');
    }else{
      let item=r.reviewItems.find(x=>x.kind===claim.kind&&x.source===claim.source);
      if(!item){
        item={id:r.nextReviewId++,kind:claim.kind,source:claim.source,turn:r.turn};
        r.reviewItems.push(item);
        if(r.reviewItems.length>30)r.reviewItems.shift();
      }
      notices.push('[RPG] ПРОВЕРЬТЕ ИЗМЕНЕНИЯ #'+item.id+': '+claim.source+' — '+claim.detail+'. '+claim.command+'.');
    }
  }
  return {text:kept.join('\n').replace(/\n{3,}/g,'\n\n').trim(),notices};
}
function rpgReviewCommand(r,arg){
  const value=String(arg||'').trim();
  if(/^(?:help|\?)$/iu.test(value))return 'ПРОВЕРКА ПРЕДЛОЖЕНИЙ РАССКАЗЧИКА\n:review или :review list — неподтверждённые изменения баланса/заданий\n:review dismiss ID — убрать напоминание после проверки\n:review clear confirm — удалить все напоминания\nЗаписи не изменяют баланс, задания или другие игровые данные.';
  if(/^(?:list|all)?$/iu.test(value)){
    const items=r.reviewItems.slice(-30);
    return 'ПРОВЕРЬТЕ ИЗМЕНЕНИЯ ('+items.length+')\n'+(items.map(x=>{
      // Derive status afresh, since the player may have resolved the discrepancy.
      const claim=rpgReviewClaim(r,x.source);
      const now=claim?(claim.matched?'[УЖЕ СОВПАДАЕТ] ':'[НУЖНА ПРОВЕРКА] ')+claim.detail:'[НЕИЗВЕСТНО]';
      return '#'+x.id+' '+x.source+' — '+now+(claim&&!claim.matched?'\n  '+claim.command:'');
    }).join('\n')||'Нет неподтверждённых предложений.')+'\n:review dismiss ID — убрать проверенное напоминание.';
  }
  const m=value.match(/^(?:dismiss|remove)\s+(\d+)$/iu);
  if(m){
    const id=+m[1],idx=r.reviewItems.findIndex(x=>x.id===id);
    if(idx<0)return 'Напоминание #'+id+' не найдено. :review';
    r.reviewItems.splice(idx,1);return 'Напоминание #'+id+' убрано. Игровые данные не изменены.';
  }
  if(/^clear\s+confirm$/iu.test(value)){
    const n=r.reviewItems.length;r.reviewItems=[];
    return 'Убрано напоминаний: '+n+'. Игровые данные не изменены.';
  }
  return 'Неизвестная команда. :help review';
}

function rpgHelp(r,topic){
  const key=rpgClean(topic||'',60).toLowerCase();
  const stats=RPG_STATS.map(x=>x+'='+r.stats[x]).join(', ');
  const help={
    char:'ПЕРСОНАЖ И БИОГРАФИЯ\n:char create — черновик создания (не сбрасывает сохранение)\n:char name Имя — имя в черновике\n:char gender Пол — пол в черновике\n:char age 25 — возраст в черновике\n:char job Профессия — профессия в черновике\n:char bio Текст — записать или заменить биографию ДО 1500 символов; работает и без черновика\n:char bio add Событие — добавить важный факт в биографию (в пределах лимита)\n:char bio show — показать полную биографию\n:char dream Текст — мечта героя ДО 300 символов; доступно редактирование без пересоздания\n:char goal Текст — старое имя команды, теперь тоже меняет мечту\n:char info — сведения и лимиты текста\n:char stat Сила 7; :char skill Скрытность 20 — распределение очков в черновике\n:char show; :char done; :char cancel — просмотр, подтверждение, отмена черновика\nПокупка характеристик: 12 + до 6 возвратных; 6–16. Навыки 60 очков, 0–30.',
    stat:'ХАРАКТЕРИСТИКИ (9)\n'+stats+'\n:stat Сила 7 — установить характеристику уже созданного персонажа (1–30; без проверки бюджета)\n:char stat Сила 7 — распределить во время создания (6–16, с бюджетом)\n:stat list — показать текущие характеристики\nНижние характеристики дают отрицательный модификатор floor((значение−10)/2).',
    skill:'НАВЫКИ\n'+rpgSkillListText(r)+'\n:skill Скрытность 20 — установить навык (0–50)\n:skill add Алхимия | Интеллект | алхим,зелье — создать навык с основной характеристикой и фразами для автосудьи\n:skill info Алхимия — характеристика, фразы, значение, бонус\n:skill attr Алхимия | Смекалка — сменить характеристику\n:skill bind Алхимия | эликсир,зелье — заменить ключевые фразы\n:skill remove Алхимия — безвозвратно удалить пользовательский навык\n:skill list — показать стандартные и пользовательские навыки\n:char skill Алхимия 20 — вложить очки в черновике\nКаждые 10 уровней дают +1 к d20. Для автосудьи важны ключевые фразы; нестандартный текст не всегда будет распознан.',
    review:'ПРОВЕРЬТЕ ИЗМЕНЕНИЯ — сообщения рассказчика о состоянии денег/заданий, не являющиеся действиями движка.\n:review — список; :review dismiss ID — убрать запись; :review clear confirm — очистить список.\nПроверяй :status, :debt log и :quest info ID. Отметки не изменяют состояние игры.',
    debug:'ОТЛАДКА\n:debug on — показывать результаты бросков и автоматического учёта\n:debug off — скрывать технические сообщения в сюжетном выводе\n:debug status — показать режимы судьи, редактора, инвентаря и число бросков\n:debug last — последнее решение судьи, навык, DC, d20 и итог\n:effects — последние изменения HP, выносливости, денег, времени и потребностей. Команда :debug last работает даже при off.',
    judge:'КОМБИНИРОВАННЫЕ ПРОВЕРКИ\nПри подтверждённом провале цель НЕ достигнута. В v2.31 Output заменяет произвольный ответ рассказчика строгим отрицательным исходом; для двух проверок сохраняется отдельный результат каждой.\n:judge combo simple — старый приоритет первого совпадения.\n:judge combo weighted — контекстный выбор основного навыка и характеристики, вспомогательный навык ≥10 даёт +1.\n:judge combo detailed — дополнительно два броска при независимых целях, например взлом и скрытность при охране.\n:judge override Восприятие | Рисование — только следующую автоматическую проверку выполнить указанной парой.\n:judge clear — отменить. :judge last — последнее решение.\n:check Восприятие 14 Рисование | рисую портрет — ручной бросок без переопределения.\nВспомогательный навык не получает XP. В detailed независимые риски получают XP по своим броскам. smart JSON использует выбор самой модели, комбинации применяются к classic/narrative.',
    auto:'АВТОСУДЬЯ\nРассказчик не может превратить провал d20 в успех: при провале выводится строгий результат движка. Это применяется и к ручному :check.\n:judge combo weighted — контекстный выбор; :help judge — подробности.\n:auto cautious — осторожный режим: бросок только при однозначном немедленном действии; без универсальной Смекалки\n:auto narrative — старый автоматический режим (широкий охват, возможны ложные срабатывания)\n:auto classic — базовый режим ключевых слов\n:auto smart — экспериментальный JSON RPG_TURN, может не работать с моделью\n:auto on — включить ранее выбранный режим\n:auto off — отключить автоматические броски\n:check Сила 14 Холодное оружие | ударить мечом — ручная проверка\nНовые навыки в narrative/classic распознаются по заданным фразам; это не ИИ-судья.',
    check:'РУЧНАЯ И ПОЛУАВТОМАТИЧЕСКАЯ ПРОВЕРКА\nПровал d20 означает, что заявленная цель не достигнута. В v2.31 текст противоречащего рассказчика заменяется результатом движка; XP и бросок не повторяются.\n:check preview обольщаю красотой, легко | флиртую с охранником — предпросмотр без броска\n:check рисую используя навыки черчения, сложно | делаю чертёж — подбор существующего навыка; при неоднозначности покажет варианты\n:check choose 1 — выполнить выбранный вариант один раз; :check cancel — отменить\nСложности словами: пустяк DC5, легко DC9, средне DC13, сложно DC19, невозможно DC30 (натуральная 20 всё равно критический успех). Подходят и синонимы; можно писать сложность: сложно.\n:check Ловкость Скрытность | проскользнуть мимо охраны — авто-DC\n:check Сила 14 Холодное оружие | ударить мечом — фиксированный DC\n:check Ловкость 12 | перепрыгнуть — без навыка\n:debug last — посмотреть решение; численные модификаторы считаются программно. Для своих навыков используйте точное название.',
    inventory:'ИНВЕНТАРЬ\n:inventory on — проверять наличие распознанных личных предметов\n:inventory off — отключить строгую проверку\n:give фонарик 2 — добавить предметы\n:take фонарик 1 — убрать предмет\n:use фонарик | осмотреть подвал — проверить предмет и выполнить действие\n:rename старое имя | новое имя — переименовать предмет без потери количества\n:status — посмотреть инвентарь. Автопроверка не охватывает все предметы.',
    fallback:'РЕЗЕРВНЫЙ РЕЖИМ\n:fallback safe — резервная программная проверка при сбое JSON в smart\n:fallback story — пропустить ответ модели без подтверждённой проверки\n:fallback strict — остановиться при неверном RPG_TURN\nВ :auto narrative резервный JSON-режим не нужен.',
    status:':status — персонаж, характеристики, изученные навыки, здоровье, потребности, деньги, предметы, место, время.\n:help stat и :help skill — полные списки.',
    mod:'ВРЕМЕННЫЕ МОДИФИКАТОРЫ БРОСКОВ d20\n:mod add Рисование | +2 | 120 | Вдохновение — +2 к проверкам Рисования на 120 игровых минут.\n:mod add Сила, Скрытность | -3 | 60 | Травма — −3 к проверкам Силы и Скрытности.\n:mod — список; :mod remove 1 — снять #1; :mod clear confirm — снять все.\nID — минимальный свободный номер; после удаления всех эффектов следующий #1. Действующие ID не меняются.\nДиапазон одного эффекта: −10…−1 или +1…+10; общая сумма на одну цель ограничена ±20. Время 1–10080 мин, до 30 эффектов; навыки и характеристики не меняются, отрицательный штраф работает и при навыке 0.\nПри проверке характеристика и навык суммируют свои модификаторы, а вспомогательный навык — свой. :modifiers — старый псевдоним списка; :buff/:debuff — устаревшие для добавления, но позволяют удалять старые эффекты по ID и clear confirm. :effects — журнал автоучёта.',
    modifiers:'Старые команды удаления работают: :modifiers remove ID; :modifiers clear confirm. Для добавления новых эффектов: :help mod.',
    buff:'Добавление: :mod add Навык | +2 | 120 | Причина. Удаление старых бафов: :buff remove ID; :buff clear confirm.',
    debuff:'Добавление: :mod add Навык | -2 | 120 | Причина. Удаление старых дебафов: :debuff remove ID; :debuff clear confirm.',
    effects:':effects — последние 10 записей автоматического учёта времени, голода, жажды, усталости, урона и денежных транзакций.\n:debug on — дополнительно показывать изменения прямо после ответов.',
    needs:':needs on/off — включить или отключить расчёт потребностей.\n:needs status — показатели, скорости роста и остатки минут до следующей единицы.\n:needs eat — вручную учесть еду (−22 голода); :needs drink — питьё (−28 жажды).\n:needs hunger 20 / :needs thirst 30 / :needs fatigue 15 — установить точное значение 0–100 без изменения игрового времени; действует также при needs off.\nУспешные действия героя «ем», «пью», «съедаю», «выпиваю» распознаются после ответа рассказчика.\nПо обычным ходам автоматически +3 мин, если не указано время действия. :time 90 — вручную продвинуть часы; :time set — лишь установить часы. :rest 60 — отдых.',
    combat:':combat on — учитывать расход выносливости и однозначно описанные ранения героя.\n:combat off — отключить автоматические боевые эффекты.\n:hp -8 и :stamina +10 — ручная коррекция.',
    economy:':economy on — выполнять только ЯВНЫЕ финансовые действия игрока. Рассказчик больше НЕ выставляет счета и НЕ изменяет деньги/долг.\nОплачиваю 4,50 — списать; получаю 10 — прибавить; запишите на мой счёт 20 — долг +20, деньги без изменений; погашаю долг 5 — долг и деньги −5.\n:economy off — отключить. :debt — долг и журнал. :money +/-N — исправить баланс.',
    debt:'ДОЛГ И ФИНАНСОВЫЕ ДЕЙСТВИЯ (ТОЛЬКО РЕПЛИКИ ИГРОКА)\n«Запишите на мой счёт 7,5» или «буду должен 7,5» — долг +7,5, баланс без изменений.\n«Оплачиваю 7,5» — баланс −7,5.\n«Погашаю долг 5» — долг −5 и баланс −5.\n«Получаю 10» — баланс +10.\n«Беру взаймы 20» — долг +20 и баланс +20.\n:debt — долг и баланс; :debt log — история операций\n:debt add 10 / :debt pay 5 / :debt set 0 — ручное управление; :money +/-N — коррекция кошелька.\nСумма обязательна для каждой оплаты. Ничего не извлекается из повествования модели.',
    hp:':hp -10 — отнять HP; :hp +10 — восстановить HP. 0–maxHP.\n:status — посмотреть здоровье.',
    stamina:':stamina -5 — уменьшить выносливость; :stamina +10 — восстановить; 0–maxStamina.',
    money:':money +50 / :money -7.5 / :money -7,50 — ручное изменение баланса (до 2 знаков после десятичного разделителя). В ручном режиме допустим отрицательный кошелёк.',
    time:':time 120 — продвинуть игровое время на 120 минут, учитывая потребности.\n:time set 15:30 — установить часы без перерасчёта потребностей.\n:date show / set / advance — условный календарь, см. :help date.',
    date:'КАЛЕНДАРЬ (УНИВЕРСАЛЬНЫЙ)\n12 месяцев в году, по 30 дней, без реальных дат и названий месяцев.\n:date show — текущая дата и время\n:date set 2 4 15 — год 2, месяц 4, день 15; часы сохраняются\n:date set 2 4 15 09:30 — одновременно дата и часы\n:date advance 3 — продвинуть 3 дня вперёд с учётом потребностей (1–30)\n:time set 16:45 — установить время суток без перерасчёта потребностей\n:time 45 — продвинуть 45 минут с учётом потребностей. Возврат назад только через set.',
    rest:':rest 60 — отдых 60 минут; :rest 240 — длительный отдых/сон. Восстанавливает выносливость и снижает усталость.',
    place:':place Улица у рынка — сохранить локацию персонажа; :status — посмотреть.',
    note:'ЖУРНАЛ ПАМЯТИ (до 100 записей по 400 символов)\n:note текст — быстрый факт\n:note add npc | Охранник запомнил героиню — категория\n:notes — последние 20; :notes all — до 50; :notes npc; :notes pinned — фильтры\n:note search охранник — поиск по тексту\n:note edit 3 | Исправленный факт — редактировать #3\n:note remove 3 — удалить запись #3\n:note pin 3 / :note unpin 3 — закрепить/открепить\n:note clear confirm — очистить весь журнал (необратимо).\nКатегории: факт, npc, событие, обещание, место, квест, мир. Закреплённые заметки приоритетны в контексте.',
    notes:':notes — список записей; :notes all, :notes pinned, :notes npc и другие категории.\n:help note — все операции журнала.',
    quest:'ЗАДАНИЯ (ДЕЙСТВУЮТ ПОСЛЕ ПОДТВЕРЖДЕНИЯ ИГРОКОМ)\n:quest add Найти работу | Прийти в агентство — создать задание\n:quest list [active/done/failed/cancelled/all] — список\n:quest info 1 — полная запись\n:quest due 1 | 2 4 15 18:00 — срок по игровому календарю; :quest due 1 clear — убрать\n:quest status 1 done — завершить, также failed/cancelled/active\n:quest edit 1 | Новое название | Новое описание — изменить\n:quest remove 1 confirm — удалить.\nСкрипт НЕ определяет автоматически завершение задания по тексту модели; явные статусы надёжнее.',
    roll:':roll 6 — бросить d6; допустимые грани 2–1000.\n:check — проверка навыка d20.',
    give:':give фонарик 2 — добавить 2 предмета в инвентарь. Максимум 50 разных названий.',
    take:':take фонарик 1 — забрать 1 предмет из инвентаря; сверх имеющегося количества нельзя.',
    rename:':rename фонарик 1. | фонарик — переименовать предмет, сохраняя количество. Указанные имена точные.',
    use:':use фонарик | осмотреть подвал — проверить наличие предмета и передать действие рассказчику.',
    xp:':xp on/off — включить или приостановить рост (прогресс сохраняется).\n:xp speed slow/normal/fast — готовые множители XP: slow ×0.5, normal ×1, fast ×2.\n:xp speed 1.5 — собственный множитель; 0.1–10, до 2 знаков после точки или запятой, например :xp speed 0,75.\n:xp mode instant/rest/manual — повышение сразу, после :rest 180+ или вручную. Это НЕ скорости накопления.\n:xp — сводка XP; :xp skill Рисование; :xp stat Восприятие; :xp log — журнал повышений.\n:xp apply — применить накопленные повышения в любом режиме.\nНаграды округляются Math.round, после чего за повторение уменьшаются вдвое с округлением вниз; при малой скорости может быть 0 XP.\nПовторение того же действия уменьшает XP, 3-й раз за 8 ходов — 0. Навык до 50, характеристика до 30.\nРучные :skill/:stat/:setup не начисляют XP.\n:setup §xp_speed=1.5 §:apply — изменение через анкету; накопленный XP не пересчитывается.',
    rpg:'УПРАВЛЕНИЕ СОХРАНЕНИЕМ — :rpg.\n'+
      ':rpg status — показать размер журналов и имя хранилища.\n'+
      ':rpg memory clear / :rpg reset / :rpg uninstall — предварительный просмотр количества и состава удаляемых данных БЕЗ изменения сохранения.\n'+
      ':rpg memory clear confirm — удалить журнал заметок, задания, краткую память, последние броски, логи, напоминания и флаги; оставить героя, биографию, XP, инвентарь, ресурсы, часы, эффекты и настройки.\n'+
      ':rpg reset confirm — полностью пересоздать state.rpg со значениями по умолчанию; исходные поля сценария могут снова заполнить имя/пол героя.\n'+
      ':rpg uninstall confirm — удалить state.rpg и остановить все RPG-хуки перед удалением четырёх JS-файлов. Останется служебный флаг state.aidUniversalRpgRemoved, предотвращающий повторное создание базы, пока скрипт установлен.\n'+
      'После uninstall :rpg reset confirm возобновляет работу с новой пустой игрой.\n'+
      'Без confirm команды показывают состав и количество затрагиваемых данных; удаление не происходит. Ни одна команда не стирает историю чата, Memory/Story Cards/другие данные AI Dungeon или чужие ключи state. Не запускай команды очистки внутри :batch.',
    aidm:'РУЧНОЙ ЭКСПОРТ СНИМКА RPG ДЛЯ AID MEMORY ENGINE v1.5.0\n:aidm export — создать или обновить одну Custom Story Card.\n:aidm status — проверить готовность JSON и наличие карточки без записи.\nKeys: __AID_RPG_EXPORT_V1__; Entry начинается с [AID_RPG_EXPORT:1]. JSON до 5000 символов.\nИмпорт в Memory Engine выполняется ОТДЕЛЬНО: ;mem import rpg card; просмотр: ;mem import rpg status.\nДанные читаются только из state.rpg, сохранение героя не меняется; отсутствующие поля не выдумываются. :batch не допускает экспорт.\nЕсли зарезервированные Keys заняты чужой карточкой, операция отклоняется.',
    batch:rpgBatchHelp(),
    setup:rpgSetupHelp(r),
    help:':help — краткая справка всех команд\n:help stat / skill / char / debug / auto / check / inventory — подробности\n:help all — названия доступных разделов.'
  };
  help.economy+='\nОтображение v2.13: при :debug off — только успешное изменение, например [RPG] Баланс −5; долг −5. При :debug on — подробности всех распознанных финансовых попыток, причин отказов и сохранённых сумм. Ошибки, из-за которых операция отклонена, показываются отдельно для безопасности.';
  help.money+='\nПри :debug off — краткая величина изменения; при :debug on — старый и новый баланс.';
  if(key==='all')return 'РАЗДЕЛЫ ПОДРОБНОЙ СПРАВКИ\n'+Object.keys(help).sort().map(x=>':help '+x+' — '+({char:'создание',stat:'характеристики',skill:'навыки',debug:'отладка'}[x]||'правила и примеры')).join('\n');
  if(key&&help[key])return help[key];
  if(key)return 'Неизвестный раздел «'+key+'». :help all — полный список.';
  return 'UNIVERSAL RPG — КОМАНДЫ\n'+[
    ':setup — полный шаблон первоначальной настройки и персонажа (одной вставкой)',
    ':batch template hero/skills/inventory/resources/modifiers/time/notes/quests/rules/review — полные шаблоны изменений',
    ':help [тема] — описание и примеры (:help judge / skill / char / debug / all)',
    ':status — лист персонажа; :effects — изменения ресурсов',
    ':aidm export / status — обменная Story Card для Memory Engine v1.5.0',
    ':rpg status / memory clear / reset / uninstall — предпросмотр; добавь confirm для выполнения',
    ':char create / show / done / cancel; :char bio / dream — создание, биография и мечта',
    ':stat Имя число — изменить характеристику; :skill Имя число — изменить навык',
    ':skill add / info / attr / bind / remove / list — управление пользовательскими навыками',
    ':auto cautious / narrative / classic / smart / on / off — автоматический судья',
    ':check preview ... / :check choose N / :check описание | действие — полуавтоматический подбор; :roll 6 — d6',
    ':debug on / off / status / last — диагностика',
    ':inventory on / off — проверка предметов; :give / :take / :rename / :use — инвентарь',
    ':hp +/-N; :stamina +/-N; :money +/-N — изменение ресурсов',
    ':debt / add N / pay N / set N / log — долг и финансовый журнал',
    ':date show / set / advance; :time N / set ЧЧ:ММ — календарь и часы',
    ':rest N; :place Место — отдых и локация',
    ':xp on/off; :xp speed slow/normal/fast/1.5; :xp mode instant/rest/manual — развитие персонажа',
    ':mod add Навык/Характеристика | +2/-2 | 120 | Причина — модификаторы d20',
    ':judge combo simple/weighted/detailed; :judge override — выбор навыков и характеристик',
    ':needs on/off; :combat on/off; :economy on/off — автоматический учёт',
    ':magic on/off — доступность магии',
    ':note add/edit/remove/pin/search; :notes — управляемый журнал',
    ':quest add/list/info/status/edit/remove — задания и их состояния',
    ':review — неподтверждённые изменения, предложенные рассказчиком',
    ':editor on/off; :fallback safe/story/strict; :ledger on/off — дополнительные режимы'
  ].join('\n');
}
/* ---------- v2.7 — setup parser safe for flattened AI Dungeon input ---------- */
// AI Dungeon may replace pasted newlines with spaces before onInput.
// Therefore each setup field/comment is explicitly delimited by §.
// Never use whitespace or a newline alone to identify a field boundary.
function rpgSetupFrame(block) {
  return block.split('\n').map((line,index)=>index===0?line:'§'+line).join('\n');
}
// Full template reflects CURRENT saved values; copying it back does not reset an existing game.
function rpgSetupTemplate(r,section) {
  section=section||'all';
  const ca=rpgCalendar(r), c=r.character||{};
  const safe=(v)=>String(v===undefined||v===null?'':v).replace(/[\r\n]/g,' ').replace(/\s+/g,' ').trim();
  const mode=!r.config.autoJudge?(r.turn===0&&!r.setupCompleted?'narrative':'off'):r.config.smartJudge?'smart':r.config.narrativeJudge?'narrative':r.config.cautiousJudge?'cautious':'classic';
  const b=rpgCharStatBudget(r.stats);
  const skillTotal=rpgSkillList(r).reduce((n,k)=>n+(r.skills[k]||0),0);
  const validNew=RPG_STATS.every(k=>r.stats[k]>=6&&r.stats[k]<=16) && b.spend<=b.limit &&
    rpgSkillList(r).every(k=>r.skills[k]>=0&&r.skills[k]<=30) && skillTotal<=60;
  // Show a genre-neutral sample biography ONLY for an untouched new adventure.
  // Never fill in a missing biography in an established campaign.
  const fresh=!r.setupCompleted && r.turn<=1;
  const existingBio=safe(c.background==='не указана'?'':c.background);
  const sampleBio='Детство прошло в небольшом поселении. С ранних лет приходилось помогать близким и осваивать полезные навыки. Позже пришлось отправиться в другое место в поисках своего пути.';
  const displayedBio=existingBio||(fresh?sampleBio:'');
  const lines=[
    ':setup',
    '# БЫСТРЫЙ СТАРТ: меняй значения после = и вставь весь блок одним сообщением.',
    '# ВАЖНО: символ § перед строками — РАЗДЕЛИТЕЛЬ. Не удаляй его!',
    '# Строки с # — подсказки, они НЕ сохраняются. Можно удалить ненужные поля (остальные не изменятся).',
    '# Ошибка хотя бы в одном поле отменяет применение ВСЕГО блока. Рекомендуется режим Story.',
    '# budget: creation — новый персонаж, 12 очков + до 6 за сниженные характеристики, 60 очков навыков.',
    '# budget: free — изменение существующего героя без бюджета; характеристики 1–30, навыки 0–50.',
    'budget='+(validNew?'creation':'free'),
    '# === РЕЖИМ ИГРЫ ===',
    '# auto: narrative — широкий охват (ложные срабатывания); cautious — осторожная проверка; classic — ключевые слова;',
    '# auto: smart — экспериментальный RPG_TURN/JSON (модель может нарушать формат); off — без автосудьи.',
    '# judge_combo: simple — один; weighted — контекст+поддержка (рекомендован); detailed — отдельные независимые риски.',
    'judge_combo='+r.config.judgeCombo,
    'auto='+mode,
    '# debug: on — показывать расчёты/автоучёт; off — скрыть, доступна команда :debug last.',
    'debug='+(r.config.debug?'on':'off'),
    '# Далее on — включено, off — выключено. Каждый переключатель независимый.',
    '# inventory — проверять наличие предметов в распознанных действиях.',
    'inventory='+(r.config.inventoryStrict?'on':'off'),
    '# needs — голод, жажда и усталость при течении времени.',
    'needs='+(r.config.needs?'on':'off'),
    '# combat — затраты выносливости и распознаваемые ранения игрока.',
    'combat='+(r.config.combat?'on':'off'),
    '# economy — деньги и долг ТОЛЬКО по явным фразам игрока, не по ответу модели.',
    'economy='+(r.config.economy?'on':'off'),
    '# xp: on/off; скорость slow(×0.5)/normal(×1)/fast(×2) или 0.1–10 (например 1.5); повышение instant/rest/manual.',
    'xp='+(r.config.xpEnabled?'on':'off'),
    'xp_speed='+r.config.xpSpeed,
    'xp_mode='+r.config.xpMode,
    '# magic — разрешить или запретить магию в мире.',
    'magic='+(r.config.magic?'on':'off'),
    '# editor — проверка структурированного ответа (имеет смысл прежде всего с auto=smart).',
    'editor='+(r.config.editor?'on':'off'),
    '# ledger — экспериментальная обработка RPG_DELTA; с auto=narrative/smart ОБЯЗАТЕЛЬНО off.',
    'ledger='+(r.config.ledger?'on':'off'),
    '# fallback: safe — резервная программная проверка, если smart не вернул нужный формат;',
    '# fallback: story — разрешить обычное продолжение истории без гарантий судьи;',
    '# fallback: strict — остановить ход при ошибке smart; для narrative почти не нужен.',
    'fallback='+(r.config.fallback||'safe'),
    '# === ГЕРОЙ ===',
    '# name — имя (до 120 символов); если пусто, останется текущее или «Герой». gender — пол; age — 1–120.',
    'name='+safe(c.name==='не задано'?'':c.name),
    'gender='+safe(c.gender==='не задан'?'':c.gender),
    'age='+(c.age||''),
    '# job — занятие/профессия (до 120 символов).',
    'job='+safe(c.job==='не указана'?'':c.job),
    '# bio — КРАТКАЯ биография (максимум 1500 символов), dream — мечта (максимум 300).',
    '# Образец bio при первой настройке можно полностью заменить. В текущей игре здесь твой сохранённый текст.',
    'bio='+displayedBio,
    'dream='+safe(c.dream==='не указана'?'':c.dream),
    '# === ХАРАКТЕРИСТИКИ ===',
    '# stat.* — 9 характеристик; creation 6–16, free 1–30. Ниже 10 — штрафы, выше 10 — бонусы.',
    ...RPG_STATS.map(k=>'stat.'+k+'='+r.stats[k]),
    '# === СТАНДАРТНЫЕ НАВЫКИ (27) ===',
    '# skill.* — уровень 0–30 при creation (суммарно <= 60), 0–50 при free.',
    ...RPG_SKILLS.map(k=>'skill.'+k+'='+(r.skills[k]||0)),
    '# === СВОИ / ДОПОЛНИТЕЛЬНЫЕ НАВЫКИ (ОДИН И ТОТ ЖЕ РАЗДЕЛ) ===',
    '# custom.Название=Характеристика | ключевое слово,другое слово | уровень',
    '# Пример (не применяется, пока стоит #): custom.Алхимия=Интеллект | алхим,зелье | 20',
    '# Ключи нужны автосудье; до 8 слов или фраз по 3–32 символа. Свои навыки можно создавать без JS.',
    ...Object.keys(r.customSkills||{}).map(k=>'custom.'+k+'='+r.customSkills[k].attr+' | '+r.customSkills[k].keywords.join(',')+' | '+(r.skills[k]||0)),
    '# === ДАТА И РЕСУРСЫ ===',
    '# Условный календарь: year 1–9999, month 1–12, day 1–30; time — HH:MM (00:00–23:59).',
    'year='+ca.year,
    'month='+ca.month,
    'day='+ca.day,
    'time='+String(Math.floor(r.timeMinutes/60)).padStart(2,'0')+':'+String(r.timeMinutes%60).padStart(2,'0'),
    '# place — место; money — баланс; debt — сумма долга (не уменьшает баланс).',
    'place='+safe(r.location),
    'money='+rpgMoneyFormat(r.money),
    'debt='+rpgMoneyFormat(r.debt),
    '# maxhp/maxstamina — максимум; hp/stamina — текущие значения, не выше максимума.',
    'maxhp='+r.maxHP,
    'hp='+r.hp,
    'maxstamina='+r.maxStamina,
    'stamina='+r.stamina,
    '# hunger/thirst/fatigue — потребности от 0 (нет) до 100 (максимум).',
    'hunger='+r.needs.hunger,
    'thirst='+r.needs.thirst,
    'fatigue='+r.needs.fatigue,
    '# === ПРЕДМЕТЫ ===',
    '# item.Название=Количество (0–999). Значение 0 удаляет предмет; максимум 50 разных предметов.',
    '# Пример (не применяется, пока стоит #): item.фонарик=1',
    ...Object.keys(r.items||{}).map(k=>'item.'+k+'='+r.items[k]),
    '# Строки со своими навыками находятся сразу после стандартных; удаление custom-строки НЕ удаляет навык.',
    '# Удалить пользовательский навык: :skill remove Название — отдельной командой после настройки.',
    ':apply'
  ];
  // AI Dungeon Story actions are limited to 4000 characters. The original
  // v2.5 annotated template was 4300 characters even for an empty character,
  // so the app truncated away :apply before the parser ever saw it.
  // The default template is deliberately compact and keeps room for edits.
  const sectionNames=['rules','hero','skills','resources'];
  if(sectionNames.includes(section)){
    const at={
      rules:[0,lines.findIndex(x=>x==='# === ГЕРОЙ ===')],
      hero:[lines.findIndex(x=>x==='# === ГЕРОЙ ==='),lines.findIndex(x=>x==='# === СТАНДАРТНЫЕ НАВЫКИ (27) ===')],
      skills:[lines.findIndex(x=>x==='# === СТАНДАРТНЫЕ НАВЫКИ (27) ==='),lines.findIndex(x=>x==='# === ДАТА И РЕСУРСЫ ===')],
      resources:[lines.findIndex(x=>x==='# === ДАТА И РЕСУРСЫ ==='),lines.length-1]
    };
    const bounds=at[section];
    const selected=lines.slice(bounds[0],bounds[1]).filter(x=>x!==':setup');
    if(section==='hero'||section==='skills')selected.unshift('budget='+(validNew?'creation':'free'));
    const body=rpgSetupFrame([':setup','# Раздел '+section+': измени значения и отправь блок до :apply.',...selected,':apply'].join('\n'));
    return body.length>3800
      ?'Раздел '+section+' содержит '+body.length+' символов, больше безопасного лимита 3800. Используй короткие блоки :setup\nkey=value\n:apply либо команды :help.'
      :body;
  }
  // Keep group labels, all data and explanations of non-obvious choices.
  // More detailed comments are available via :setup rules/hero/skills/resources.
  const keepComment=x=> /^# ===/.test(x)||
    /^# (?:БЫСТРЫЙ СТАРТ|budget:|auto:|debug:|fallback:|bio —|stat\.\*|skill\.\*|custom\.Название|Пример.*custom|Условный календарь|item\.Название)/.test(x);
  const compact=lines.filter(x=>!x.startsWith('#')||keepComment(x));
  compact.splice(1,0,'# ПОДСКАЗКИ: :setup rules / hero / skills / resources (подробные шаблоны).');
  const inv=compact.findIndex(x=>x.startsWith('inventory='));
  compact.splice(inv,0,'# Переключатели (on/off): inventory предметы; needs потребности; combat бой; economy деньги;',
    '# magic магия; editor контроль JSON; ledger экспериментально (для narrative — off).');
  const out=rpgSetupFrame(compact.join('\n'));
  return out.length>3800
    ?'Текущий полный шаблон слишком большой ('+out.length+' символов, лимит AI Dungeon 4000). Используй :setup rules, :setup hero, :setup skills, :setup resources — каждый раздел можно отправить одним блоком.'
    :out;
}
function rpgSetupHelp(r){
  return 'AI DUNGEON: не более 4000 символов на одно действие.\n'+
    ':setup / :setup template — общий шаблон с символами § перед строками.\n'+
    ':setup rules — режимы auto, debug, inventory, needs, combat, economy и т.д.\n'+
    ':setup hero — имя, профессия, био, мечта, характеристики.\n'+
    ':setup skills — стандартные и свои навыки рядом.\n'+
    ':setup resources — дата, место, деньги, HP, потребности и предметы.\n'+
    'Шаблон теперь использует § как обязательный разделитель строк. Не удаляй § при копировании.\n'+
    'Каждый блок начинается с :setup, заканчивается §:apply и отправляется ОТДЕЛЬНЫМ сообщением в Story.\n'+
    'Если меняешь один-два параметра: :setup §name=Мира §:apply\n'+
    'budget=creation проверяет стартовые очки; budget=free меняет существующего героя.\n'+
    'Комментарии # не сохраняются. Непереданные поля не изменяются. Ошибка отклоняет весь ОДИН блок.';
}
function rpgSetupCommand(r,arg){
  const trimmed=String(arg||'').trim();
  if(!trimmed)return 'Скопируй весь шаблон с символами § (максимум 4000 символов на действие).\n'+rpgSetupTemplate(r);
  if(/^(template|show)$/i.test(trimmed))return rpgSetupTemplate(r);
  if(/^help$/i.test(trimmed))return rpgSetupHelp(r);
  if(/^(rules|hero|skills|resources)$/i.test(trimmed))return rpgSetupTemplate(r,trimmed.toLowerCase());
  if(r.characterDraft)return 'НАСТРОЙКА НЕ СОХРАНЕНА: открыт черновик :char create. Сначала :char done или :char cancel, затем :setup.';
  const raw=trimmed.replace(/^```(?:text)?\s*/i,'').replace(/\s*```\s*$/,'').trim();
  const framed=raw.includes('§');
  // The first token precedes the first marker. All actual fields must
  // be explicitly framed, so whitespace flattening cannot merge them.
  let lines;
  if(framed){
    const fragments=raw.split('§');
    if(fragments[0].trim()){
      return 'НАСТРОЙКА НЕ СОХРАНЕНА: текст до первого символа §. Скопируй новый :setup template полностью.';
    }
    lines=fragments.slice(1).map(x=>x.trim()).filter(Boolean);
  } else {
    lines=raw.split(/\r?\n/);
    if(lines.length===1 && /:apply\s*[.!?]?$/i.test(raw)){
      return 'НАСТРОЙКА НЕ СОХРАНЕНА: AI Dungeon склеил строки шаблона. Получи новый :setup template с разделителями § и НЕ удаляй их.';
    }
  }
  // The explicit terminator prevents accidental import of an incomplete/pasted fragment.
  if(!/^:apply\s*[.!?]?$/i.test(lines[lines.length-1].trim())){
    const received=String(raw).length+6; // include command :setup
    const end=String(raw).slice(-75).replace(/[\r\n]+/g,' / ');
    const likelyLimit=received>=3850;
    return 'НАСТРОЙКА НЕ СОХРАНЕНА: строка :apply не получена. Длина полученного ввода ≈'+received+
      ' символов; конец: «'+end+'».\n'+
      (likelyLimit?'Вероятно, AI Dungeon ОБРЕЗАЛ ввод (лимит 4000 символов на действие). ':'')+
      'Получить исправленный шаблон: :setup template (разделитель §); можно разбить на :setup rules / hero / skills / resources. Ранее сохранённые данные не затронуты.';
  }
  lines.pop();
  if(raw.length>14000||lines.length>160)return 'НАСТРОЙКА НЕ СОХРАНЕНА: шаблон слишком длинный (максимум 14000 символов и 160 строк).';
  const candidates=[];
  const seen=new Set();
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    if(!line||/^#/.test(line))continue;
    const eq=line.indexOf('=');
    if(eq<1)return 'НАСТРОЙКА НЕ СОХРАНЕНА: строка '+(i+2)+' без =: '+line.slice(0,65);
    const key=line.slice(0,eq).trim(),value=line.slice(eq+1).trim();
    const lk=key.toLowerCase().replace(/ё/g,'е');
    if(seen.has(lk))return 'НАСТРОЙКА НЕ СОХРАНЕНА: поле «'+key+'» повторяется.';
    seen.add(lk);candidates.push({key,value,line:i+2});
  }
  if(!candidates.length)return 'НАСТРОЙКА НЕ СОХРАНЕНА: нет ни одного поля.';
  // Stage changes in separate objects: no side effects until ALL checks pass.
  const cfg=Object.assign({},r.config), c=Object.assign({},r.character),
        stats=Object.assign({},r.stats),skills=Object.assign({},r.skills),
        custom=JSON.parse(JSON.stringify(r.customSkills||{})),items=Object.assign({},r.items||{});
  let day=r.day,mins=r.timeMinutes,place=r.location,money=r.money,debt=r.debt,hp=r.hp,stamina=r.stamina,
      maxHP=r.maxHP,maxStamina=r.maxStamina;
  const needs=Object.assign({},r.needs);
  const calendar=rpgCalendar(r);let year=calendar.year,month=calendar.month,monthday=calendar.day;
  let budget='free';
  // budget is order-independent.
  for(const row of candidates)if(row.key.toLowerCase()==='budget')budget=row.value.toLowerCase();
  if(!['creation','free'].includes(budget))return 'НАСТРОЙКА НЕ СОХРАНЕНА: budget должен быть creation или free.';
  const integer=(v,min,max)=>/^[-+]?\d+$/.test(v)&&Number.isSafeInteger(+v)&&(+v>=min&&+v<=max)?+v:null;
  const switches={debug:'debug',inventory:'inventoryStrict',needs:'needs',combat:'combat',economy:'economy',magic:'magic',editor:'editor',xp:'xpEnabled'};
  for(const row of candidates){
    const key=row.key,val=row.value,lkey=key.toLowerCase();
    if(lkey==='budget')continue;
    const fail=msg=>'НАСТРОЙКА НЕ СОХРАНЕНА (строка '+row.line+', '+key+'): '+msg;
    if(Object.prototype.hasOwnProperty.call(switches,lkey)){
      if(!/^(on|off)$/i.test(val))return fail('укажи on или off');
      cfg[switches[lkey]]=val.toLowerCase()==='on';continue;
    }
    if(lkey==='ledger'){
      if(!/^(on|off)$/i.test(val))return fail('on/off');
      cfg.ledger=val.toLowerCase()==='on';continue;
    }
    if(lkey==='auto'){
      if(!['off','narrative','classic','smart','cautious'].includes(val.toLowerCase()))return fail('off/narrative/classic/smart/cautious');
      cfg.autoJudge=val.toLowerCase()!=='off';cfg.smartJudge=val.toLowerCase()==='smart';cfg.narrativeJudge=val.toLowerCase()==='narrative';cfg.cautiousJudge=val.toLowerCase()==='cautious';continue;
    }
    if(lkey==='judge_combo'){
      if(!['simple','weighted','detailed'].includes(val.toLowerCase()))return fail('simple/weighted/detailed');
      cfg.judgeCombo=val.toLowerCase();continue;
    }
    if(lkey==='xp_speed'){
      const parsed=rpgXpSpeedParse(val);
      if(!parsed)return fail('xp_speed: '+RPG_XP_SPEED_HELP);
      cfg.xpSpeed=parsed.value;continue;
    }
    if(lkey==='xp_mode'){
      if(!['instant','rest','manual'].includes(val.toLowerCase()))return fail('instant/rest/manual');
      cfg.xpMode=val.toLowerCase();continue;
    }
    if(lkey==='fallback'){
      if(!['safe','story','strict'].includes(val.toLowerCase()))return fail('safe/story/strict');
      cfg.fallback=val.toLowerCase();continue;
    }
    if(['name','gender','job','bio','dream'].includes(lkey)){
      const field={name:'name',gender:'gender',job:'job',bio:'background',dream:'dream'}[lkey];
      const limit={name:120,gender:120,job:120,bio:RPG_CFG.maxBio,dream:RPG_CFG.maxDream}[lkey];
      if(/[\r\n]/.test(val)||Array.from(val).length>limit)return fail('лимит '+limit+' символов');
      if(lkey==='name'&&!val){c.name=c.name&&c.name!=='не задано'?c.name:'Герой';continue;}
      c[field]=val||'не указана';continue;
    }
    if(lkey==='age'){
      const n=val===''?null:integer(val,1,120);
      if(val!==''&&n===null)return fail('возраст 1–120 или пустое поле');
      c.age=n;continue;
    }
    if(lkey==='year'||lkey==='month'||lkey==='day'){
      const ranges={year:[1,9999],month:[1,12],day:[1,30]};
      const n=integer(val,...ranges[lkey]);if(n===null)return fail('число '+ranges[lkey].join('–'));
      if(lkey==='year')year=n;else if(lkey==='month')month=n;else monthday=n;continue;
    }
    if(lkey==='time'){
      const m=val.match(/^(\d{1,2}):(\d{2})$/);
      if(!m||+m[1]>23||+m[2]>59)return fail('формат HH:MM, 00:00–23:59');
      mins=(+m[1])*60+(+m[2]);continue;
    }
    if(lkey==='place'){
      if(Array.from(val).length>100)return fail('максимум 100 символов');
      place=val||'не определена';continue;
    }
    if(['money','debt','maxhp','hp','maxstamina','stamina','hunger','thirst','fatigue'].includes(lkey)){
      const bounds=lkey==='money'?[-1000000,100000000]:lkey==='debt'?[0,100000000]:lkey==='maxhp'||lkey==='maxstamina'?[1,1000]:lkey==='hp'||lkey==='stamina'?[0,1000]:[0,100];
      const n=['money','debt'].includes(lkey)?rpgMoneyParse(val):integer(val,...bounds);if(n===null||n<bounds[0]||n>bounds[1])return fail((['money','debt'].includes(lkey)?'денежная сумма до 2 знаков после точки/запятой, диапазон ':'целое число ')+bounds.join('..'));
      if(lkey==='money')money=n;else if(lkey==='debt')debt=n;else if(lkey==='maxhp')maxHP=n;else if(lkey==='hp')hp=n;
      else if(lkey==='maxstamina')maxStamina=n;else if(lkey==='stamina')stamina=n;else needs[lkey]=n;continue;
    }
    if(/^stat\./i.test(key)){
      const name=rpgName(RPG_STATS,key.slice(5));if(!name)return fail('неизвестная характеристика; :help stat');
      const n=integer(val,budget==='creation'?6:1,budget==='creation'?16:30);
      if(n===null)return fail('диапазон '+(budget==='creation'?'6–16':'1–30'));
      stats[name]=n;continue;
    }
    if(/^skill\./i.test(key)){
      const suffix=key.slice(6),list=RPG_SKILLS.concat(Object.keys(custom));
      const name=rpgName(list,suffix);if(!name)return fail('неизвестный навык; для нового используй custom.Название');
      const n=integer(val,0,budget==='creation'?30:50);
      if(n===null)return fail('диапазон 0–'+(budget==='creation'?30:50));
      skills[name]=n;continue;
    }
    if(/^custom\./i.test(key)){
      const name=key.slice(7).trim();
      if(name.length<2||name.length>40||/[|:=]/.test(name)||rpgName(RPG_SKILLS,name))return fail('имя навыка 2–40 символов, уникально');
      if(Object.keys(custom).length>=40&&!rpgName(Object.keys(custom),name))return fail('не более 40 своих навыков');
      const parts=val.split('|').map(x=>x.trim());
      if(parts.length!==3)return fail('формат: custom.Алхимия=Интеллект | алхим,зелье | 20');
      const attr=rpgName(RPG_STATS,parts[0]),words=rpgSkillWords(parts[1]);
      const level=integer(parts[2],0,budget==='creation'?30:50);
      if(!attr||words===null||level===null)return fail('проверь характеристику, ключи и значение навыка');
      const existing=rpgName(Object.keys(custom),name)||name;
      custom[existing]={attr,keywords:words};skills[existing]=level;continue;
    }
    if(/^item\./i.test(key)){
      const name=key.slice(5).trim();
      const qty=integer(val,0,999);
      if(!name||name.length>80||/[|:=]/.test(name)||qty===null)return fail('формат item.фонарик=1; количество 0–999');
      const old=Object.keys(items).find(x=>x.toLowerCase()===name.toLowerCase())||name;
      if(qty===0)delete items[old];else items[old]=qty;
      if(Object.keys(items).length>RPG_CFG.maxItems)return fail('лимит '+RPG_CFG.maxItems+' предметов');
      continue;
    }
    return fail('неизвестное поле; проверь название в :setup template');
  }
  if(budget==='creation'){
    const b=rpgCharStatBudget(stats),spent=Object.keys(skills).reduce((sum,k)=>sum+(skills[k]||0),0);
    if(RPG_STATS.some(k=>stats[k]<6||stats[k]>16)||b.spend>b.limit)
      return 'НАСТРОЙКА НЕ СОХРАНЕНА: характеристики: потрачено '+b.spend+', доступно '+b.limit+' (макс. возврат 6). Для редактирования опытного героя укажи budget=free.';
    if(spent>60||Object.keys(skills).some(k=>skills[k]<0||skills[k]>30))
      return 'НАСТРОЙКА НЕ СОХРАНЕНА: навыки: потрачено '+spent+'/60, максимум 30 в одном. Используй budget=free для редактирования существующей игры.';
  }
  if(hp>maxHP||stamina>maxStamina)return 'НАСТРОЙКА НЕ СОХРАНЕНА: hp не может быть больше maxhp, stamina — больше maxstamina.';
  if(cfg.ledger&&cfg.autoJudge&&(cfg.smartJudge||cfg.narrativeJudge))return 'НАСТРОЙКА НЕ СОХРАНЕНА: ledger=on несовместим с auto=narrative/smart. Используй ledger=off.';
  if(cfg.magic===false&&skills['Магия']>0)return 'НАСТРОЙКА НЕ СОХРАНЕНА: Магия имеет уровень '+skills['Магия']+', но magic=off. Установи magic=on либо skill.Магия=0.';
  day=(year-1)*360+(month-1)*30+monthday;
  // Commit changes only after successful validation of every field.
  rpgXpInit(r);
  for(const key of Object.keys(skills))if(skills[key]!==r.skills[key])r.xp.skills[key]=0;
  for(const key of RPG_STATS)if(stats[key]!==r.stats[key]){r.xp.attrPoints[key]=0;r.xp.practice[key]=0;}
  r.config=cfg;r.character=c;r.stats=stats;r.skills=skills;r.customSkills=custom;r.items=items;
  r.day=day;r.timeMinutes=mins;r.location=place;r.money=money;r.debt=debt;r.hp=hp;r.stamina=stamina;
  rpgNeedsSyncCheckpoint(r); // setup is a state edit, not gameplay time
  r.maxHP=maxHP;r.maxStamina=maxStamina;r.needs=needs;
  r.setupCompleted=true;
  if(cfg.autoJudge&&(cfg.smartJudge||cfg.narrativeJudge))cfg.ledger=false;
  return 'НАСТРОЙКИ СОХРАНЕНЫ ('+candidates.length+' полей).\n'+
    'Герой: '+(c.name||'не задано')+'; режим судьи: '+(cfg.autoJudge?(cfg.smartJudge?'smart':cfg.narrativeJudge?'narrative':cfg.cautiousJudge?'cautious':'classic'):'off')+
    '; магия '+(cfg.magic?'on':'off')+'; отладка '+(cfg.debug?'on':'off')+'.\n'+
    'Дата: '+rpgClock(r)+'; деньги '+rpgMoneyFormat(r.money)+'; долг '+rpgMoneyFormat(r.debt)+'; предметов '+Object.keys(r.items).length+'.\n'+
    'Остальные данные приключения (заметки, задания, история) не удалялись. :status — проверить результат.';
}

/* v2.24 — transactional command batch. Each entry is literally an existing
 * single RPG command (including its colon); no alternative mini-language.
 * The § marker is mandatory for flattened/one-line input. Without §, actual
 * newlines may be used in Story mode. :apply is an explicit end-of-input guard.
 * Do not call rpgUI or non-deterministic action/roll commands from the draft. */
// v2.25: templates are operation checklists, not lists of every possible user
// value. A single repeatable :skill line and an optional slash-separated
// choice list avoid exceeding the 20-command transaction limit.
const RPG_BATCH_TEMPLATES = {
  hero: [
    ...RPG_STATS.map(x=>':stat '+x+' 10'),
    ':char bio set Краткая биография персонажа',
    ':char bio add Дополнительное событие из биографии',
    ':char bio clear confirm',
    ':char dream set Главная мечта персонажа',
    ':char dream clear confirm'
  ],
  skills: [
    '# Названия стандартных навыков (выбери одно; / означает ИЛИ): '+RPG_SKILLS.join(' / '),
    '# Строку :skill можно скопировать столько раз, сколько нужно.',
    ':skill Атлетика 10',
    ':skill add Акробатика | Ловкость | акробат, сальто',
    ':skill attr Акробатика | Ловкость',
    ':skill bind Акробатика | акробат, сальто',
    ':skill remove Акробатика'
  ],
  inventory: [
    ':give фонарик 2',
    ':take фонарик 1',
    ':rename фонарик | фонарь'
  ],
  resources: [
    ':money +100',
    ':money -10',
    ':debt set 20',
    ':debt add 10',
    ':debt pay 5',
    ':hp +10',
    ':hp -5',
    ':stamina +10',
    ':stamina -5',
    ':needs on',
    ':needs hunger 20',
    ':needs thirst 30',
    ':needs fatigue 15',
    ':needs eat',
    ':needs drink'
  ],
  modifiers: [
    ':mod add Скрытность | +2 | 120 | Концентрация',
    ':mod add Сила | -1 | 60 | Усталость',
    ':mod remove 1',
    ':mod clear confirm',
    ':modifiers remove 1',
    ':modifiers clear confirm',
    ':buff remove 1',
    ':buff clear confirm',
    ':debuff remove 1',
    ':debuff clear confirm'
  ],
  time: [
    ':date set 2 4 15 09:30',
    ':date advance 1',
    ':time set 12:00',
    ':time 30',
    ':place Центральная площадь',
    ':rest 180'
  ],
  notes: [
    '# Тип заметки (выбери один; / означает ИЛИ): '+RPG_NOTE_TYPES.join(' / '),
    ':note Краткий факт без указания категории',
    ':note add факт | Текст записи',
    ':note edit 1 | Исправленный текст записи',
    ':note pin 1',
    ':note unpin 1',
    ':note remove 1',
    ':note clear confirm'
  ],
  quests: [
    '# Возможные статусы: active / done / failed / cancelled (выбери один).',
    ':quest add Найти кузнеца | Узнать, где он работает',
    ':quest status 1 done',
    ':quest edit 1 | Новое название | Новое описание',
    ':quest due 1 | 2 4 15 18:00',
    ':quest due 1 clear',
    ':quest remove 1 confirm'
  ],
  rules: [
    '# Режим auto: on / off / classic / smart / narrative / cautious (выбери один).',
    ':auto classic',
    ':magic on',
    ':ledger on',
    ':debug off',
    ':editor on',
    ':inventory on',
    ':needs on',
    ':combat on',
    ':economy on',
    ':fallback safe',
    ':xp on',
    ':xp mode rest',
    ':xp speed normal',
    ':xp apply',
    ':judge combo weighted',
    ':judge override Ловкость | Скрытность',
    ':judge clear'
  ],
  review: [
    ':review dismiss 1',
    ':review clear confirm'
  ]
};
const RPG_BATCH_MAX_COMMANDS=20;
const RPG_BATCH_MAX_CHARS=3800;
function rpgBatchHelp(){
  return 'ПАКЕТ КОМАНД — :batch template hero/skills/inventory/resources/modifiers/time/notes/quests/rules/review.\n'+
    'Вставь ОДНИМ сообщением (Story предпочтительно):\n'+
    ':batch\n§:stat Сила 12\n§:skill Атлетика 10\n§:apply\n'+
    'Каждая строка — ОБЫЧНАЯ одиночная команда, начинающаяся с :. ' +
    'Знак § перед КАЖДОЙ строкой обязателен при склейке строк AI Dungeon. '+
    'Строки §# комментарий игнорируются. :apply обязателен. '+
    'Проверка на копии: если хотя бы одна команда ошибочна, ни одна не сохраняется. '+
    'До 20 изменений и 3800 символов. Шаблоны перечисляют каждую ОПЕРАЦИЮ один раз: выбери значение, повтори нужные строки, удали остальные. В строках комментариев / означает «или»; изменения по ID требуют реальных номеров. Броски, игровые действия, :setup, создание героя и вложенные пакеты запрещены.';
}
function rpgBatchTemplate(kind){
  const lines=RPG_BATCH_TEMPLATES[kind];
  if(!lines)return 'Неизвестная категория. :batch categories — все категории шаблонов.';
  return rpgSetupFrame([':batch',
    '# '+kind+': каждая ОПЕРАЦИЯ по одному разу. УДАЛИ ненужные команды.',
    '# Меняй ID/значения, при нужде КОПИРУЙ строки. / в подсказках означает выбор.',
    '# Удаление/clear выполняются НАСТОЯЩИМ образом.',
    '# Разделители перед строками обязательны: AI Dungeon склеивает переносы.',
    '# При ошибке весь пакет отклоняется; проверь результат через :status.',
    ...lines, ':apply'].join('\n'));
}
// Output signatures are deliberately strict: an error/help/list response can
// never be mistaken for successful mutation even if it contains user text.
function rpgBatchSuccess(cmd,arg,out){
  if(typeof out!=='string')return false;
  const op=String(arg||'').trim();
  const is=(rx)=>rx.test(op);
  switch(cmd){
    case 'stat': return /^.+ = \d+(?: \(ручное изменение, XP не начислен\))?$/.test(out) && is(/^.+\s+\d+$/);
    case 'skill':
      if(is(/^add\s/i))return out.startsWith('Навык добавлен: ');
      if(is(/^(remove|delete)\s/i))return /^Пользовательский навык «.+» удалён/.test(out);
      if(is(/^(attr|bind)\s/i))return /^.+: (?:характеристика |ключевые фразы )/.test(out);
      return /^.+ = \d+(?: \(ручное изменение, XP не начислен\))?$/.test(out)&&is(/^.+\s+\d+$/);
    case 'char': return is(/^(?:bio|background|dream|goal)\s/i)&&/^(?:Биография|Мечта) (?:сохранена|очищена)/.test(out);
    case 'give': case 'take': return /^.+: \d+ → -?\d+$/.test(out);
    case 'rename': return /^(?:Переименовано:|Название уже верное:)/.test(out);
    case 'money': return /^(?:\[RPG(?: DEBUG)?\] (?:Баланс|ФИНАНСЫ: ручная корректировка баланса)|Баланс не изменён)/.test(out);
    case 'debt': return is(/^(?:add|pay|set)\s/i)&& /^(?:\[RPG(?: DEBUG)?\]|Долг не изменён)/.test(out);
    case 'hp': case 'stamina': return new RegExp('^'+cmd+': \\d+ → \\d+$').test(out);
    case 'place': return out.startsWith('Местоположение: ');
    case 'date': return /^(?:Игровая дата установлена:|Дата продвинута на)/.test(out);
    case 'time': return /^(?:Игровое время установлено:|Время:)/.test(out);
    case 'rest': return out.startsWith('Отдых ');
    case 'mod': case 'modifiers': case 'buff': case 'debuff':
      return /^(?:Добавлен баф:|Добавлен дебаф:|Модификатор #\d+ \(|Снято модификаторов:)/.test(out);
    case 'note':
      return /^(?:Заметка #\d+ \[.+\] добавлена\.|Заметка #\d+ (?:обновлена|удалена)\.|Заметка #\d+: (?:закреплена|откреплена)\.|Удалено \d+ записей журнала\.)/.test(out);
    case 'quest': return /^(?:Задание #\d+(?: (?:добавлено:|изменено\.|удалено\.)|: (?:active|done|failed|cancelled)\.)|Срок (?:задания )?#\d+:|Срок задания #\d+ очищен\.)/.test(out);
    case 'needs': return (is(/^(?:on|off|eat|drink)$/i)&&/^(?:needs: (?:on|off)|Еда: голод |Питьё: жажда )/.test(out)) ||
      (is(/^(?:set\s+)?(?:hunger|thirst|fatigue)\s+\d+$/i)&&/^Потребность (?:голод|жажда|усталость): \d+ → \d+\.$/.test(out));
    case 'judge': return (is(/^combo\s+(?:simple|weighted|detailed)$/i)&&out.startsWith('Режим сочетания навыков: ')) ||
      (is(/^override\s+[^|]+\|.+$/i)&&out.startsWith('Следующая автоматическая проверка: ')) ||
      (is(/^clear$/i)&&out==='Переопределение судьи отменено.');
    case 'review': return (is(/^(?:dismiss|remove)\s+\d+$/i)&&/^Напоминание #\d+ убрано\./.test(out)) ||
      (is(/^clear\s+confirm$/i)&&/^Убрано напоминаний: \d+\./.test(out));
    case 'combat': case 'economy': return is(/^(?:on|off)$/i)&&out===cmd+': '+op.toLowerCase();
    case 'inventory': case 'editor': return /^(?:Строгая проверка инвентаря|Контроль редактора): (?:on|off)$/.test(out);
    case 'auto': return /^(?:Автосудья: (?:classic|smart|narrative|cautious)|Автопроверки: (?:on|off))/.test(out);
    case 'magic': return /^Магия: (?:on|off)$/.test(out);
    case 'ledger': return /^Автоучёт событий: (?:on|off)$/.test(out);
    case 'debug': return /^Отладка: (?:on|off)$/.test(out);
    case 'fallback': return /^Режим резервной обработки: (?:safe|story|strict)/.test(out);
    case 'xp': return (is(/^(?:on|off|mode\s|speed\s)/i)&&/^(?:Развитие: (?:on|off)\.|Повышение: (?:instant|rest|manual)\.|Скорость накопления XP: (?:ручная )?(?:slow|normal|fast|\d+(?:\.\d+)?) \(×)/.test(out)) ||
      (is(/^apply$/i)&&(out==='Пока нет готовых повышений. :xp — прогресс.'||/^(?:Навык |Характеристика |Повышен )/.test(out)));
    default: return false;
  }
}
function rpgBatchCommand(r,arg){
  const raw=String(arg||'').trim();
  if(!raw||/^help$/i.test(raw))return rpgBatchHelp();
  if(/^categories$/i.test(raw))return Object.keys(RPG_BATCH_TEMPLATES).join(', ');
  const template=raw.match(/^template\s+([a-z]+)$/i);
  if(template)return rpgBatchTemplate(template[1].toLowerCase());
  if(/^template$/i.test(raw))return rpgBatchHelp();
  if(raw.length+7>RPG_BATCH_MAX_CHARS)return 'ПАКЕТ ОТКЛОНЁН: превышен безопасный лимит '+RPG_BATCH_MAX_CHARS+' символов. Раздели пакет.';
  let entries;
  if(raw.includes('§')){
    const parts=raw.split('§');
    if(parts[0].trim())return 'ПАКЕТ ОТКЛОНЁН: перед первым § обнаружен текст. Скопируй шаблон целиком.';
    entries=parts.slice(1).map(x=>x.trim()).filter(Boolean);
  }else{
    entries=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(entries.length===1)return 'ПАКЕТ ОТКЛОНЁН: строки склеены AI Dungeon. Перед каждой командой поставь §. См. :help batch.';
  }
  if(entries.length===0||!/^:apply\s*[.!?]?$/i.test(entries[entries.length-1]))
    return 'ПАКЕТ ОТКЛОНЁН: не получен завершающий §:apply. Ничего не изменено.';
  entries.pop();
  entries=entries.filter(x=>!/^#/.test(x));
  if(!entries.length||entries.length>RPG_BATCH_MAX_COMMANDS)return 'ПАКЕТ ОТКЛОНЁН: нужно 1–'+RPG_BATCH_MAX_COMMANDS+' команд (строки # не считаются).';
  let draft;
  try{draft=JSON.parse(JSON.stringify(r));}
  catch(e){return 'ПАКЕТ ОТКЛОНЁН: состояние невозможно безопасно скопировать.';}
  const results=[];
  for(let i=0;i<entries.length;i++){
    const line=entries[i];
    // rpgParseCommand strips punctuation in the same way as the normal Input.
    const c=rpgParseCommand(line);
    if(!c||!line.startsWith(':')||!c.arg||c.cmd==='batch'||c.cmd==='rpg'||c.cmd==='aidm')
      return 'ПАКЕТ ОТКЛОНЁН: строка '+(i+1)+' — недопустима команда (или нужен аргумент). :rpg выполняется только отдельно: '+line.slice(0,110);
    let result;
    try{result=rpgCommand(draft,c.cmd,c.arg);}
    catch(e){return 'ПАКЕТ ОТКЛОНЁН: строка '+(i+1)+' вызвала ошибку; состояние не изменено.';}
    if(!rpgBatchSuccess(c.cmd,c.arg,result))
      return 'ПАКЕТ ОТКЛОНЁН: строка '+(i+1)+' ('+line.slice(0,90)+').\nПричина: '+String(result||'команда недоступна в пакете').slice(0,260)+'\nНи одно изменение не сохранено.';
    results.push((i+1)+'. '+String(result).split('\n')[0].slice(0,150));
  }
  // Preserve the identity of the state.rpg object for the surrounding hook.
  for(const k of Object.keys(r))delete r[k];
  Object.assign(r,draft);
  const summary=results.join('\n');
  return 'ПАКЕТ ПРИМЕНЁН: '+results.length+' команд. Все изменения сохранены.\n'+
    (summary.length>2400?summary.slice(0,2400)+'\n… (список сокращён; результат сохранён) ':summary);
}


/* ---------- v2.28 — manual export to an exchange Story Card ----------
 * Source of truth: state.rpg only. No references to Memory Engine state.
 * The marker in Entry and reserved Keys together identify our own card.
 */
const RPG_AIDM_CARD_KEY='__AID_RPG_EXPORT_V1__';
const RPG_AIDM_CARD_MARKER='[AID_RPG_EXPORT:1]';
const RPG_AIDM_JSON_LIMIT=5000;
function rpgAidmText(value,max){
  if(typeof value!=='string')return '';
  const s=value.replace(/\s+/g,' ').trim();
  if(!s||/^(?:не задано|не задан|не указана|не указан|не определена|не определено)$/i.test(s))return '';
  return Array.from(s).slice(0,max).join('');
}
function rpgAidmClock(r){
  const minute=r.timeMinutes;
  return Number.isInteger(minute)&&minute>=0&&minute<1440?
    String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0'):'';
}
function rpgAidmDate(r){
  if(!Number.isSafeInteger(r.day)||r.day<1||r.day>9999*360)return '';
  const d=rpgCalendar(r),year=d.year,month=d.month,day=d.day;
  // Universal RPG has 30-day months, but the receiver requires a real YYYY-MM-DD.
  // Impossible Gregorian dates (e.g. February 30) must be OMITTED, not changed.
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const lengths=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(year<1||year>9999||month<1||month>12||day<1||day>lengths[month-1])return '';
  return String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
}
function rpgAidmNumberOrText(value){
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value==='string')return rpgAidmText(value,90)||null;
  return null;
}
function rpgAidmSnapshot(r){
  const hero=r.character||{};
  const name=rpgAidmText(hero.name,81);
  if(Array.from(name).length<2||Array.from(name).length>80)
    return {error:'Нужно задать настоящее имя персонажа длиной 2–80 символов. Используй :char create / :char name / :char done либо :setup.'};
  const doc={source:'Universal RPG',version:1,hero:{name}};
  for(const [out,key,max] of [
    ['race','race',90],['class','class',90],['bio','background',650],
    ['appearance','appearance',220],['occupation','occupation',120]]){
    const raw=out==='occupation'?(hero.occupation||hero.job):hero[key];
    const val=rpgAidmText(raw,max);
    if(val)doc.hero[out]=val;
  }
  const location=rpgAidmText(r.location,90);
  if(location)doc.location=location;
  const date=rpgAidmDate(r);
  if(date)doc.date=date;
  const time=rpgAidmClock(r);
  if(time)doc.time=time;
  const stats=Object.create(null);
  for(const name of RPG_STATS){
    if(!r.stats||!Object.prototype.hasOwnProperty.call(r.stats,name))continue;
    const val=rpgAidmNumberOrText(r.stats[name]);
    if(val!==null)stats[rpgAidmText(name,60)]=val;
  }
  if(Object.keys(stats).length)doc.stats=stats;
  const allSkills=Object.keys(r.skills||{}).filter(k=>{
    const n=rpgAidmNumberOrText(r.skills[k]);
    return n!==null&&(typeof n!=='number'||n>0);
  }).sort((a,b)=>{
    // Prefer higher learned skills, then a stable, locale-aware name ordering.
    const av=Number(r.skills[a])||0,bv=Number(r.skills[b])||0;
    return bv-av||a.localeCompare(b,'ru');
  });
  const skills=Object.create(null);
  for(const rawName of allSkills){
    if(Object.keys(skills).length>=50)break;
    const name=rpgAidmText(rawName,60),value=rpgAidmNumberOrText(r.skills[rawName]);
    if(name&&value!==null&&!Object.prototype.hasOwnProperty.call(skills,name))skills[name]=value;
  }
  if(Object.keys(skills).length)doc.skills=skills;
  const items=Object.keys(r.items||{}).sort((a,b)=>a.localeCompare(b,'ru'));
  const inventory=[];
  for(const rawName of items){
    if(inventory.length>=60)break;
    const qty=r.items[rawName],name=rpgAidmText(rawName,75);
    if(!name||!Number.isFinite(qty)||qty<=0)continue;
    const entry=rpgAidmText(name+' ×'+qty,90);
    if(entry)inventory.push(entry);
  }
  if(inventory.length)doc.inventory=inventory;
  const journal=Array.isArray(r.journal)?r.journal:[];
  // Important (pinned) first, then most recent, without changing the actual journal.
  const selected=journal.filter(x=>x&&x.pinned).slice().reverse()
    .concat(journal.filter(x=>x&&!x.pinned).slice().reverse());
  const notes=[];
  for(const note of selected){
    if(notes.length>=15)break;
    const content=rpgAidmText(note.text,220);
    if(content)notes.push(content);
  }
  if(notes.length)doc.notes=notes;
  // The 5,000-character budget is for serialized JSON, not Entry or bytes.
  // Prefer keeping core hero data, attributes, learned skills and some facts.
  const sizes={notes:doc.notes?doc.notes.length:0,inventory:doc.inventory?doc.inventory.length:0,
    skills:doc.skills?Object.keys(doc.skills).length:0};
  let json=JSON.stringify(doc),dropped=0;
  const sizeOf=(kind)=>kind==='skills'?Object.keys(doc.skills||{}).length:(doc[kind]||[]).length;
  const drop=(kind)=>{
    if(kind==='skills'){
      const keys=Object.keys(doc.skills||{});if(!keys.length)return false;
      delete doc.skills[keys[keys.length-1]];
    }else{
      if(!doc[kind]||!doc[kind].length)return false;
      doc[kind].pop();
    }
    if(sizeOf(kind)===0)delete doc[kind];
    dropped++;return true;
  };
  for(let i=0;json.length>RPG_AIDM_JSON_LIMIT&&i<500;i++){
    // Keep at least five notes, ten items and ten skills when the budget allows.
    const first=['notes','inventory','skills'].find(k=>sizeOf(k)>{notes:5,inventory:10,skills:10}[k]);
    const next=first||['notes','inventory','skills'].find(k=>sizeOf(k)>0);
    if(!next||!drop(next))break;
    json=JSON.stringify(doc);
  }
  if(json.length>RPG_AIDM_JSON_LIMIT)
    return {error:'JSON превышает 5000 символов даже после сокращения массивов. Экспорт отменён.'};
  let parsed;
  try{parsed=JSON.parse(json);}catch(e){return {error:'Ошибка сериализации JSON; экспорт отменён.'};}
  if(parsed.source!=='Universal RPG'||parsed.version!==1||!parsed.hero||
     typeof parsed.hero.name!=='string'||Array.from(parsed.hero.name).length<2||
     Array.from(parsed.hero.name).length>80)
    return {error:'JSON не прошёл проверку обязательных полей; экспорт отменён.'};
  return {entry:RPG_AIDM_CARD_MARKER+'\n'+json,jsonChars:json.length,
    counts:{stats:Object.keys(doc.stats||{}).length,skills:Object.keys(doc.skills||{}).length,
      inventory:(doc.inventory||[]).length,notes:(doc.notes||[]).length},
    omitted:dropped,invalidDate:!date&&Number.isSafeInteger(r.day)};
}
function rpgAidmCardLookup(){
  if(typeof storyCards==='undefined'||!Array.isArray(storyCards))
    return {error:'Story Cards недоступны в этом скриптовом хуке.'};
  const marked=[],collisions=[];
  for(let i=0;i<storyCards.length;i++){
    const card=storyCards[i];if(!card||typeof card!=='object')continue;
    const entry=typeof card.entry==='string'?card.entry:'';
    if(entry.startsWith(RPG_AIDM_CARD_MARKER))marked.push(i);
    const keys=Array.isArray(card.keys)?card.keys:String(card.keys||'').split(',');
    if(keys.some(x=>String(x).trim()===RPG_AIDM_CARD_KEY))collisions.push(i);
  }
  if(marked.length>1)return {error:'Найдено несколько карточек с маркером RPG. Автоматическое обновление отменено во избежание потери данных.'};
  if(marked.length){
    const index=marked[0],card=storyCards[index];
    if(card.keys!==RPG_AIDM_CARD_KEY||String(card.type||'').toLowerCase()!=='custom')
      return {error:'Карточка с маркером имеет другие Keys или Type. Изменение запрещено; проверь карточки вручную.'};
    if(collisions.some(i=>i!==index))
      return {error:'Другой пользовательской карточке назначены зарезервированные Keys. Экспорт отменён без перезаписи.'};
    return {index,mode:'update'};
  }
  if(collisions.length)return {error:'Keys '+RPG_AIDM_CARD_KEY+' уже заняты другой карточкой. Экспорт отменён без перезаписи.'};
  return {mode:'create'};
}
function rpgAidmCommand(r,arg){
  const mode=String(arg||'').trim().toLowerCase();
  if(!mode||mode==='help')return rpgHelp(r,'aidm');
  if(!['export','status'].includes(mode))return 'Команды: :aidm export / :aidm status / :help aidm. Ничего не изменено.';
  const snapshot=rpgAidmSnapshot(r);
  if(snapshot.error)return 'ЭКСПОРТ RPG: '+snapshot.error;
  const lookup=rpgAidmCardLookup();
  if(lookup.error)return 'ЭКСПОРТ RPG: '+lookup.error;
  const summary='JSON '+snapshot.jsonChars+'/5000; характеристики '+snapshot.counts.stats+
    ', навыки '+snapshot.counts.skills+', предметы '+snapshot.counts.inventory+
    ', заметки '+snapshot.counts.notes+'.'+
    (snapshot.omitted?' Убрано записей из-за лимита: '+snapshot.omitted+'.':'')+
    (snapshot.invalidDate?' Игровая дата не соответствует григорианскому календарю и не включена.':'');
  if(mode==='status')return 'AIDM RPG: '+(lookup.mode==='update'?'обменная карточка #'+lookup.index+' найдена.':'обменная карточка ещё не создана.')+'\n'+summary+'\n:aidm export — создать или обновить.';
  try{
    if(lookup.mode==='update'){
      if(typeof updateStoryCard!=='function')return 'ЭКСПОРТ RPG: updateStoryCard недоступна; ничего не обновлено.';
      const updated=updateStoryCard(lookup.index,RPG_AIDM_CARD_KEY,snapshot.entry,'Custom');
      if(updated===false)return 'ЭКСПОРТ RPG: updateStoryCard отклонила обновление; проверь карточку.';
      return 'ЭКСПОРТ RPG ОБНОВЛЁН: карточка #'+lookup.index+'. '+summary+'\nВ Memory Engine выполни ;mem import rpg card.';
    }
    if(typeof addStoryCard!=='function')return 'ЭКСПОРТ RPG: addStoryCard недоступна; карточка не создана.';
    const idx=addStoryCard(RPG_AIDM_CARD_KEY,snapshot.entry,'Custom');
    if(idx===false)return 'ЭКСПОРТ RPG: addStoryCard отклонила создание (возможно, конфликт Keys); данные не записаны.';
    return 'ЭКСПОРТ RPG СОЗДАН: '+RPG_AIDM_CARD_KEY+'. '+summary+'\nВ Memory Engine выполни ;mem import rpg card.';
  }catch(e){
    return 'ЭКСПОРТ RPG: ошибка Story Card API ('+rpgAidmText(e&&e.message||'неизвестная ошибка',120)+'). Состояние RPG не сброшено.';
  }
}

/* ---------- v2.27 — RPG state maintenance with deletion previews ----------
 * :rpg memory clear confirm  : remove stored narrative/history records only
 * :rpg reset confirm         : replace the RPG object with the fresh defaults
 * :rpg uninstall confirm     : delete state.rpg and suspend hooks until reset
 * The removal sentinel is deliberately outside state.rpg, because hooks would
 * otherwise silently re-create state.rpg during Context/Output or next turn.
 */
function rpgMaintenanceMemoryInventory(r){
  // These are EXACTLY the lists reset by the memory-clear branch below.
  // Keep this inventory aligned with that branch; do not include retained XP.
  const count=a=>Array.isArray(a)?a.length:0;
  const objCount=o=>o&&typeof o==='object'&&!Array.isArray(o)?Object.keys(o).length:0;
  const parts=[
    ['Заметки (journal)', count(r.journal)],
    ['Старые заметки (notes)', count(r.notes)],
    ['Задания (quests)', count(r.quests)],
    ['Краткая память (recent)', count(r.recent)],
    ['Предложения рассказчика (reviewItems)', count(r.reviewItems)],
    ['История бросков (rolls)', count(r.rolls)],
    ['Финансовые события (financeLog)', count(r.financeLog)],
    ['События автоучёта (autoEvents)', count(r.autoEvents)],
    ['Повышения XP (xp.log)', count(r.xp&&r.xp.log)],
    ['Следы повторений XP (xp.recent)', count(r.xp&&r.xp.recent)],
    ['Уведомления XP (xp.notices)', count(r.xp&&r.xp.notices)],
    ['Уведомления модификаторов (modifierNotices)', count(r.modifierNotices)]
  ];
  const flagCount=objCount(r.flags);
  const oneOff=['lastJudgement','lastAction','pendingRoll','pendingSecondaryRoll',
    'pendingSmart','pendingAction','pendingEffects','nextJudgeOverride','pendingCheck'];
  const present=oneOff.filter(k=>r[k]!==undefined&&r[k]!==null&&r[k]!==''&&r[k]!==false);
  const total=parts.reduce((sum,x)=>sum+x[1],0);
  return {parts,total,flagCount,present};
}
function rpgMaintenanceFullInventory(r){
  const count=o=>o&&typeof o==='object'&&!Array.isArray(o)?Object.keys(o).length:0;
  const fields=count(r),stats=count(r.stats),skills=count(r.skills),custom=count(r.customSkills);
  const statsChanged=Object.keys(r.stats||{}).filter(k=>r.stats[k]!==10).length;
  const skillsChanged=Object.keys(r.skills||{}).filter(k=>Number(r.skills[k])!==0).length;
  const items=count(r.items),itemUnits=Object.keys(r.items||{}).reduce((sum,k)=>sum+(Number(r.items[k])||0),0);
  const xp=r.xp||{}, xpSkillActive=Object.keys(xp.skills||{}).filter(k=>Number(xp.skills[k])>0).length;
  const xpAttrActive=Object.keys(xp.attrPoints||{}).filter(k=>Number(xp.attrPoints[k])>0).length;
  const xpPracticeActive=Object.keys(xp.practice||{}).filter(k=>Number(xp.practice[k])>0).length;
  let jsonSize=0;
  try{jsonSize=JSON.stringify(r).length;}catch(e){jsonSize=-1;}
  const memories=rpgMaintenanceMemoryInventory(r);
  return [
    'Всё содержимое state.rpg: '+fields+' полей верхнего уровня'+(jsonSize>=0?', '+jsonSize+' символов JSON':'')+'.',
    'Персонаж: '+(r.character?'1 профиль ('+count(r.character)+' полей)':'нет профиля')+
      (r.characterDraft?'; 1 черновик создания':'')+'.',
    'Характеристики: '+stats+' (не равны стартовым 10: '+statsChanged+'); навыки: '+skills+
      ' (уровень выше 0: '+skillsChanged+'), пользовательские навыки: '+custom+'.',
    'Инвентарь: '+items+' позиций, '+itemUnits+' единиц; временные модификаторы: '+(r.modifiers||[]).length+'.',
    'XP: навыков с накопленным опытом '+xpSkillActive+', характеристик с очками '+xpAttrActive+
      ', с практикой '+xpPracticeActive+'.',
    'Ресурсы: HP '+r.hp+'/'+r.maxHP+', выносливость '+r.stamina+'/'+r.maxStamina+
      ', голод '+(r.needs&&r.needs.hunger||0)+', жажда '+(r.needs&&r.needs.thirst||0)+
      ', усталость '+(r.needs&&r.needs.fatigue||0)+'.',
    'Деньги: '+r.money+'; долг: '+r.debt+'; время: день '+r.day+', минута '+r.timeMinutes+
      '; настройки: '+count(r.config)+'.',
    'Память и журналы: '+memories.total+' записей в списках, '+memories.flagCount+
      ' флагов, '+memories.present.length+' ожидающих/служебных значений.'
  ];
}
function rpgMaintenancePreview(r,kind){
  const heading={
    'memory clear':'ПРЕДПРОСМОТР ОЧИСТКИ ПАМЯТИ',
    reset:'ПРЕДПРОСМОТР ПОЛНОГО СБРОСА',
    uninstall:'ПРЕДПРОСМОТР УДАЛЕНИЯ СКРИПТА'
  }[kind];
  if(!heading)return '';
  const lines=[heading+' — состояние не изменено.'];
  if(kind==='memory clear'){
    const m=rpgMaintenanceMemoryInventory(r);
    lines.push('Из state.rpg будут очищены:');
    for(const [name,n] of m.parts)lines.push('• '+name+': '+n);
    lines.push('• Сюжетные флаги (flags): '+m.flagCount);
    lines.push('• Ожидающие действия и решения: '+m.present.length+
      (m.present.length?' ('+m.present.join(', ')+')':''));
    lines.push('ИТОГО: '+m.total+' записей в списках, '+m.flagCount+' флагов, '+
      m.present.length+' ожидающих/служебных значений. Счётчики ID заметок, заданий и напоминаний будут сброшены к 1.');
    lines.push('СОХРАНЯТСЯ: герой и биография, характеристики, навыки, накопленный XP, инвентарь, '+
      'деньги и долг, потребности, HP, выносливость, дата, модификаторы и настройки.');
  }else{
    lines.push(kind==='reset'?'Все текущие данные RPG будут заменены стандартным состоянием:':
      'Будет полностью удалён объект state.rpg, включая:');
    for(const line of rpgMaintenanceFullInventory(r))lines.push('• '+line);
    lines.push('Разбивка памяти и журналов:');
    for(const [name,n] of rpgMaintenanceMemoryInventory(r).parts)lines.push('  — '+name+': '+n);
    if(kind==='reset')lines.push('ПОСЛЕ СБРОСА: характеристики по 10, навыки по 0, '+
      'HP/выносливость по 100, деньги/долг/потребности/XP по 0, пустые предметы и журналы; '+
      'имя и пол могут заново заполниться из начальных полей сценария.');
    else lines.push('ПОСЛЕ УДАЛЕНИЯ: RPG-хуки отключатся; останется только '+
      'state.aidUniversalRpgRemoved=true для защиты от повторного создания базы.');
    lines.push('Другие ключи state (кроме служебных данных RPG) не затрагиваются.');
  }
  lines.push('История чата и отдельная память AI Dungeon не удаляются.');
  lines.push('Для выполнения введи: :rpg '+kind+' confirm');
  return lines.join('\n');
}
function rpgDataSummary(r){
  const m=rpgMaintenanceMemoryInventory(r);
  return 'ХРАНИЛИЩЕ RPG: state.rpg (сохранение присутствует).\n'+
    'Записей истории/журналов: '+m.total+'; флагов: '+m.flagCount+
    '; ожидающих/служебных значений: '+m.present.length+'.\n'+
    'Предпросмотр без удаления: :rpg memory clear / :rpg reset / :rpg uninstall.\n'+
    'Для выполнения добавь confirm. Все три операции необратимы.';
}
function rpgMaintenanceCommand(r,arg){
  const action=String(arg||'').trim().toLowerCase().replace(/\s+/g,' ');
  if(!action||action==='help')return rpgHelp(r,'rpg');
  if(action==='status')return rpgDataSummary(r);
  if(['memory clear','reset','uninstall'].includes(action))return rpgMaintenancePreview(r,action);
  if(action==='memory clear confirm'){
    const summary=rpgMaintenanceMemoryInventory(r);
    r.notes=[];r.journal=[];r.nextNoteId=1;
    r.quests=[];r.nextQuestId=1;
    r.recent=[];r.reviewItems=[];r.nextReviewId=1;
    r.rolls=[];r.financeLog=[];r.autoEvents=[];r.flags={};
    r.lastJudgement='';r.lastAction='';
    r.pendingRoll=null;r.pendingSecondaryRoll=null;r.pendingSmart=null;
    r.pendingAction=null;r.pendingEffects=null;r.nextJudgeOverride=null;r.pendingCheck=null;
    r.modifierNotices=[];
    if(r.xp){r.xp.log=[];r.xp.recent=[];r.xp.notices=[];}
    return 'ПАМЯТЬ RPG ОЧИЩЕНА: '+summary.total+' записей истории/журналов, '+summary.flagCount+' флагов, '+summary.present.length+' ожидающих/служебных значений; счётчики ID сброшены. '+
      'Персонаж, биография, характеристики, навыки, XP, деньги, предметы, модификаторы, время и настройки сохранены. '+
      'История чата AI Dungeon не удалена.';
  }
  if(action==='reset confirm'){
    // Keep the object identity because Input/Output hold references to it.
    const fresh=rpgDefaultState();
    for(const key of Object.keys(r))delete r[key];
    Object.assign(r,fresh);
    rpgInit();
    delete state.message;
    return 'RPG СБРОШЕНА: создано состояние по умолчанию в state.rpg. '+
      'Герой взят из начальных полей сценария (если заданы); остальной прогресс, логи и настройки удалены. '+
      'Другие ключи state и история чата AI Dungeon не затронуты.';
  }
  if(action==='uninstall confirm'){
    // All four hooks must recognize the sentinel BEFORE calling rpgInit().
    // The one root-level flag remains by design to prevent recreation while
    // the script is still installed. The notice is consumed by Output.
    state.aidUniversalRpgRemoved=true;
    delete state.rpg;
    delete state.message;
    state.aidUniversalRpgNotice='RPG УДАЛЕНА ИЗ STATE: state.rpg удалён. '+
      'Обработка RPG остановлена. Теперь удали Library/Input/Context/Output из сценария. '+
      'Флаг state.aidUniversalRpgRemoved остаётся, пока скрипты установлены, чтобы база не создалась снова. '+
      'Для отмены удаления: :rpg reset confirm (создаст новую игру). '+
      'История чата AI Dungeon не удалена.';
    return state.aidUniversalRpgNotice;
  }
  return 'Неверная или неподтверждённая команда: состояние не изменено. '+
    'Справка: :help rpg. Для предпросмотра: :rpg memory clear / :rpg reset / :rpg uninstall. Для выполнения добавь confirm.';
}

/* v2.29 — полуавтоматический ручной судья. Никаких LLM-вызовов и скрытых бросков в preview. */
const RPG_DIFFICULTY_WORDS=[
  {label:'пустяк',dc:5,re:/(?:(?<![а-я])пустяк(?![а-я])|проще простого|раз плюнуть|элементарно|легкотня|пустяковое|совсем просто)/iu},
  {label:'легко',dc:9,re:/(?:(?<![а-я])легко(?![а-я])|(?<![а-я])нетрудно(?![а-я])|(?<![а-я])несложно(?![а-я])|(?<![а-я])просто(?![а-я])|не составляет труда|без особых усилий)/iu},
  {label:'средне',dc:13,re:/(?:(?<![а-я])средне(?![а-я])|(?<![а-я])обычная сложность(?![а-я])|(?<![а-я])средняя сложность(?![а-я])|(?<![а-я])умеренно(?![а-я])|(?<![а-я])умеренная сложность(?![а-я])|ни легко ни сложно|не слишком сложно)/iu},
  {label:'сложно',dc:19,re:/(?:(?<![а-я])сложно(?![а-я])|(?<![а-я])трудно(?![а-я])|(?<![а-я])непросто(?![а-я])|(?<![а-я])тяжело(?![а-я])|очень сложно|очень трудно|трудная задача|сложная задача)/iu},
  {label:'невозможно',dc:30,re:/(?:(?<![а-я])невозможно(?![а-я])|(?<![а-я])нереально(?![а-я])|почти невозможно|почти нереально|запредельно трудно|практически невозможно)/iu}
];
function rpgSemiNormalize(s){return String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[\s]+/g,' ').trim();}
function rpgSemiDifficulty(raw){
  const text=rpgSemiNormalize(raw);
  const direct=text.match(/(?:сложность|трудность|dc)\s*[:=\-]?\s*(пустяк|легко|средне|сложно|невозможно|\d{1,2})(?![а-яa-z0-9])/iu);
  if(direct){
    if(/^\d+$/.test(direct[1])){const dc=+direct[1];return dc>=5&&dc<=30?{dc,label:'DC '+dc,explicit:true,token:direct[0]}:{error:'Сложность DC должна быть 5–30.'};}
    const d=RPG_DIFFICULTY_WORDS.find(x=>x.label===direct[1]);
    if(d)return {dc:d.dc,label:d.label,explicit:true,token:direct[0]};
  }
  // Standalone evaluations, not adjectives about a person/item. Multiple conflicting tiers require clarification.
  const hits=RPG_DIFFICULTY_WORDS.filter(x=>x.re.test(text));
  // Negation should not be misread as an easy roll: «не просто» is difficult.
  if(/(?:не слишком сложно|не так уж сложно)/iu.test(text))return {dc:13,label:'средне',explicit:true,token:'не слишком сложно'};
  if(/(?:не сложно|не трудно|не тяжело)/iu.test(text))return {dc:9,label:'легко',explicit:true,token:'не сложно'};
  if(/(?<![а-я])не просто(?![а-я])|(?<![а-я])не легко(?![а-я])|(?<![а-я])не пустяк(?![а-я])|нелегко/iu.test(text))return {dc:19,label:'сложно',explicit:true,token:'не просто'};
  if(hits.length>1){
    // Prefer stronger idioms first: «почти невозможно» must not be shadowed by «сложно».
    if(hits.some(x=>x.label==='невозможно')&&/почти невозмож|практически невозмож|почти нереаль/iu.test(text))return {dc:30,label:'невозможно',explicit:true,token:'почти невозможно'};
    return {error:'В описании несколько разных оценок сложности. Укажи одну, например «сложность: сложно».'};
  }
  return hits.length?{dc:hits[0].dc,label:hits[0].label,explicit:true,token:hits[0].label}:null;
}
function rpgSemiStripDifficulty(s,d){
  if(!d||!d.token)return s;
  return String(s).replace(new RegExp(d.token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'iu'),' ').replace(/\s+/g,' ').trim();
}
function rpgSemiStem(s){
  return rpgSemiNormalize(s).replace(/[^а-яa-z0-9 ]/g,'').split(' ').filter(Boolean).map(w=>
    w.length<=4?w:w.replace(/(?:иями|ями|иями|ами|ого|ему|ыми|ими|ение|ания|ению|анием|ений|ние|ния|ний|ной|ным|ных|ого|ами|ями|ую|ий|ый|ая|ое|ов|ев|ом|ем|ей|ии|ие|ия|ию|ам|ям|ах|ях|а|у|ы|е|и|о|я|ю)$/u,'').slice(0,Math.max(4,w.length-2)));
}
function rpgSemiWordMatch(text,name){
  const words=rpgSemiStem(name);
  if(!words.length)return false;
  const normalized=rpgSemiNormalize(text).replace(/[^а-яa-z0-9 ]/g,' ');
  const tokens=normalized.split(/\s+/).filter(Boolean);
  for(let i=0;i<=tokens.length-words.length;i++){
    if(words.every((word,k)=>tokens[i+k].startsWith(word.slice(0,Math.max(3,Math.min(6,word.length)))) &&
      Math.abs(tokens[i+k].length-rpgSemiNormalize(name).split(' ')[k].length)<=3))return true;
  }
  return false;
}
function rpgSemiExplicitSkill(r,head){
  const s=rpgSemiNormalize(head),list=rpgSkillList(r);
  const hint=s.match(/(?:(?<![а-я])навык(?:и|ами|ом|а|ов)?(?![а-я])|(?<![а-я])умени(?:е|я|ями|ем)(?![а-я]))\s+(.+)/u);
  if(hint){
    const names=list.filter(x=>rpgSemiWordMatch(hint[1],x));
    if(names.length===1)return {skill:names[0],explicit:true};
    if(names.length>1)return {error:'Указано несколько навыков: '+names.join(', ')+'. Уточни один.'};
    const guessed=hint[1].split(/[,;]|\s+(?:под|сложность|чтобы|для)(?![а-я])/iu)[0].trim();
    return {error:'Навык «'+rpgClean(guessed,60)+'» не найден. :skill list / :skill add. Навык не создаётся автоматически.'};
  }
  // Without the cue «навык» do not mistake effect reasons («под вдохновением»)
  // or ordinary adjectives for a deliberately selected skill.
  const direct=rpgName(list,s);
  return direct?{skill:direct,explicit:true}:null;
}
function rpgSemiExplicitAttr(head){
  const s=rpgSemiNormalize(head);
  const patterns=[
    ['Внешность',/красот(?:ой|ою|е|а)|внешност(?:ью|и)|привлекательност(?:ью|и)|красивой внешност/iu],
    ['Интеллект',/логик(?:ой|е|а|у)|умом|интеллект(?:ом|а)|рассуждени(?:ем|ями)|научн(?:ым|ой) методом/iu],
    ['Сила',/силой|использую силу|грубой силой|мускулами/iu],
    ['Ловкость',/ловкост(?:ью|и)|проворств(?:ом|а)|координацией/iu],
    ['Выносливость',/выносливост(?:ью|и)|стойкостью|терпением/iu],
    ['Восприятие',/наблюдательност(?:ью|и)|внимательност(?:ью|и)|зоркост(?:ью|и)/iu],
    ['Воля',/силой воли|волевым усилием|сил(?:ой|ы) духа/iu],
    ['Обаяние',/харизм(?:ой|е)|обаяни(?:ем|я)|дружелюбием/iu],
    ['Смекалка',/смекалк(?:ой|е)|находчивост(?:ью|и)|импровизацией/iu]
  ];
  for(const [attr,re] of patterns)if(re.test(s))return attr;
  return RPG_STATS.find(x=>rpgSemiWordMatch(s,x))||'';
}
function rpgSemiRuleCandidates(r,text){
  const s=rpgSemiNormalize(text),out=[];
  function push(test,attr,skill,dc,reason){
    if(test.test(s))out.push({kind:'semantic',attr,skill,dc,reason,score:30});
  }
  push(/обольщ|соблазня|соблазнить|флирт|очаровыва|очаровать|заигрыва/iu,'Обаяние','Переговоры',14,'социальное сближение');
  push(/рисую|нарис|рисова|портрет|иллюстраци|эскиз|набросок/iu,'Смекалка','Ремесло',13,'изобразительная работа (если создан навык Рисование, можно указать его явно)');
  push(/черт[её]ж|черчени|вычерчив|черчу|чертить/iu,'Интеллект','Технологии',14,'технический чертёж');
  push(/поднимаю тяж|сдвигаю камень|тяну тяж|волоку груз/iu,'Сила','Атлетика',15,'физическая сила');
  push(/лечу ран|перевязыв|оказыва[юю] первую помощ|диагностир|осматриваю ран/iu,'Интеллект','Медицина',14,'медицинская помощь');
  push(/ищу след|изучаю улик|расследу|собираю доказательства/iu,'Восприятие','Расследование',14,'исследование улик');
  push(/убеждаю|уговариваю|доказываю|аргументирую/iu,'Обаяние','Переговоры',13,'убеждение');
  return out;
}
function rpgSemiPlan(r,raw){
  const input=String(raw||'').trim();
  if(!input||input.length>500)return {error:'Опиши действие (до 500 символов): :check рисую под вдохновением | портрет с натуры'};
  const sections=input.split('|');
  if(sections.length>2)return {error:'Нужен один разделитель | между способом и описанием действия.'};
  let head=sections[0].trim(),act=(sections[1]||'').trim();
  const difficulty=rpgSemiDifficulty(head);
  if(difficulty&&difficulty.error)return {error:difficulty.error};
  head=rpgSemiStripDifficulty(head,difficulty);
  const actionDifficulty=act.match(/(?:сложность|трудность|dc)\s*[:=\-]?\s*(?:пустяк|легко|средне|сложно|невозможно|\d{1,2})\b/iu);
  let fromAction=null;
  if(actionDifficulty){fromAction=rpgSemiDifficulty(actionDifficulty[0]);if(fromAction&&fromAction.error)return {error:fromAction.error};}
  if(difficulty&&fromAction&&difficulty.dc!==fromAction.dc)return {error:'Указаны две разные сложности. Оставь одну.'};
  const chosenDifficulty=difficulty||fromAction;
  if(fromAction)act=rpgSemiStripDifficulty(act,fromAction);
  const action=act||head;
  const searchText=(head+' '+act).trim()||action;
  const skillHint=rpgSemiExplicitSkill(r,head);
  if(skillHint&&skillHint.error)return {error:skillHint.error};
  const attrHint=rpgSemiExplicitAttr(head);
  const all=rpgJudgeRuleMatches(searchText).concat(rpgJudgeCustomMatches(r,searchText),rpgSemiRuleCandidates(r,searchText));
  // An explicitly named skill is authoritative, even when the action has no dictionary rule.
  if(skillHint&&skillHint.skill&&!all.some(x=>x.skill===skillHint.skill))all.unshift({kind:'manual',skill:skillHint.skill,attr:rpgXpSkillAttribute(r,skillHint.skill)||'Смекалка',dc:14,score:50,reason:'навык прямо указан игроком'});
  if(!all.length)return {error:'Не нашёл подходящий навык по действию. Укажи существующий навык словами «использую навык <название>» или старой формой :check Характеристика DC Навык | действие. :skill list'};
  const candidates=[],seen=new Set();
  for(const x of all){
    if(skillHint&&skillHint.skill&&x.skill!==skillHint.skill)continue;
    const method=rpgJudgeAttribute(x,head+' '+action);
    const attr=attrHint||method.attr||x.attr;
    const dc=chosenDifficulty?chosenDifficulty.dc:x.dc;
    const candidate={attr,skill:x.skill,dc,action,reason:skillHint&&skillHint.skill?'игрок указал навык':attrHint?'игрок указал способ':x.reason||method.reason||'контекст действия',
      difficultyLabel:chosenDifficulty?chosenDifficulty.label:'оценка по контексту',explicitDifficulty:!!chosenDifficulty,score:rpgJudgeRank(x,searchText)+(skillHint&&skillHint.skill?100:0)+(x.custom?18:0)+(x.kind==='semantic'?3:0)};
    const key=attr+'/'+x.skill+'/'+dc;
    if(!seen.has(key)){seen.add(key);candidates.push(candidate);}
  }
  if(!candidates.length)return {error:'Явно указанный навык не подходит к найденным вариантам. Уточни действие.'};
  candidates.sort((a,b)=>b.score-a.score||a.attr.localeCompare(b.attr,'ru')||a.skill.localeCompare(b.skill,'ru'));
  // For visual/artistic work, multiple characteristics represent genuinely different methods.
  if(!attrHint&&!skillHint&&/рисую|рисова|нарис|портрет|эскиз/iu.test(searchText)){
    const base=candidates.find(x=>x.skill==='Ремесло'||x.skill==='Рисование')||candidates[0];
    if(base){
      for(const [attr,reason] of [['Восприятие','точность наблюдения'],['Ловкость','техника исполнения'],['Смекалка','творческая оригинальность']]){
        const key=attr+'/'+base.skill+'/'+base.dc;
        if(!seen.has(key)){
          seen.add(key);candidates.push(Object.assign({},base,{attr,reason,score:base.score-4}));
        }
      }
    }
  }
  // Context-sensitive candidate is first; never re-sort artistic alternatives after augmentation.
  return {candidates:candidates.slice(0,3),action};
}
function rpgSemiPreviewText(r,plan){
  const items=plan.candidates||[];
  const lines=['ПРЕДПРОСМОТР ПРОВЕРКИ (кубик НЕ брошен, XP не начислен).','Действие: '+rpgClean(plan.action,170), 'Выбери вариант:'];
  items.forEach((c,i)=>{
    const attrBonus=Math.floor(((r.stats[c.attr]??10)-10)/2),skillBonus=Math.floor((r.skills[c.skill]||0)/10);
    const effects=rpgModifierDelta(r,c.attr,'stats')+rpgModifierDelta(r,c.skill,'skills');
    lines.push((i+1)+'. '+c.attr+' + '+c.skill+'; DC '+c.dc+' ('+c.difficultyLabel+')'+
      '; базовые бонусы '+(attrBonus>=0?'+':'')+attrBonus+' / '+(skillBonus>=0?'+':'')+skillBonus+
      (effects?'; активные эффекты '+(effects>=0?'+':'')+effects:'')+'; '+c.reason+'.');
  });
  lines.push('Для броска: :check choose 1'+(items.length>1?' / 2'+(items.length>2?' / 3':''):'')+'. Для отмены: :check cancel.');
  lines.push('Слова сложности: пустяк=5, легко=9, средне=13, сложно=19, невозможно=30.');
  lines.push('DC 30 означает крайне трудную проверку: натуральная 20 остаётся критическим успехом по правилам RPG.');
  return lines.join('\n');
}
function rpgSemiCheckCommand(r,arg){
  const raw=String(arg||'').trim();
  if(/^help$/i.test(raw))return rpgHelp(r,'check');
  if(/^cancel$/i.test(raw)){r.pendingCheck=null;return 'Ожидающий выбор проверки отменён. Броска и XP нет.';}
  const pick=raw.match(/^choose\s+(\d+)$/i);
  if(pick){
    const pending=r.pendingCheck,index=+pick[1]-1;
    if(!pending||!Array.isArray(pending.candidates)||pending.turn!==r.turn)return 'Нет актуального предпросмотра. Введи :check preview описание действия.';
    if(index<0||index>=pending.candidates.length)return 'Вариант '+(index+1)+' отсутствует. Выбери номер из предпросмотра.';
    const c=pending.candidates[index];r.pendingCheck=null;
    const x=rpgCheck(r,c.attr,c.dc,c.skill,c.action);x.manualSemantic=true;
    r.lastJudgement='ПОЛУАВТОМАТИЧЕСКИЙ ВЫБОР: '+rpgSemiPreviewTextShort(c)+'\n'+rpgRollLabel(x);
    return x;
  }
  if(/^choose\b/i.test(raw))return 'Формат: :check choose 1 (номер из предпросмотра).';
  const preview=/^preview(?:\s|$)/i.test(raw);
  const payload=preview?raw.replace(/^preview\s*/i,''):raw;
  r.pendingCheck=null;
  const plan=rpgSemiPlan(r,payload);
  if(plan.error)return 'ПРОВЕРКА НЕ ВЫПОЛНЕНА: '+plan.error;
  if(preview||plan.candidates.length!==1){
    r.pendingCheck={turn:r.turn,action:plan.action,candidates:plan.candidates};
    return rpgSemiPreviewText(r,plan);
  }
  r.pendingCheck=null;
  const c=plan.candidates[0],x=rpgCheck(r,c.attr,c.dc,c.skill,c.action);
  x.manualSemantic=true;
  r.lastJudgement='ПОЛУАВТОМАТИЧЕСКИЙ ВЫБОР: '+rpgSemiPreviewTextShort(c)+'\n'+rpgRollLabel(x);
  return x;
}
function rpgSemiPreviewTextShort(c){return c.attr+'/'+c.skill+'; DC '+c.dc+' ('+c.difficultyLabel+')';}
function rpgCautiousCheck(r,input){
  const raw=String(input||'').replace(/^>\s*You(?:\s+try to)?\s*/i,'').trim();
  if(!raw||raw.length>350||/[?？]/.test(raw))return null;
  const s=rpgSemiNormalize(raw);
  // Interpret only an immediate, affirmative action of the player; never quoted or retrospective narration.
  if(/^(?:говорю|спрашиваю|думаю|размышляю|вспоминаю|рассказываю|читаю|наблюдаю|обсуждаю|планирую|хочу|собираюсь|мечтаю|интересуюсь|может|если|вчера|раньше|помню|не |что если|допустим|представим)/u.test(s) ||
     /(?:^|\s)(?:не хочу|не буду|не собираюсь|не пытаюсь|вчера|прошлый раз|когда-то|как будто|наверное|возможно|если бы)(?:\s|$)/u.test(s) ||
     /[«»“”]/.test(s))return null;
  const immediate=/^(?:я\s+)?(?:бью|ударяю|нападаю|атакую|рублю|стреляю|выстреливаю|взламываю|вскрываю|крадусь|пробираюсь|подкрадываюсь|проскальзываю|прячусь|убеждаю|уговариваю|запугиваю|угрожаю|перепрыгиваю|карабкаюсь|прыгаю|выломываю|поднимаю тяж|программирую|рисую|черчу|лечу|перевязываю|расследую|изучаю улики)(?=\s|$|[,.!])/u;
  if(!immediate.test(s))return null;
  if(rpgIsSimpleFinancialAction(raw,r))return null;
  // No generic fallback to Wit. Not enough evidence = no roll.
  const candidate=rpgChooseCheck(raw,r);
  if(!candidate||candidate.generic)return null;
  // Simultaneous distinct risks need a deliberate manual check instead of an arbitrary primary roll.
  const matches=rpgJudgeRuleMatches(raw).concat(rpgJudgeCustomMatches(r,raw));
  if(matches.some(x=>x.skill!==candidate.skill&&
      /(?:и одновременно|одновременно|при этом|в то же время)/u.test(s)))return null;
  const chosen=rpgJudgeNext(r,candidate);
  const x=rpgCheck(r,chosen.attr,chosen.dc,chosen.skill,raw,{supportSkill:chosen.supportSkill});
  x.auto=true;x.cautious=true;
  r.lastJudgement='ОСТОРОЖНЫЙ АВТОСУДЬЯ: '+rpgJudgeDecisionLabel(chosen)+'\n'+rpgRollLabel(x);
  rpgDebugLog(r,r.lastJudgement);
  return x;
}

function rpgCommand(r, cmd, arg) {
  const split=(s)=>s.split('|').map(x=>x.trim());
  const n=(v,min,max)=>{const x=Number(v);return Number.isFinite(x)?rpgInt(x,min,max):null;};
  if(cmd==='help')return rpgHelp(r,arg);
  if(cmd==='rpg')return rpgMaintenanceCommand(r,arg);
  if(cmd==='aidm')return rpgAidmCommand(r,arg);
  if(cmd==='batch')return rpgBatchCommand(r,arg);
  if(cmd==='setup')return rpgSetupCommand(r,arg);
  if(cmd==='status')return rpgStatus(r);
  if(cmd==='review')return rpgReviewCommand(r,arg);
  if(cmd==='debt')return rpgDebtCommand(r,arg);
  if(cmd==='xp')return rpgXpCommand(r,arg);
  if(cmd==='judge')return rpgJudgeCommand(r,arg);
  if(['mod','modifiers','buff','debuff'].includes(cmd))return rpgModifierCommand(r,cmd,arg);
  if(cmd==='effects')return 'АВТОУЧЁТ\n'+(r.autoEvents.slice(-10).join('\n')||'Ещё нет изменений.');
  if(cmd==='needs'){
    const opt=arg.toLowerCase();
    // v2.25: explicit resource editing; unlike eat/drink this does not
    // consume food, infer a narrative event, or move the clock.
    const set=opt.match(/^(?:set\s+)?(hunger|thirst|fatigue)\s+(\d+)$/);
    if(set){
      const key=set[1],value=Number(set[2]);
      if(!Number.isSafeInteger(value)||value<0||value>100)
        return 'Потребности задаются целым значением от 0 до 100: :needs hunger 20 / thirst 30 / fatigue 15.';
      const before=r.needs[key];
      r.needs[key]=value;
      r.needs[key+'Remainder']=0;
      rpgNeedsSyncCheckpoint(r);
      const label={hunger:'голод',thirst:'жажда',fatigue:'усталость'}[key];
      return 'Потребность '+label+': '+before+' → '+value+'.';
    }
    if(/^(status|why)$/i.test(opt)){
      const n=r.needs;
      const left=(rem,rate)=>Math.ceil((60-(rem||0))/rate);
      return 'ПОТРЕБНОСТИ ('+(r.config.needs?'on':'off')+')\n'+
        'Голод '+n.hunger+'/100; жажда '+n.thirst+'/100; усталость '+n.fatigue+'/100.\n'+
        'Обычный рост в час: голод +2, жажда +3, усталость +1.\n'+
        'До следующей единицы: голод '+left(n.hungerRemainder,2)+' мин; жажда '+left(n.thirstRemainder,3)+' мин; усталость '+left(n.fatigueRemainder,1)+' мин (без дополнительных нагрузок).\n'+
        ':time 90 — продвинуть на 90 минут; :time set ЧЧ:ММ — только установить часы.\n'+
        ':needs eat / :needs drink — ручное подтверждение еды/питья.';
    }
    if(/^(eat|drink)$/i.test(opt)){
      if(!r.config.needs)return 'Потребности отключены. Сначала введи :needs on.';
      const k=opt==='eat'?'hunger':'thirst',points=opt==='eat'?22:28;
      const before=r.needs[k];r.needs[k]=Math.max(0,before-points);
      const out=(opt==='eat'?'Еда: голод ':'Питьё: жажда ')+before+'→'+r.needs[k]+'.';
      r.autoEvents.push('ручная команда: '+out);r.autoEvents=r.autoEvents.slice(-15);
      return out;
    }
    if(!/^(on|off)$/i.test(arg))return 'Используй :needs on/off/status/eat/drink/hunger N/thirst N/fatigue N (0–100)';
    r.config.needs=opt==='on';return 'needs: '+opt;
  }
  if(['combat','economy'].includes(cmd)){
    if(!/^(on|off)$/i.test(arg))return 'Используй :'+cmd+' on/off';
    r.config[cmd]=arg.toLowerCase()==='on';return cmd+': '+arg.toLowerCase();
  }
  if(cmd==='rest'){
    if(!/^\d+$/.test(arg)||+arg<1||+arg>720)return 'Пример: :rest 60 (минуты, не более 720).';
    rpgAdvanceTime(r,+arg,+arg>=180?'sleep':'rest');
    const levels=(r.config.xpEnabled&&r.config.xpMode==='rest'&&+arg>=180)?rpgXpApply(r):[];
    return 'Отдых '+arg+' минут: '+rpgClock(r)+'; выносливость '+r.stamina+'/'+r.maxStamina+', усталость '+r.needs.fatigue+'/100.'+
      (levels.length?'\n'+levels.join('\n'):'')+
      (r.config.xpEnabled&&r.config.xpMode==='rest'&&+arg<180?'\nПовышение навыков после отдыха от 180 минут.':'');
  }
  if(cmd==='char')return rpgCharacterCommand(r,arg);
  if(cmd==='notes'||cmd==='note')return rpgJournalCommand(r,cmd,arg);
  if(cmd==='quest')return rpgQuestCommand(r,arg);
  if(cmd==='date')return rpgDateCommand(r,arg);
  // Debug status works independently of model generation and Output hook.
  if(cmd==='debug' && /^(status|last)$/i.test(arg)) {
    const enabled=r.config.debug?'on':'off';
    const last=r.rolls && r.rolls.length?r.rolls[r.rolls.length-1]:null;
    if(arg.toLowerCase()==='status')return 'Отладка: '+enabled+'; комбинированный судья: '+r.config.judgeCombo+'; автосудья: '+(r.config.autoJudge?(r.config.smartJudge?'smart':r.config.narrativeJudge?'narrative':r.config.cautiousJudge?'cautious':'classic'):'off')+'; резерв: '+r.config.fallback+'; редактор: '+(r.config.editor?'on':'off')+'; инвентарь: '+(r.config.inventoryStrict?'on':'off')+
      '; бросков в журнале: '+(r.rolls?r.rolls.length:0)+
      (r.pendingRoll?'; есть ожидающий результат для рассказчика':'');
    return r.lastJudgement?'ПОСЛЕДНЕЕ РЕШЕНИЕ СУДЬИ\n'+r.lastJudgement:(last?'ПОСЛЕДНИЙ БРОСОК\n'+rpgRollLabel(last):'Решений пока нет. Сделай :check или действие с :auto on.');
  }
  if(cmd==='fallback'){
    const choice=arg.toLowerCase();
    if(['safe','story','strict'].includes(choice)){
      r.config.fallback=choice;
      return 'Режим резервной обработки: '+choice+' (safe — автоматическая упрощённая проверка; story — обычный рассказ без проверки; strict — остановка при неверном формате).';
    }
    return 'Резервная обработка: '+r.config.fallback+'. Варианты: :fallback safe | story | strict';
  }
  if(cmd==='auto' && /^(classic|smart|narrative|cautious)$/i.test(arg)) {
    const mode=arg.toLowerCase();
    r.config.autoJudge=true;
    r.config.smartJudge=mode==='smart';
    r.config.narrativeJudge=mode==='narrative';
    r.config.cautiousJudge=mode==='cautious';
    if(r.config.smartJudge||r.config.narrativeJudge)r.config.ledger=false;
    return 'Автосудья: '+mode+' (действует на следующие ходы).'+(r.config.narrativeJudge?' Обычная проза без обязательного RPG_TURN; бросок до генерации.':'');
  }
  if(cmd==='editor'||cmd==='inventory') {
    if(!/^(on|off)$/i.test(arg))return 'Используй :'+cmd+' on или :'+cmd+' off';
    r.config[cmd==='editor'?'editor':'inventoryStrict']=arg.toLowerCase()==='on';
    return (cmd==='editor'?'Контроль редактора':'Строгая проверка инвентаря')+': '+arg.toLowerCase();
  }
  if(cmd==='magic'||cmd==='auto'||cmd==='ledger'||cmd==='debug') {
    if(cmd==='ledger'&&arg.toLowerCase()==='on'&&r.config.autoJudge&&(r.config.smartJudge||r.config.narrativeJudge))return 'Автоучёт RPG_DELTA не совместим с режимами smart/narrative. Выбери :auto cautious или :auto classic или оставь :ledger off.';
    if(!/^(on|off)$/i.test(arg))return 'Используй :'+cmd+' on или :'+cmd+' off';
    r.config[cmd==='magic'?'magic':cmd==='ledger'?'ledger':cmd==='debug'?'debug':'autoJudge']=arg.toLowerCase()==='on';
    if(cmd==='auto'&&r.config.autoJudge&&(r.config.smartJudge||r.config.narrativeJudge))r.config.ledger=false;
    return (cmd==='magic'?'Магия':cmd==='ledger'?'Автоучёт событий':cmd==='debug'?'Отладка':'Автопроверки')+': '+arg.toLowerCase();
  }
  if(cmd==='skill'){
    const customResult=rpgCustomSkillCommand(r,arg);
    if(customResult!==null)return customResult;
  }
  if(cmd==='stat' && /^(list|help)$/i.test(arg))return rpgHelp(r,'stat');
  if(cmd==='stat'||cmd==='skill') {
    const m=arg.match(/^(.*?)\s+(-?\d+)$/); if(!m)return 'Нужно название и число. Пример: :stat Сила 15';
    const name=cmd==='stat'?rpgName(RPG_STATS,m[1]):rpgSkillName(r,m[1]);
    if(!name)return 'Неизвестное название. См. :help '+cmd+'.';
    const val=n(m[2],cmd==='stat'?1:0,cmd==='stat'?30:50);
    const old=r[cmd==='stat'?'stats':'skills'][name];
    r[cmd==='stat'?'stats':'skills'][name]=val;
    if(old!==val){rpgXpInit(r);if(cmd==='skill')r.xp.skills[name]=0;else{r.xp.attrPoints[name]=0;r.xp.practice[name]=0;}}
    return name+' = '+val+(old!==val?' (ручное изменение, XP не начислен)':'');
  }
  if(cmd==='give'||cmd==='take') {
    const m=arg.match(/^(.*?)(?:\s+(\d+))?$/);let item=rpgClean(m?m[1]:'',60);
    const quantity=n(m&&m[2]?m[2]:'1',1,999);
    if(!item||!quantity)return 'Пример: :give фонарик 1';
    const old=r.items[item]||0;
    if(cmd==='take'&&old<quantity)return 'Нельзя убрать '+quantity+' шт. «'+item+'»: в наличии '+old;
    if(cmd==='give'&&!old&&Object.keys(r.items).length>=RPG_CFG.maxItems)return 'Инвентарь переполнен.';
    const newQty=old+(cmd==='give'?quantity:-quantity);
    if(newQty<=0)delete r.items[item]; else r.items[item]=newQty;
    return item+': '+old+' → '+newQty;
  }
  if(cmd==='rename') {
    // Repair malformed inventory entries (e.g. "фонарик 1." from Do mode).
    const parts=split(arg);
    if(parts.length!==2 || !parts[0] || !parts[1])return 'Пример: :rename фонарик 1. | фонарик';
    const oldName=Object.keys(r.items).find(k=>k.toLowerCase()===parts[0].toLowerCase());
    if(!oldName)return 'Не найден предмет «'+parts[0]+'».';
    const newName=rpgClean(parts[1],60);
    if(!newName)return 'Укажи новое название предмета.';
    if(oldName===newName)return 'Название уже верное: '+newName;
    const qty=r.items[oldName];
    const existing=Object.keys(r.items).find(k=>k.toLowerCase()===newName.toLowerCase()&&k!==oldName);
    delete r.items[oldName];
    r.items[existing||newName]=(r.items[existing||newName]||0)+qty;
    return 'Переименовано: '+oldName+' → '+(existing||newName)+' (+'+qty+' шт.)';
  }
  if(cmd==='use'){
    const parts=split(arg), item=parts[0], action=parts[1]||'использовать предмет';
    if(!item)return 'Пример: :use фонарик | исследовать подвал';
    const key=Object.keys(r.items).find(k=>k.toLowerCase()===item.toLowerCase());
    if(!key)return 'НЕТ ПРЕДМЕТА «'+item+'» в инвентаре. Действие недоступно.';
    r.pendingAction='Используется '+key+': '+rpgClean(action,180);
    return null;
  }
  if(cmd==='hp'||cmd==='stamina'||cmd==='money') {
    if(cmd==='money'){
      if(!/^[+-]/.test(arg))return 'ОШИБКА ДЕНЕГ: нужен знак + или −. Пример: :money -7.5 или :money +20,50.';
      const delta=rpgMoneyParse(arg);
      if(delta===null)return 'ОШИБКА ДЕНЕГ: неверное число. Используй точку или запятую, не более двух знаков после разделителя: :money -7.5.';
      const prev=r.money;
      if(rpgMoneyRound(prev+delta)<-1000000||rpgMoneyRound(prev+delta)>100000000)return 'ОШИБКА ДЕНЕГ: баланс выходит за диапазон -1000000…100000000.';
      r.money=rpgMoneyRound(prev+delta);
      const result=rpgFinanceSigned(delta);
      if(delta){
        r.financeLog.push('ход '+r.turn+': ручной баланс '+rpgMoneyFormat(prev)+'→'+rpgMoneyFormat(r.money));
        r.financeLog=r.financeLog.slice(-30);
      }
      if(r.config.debug)return '[RPG DEBUG] ФИНАНСЫ: ручная корректировка баланса '+rpgMoneyFormat(prev)+'→'+rpgMoneyFormat(r.money)+'; изменение '+result+'.';
      return delta?'[RPG] Баланс '+result+'.':'Баланс не изменён.';
    }
    if(!/^[+-]\d+$/.test(arg))return 'Нужно целое изменение со знаком, например :'+cmd+' -10';
    const delta=parseInt(arg,10);
    const low=cmd==='money'?-1000000:0,high=cmd==='money'?100000000:cmd==='hp'?r.maxHP:r.maxStamina;
    const prev=r[cmd]; r[cmd]=rpgInt(prev+delta,low,high);
    return cmd+': '+prev+' → '+r[cmd];
  }
  if(cmd==='time') {
    const set=arg.match(/^set\s+(\d{1,2}):(\d{2})$/i);
    if(set){const hh=+set[1],mm=+set[2];if(hh>23||mm>59)return 'Время 00:00–23:59';
      r.timeMinutes=hh*60+mm;rpgNeedsSyncCheckpoint(r);return 'Игровое время установлено: '+rpgClock(r)+'. Потребности не пересчитаны.';}
    if(!/^\d+$/.test(arg))return 'Пример: :time 30 (вперёд на 30 мин.) или :time set 15:30';
    const mins=n(arg,0,10080);if(mins===null)return 'Неверное число';
    rpgAdvanceTime(r,mins,'normal');
    return 'Время: '+rpgClock(r)+'; голод '+r.needs.hunger+'/100; жажда '+r.needs.thirst+'/100.';
  }
  if(cmd==='place') { if(!arg)return 'Пример: :place центр города';r.location=rpgClean(arg,100);return 'Местоположение: '+r.location; }
  if(cmd==='roll'){
    const sides=n(arg,2,1000);if(!/^[0-9]+$/.test(arg)||sides===null)return 'Пример: :roll 6';
    return 'Честный бросок d'+sides+': '+rpgRoll(sides);
  }
  if(cmd==='check'){
    // Legacy exact mechanics retain priority; free-form + preview/choose use v2.29.
    const text=String(arg||'').trim();
    const oldStyle=RPG_STATS.some(stat=>new RegExp('^'+stat+'(?:\\s|$)','i').test(text)) && !/^(?:preview|choose|cancel)\b/i.test(text);
    if(!oldStyle)return rpgSemiCheckCommand(r,arg);
    r.pendingCheck=null;
    const parts=split(arg),params=parts[0].split(/\s+/).filter(Boolean);
    const idx=params.findIndex(t=>/^\d+$/.test(t));
    let a=null,dc=null,skill=null;
    if(idx>0){
      a=rpgName(RPG_STATS,params.slice(0,idx).join(' '));
      dc=n(params[idx],5,30);
      skill=rpgSkillName(r,params.slice(idx+1).join(' '));
      if(params.length>idx+1&&!skill)return 'Неизвестный навык.';
    } else {
      // Allow :check Ловкость Скрытность | тихо пройти мимо охраны
      for(const stat of RPG_STATS){
        if(parts[0].toLowerCase().startsWith(stat.toLowerCase())){
          a=stat;
          const tail=parts[0].slice(stat.length).trim();
          skill=tail?rpgSkillName(r,tail):null;
          if(tail&&!skill)return 'Неизвестный навык.';
          break;
        }
      }
      const suggestion=rpgChooseCheck(parts[1]||parts[0],r);
      dc=suggestion?suggestion.dc:14;
    }
    if(!a||dc===null)return 'Пример: :check Ловкость Скрытность | проскользнуть мимо охраны';
    const x=rpgCheck(r,a,dc,skill,parts[1]||'действие игрока');
    x.autoDifficulty=idx<0;
    rpgDebugLog(r,rpgRollLabel(x));
    r.lastJudgement=rpgRollLabel(x);
    return x;
  }
  return 'Неизвестная команда :'+cmd+'. Введи :help';
}
function rpgDifficulty(kind,action,base){
  const s=String(action||'').toLowerCase();
  let delta=0;
  if(kind==='stealth'){
    if(/на виду|на глазах|камер|осматрива|бдительн|ярк(ий|о)|светло|охраняем/i.test(s))delta+=3;
    if(/в толпе|темнот|в темноте|отвлеч[её]н|шумн|не замеча|ночью/i.test(s))delta-=2;
  } else if(kind==='fire'){
    if(/далек|движ|под укрытием|за укрытием|сильн.*ветр|плох.*видим/i.test(s))delta+=3;
    if(/в упор|вплотную|неподвиж|рядом/i.test(s))delta-=2;
  } else if(kind==='tech'){
    if(/сложн|защищ|шифр|профессиональн/i.test(s))delta+=3;
    if(/простой|старый замок|неисправн|слаб.*защит/i.test(s))delta-=2;
  } else if(kind==='athletics'){
    if(/высок|скольз|мокр|тяжел|через крышу|под дожд/i.test(s))delta+=3;
    if(/низк|устойчив|небольш|легк/i.test(s))delta-=2;
  } else if(kind==='social'){
    if(/враждебн|подозрител|не доверя|разозл/i.test(s))delta+=3;
    if(/друг|знаком|доверя|расположен/i.test(s))delta-=2;
  }
  return Math.max(6,Math.min(24,base+delta));
}
/* v2.18: score all plausible pairs; never choose by a character's skill LEVEL.
 * The original rules remain stable in simple mode for old saves. */
function rpgJudgeRuleMatches(action){
  const s=String(action||'').toLowerCase();
  const options=[
    // Do not let vague 'try' fall through to Wit when melee weapons are mentioned.
    {kind:'melee',test:/(?:бью|ударя|ударю|наношу удар|напада|атакую|атаковать|замахива|рублю|разруб|выпад|колю|режу|пронза|режущим|strike|slash|stab|attack)(?:.{0,110})(?:меч[еёо]м|мечом|меча|клинк|сабл|ножом|топор|копь[её]|кинжал|дубин|секир|клинком)|(?:меч[еёо]м|мечом|клинк|ножом|сабл|копь[её]|топор)(?:.{0,80})(?:бью|ударя|атакую|рублю|наношу)/i,attr:'Сила',skill:'Холодное оружие',dc:14},
    {kind:'melee',test:/(?:бью|ударя|ударю|наношу удар|напада|атакую|атаковать|замахива|врезаю|strike|punch|attack)(?:.{0,90})(?:кулак|рук[оа]й|ногой|без оруж|врукопашную)|(?:кулак|рук[оа]й|ногой|без оруж)(?:.{0,50})(?:бью|ударя|атакую)/i,attr:'Сила',skill:'Драка',dc:13},
    {kind:'tech',test:/взлом|взлам|вскры(ваю|ть)|подбор ключ|hack into|pick.*lock/i,attr:'Интеллект',skill:'Технологии',dc:15},
    {kind:'stealth',test:/крадусь|подкрад|пробира|проскольз|незамет|тихо прохож|скры(ть|ться|ваюсь|ва)|спрят|пряч|мимо охранник|мимо страж|от глаз|незрим|укры(ть|ться)|sneak|stealth|hide from/i,attr:'Ловкость',skill:'Скрытность',dc:14},
    {kind:'social',test:/заболт|заговарив|разговарива|пытаюсь отвлечь разговором|убежда|убед|уговор|переговор|persuad|convinc/i,attr:'Обаяние',skill:'Переговоры',dc:13},
    {kind:'athletics',test:/перепрыг|запрыг|перелез|карабка|прыг(аю|нуть)|jump|climb/i,attr:'Ловкость',skill:'Атлетика',dc:13},
    {kind:'fire',test:/стреля|выстрел|shoot|fire at/i,attr:'Ловкость',skill:'Огнестрельное оружие',dc:14},
    {kind:'social',test:/запуг|угрожа|intimidat/i,attr:'Воля',skill:'Запугивание',dc:14},
    {kind:'tech',test:/программир|вирус|компьютер|password|пробить базу/i,attr:'Интеллект',skill:'Компьютеры',dc:14},
    {kind:'athletics',test:/поднять тяж|вылом|выбить дверь/i,attr:'Сила',skill:'Атлетика',dc:15}
  ];
  return options.filter(x=>x.test.test(s)).map(x=>Object.assign({},x,{dc:rpgDifficulty(x.kind,s,x.dc)}));
}
function rpgJudgeCustomMatches(r,action){
  if(!r)return [];
  const text=String(action||'').toLowerCase().replace(/ё/g,'е');
  const found=[];
  for(const name of Object.keys(r.customSkills||{})){
    const c=r.customSkills[name];
    if(!c||!RPG_STATS.includes(c.attr)||!Array.isArray(c.keywords))continue;
    const matches=c.keywords.filter(k=>rpgCustomKeywordMatch(text,k));
    // Common Russian inflections absent from configured stems: рисован/рисун -> рисую.
    if(name.toLowerCase()==='рисование' && c.keywords.some(k=>/^(?:рисун|рисован|рисовать|нарис)/.test(k)) &&
      /(?:^|[^а-яёa-z])(?:рису(?:ю|ешь|ет|ем|ют)|нарис|рисов|рисунк)/i.test(text))matches.push('рисование');
    if(matches.length)found.push({kind:'custom',attr:c.attr,skill:name,dc:14,custom:true,
      keyLength:Math.max(...matches.map(k=>k.length)),key:matches.sort((a,b)=>b.length-a.length)[0]});
  }
  return found;
}
function rpgJudgeAttribute(candidate,action){
  const s=String(action||'').toLowerCase().replace(/ё/g,'е');
  // Explicit method beats a skill's default characteristic. Strongest patterns first.
  const methods=[
    {attr:'Интеллект',test:/академическ|по инструкции|научн|логическ|аргументир|доказательств|расчет|расчёт|формул|теори|техник[еиу] рисунка/i,reason:'теория, знания или логические аргументы'},
    {attr:'Смекалка',test:/придумыва|изобрета|необычн(?:ый|ую|ого)|оригинальн|креатив|нестандартн|нов(?:ый|ую) (?:дизайн|способ|решение)|импровизир/i,reason:'изобретательность и оригинальная идея'},
    {attr:'Ловкость',test:/мелк(?:ие|их) детал|тонк(?:ие|ая) лини|точност[ьи] движ|ловко|быстр(?:о|ые) движен|ювелирн|аккуратно вывод|координац/i,reason:'тонкая моторика и точность движений'},
    {attr:'Восприятие',test:/с натуры|внимательно (?:изуча|наблюда|рассматрива)|подмеча|замеча(?:ю|ть) детал|наблюдательност/i,reason:'внимательное наблюдение'},
    {attr:'Сила',test:/силой|физическ(?:ой|ую) сил|груб(?:ой|ую) сил|мускул/i,reason:'физическое усилие'},
    {attr:'Обаяние',test:/дружелюб|харизм|обаяни|улыб(?:кой|аясь)|расположить к себе/i,reason:'личное обаяние'}
  ];
  for(const m of methods){if(m.test.test(s))return m;}
  return {attr:candidate.attr,reason:'характеристика навыка по умолчанию'};
}
function rpgJudgeRank(candidate,action){
  const s=String(action||'').toLowerCase();
  let score=candidate.custom?16+Math.min(12,(candidate.keyLength||3)*0.7):18;
  if(candidate.kind==='tech'&&/вскры|взлом|взлам|подбор ключ|hack/i.test(s))score+=20;
  if(candidate.kind==='melee')score+=13;
  if(candidate.kind==='fire')score+=13;
  if(candidate.kind==='stealth')score+=11;
  if(candidate.kind==='social')score+=7;
  if(candidate.kind==='athletics')score+=7;
  if(candidate.custom&&/рисую|нарис|рисован|рисунок|дизайн|скетч|портрет|иллюстрац/i.test(s))score+=16;
  if(candidate.kind==='stealth'&&/незаметно (?:доста|беру|выхватыва)|тайно доста/i.test(s))score+=20;
  // Technological task remains primary when the actor also wants to be discreet.
  if(candidate.kind==='tech'&&/электронн|кодовый|цифров|защит/i.test(s))score+=5;
  return score;
}
function rpgChooseCheck(input,r){
  const s=String(input||'').toLowerCase(),mode=r&&r.config&&r.config.judgeCombo||'weighted';
  const standard=rpgJudgeRuleMatches(s),custom=rpgJudgeCustomMatches(r,s);
  if(mode==='simple'){
    const chosen=custom.length?custom.slice().sort((a,b)=>b.keyLength-a.keyLength)[0]:standard[0];
    if(!chosen)return null;
    return Object.assign({},chosen,{reason:'простое правило: '+(chosen.custom?'ключевое слово '+chosen.key:'первое совпадение'),alternatives:[]});
  }
  const all=standard.concat(custom).map(x=>Object.assign({},x,{score:rpgJudgeRank(x,s)}));
  if(!all.length)return null;
  all.sort((a,b)=>b.score-a.score || (b.keyLength||0)-(a.keyLength||0) || a.skill.localeCompare(b.skill,'ru'));
  const top=all[0],method=rpgJudgeAttribute(top,s);
  // Support is an optional +1 from a genuinely distinct, trained skill.
  // Other candidate may not be selected just because its level is higher.
  const supporter=all.slice(1).find(x=>x.skill!==top.skill && x.kind!==top.kind &&
    r&&rpgSkillEffective(r,x.skill)>=10 && x.score>=18);
  const extras=all.slice(1).filter(x=>x.skill!==top.skill).slice(0,3).map(x=>({attr:x.attr,skill:x.skill,score:x.score}));
  return Object.assign({},top,{attr:method.attr,reason:method.reason,alternatives:extras,
    supportSkill:supporter?supporter.skill:'',supportBonus:supporter?1:0});
}
function rpgJudgeDecisionLabel(x){
  if(!x)return 'Подходящей проверки нет';
  return 'основная '+x.attr+'/'+(x.skill||'без навыка')+', DC '+x.dc+
    '; причина: '+(x.reason||'контекст действия')+
    (x.supportSkill?'; вспомогательный '+x.supportSkill+' +1 (только уровень ≥10)':'')+
    (x.alternatives&&x.alternatives.length?'; альтернативы: '+x.alternatives.map(a=>a.attr+'/'+a.skill).join(', '):'');
}
function rpgJudgeNext(r,x){
  const o=r.nextJudgeOverride;
  if(o&&x){r.nextJudgeOverride=null;return Object.assign({},x,{attr:o.attr,skill:o.skill||'',
    supportSkill:'',supportBonus:0,reason:'ручное однократное переопределение',alternatives:[],overridden:true});}
  return x;
}
// Detailed mode: second roll ONLY for an independently identifiable objective.
function rpgJudgeSecondRisk(action,r,main){
  if(!r||r.config.judgeCombo!=='detailed'||!main||main.overridden)return null;
  const s=String(action||'').toLowerCase();
  const stealth=rpgJudgeRuleMatches(s).find(x=>x.kind==='stealth');
  if(stealth&&main.kind!=='stealth' &&
    /незаметно|не привлекая внимани|чтобы не заметил|скрытно|тайно/i.test(s) &&
    /охранник|страж|патрул|полиц|камер|за спиной|чтобы не заметил/i.test(s))
    return Object.assign({},stealth,{reason:'отдельный риск обнаружения'});
  if(main.kind==='stealth' && /вскры|взлом|взлам/i.test(s)){
    const tech=rpgJudgeRuleMatches(s).find(x=>x.kind==='tech');
    if(tech)return Object.assign({},tech,{reason:'отдельный риск вскрытия'});
  }
  return null;
}
function rpgJudgeCommand(r,arg){
  const txt=String(arg||'').trim(),m=txt.match(/^(combo|override|clear|last|help)\b\s*(.*)$/i);
  if(!m)return 'СУДЬЯ: '+r.config.judgeCombo+'. Режимы: simple / weighted / detailed. '+
    (r.nextJudgeOverride?'Следующая проверка: '+r.nextJudgeOverride.attr+'/'+(r.nextJudgeOverride.skill||'без навыка')+'.':'Автоматический выбор.')+'\n:help judge';
  const op=m[1].toLowerCase(),val=m[2].trim();
  if(op==='help')return rpgHelp(r,'judge');
  if(op==='last')return r.lastJudgement||'Пока не было решений судьи.';
  if(op==='clear'){r.nextJudgeOverride=null;return 'Переопределение судьи отменено.';}
  if(op==='combo'){
    if(!['simple','weighted','detailed'].includes(val))return 'Варианты: :judge combo simple | weighted | detailed';
    r.config.judgeCombo=val;return 'Режим сочетания навыков: '+val+'. Опыт и сохранение не сброшены.';
  }
  const parts=val.split('|').map(x=>x.trim());
  if(parts.length!==2)return 'Формат: :judge override Восприятие | Рисование. Для отмены: :judge clear';
  const attr=rpgName(RPG_STATS,parts[0]);const skill=parts[1]?rpgSkillName(r,parts[1]):'';
  if(!attr||(parts[1]&&!skill))return 'Неизвестная характеристика или навык. :help stat / :help skill';
  r.nextJudgeOverride={attr,skill};
  return 'Следующая автоматическая проверка: '+attr+'/'+(skill||'без навыка')+'. Только один раз; XP начисляется за этот выбор.';
}
// Single-pass narrative judge. It does not need the model to return JSON.
// For unknown but clearly attempted risky actions choose a conservative generic check;
// everyday low-risk behavior proceeds without rolling.
function rpgNarrativeCandidate(input,r){
  const s=String(input||'').toLowerCase();
  const known=rpgChooseCheck(s,r);
  if(known)return known;
  const risk=/бью|ударя|атакую|напада|рублю|оружи|мечом|мечем|клинком|драка|сражен|охранник|страж|патрул|полиц|погон|опасн|препятств|не замет|не увид|обойти охран|обман|поддел|похит|украст|схват|поймат|сбеж|убежать|ускольз|спаст|выдерж|догнат|прослед|подслуш|уклон|открыть заперт|замаскиров|обойти защит|попыта|пытаюсь|попробую|стараюсь|рискую|проверю смогу ли|смогу ли|хочу добиться|решаюсь|try to|attempt to|risk/i.test(s);
  if(!risk)return null;
  if(/(?:охранник|страж|патрул|полиц).*(?:обой|мимо|скры|уйти)|(?:обой|мимо|скры|уйти).*(?:охранник|страж|патрул|полиц)|не увид|не замет|подслуш|слежк|прослед/i.test(s)){
    return {kind:'stealth',attr:'Ловкость',skill:'Скрытность',dc:rpgDifficulty('stealth',s,14),generic:true};
  }
  if(/(?:атакую|напада|бью|ударя|замахиваюсь|сражаюсь|дерусь|драку)/i.test(s)){
    return {kind:'melee',attr:'Сила',skill:/меч|клинок|сабл|нож|топор|копь/i.test(s)?'Холодное оружие':'Драка',dc:14,generic:true};
  }
  if(/(?:обман|совр|солг|выдать себя|(?:^|[^а-яё])ложн|поддел)/i.test(s)){
    return {kind:'social',attr:'Обаяние',skill:'Хитрость',dc:rpgDifficulty('social',s,14),generic:true};
  }
  if(/(?:догнат|убежать|сбеж|погон|ускольз|уклон)/i.test(s)){
    return {kind:'athletics',attr:'Ловкость',skill:'Атлетика',dc:rpgDifficulty('athletics',s,14),generic:true};
  }
  if(/(?:отыск|выслед|разыск|прослуш|выяснить|расслед)/i.test(s)){
    return {kind:'generic',attr:'Восприятие',skill:'Расследование',dc:13,generic:true};
  }
  return {kind:'generic',attr:'Смекалка',skill:'',dc:12,generic:true};
}
function rpgIsSimpleFinancialAction(action,r){
  if(!rpgPlayerTransaction(action,r))return false;
  // Only isolated financial actions are exempt; an explicit dangerous action
  // after a payment still needs normal adjudication.
  return !/(?:взлом|взлам|вскрыва|крадусь|подкрад|напада|атакую|стреля|ударя|дерусь|обман|убега|поддел|похища|прыг|карабка)/iu.test(String(action||''));
}
function rpgNarrativePreflight(r, input){
  const action=String(input||'');
  if(action.length>900||!r.config.autoJudge)return {kind:'none'};
  if(rpgIsSimpleFinancialAction(action,r)){
    r.lastJudgement='Повседневная финансовая операция: бросок d20 не требуется';
    return {kind:'none'};
  }
  if(/\b(?:не хочу|не собираюсь|отказываюсь)\b/i.test(action))return {kind:'none'};
  if(!r.config.magic && /магическ|заклинан|колду|телепорт|призываю демона|портал в другой мир/i.test(action)){
    r.lastJudgement='ОТКЛОНЕНО: магия отключена';
    return {kind:'blocked',reason:'В этом мире магия отключена. Действие не может иметь сверхъестественного результата.'};
  }
  const missing=r.config.inventoryStrict?rpgFallbackItem(r,action):'';
  if(missing){
    r.lastJudgement='ОТКЛОНЕНО: отсутствует предмет «'+missing+'»';
    return {kind:'blocked',reason:'Нет необходимого предмета «'+missing+'» в инвентаре. Действие в таком виде невозможно.'};
  }
  const candidate=rpgNarrativeCandidate(action,r);
  if(!candidate){r.lastJudgement='Проверка не потребовалась';return {kind:'none'};}
  // Already-alert nearby guard makes repeated stealth harder, no new model call needed.
  if(candidate.skill==='Скрытность' && /охранник|страж|патрул|дозор/i.test(action) &&
      Number.isInteger(r.flags.guardAlertTurn) && r.turn-r.flags.guardAlertTurn<=6 && r.turn>=r.flags.guardAlertTurn){
    candidate.dc=Math.min(24,candidate.dc+3);
  }
  const chosen=rpgJudgeNext(r,candidate);
  const secondary=rpgJudgeSecondRisk(action,r,chosen);
  const roll=rpgCheck(r,chosen.attr,chosen.dc,chosen.skill,action,{supportSkill:secondary?'':chosen.supportSkill});
  roll.auto=true;
  if(secondary){
    const secondRoll=rpgCheck(r,secondary.attr,secondary.dc,secondary.skill,action+' [риск обнаружения]');
    secondRoll.auto=true;r.pendingSecondaryRoll=secondRoll;r.pendingRoll=roll;
  }
  r.lastJudgement='ВЫБОР: '+rpgJudgeDecisionLabel(chosen)+(secondary?'\nВТОРОЙ РИСК: '+rpgJudgeDecisionLabel(secondary):'')+
    '\nНАРРАТИВНАЯ ПРОВЕРКА: '+rpgRollLabel(roll)+(r.pendingSecondaryRoll?'\n'+rpgRollLabel(r.pendingSecondaryRoll):'')+
    (candidate.generic?' (ориентировочная сложность, без отдельной модели-судьи)':'');
  rpgDebugLog(r,r.lastJudgement);
  return {kind:'check',roll};
}
function rpgAutoCheck(r, input){
  const s=String(input||'');
  if(s.length>450||!r.config.autoJudge)return null;
  if(rpgIsSimpleFinancialAction(s,r))return null;
  if(/\bне хочу\b|\bне собираюсь\b|\bотказываюсь\b/i.test(s))return null;
  const o=rpgChooseCheck(s,r);
  if(!o)return null;
  const chosen=rpgJudgeNext(r,o);
  const second=rpgJudgeSecondRisk(s,r,chosen);
  const x=rpgCheck(r,chosen.attr,chosen.dc,chosen.skill,rpgClean(input,150),{supportSkill:second?'':chosen.supportSkill});
  x.auto=true;
  if(second){const sr=rpgCheck(r,second.attr,second.dc,second.skill,rpgClean(input,150)+' [риск обнаружения]');sr.auto=true;r.pendingSecondaryRoll=sr;r.pendingRoll=x;}
  r.lastJudgement='ВЫБОР: '+rpgJudgeDecisionLabel(chosen)+(second?'\nВТОРОЙ РИСК: '+rpgJudgeDecisionLabel(second):'')+'\n'+rpgRollLabel(x)+(r.pendingSecondaryRoll?'\n'+rpgRollLabel(r.pendingSecondaryRoll):'');
  rpgDebugLog(r,'Автосудья: '+r.lastJudgement);
  return x;
}

function rpgApplyDelta(r, payload) {
  // Untrusted model output: validate structure and bound all modifications.
  if(!payload || typeof payload!=='object' || Array.isArray(payload))return [];
  const changes=[];
  for(const key of ['hp','stamina']) {
    const value=payload[key];
    if((key==='money'?rpgMoneyParse(String(value))===null:!Number.isInteger(value)) || Math.abs(value)>(key==='money'?1000:40) || value===0)continue;
    const old=r[key];
    r[key]=key==='money'?rpgMoneyRound(old+value):rpgInt(old+value,0,key==='hp'?r.maxHP:r.maxStamina);
    if(old!==r[key])changes.push(key+' '+old+'→'+r[key]);
  }
  if(Number.isInteger(payload.time) && payload.time>0 && payload.time<=720) {
    // Use the same clock/needs calculation as ordinary actions and :time N.
    const mode=r.pendingEffects?rpgAutoCostKind(r.pendingEffects.action):'normal';
    const before=r.needs&&{hunger:r.needs.hunger,thirst:r.needs.thirst,fatigue:r.needs.fatigue};
    rpgAdvanceTime(r,payload.time,mode);
    changes.push('время +'+payload.time+' мин.');
    const needsChanges=[];
    if(r.config.needs&&before){
      for(const k of ['hunger','thirst','fatigue']){
        if(before[k]!==r.needs[k]){
          const label=({hunger:'голод',thirst:'жажда',fatigue:'усталость'})[k];
          const change=label+' '+before[k]+'→'+r.needs[k];
          changes.push(change);needsChanges.push(change);
        }
      }
    }
    if(r.pendingEffects){
      r.pendingEffects.ledgerTimeApplied=payload.time;
      r.pendingEffects.ledgerNeedsChanges=needsChanges;
    }
  }
  if(typeof payload.location==='string' && payload.location.length<=100 && payload.location.trim()){
    r.location=rpgClean(payload.location,100);changes.push('место: '+r.location);
  }
  if(Array.isArray(payload.items)) {
    payload.items.slice(0,4).forEach(item=>{
      if(!item || typeof item.name!=='string' || item.name.length>60 ||
          !Number.isInteger(item.qty) || item.qty===0 || Math.abs(item.qty)>10)return;
      const key=rpgClean(item.name,60);if(!key)return;
      const old=r.items[key]||0, next=old+item.qty;
      if(next<0 || (next>0&&!old&&Object.keys(r.items).length>=RPG_CFG.maxItems))return;
      if(next===0)delete r.items[key];else r.items[key]=next;
      changes.push(key+' '+old+'→'+next);
    });
  }
  if(Array.isArray(payload.notes)) {
    payload.notes.slice(0,2).forEach(note=>{
      if(typeof note!=='string'||!note.trim())return;
      rpgJournalAdd(r,'событие',note,false);
      changes.push('событие сохранено');
    });
  }
  return changes;
}

/* ---------- v1.5: model-guided adjudication, deterministic validation ---------- */
function rpgNormalizeItem(s){
  return String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[«»"'.,!?()\[\]]/g,'').replace(/\s+/g,' ').trim();
}
function rpgOwnedItem(r,item){
  const want=rpgNormalizeItem(item);
  const keys=Object.keys(r.items||{});
  // No fuzzy matching: a different object must not count as the required item.
  return keys.find(k=>rpgNormalizeItem(k)===want && Number(r.items[k])>0)||null;
}
function rpgFindTurnPlan(text){
  const raw=String(text||'').trim();
  const tagged=raw.match(/<RPG_TURN>\s*([\s\S]*?)\s*<\/RPG_TURN>/i);
  const candidates=[];
  if(tagged)candidates.push(tagged[1]);
  const fenced=raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if(fenced)candidates.push(fenced[1]);
  // Some models produce plain JSON without the wrapper, despite explicit instructions.
  if(raw.charAt(0)==='{')candidates.push(raw);
  const first=raw.indexOf('{'), last=raw.lastIndexOf('}');
  if(first!==-1 && last>first && raw.slice(first,last+1).includes('"check"')){
    candidates.push(raw.slice(first,last+1));
  }
  for(const candidate of candidates){
    try {
      const parsed=JSON.parse(candidate.trim());
      if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&
        ('check' in parsed || 'narration' in parsed))return parsed;
    }catch(e){}
  }
  return null;
}
function rpgSmartReview(r,text){
  const plan=rpgFindTurnPlan(text);
  if(!plan)return {ok:false,error:'Модель не вернула понятный план RPG_TURN'};
  if(!plan||typeof plan!=='object'||Array.isArray(plan))return {ok:false,error:'Неверная структура RPG_TURN'};
  if(!Array.isArray(plan.requires))return {ok:false,error:'Отсутствует список необходимых предметов requires'};
  if(plan.requires.length>8||plan.requires.some(x=>typeof x!=='string'||x.length>80))return {ok:false,error:'Недопустимый список предметов'};
  if(typeof plan.magic!=='boolean')return {ok:false,error:'Отсутствует magic true/false'};
  let check=null;
  if(plan.check!==null && plan.check!==undefined){
    if(typeof plan.check!=='object'||Array.isArray(plan.check))return {ok:false,error:'Неверная проверка'};
    const a=rpgName(RPG_STATS,plan.check.attr);
    const skill=plan.check.skill?rpgSkillName(r,plan.check.skill):'';
    if(!a || (plan.check.skill&&!skill) || !Number.isInteger(plan.check.dc)||plan.check.dc<6||plan.check.dc>24)
      return {ok:false,error:'Модель выбрала неизвестную характеристику/навык или DC вне 6–24'};
    check={attr:a,skill,dc:plan.check.dc};
  }
  const required=plan.requires.map(x=>rpgClean(x,70)).filter(Boolean);
  const missing=required.filter(x=>!rpgOwnedItem(r,x));
  if(!r.config.magic && plan.magic){
    return {ok:true,kind:'blocked',reason:'Магия недоступна в этом мире. Действие не удалось.',missing};
  }
  if(r.config.inventoryStrict && missing.length){
    return {ok:true,kind:'blocked',reason:'Нет необходимых предметов: '+missing.join(', ')+'. Действие нельзя выполнить в заявленном виде.',missing};
  }
  if(check){
    if(typeof plan.success!=='string'||!plan.success.trim()||typeof plan.failure!=='string'||!plan.failure.trim())
      return {ok:false,error:'Нет двух альтернативных исходов success/failure'};
    return {ok:true,kind:'check',check,success:plan.success.trim().slice(0,6000),failure:plan.failure.trim().slice(0,6000),required};
  }
  if(typeof plan.narration!=='string'||!plan.narration.trim())return {ok:false,error:'Пустой narration без проверки'};
  return {ok:true,kind:'none',narration:plan.narration.trim().slice(0,6000),required};
}
function rpgFallbackNarrative(raw){
  const s=String(raw||'').replace(/<RPG_TURN>[\s\S]*/gi,'')
    .replace(/```(?:json)?\s*[\s\S]*?```/gi,'')
    .replace(/<\/?RPG_[A-Z_]+>/gi,'').trim();
  if(!s || /^[\s\[{]/.test(s) || /"(?:check|requires|success|failure)"\s*:/.test(s))return '';
  return s.slice(0,3500);
}
function rpgFallbackItem(r,action){
  // Conservative emergency check for explicitly claimed personal equipment.
  const text=String(action||'').toLowerCase();
  const patterns=[
    {test:/пистолет/i,names:['пистолет']},
    {test:/револьвер/i,names:['револьвер']},
    {test:/фонарик|фонарь/i,names:['фонарик','фонарь']},
    {test:/винтовк|ружь[её]|карабин/i,names:['винтовка','ружье','ружьё','карабин']},
    {test:/ножом|нож[а]?\b/i,names:['нож']},
    {test:/телефон|смартфон/i,names:['телефон','смартфон']}
  ];
  if(!/достаю|беру свой|свой|своим|мо[йяе]|из своего|использу|применя|стреля|свети|включаю/i.test(text))return '';
  for(const x of patterns)if(x.test.test(text)&&!x.names.some(n=>rpgOwnedItem(r,n)))return x.names[0];
  return '';
}
/* v2.31 — an authoritative failure result for pre-rolled checks. The
 * model's free-form response cannot be trusted to honour a failed die roll.
 * Build a safe continuation in JavaScript instead of attempting to detect
 * semantic success using brittle Russian-language regexes.
 * Does not roll again or change gameplay state. */
function rpgStrictOutcome(r,primary,secondary){
  const describe=(x,extra)=>{
    if(!x)return '';
    const action=String(x.action||'');
    const stealth=x.skill==='Скрытность';
    if(extra && /риск обнаружения/i.test(action)){
      return x.success?'Второй риск пройден: тебя не замечают.':
        'Второй риск провален: твоё присутствие или действия замечают. Скрытность не удалась.';
    }
    if(!x.success){
      if(stealth){
        if(/охранник|страж|патрул|дозор/i.test(action))
          return 'Охранник замечает движение. Незаметно выполнить задуманное не удалось.';
        if(/камер/i.test(action))
          return 'Камера фиксирует движение. Сохранить незаметность не удалось.';
        return 'Попытка скрыться или действовать незаметно проваливается: тебя замечают либо выдают следы. Заявленная цель скрытности не достигнута.';
      }
      if(/Переговоры|Запугивание|Этикет|Обаяние/.test(x.skill||x.attr||''))
        return 'Твои слова не достигают цели: собеседник не принимает предложение. Убедить его не удалось.';
      if(x.skill==='Огнестрельное оружие')return 'Выстрел не достигает намеченной цели. Попадание не засчитано.';
      if(/Технологии|Воровство|Компьютеры|Черчение/.test(x.skill||''))
        return 'Попытка выполнить задуманное не удаётся: нужный результат не получен, задача остаётся нерешённой.';
      if(x.skill==='Атлетика')return 'Преодолеть препятствие не удаётся. Препятствие остаётся непройденным.';
      return 'Твоя попытка заканчивается неудачей. Заявленная цель остаётся недостигнутой; потребуется другой подход.';
    }
    return rpgFallbackOutcome(r,action,x);
  };
  const text=describe(primary,false)+(secondary?' '+describe(secondary,true):'');
  return text.trim()||'Проверка провалена. Заявленная цель не достигнута.';
}
function rpgFallbackOutcome(r,action,x){
  if(x.skill==='Скрытность')return x.success
      ?'Ты действуешь осторожно и остаёшься незамеченным. Дальнейшие события пока неизвестны.'
      :'Попытка остаться незамеченным не удаётся: твоё движение привлекает внимание. Реакция окружающих ещё не определена.';
  if(x.skill==='Атлетика')return x.success
      ?'Попытка удаётся. Ты преодолеваешь препятствие, хотя усилие не остаётся незамеченным.'
      :'Попытка не удаётся. Препятствие остаётся перед тобой; ты можешь выбрать другой подход.';
  if(x.skill==='Переговоры'||x.skill==='Запугивание')return x.success
      ?'Собеседник принимает твои доводы, по крайней мере сейчас.'
      :'Собеседник не соглашается. Его позиция остаётся прежней.';
  if(x.skill==='Огнестрельное оружие')return x.success?'Твой выстрел достигает намеченной цели.':'Выстрел не достигает намеченной цели.';
  return x.success?'Предпринятое действие удаётся, хотя детали остаются за пределами проверки.':'Действие не удаётся. Ситуация не меняется так, как ты рассчитывал.';
}
function rpgSmartFallback(r,text,originalError){
  const reason='RPG_TURN недоступен ('+originalError+'); применён резервный режим.';
  if(r.config.fallback==='strict'){r.lastJudgement=reason;return {text:'[RPG] '+reason+' Повтори ход или используй :fallback safe.',debug:reason};}
  const narrative=rpgFallbackNarrative(text);
  if(r.config.fallback==='story'){
    r.lastJudgement=reason+' Текст модели без подтверждённой проверки.';
    return {text:narrative||'Сцена продолжается, но автоматический судья не подтвердил исход.',debug:r.lastJudgement};
  }
  const action=r.pendingSmart?String(r.pendingSmart.action||''):'';
  if(!r.config.magic && /\bmagic\b|магическ|заклинан|заколд|колду|телепорт|портал в другой мир/i.test(action)){
    r.lastJudgement=reason+' Попытка применить выключенную магию.';
    return {text:'В этом мире магия отключена; такое действие не приводит к сверхъестественному эффекту.',debug:r.lastJudgement};
  }
  const missing=r.config.inventoryStrict?rpgFallbackItem(r,action):'';
  if(missing){
    r.lastJudgement=reason+' Запрещённое использование отсутствующего предмета: '+missing;
    return {text:'У тебя нет предмета «'+missing+'». Для этого действия понадобится другой способ.',debug:r.lastJudgement};
  }
  const candidate=rpgChooseCheck(action,r);
  if(candidate){
    const x=rpgCheck(r,candidate.attr,candidate.dc,candidate.skill,action);
    const decision='РЕЗЕРВНАЯ ПРОВЕРКА: '+rpgRollLabel(x)+'; '+reason;
    r.pendingRoll=null;
    r.lastJudgement=decision;
    return {text:rpgFallbackOutcome(r,action,x),debug:decision};
  }
  if(/попыт|пробую|стараюсь|пытаюсь|хитр|риск|удастся/i.test(action)){
    const x=rpgCheck(r,'Смекалка',12,'',action);
    const decision='ОБЩАЯ РЕЗЕРВНАЯ ПРОВЕРКА: '+rpgRollLabel(x)+'; '+reason;
    r.pendingRoll=null;
    r.lastJudgement=decision;
    return {text:rpgFallbackOutcome(r,action,x),debug:decision};
  }
  r.lastJudgement=reason+' Проверка не подтверждена; сохранено обычное повествование.';
  return {text:narrative||'Ты продолжаешь действовать, но ситуация пока не изменилась.',debug:r.lastJudgement};
}
function rpgSmartResolve(r,text){
  const plan=rpgSmartReview(r,text);
  if(!plan.ok){
    const fallback=rpgSmartFallback(r,text,plan.error);
    rpgDebugLog(r,fallback.debug);
    return fallback;
  }
  let output,decision;
  if(plan.kind==='blocked'){
    output=plan.reason;
    decision='ОТКЛОНЕНО: '+plan.reason;
  }else if(plan.kind==='none'){
    output=plan.narration;
    decision='Проверка не требуется; необходимые предметы: '+(plan.required.join(', ')||'нет');
  }else{
    const x=rpgCheck(r,plan.check.attr,plan.check.dc,plan.check.skill,r.pendingSmart?r.pendingSmart.action:'действие');
    decision=rpgRollLabel(x)+'; требуемые предметы: '+(plan.required.join(', ')||'нет');
    if(x.success){output=plan.success;}
    else{
      // Smart mode already selects the separate failure branch. Accept it only
      // when it conveys an actual refusal, not a disguised success-with-cost.
      const f=String(plan.failure||'');
      const unambiguous=/(?:не уда[её]тся|не получилось|не смог|не достига|не удалось|провал|промах|не соглаш|отказ|замечает|обнаруж|не попада|оста[её]тся закрыт|не открыва)/iu.test(f);
      const contradicted=/(?:но|однако|зато|всё же|все же|тем не менее)[^.!?]{0,120}(?:уда[её]тся|получа|достига|успеш|открыва|проника|убежда|забира|попада|попал|попала|прош[её]л|проходит|вош[её]л|получил|сумел)/iu.test(f);
      output=unambiguous&&!contradicted?f:rpgStrictOutcome(r,x,null);
    }
    r.pendingRoll=null; // all adjudication is complete in this hook
  }
  r.lastJudgement=decision;
  rpgDebugLog(r,decision);
  return {text:output,debug:decision};
}
