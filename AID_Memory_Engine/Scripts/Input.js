// Source provenance and triggers remain with imported Custom/Item/Race/Lore cards.
// Existing 1.4.7 facts and import markers are preserved; refresh enriches them.
function amImport(m,refresh){
  if(typeof storyCards==='undefined'||!Array.isArray(storyCards))return 'Story Cards недоступны в этом хуке.';
  let imported=0,updated=0,skipped=0,chars=0,places=0,factions=0,generic=0,owned=0;
  for(const c of storyCards){
    if(!c||typeof c!=='object')continue;
    const t=amStr(c.type||'Custom',50),nm=amStr(c.name||c.title||String(c.keys||'').split(',')[0],80),en=amStr(c.entry,1100);
    const cardId=c.id!==undefined&&c.id!==null?'id:'+c.id:'content:'+amKey(nm)+'|'+amKey(en.slice(0,80));
    if(en.startsWith(AM_CARD)||en.startsWith('[AID_RPG_EXPORT:1]')){owned++;continue;}
    if(!nm||!en){skipped++;continue;}
    const already=!!(m.imported[cardId]||(c.id!==undefined&&m.imported[String(c.id)]));
    if(already&&!refresh)continue;
    let item=null,kind='';const cat=amKey(t);
    if(/character|персонаж/.test(cat)){
      if(!already){const old=m.characters[amKey(nm)];item=amUpsert(m.characters,nm,{bio:old&&old.bio?'':en},['bio'],AM_CFG.maxChars);}
      kind='char';
    }else if(/location|место|локация/.test(cat)){
      if(!already){const old=m.places[amKey(nm)];item=amUpsert(m.places,nm,{description:old&&old.description?'':en},['description'],AM_CFG.maxPlaces);}
      kind='place';
    }else if(/faction|фракция|организация/.test(cat)){
      if(!already){const old=m.factions[amKey(nm)];item=amUpsert(m.factions,nm,{description:old&&old.description?'':en},['description'],AM_CFG.maxFactions);}
      kind='faction';
    }else{
      // Keep custom type and ALL trigger keys, not just the first keyword.
      const source='storycard:'+t;
      item=m.facts.find(x=>x.sourceCardId===cardId)||
        m.facts.find(x=>amKey(x.about)===amKey(nm)&&x.source===source);
      if(item){
        if(item.text!==en&&refresh){item.text=en;}
        item.triggers=amStr(c.keys,500);item.cardType=t;item.sourceCardId=cardId;
      }else if(m.facts.length<AM_CFG.maxFacts){
        item={id:amId(m),about:nm,text:en,source,triggers:amStr(c.keys,500),cardType:t,sourceCardId:cardId};m.facts.push(item);
      }
      kind='fact';
    }
    if(item){
      m.imported[cardId]=1;if(c.id!==undefined&&c.id!==null)m.imported[String(c.id)]=1;
      if(!already){imported++;if(kind==='char')chars++;else if(kind==='place')places++;else if(kind==='faction')factions++;else generic++;}
      else if(kind==='fact')updated++;
    }else if(!already)skipped++;
  }
  return 'Импорт: '+imported+' карточек (персонажи '+chars+', места '+places+', фракции '+factions+', прочие как факты '+generic+'); обновлено/сверено '+updated+'; не импортировано '+skipped+'; собственных/служебных '+owned+'.\n'+
    'Исходные карточки не изменены. Кастомные типы и ключи сохранены. ;mem list fact, ;mem show fact ID. Для обновления: ;mem import refresh.';
}
function amPlotStore(m,kind,text,source){
  const keys={context:'essentials',essentials:'essentials',summary:'summary',storysummary:'summary',authorsnote:'authorsnote',note:'authorsnote',instructions:'instructions',ai:'instructions'};
  const k=keys[amKey(kind)];if(!k)return 'Неизвестный Plot: essentials, summary, authorsnote, instructions.';
  const value=String(text||'').trim();if(value.length<4||value.length>3900)return 'Длина текста Plot: от 4 до 3900 символов. Раздели слишком длинный источник.';
  const prev=m.plotImports[k];if(prev&&prev.text===value)return 'Plot '+k+': без изменений.';
  m.plotImports[k]={text:value,source:source||'paste'};
  return 'Импорт Plot '+k+': '+value.length+' символов. Исходный Plot не изменён.';
}
function amImportPlotAvailable(m,apply){
  const mem=typeof state!=='undefined'?amObj(state.memory):{};
  const sources=[['essentials','context'],['authorsnote','authorsNote']];
  let saved=0,available=0,details=[];
  for(const [kind,key] of sources){
    const val=typeof mem[key]==='string'?mem[key].trim():'';
    // Memory may have been set by another Script, never assume it's the UI Plot.
    if(!val){details.push(kind+': недоступно');continue;}
    available++;details.push(kind+': доступно '+val.length+' символов');
    if(apply&&val.length<=3900&&!/^\[AID MEMORY/.test(val)){
      const r=amPlotStore(m,kind,val,'state.memory.'+key+' (возможно изменено другим скриптом)');
      if(r.startsWith('Импорт'))saved++;
    }
  }
  return (apply?'Plot из API: обновлено '+saved+'. ':'Plot (предпросмотр): доступных источников '+available+'. ')+details.join('; ')+
    '. Story Summary и AI Instructions не доступны через отдельные документированные поля. Для них используй ;mem import plot summary | Текст.';
}
// Portable, explicit handoff. No reading state.rpg or guessing RPG values.
function amRpgPayload(m,payload,source){
  const x=amObj(payload),hero=amObj(x.hero);
  if(x.source!=='Universal RPG'||x.version!==1||!amSafeName(hero.name))return 'Некорректный снимок. Нужны source="Universal RPG", version=1 и hero.name.';
  const cleanMap=(obj,limit)=>Object.fromEntries(Object.entries(amObj(obj)).slice(0,limit).filter(([k,v])=>
    k.length<=60&&k!=='__proto__'&&['string','number'].includes(typeof v)).map(([k,v])=>[amStr(k,60),amStr(v,90)]));
  const snap={source:'Universal RPG',version:1,hero:{name:amStr(hero.name,80),race:amStr(hero.race,90),class:amStr(hero.class,90),
    bio:amStr(hero.bio,650),appearance:amStr(hero.appearance,220),occupation:amStr(hero.occupation,120)},
    location:amStr(x.location,90),date:amDate(x.date),time:amTime(x.time),
    stats:cleanMap(x.stats,25),skills:cleanMap(x.skills,50),
    inventory:amArr(x.inventory).slice(0,60).map(q=>amStr(q,90)),
    notes:amArr(x.notes).slice(0,15).map(q=>amStr(q,220)),sourceLabel:source};
  const calendar=amObj(x.calendar);
  if(Number.isInteger(calendar.year)&&calendar.year>0&&calendar.year<=9999&&
     Number.isInteger(calendar.month)&&calendar.month>=1&&calendar.month<=12&&
     Number.isInteger(calendar.day)&&calendar.day>=1&&calendar.day<=30){
    snap.calendar={year:calendar.year,month:calendar.month,day:calendar.day,time:amTime(calendar.time)};
  }
  if(JSON.stringify(m.rpgSnapshot)===JSON.stringify(snap))return 'Снимок Universal RPG уже сохранён, изменений нет.';
  if(!m.characters[amKey(snap.hero.name)]&&Object.keys(m.characters).length>=AM_CFG.maxChars)return 'Лимит персонажей: снимок RPG не импортирован.';
  // Do not overwrite the character's manually managed identity or mechanical values.
  const current=m.characters[amKey(snap.hero.name)];
  const fill={};for(const key of ['bio','appearance','occupation'])if(snap.hero[key]&&!(current&&current[key]))fill[key]=snap.hero[key];
  const c=amUpsert(m.characters,snap.hero.name,fill,['bio','appearance','occupation'],AM_CFG.maxChars);
  if(!c)return 'Лимит персонажей: снимок RPG не импортирован.';
  m.rpgSnapshot=snap;
  if(snap.location&&!c.at)c.at=snap.location;
  amDirty(m,'char',c.name);
  return 'Снимок Universal RPG импортирован для '+c.name+'. Механические stats/skills/inventory сохранены отдельно как справка, не изменяют игровой RPG.';
}
function amRpgCardImport(m){
  if(typeof storyCards==='undefined'||!Array.isArray(storyCards))return 'API Story Cards недоступен; вставь JSON через ;mem import rpg paste | {JSON}.';
  const prefix='[AID_RPG_EXPORT:1]';const list=storyCards.filter(c=>String(c&&c.entry||'').startsWith(prefix));
  if(!list.length)return 'Карточка экспорта Universal RPG не найдена. RPG должен создать Custom Story Card с Entry, начинающимся с '+prefix+'.';
  const c=list[list.length-1],body=String(c.entry).slice(prefix.length).trim();
  if(body.length>5000)return 'Экспорт RPG слишком длинный (максимум 5000 символов).';
  try{return amRpgPayload(m,JSON.parse(body),'storycard:'+String(c.id));}
  catch(e){return 'Ошибка JSON в Story Card Universal RPG: '+amStr(e.message,160);}
}
function amRpgNotesImport(m){
  const snap=m.rpgSnapshot;if(!snap)return 'Сначала импортируй снимок: ;mem import rpg card.';
  const notes=amArr(snap.notes).filter(x=>typeof x==='string'&&x.trim());let added=0;
  for(const note of notes)if(amFact(m,'Заметка RPG',note,'rpg-import'))added++;
  if(added)m.undo=null;
  return added?'Перенесено заметок в факты Memory Engine: '+added+'. Повторный импорт не создаёт дубликаты.':'Новых заметок для переноса нет.';
}
function amImportCommand(m,rest){
  const s=String(rest||'').trim();
  // AI Dungeon Do may append a sentence period to a standalone command.
  // Normalize ONLY argument-free import subcommands: never touch JSON, Plot
  // payloads after '|', or the punctuation within the imported material.
  const route=s.indexOf('|')===-1?s.replace(/[.!?]+\s*$/,'').trim():s;
  if(!route){m.undo=null;return amImport(m,false)+'\n'+amImportPlotAvailable(m,true);}
  if(/^refresh$/i.test(route)){m.undo=null;return amImport(m,true);}
  if(/^preview$/i.test(route))return 'Story Cards доступно: '+(typeof storyCards!=='undefined'&&Array.isArray(storyCards)?storyCards.length:'нет API')+'.\n'+amImportPlotAvailable(m,false);
  if(/^plot\s*$/i.test(route))return 'Plot: ;mem import plot auto (прочитать доступные state.memory.context / authorsNote); ;mem import plot essentials | Текст; также summary, authorsnote, instructions. Источник не удаляется.';
  if(/^plot\s+auto$/i.test(route))return amImportPlotAvailable(m,true);
  if(/^plot\s+status$/i.test(route))return 'Plot в базе: '+(Object.entries(amObj(m.plotImports)).map(([k,v])=>k+' ('+String(v.text||'').length+' символов; источник '+v.source+')').join('; ')||'пусто')+'.';
  const plot=/^plot\s+(essentials|context|summary|storysummary|authorsnote|note|instructions|ai)\s*\|\s*([\s\S]+)$/i.exec(s);
  if(plot)return amPlotStore(m,plot[1],plot[2],'paste');
  if(/^rpg\s*$/i.test(route))return 'Universal RPG изолирован. Варианты: ;mem import rpg card (служебная Story Card с [AID_RPG_EXPORT:1]); ;mem import rpg paste | {JSON}. Документ схемы — Obsidian «совместимость с RPG». Без экспорта RPG читать его state нельзя.';
  if(/^rpg\s+card$/i.test(route))return amRpgCardImport(m);
  if(/^rpg\s+notes$/i.test(route))return amRpgNotesImport(m);
  if(/^rpg\s+status$/i.test(route)){const r=m.rpgSnapshot;return r?'Снимок RPG: '+r.hero.name+'; вид '+(r.hero.race||'?')+'; класс '+(r.hero.class||'?')+'; место '+(r.location||'?')+'; дата '+(r.date||'?')+' '+(r.time||'')+'\nХарактеристики: '+JSON.stringify(r.stats)+'\nНавыки: '+JSON.stringify(r.skills)+'\nИнвентарь: '+r.inventory.join(', ')+'\nЗаметки: '+r.notes.join('; '):'Снимок Universal RPG ещё не импортирован.';}
  const rpg=/^rpg\s+paste\s*\|\s*([\s\S]+)$/i.exec(s);
  if(rpg){if(rpg[1].length>5000)return 'Слишком длинный RPG JSON (максимум 5000 символов).';
    try{return amRpgPayload(m,JSON.parse(rpg[1]),'paste');}catch(e){return 'Ошибка JSON RPG: '+amStr(e.message,160);}}
  return 'Синтаксис: ;mem import / import refresh / import preview / import plot auto / import plot essentials | Текст / import rpg card / import rpg paste | {JSON}.';
}

/* AID Memory Engine v1.7.0 — Input commands and batch templates.
   Library.js contains the shared engine and read-only help pages.
   Both Library.js and Input.js MUST be replaced together when upgrading from v1.4. */

/* ---------- portable transfer: explicit copy/paste, no cross-adventure APIs ---------- */
function amTransferCommand(m,rest){
  const text=String(rest||'').trim(),parts=text.split(/\s+/),action=(parts[0]||'status').toLowerCase();
  const head='ПЕРЕНОС ПАМЯТИ — ';
  if(action==='help'||action==='?')return head+'СПРАВКА\n'+
    ';mem transfer export — снимок всей подтверждённой памяти.\n'+
    ';mem transfer export world — только мир, места, фракции, факты и архив Plot.\n'+
    ';mem transfer part N — в старой игре получить готовую команду для копирования.\n'+
    ';mem transfer import ID N/TOTAL ДАННЫЕ — вставить команду в новой игре (каждую часть отдельно).\n'+
    ';mem transfer status — список принятых частей и их количество.\n'+
    ';mem transfer apply confirm — применить к ПУСТОЙ базе; apply replace confirm — заменить непустую.\n'+
    ';mem transfer cancel — убрать временно принятые части. Не изменяет канон.\n'+
    'Никакие Story Cards, история AI Dungeon, Memory Bank и state другого скрипта не копируются.';
  if(action==='export'){
    const scope=(parts[1]||'all').toLowerCase();
    if(parts.length>2||!['all','world'].includes(scope))return head+'Формат: ;mem transfer export [world]';
    const json=JSON.stringify(amTransferScopeData(m,scope)),payload=amTransferUTF8Encode(json);
    const total=Math.ceil(payload.length/AM_TRANSFER_CHUNK),id=amTransferChecksum(payload);
    if(total>AM_TRANSFER_MAX_PARTS)return head+'Слишком много частей ('+total+'). Используй export world или сократи подтверждённую базу.';
    m.transferOut={id,total,data:payload,scope};
    return head+'ЭКСПОРТ ПОДГОТОВЛЕН\nРежим: '+scope+'; частей: '+total+'; идентификатор: '+id+'; JSON '+json.length+' символов.\n'+
      'В старом приключении: ;mem transfer part 1 ... '+total+'. Скопируй КАЖДУЮ показанную строку целиком в новое приключение.\n'+
      'В новом приключении: ;mem transfer status; затем ;mem transfer apply confirm (или apply replace confirm для замены).\n'+
      'Экспорт — зафиксированный снимок. Для новых изменений повтори transfer export. RPG-снимок и неподтверждённые предложения не включены.';
  }
  if(action==='part'){
    const x=amObj(m.transferOut),n=Number(parts[1]);
    if(!x.data)return head+'Сначала выполни ;mem transfer export в ИСХОДНОЙ истории.';
    if(parts.length!==2||!Number.isSafeInteger(n)||n<1||n>x.total)return head+'Номер от 1 до '+x.total+'.';
    const chunk=x.data.slice((n-1)*AM_TRANSFER_CHUNK,n*AM_TRANSFER_CHUNK);
    return head+'ЧАСТЬ '+n+'/'+x.total+' (скопируй следующую строку целиком):\n'+
      ';mem transfer import '+x.id+' '+n+'/'+x.total+' '+chunk;
  }
  if(action==='import'){
    const matched=/^import\s+([0-9a-f]{16})\s+(\d+)\/(\d+)\s+([A-Za-z0-9_-]+)[.!?]*$/i.exec(text);
    if(!matched)return head+'Формат: ;mem transfer import ID N/TOTAL ДАННЫЕ. Команду получи в исходном приключении через transfer part N.';
    const id=matched[1].toLowerCase(),n=Number(matched[2]),total=Number(matched[3]),chunk=matched[4];
    if(!Number.isSafeInteger(total)||total<1||total>AM_TRANSFER_MAX_PARTS||!Number.isSafeInteger(n)||n<1||n>total||chunk.length>AM_TRANSFER_CHUNK)return head+'Некорректный номер, количество частей или размер блока.';
    let bucket=amObj(m.transferIn);
    if(bucket.id&&(bucket.id!==id||bucket.total!==total))return head+'В очереди другой снимок ('+bucket.id+'). Выполни transfer cancel, прежде чем вставлять новые части.';
    if(!bucket.id)bucket={id,total,chunks:{}};
    bucket.chunks=amObj(bucket.chunks);
    if(bucket.chunks[n]&&bucket.chunks[n]!==chunk)return head+'Часть '+n+' отличается от ранее принятой. Выполни transfer cancel и перенеси снимок повторно.';
    bucket.chunks[n]=chunk;m.transferIn=bucket;
    const count=Object.keys(bucket.chunks).length;
    return head+'ПРИНЯТА ЧАСТЬ '+n+'/'+total+'. Получено '+count+'/'+total+'. '+(count===total?'Теперь выполни ;mem transfer apply confirm.':'Следующая отсутствующая: '+Array.from({length:total},(_,i)=>i+1).find(i=>!bucket.chunks[i])+'.');
  }
  if(action==='status'||action===''){
    const bucket=amObj(m.transferIn),out=amObj(m.transferOut);
    const imported=bucket.id?Object.keys(amObj(bucket.chunks)).length+'/'+bucket.total+', ID '+bucket.id:'нет';
    const missing=bucket.id?Array.from({length:bucket.total},(_,i)=>i+1).filter(i=>!bucket.chunks[i]).slice(0,25).join(', '):'';
    return head+'СТАТУС\nВходящий снимок: '+imported+(missing?'\nНедостающие части (первые 25): '+missing:'')+'\nИсходящий снимок: '+(out.id?out.id+', частей '+out.total+', режим '+out.scope:'нет')+'\nТекущая база: '+amTransferCounts(m)+'.';
  }
  if(action==='cancel'){
    m.transferIn=null;m.transferOut=null;return head+'Временные данные обмена удалены. Сохранённая память не затронута.';
  }
  if(action==='apply'){
    const bucket=amObj(m.transferIn);
    if(!bucket.id)return head+'Нет импортированных частей. Начни с ;mem transfer import ...';
    const slots=amObj(bucket.chunks);
    if(Object.keys(slots).length!==bucket.total)return head+'Получено '+Object.keys(slots).length+'/'+bucket.total+' частей. Сначала вставь остальные.';
    const replace=parts[1]==='replace'&&parts[2]==='confirm'&&parts.length===3;
    const normal=parts[1]==='confirm'&&parts.length===2;
    let doc;
    try{
      const data=Array.from({length:bucket.total},(_,i)=>slots[i+1]).join('');
      if(amTransferChecksum(data)!==bucket.id)throw Error('Контрольная сумма не совпала: одна из частей повреждена.');
      const raw=amTransferUTF8Decode(data);if(raw.length>800000)throw Error('Снимок слишком большой.');
      doc=JSON.parse(raw);amTransferValidate(doc);
    }catch(e){return head+'ОШИБКА ПРОВЕРКИ: '+amStr(e.message,200)+'. Данные не изменены.';}
    const incoming=amTransferCounts(doc.data);
    if(!replace&&!normal)return head+'ПРЕДПРОСМОТР\nПроверка частей и контрольной суммы: пройдена. Режим: '+doc.scope+'.\n'+
      'БУДЕТ ИМПОРТИРОВАНО: '+incoming+'.\nСЕЙЧАС В БАЗЕ: '+amTransferCounts(m)+'.\n'+
      (amTransferHasCanon(m)?'В базе уже есть данные. Для полной ЗАМЕНЫ: ;mem transfer apply replace confirm.':'Для применения: ;mem transfer apply confirm.')+
      '\nНичего не изменено.';
    if(amTransferHasCanon(m)&&!replace)return head+'Текущая база непустая! Чтобы ЗАМЕНИТЬ её, используй ;mem transfer apply replace confirm. Данные не изменены.';
    const owned=(typeof storyCards!=='undefined'&&Array.isArray(storyCards))?
      storyCards.filter(c=>String(c&&c.entry||'').startsWith(AM_CARD)).length:0;
    if(owned)return head+'В ЦЕЛЕВОМ ПРИКЛЮЧЕНИИ найдено '+owned+' старых Story Cards Memory Engine. '+
      'Сначала удали их через ;mem reset cards confirm (может потребоваться несколько вызовов), затем повтори transfer apply. База не изменена.';
    const d=doc.data;
    // Build destination first, then commit. No partial overwrites on invalid input.
    const fresh=amBlankState();fresh.config={...fresh.config,auto:m.config.auto,cards:m.config.cards};
    const fields=doc.scope==='world'?['world','places','factions','facts','plotImports','provenance']:
      ['world','date','time','place','characters','places','factions','relations','facts','events','days','months','arcs','plans','nextId','plotImports','provenance','reviewHistory','reviewSeen','reviewNextId'];
    for(const key of fields)if(d[key]!==undefined)fresh[key]=d[key];
    const ids=[...amArr(fresh.facts),...amArr(fresh.events),...amArr(fresh.plans)].map(x=>x.id);
    fresh.nextId=Math.max(Number(fresh.nextId)||1,1,...ids.map(n=>Number(n)+1));
    for(const [type,records] of [['char',fresh.characters],['place',fresh.places],['faction',fresh.factions]])
      for(const row of Object.values(amObj(records)))amDirty(fresh,type,row.name);
    amResetState(m);Object.assign(m,fresh);
    // Invalidate imported Story Card IDs: IDs are adventure-local. Preserve only the canonical data.
    m.transferIn=null;m.transferOut=null;m.undo=null;m.imported={};m.rpgSnapshot=null;
    return head+'ИМПОРТ ПРИМЕНЁН. Режим: '+doc.scope+'; '+amTransferCounts(m)+'.\n'+
      'RPG-снимок НЕ перенесён, импортируй заново из Universal RPG. Сюжет и существующие Story Cards целевого приключения НЕ изменены. '+
      'Memory Engine создаст собственные карточки постепенно при следующих ходах, если cards=on.';
  }
  return head+'Неизвестная команда. ;mem transfer help';
}

function amBatchLegacyTemplate(kind){
  const common={
    char:';mem batch char Алиса\n§bio=Начинающая дизайнер\n§traits=Любознательная, упорная\n§appearance=Тёмные волосы, карие глаза\n§occupation=Стажёр\n§skills=Хорошо рисует\n§at=Офис Даны\n§skill=Рисование | уверенный | рисует эскизы от руки\n§:apply',
    place:';mem batch place Офис Даны\n§description=Кабинет на пятом этаже\n§kind=офис\n§status=работает\n§:apply',
    faction:';mem batch faction Местная полиция\n§description=Полицейское управление города\n§territory=Де-Мойн\n§goal=Поддерживать порядок\n§status=действует\n§:apply',
    arc:';mem batch arc Первый рабочий день\n§summary=Алиса знакомится с новым коллективом\n§status=идёт\n§start=2016-01-02\n§:apply',
    all:';mem batch\n§date=2016-01-02 09:06\n§world=Современные США, штат Айова\n§char=Алиса\n§bio=Молодая дизайнер\n§traits=Упорная\n§skill=Рисование | уверенный | умеет делать эскизы\n§char=Дана\n§bio=Руководитель отдела\n§rel=Дана -> Алиса | view=Интерес | reason=Впечатлена портфолио\n§place=Строй-Арт\n§description=Здание компании\n§kind=здание\n§place=Офис Даны\n§parent=Строй-Арт\n§description=Кабинет руководителя\n§event=2016-01-02 | Алиса познакомилась с Даной на работе | 2\n§day=2016-01-02 | Алиса приступила к работе\n§:apply'
  };
  return common[kind]||common.all;
}
/* ---------- v1.4: one-line commands inside an atomic batch ---------- */
function amBatchTemplate(kind){
  // Each command is a valid ordinary ;mem command. The § marker is only a
  // transport separator: it survives AI Dungeon's Do-mode newline flattening.
  const common={
    char:';mem batch\n§;mem char Алиса | bio=Молодая дизайнер | traits=Любознательная, решительная | appearance=Тёмные волосы | occupation=Стажёр | at=Офис Даны\n§;mem skill Алиса | Рисование | высокий | Рисует эскизы\n§:apply',
    skill:';mem batch\n§;mem skill Алиса | Рисование | высокий | Рисует эскизы\n§;mem skill Алиса | Переговоры | средний | Ведёт рабочие встречи\n§:apply',
    rel:';mem batch\n§;mem rel Алиса -> Дана | view=Уважение | reason=Помогла с работой | trust=40\n§;mem rel Дана -> Алиса | view=Интерес | reason=Увидела её портфолио\n§:apply',
    place:';mem batch\n§;mem place Строй-Арт | kind=здание | description=Офисное здание\n§;mem place Офис Даны | parent=Строй-Арт | kind=кабинет | description=Кабинет руководителя | status=Открыт\n§:apply',
    faction:';mem batch\n§;mem faction Местная полиция | description=Полицейское управление | territory=Де-Мойн | goal=Поддерживать порядок | status=Действует\n§;mem faction Строй-Арт | description=Компания дизайна | goal=Развивать бизнес | status=Работает\n§:apply',
    world:';mem batch\n§;mem world Современные США, штат Айова\n§;mem date 2016-01-02 09:06\n§;mem here Строй-Арт\n§:apply',
    fact:';mem batch\n§;mem fact Правила офиса | Рабочий день начинается в девять утра\n§;mem fact Пропуск | Для входа требуется служебная карта\n§:apply',
    event:';mem batch\n§;mem event 2016-01-02 | Алиса познакомилась с Даной на работе | 2\n§;mem event 2016-01-02 | Алиса получила предложение о стажировке | 3\n§:apply',
    day:';mem batch\n§;mem summary 2016-01-02 | Алиса устроилась на стажировку и познакомилась с руководителем\n§;mem summary 2016-01-03 | Алиса начала знакомиться с коллективом\n§:apply',
    arc:';mem batch\n§;mem arc Первая работа | summary=Алиса устраивается в компанию | status=Начало | start=2016-01-02\n§;mem arc Новый проект | summary=Подготовка первого заказа | status=Планируется\n§:apply',
    plan:';mem batch\n§;mem plan 2016-01-10 | Первое совещание | Представление проекта\n§;mem plan 2016-02-14 | День влюблённых | Праздничное событие | yearly\n§:apply',
    delete:';mem batch\n§;mem delete fact ID_ФАКТА\n§;mem delete plan ID_ПЛАНА\n§:apply',
    all:';mem batch\n§;mem world Современные США, штат Айова\n§;mem date 2016-01-02 09:06\n§;mem char Алиса | bio=Молодая дизайнер | traits=Упорная\n§;mem skill Алиса | Рисование | высокий | Делает эскизы\n§;mem char Дана | bio=Руководитель отдела\n§;mem rel Дана -> Алиса | view=Интерес | reason=Впечатлена портфолио\n§;mem place Строй-Арт | kind=здание | description=Здание компании\n§;mem place Офис Даны | parent=Строй-Арт | kind=кабинет | description=Кабинет руководителя\n§;mem faction Строй-Арт | description=Компания дизайна | goal=Развивать бизнес\n§;mem fact Условия найма | Стажировка продолжается две недели\n§;mem event 2016-01-02 | Алиса познакомилась с Даной на работе | 2\n§;mem summary 2016-01-02 | Алиса приступила к работе\n§;mem arc Новая работа | summary=Алиса знакомится с коллективом | status=Начало\n§;mem plan 2016-01-10 | Совещание | Первый проект\n§;mem here Офис Даны\n§:apply'
  };
  return common[kind]||null;
}

function amBatchDirect(m,source){
  const sourceLines=source.includes('§')?source.split('§'):source.split(/\r?\n/);
  const lines=sourceLines.map(x=>x.trim()).filter(Boolean);
  if(!lines.length)return 'Ошибка пакета: нет команд. Ничего не сохранено.';
  const last=lines.pop();
  if(!/^:apply[.!?]*$/i.test(last)&&! /^[!;:]mem\s+(?:apply|end)[.!?]*$/i.test(last))
    return 'Ошибка пакета: заверши блок §:apply или отдельной строкой ;mem apply. Ничего не сохранено.';
  if(lines.some(x=>/^:apply\b/i.test(x)||/^[!;:]mem\s+(?:apply|end)\b/i.test(x)))
    return 'Ошибка пакета: завершающая команда должна быть последней. Ничего не сохранено.';
  if(lines.length>55)return 'Ошибка пакета: не более 55 команд. Ничего не сохранено.';
  const ops=[];
  let error='';
  const futureChars=new Set();
  // Standalone skill commands must refer to existing or batch-created characters.
  for(const row of lines){const cleaned=row.replace(/^>\s*You\s+(?:try\s+to|say)\s+["'“]?/i,'').replace(/^>\s*You\s*/i,'').replace(/["'”]\s*$/,'').trim();
    const z=/^[!;:]mem\s+([a-z]+)(?:\s+([\s\S]*))?$/i.exec(cleaned);
    if(z&&z[1].toLowerCase()==='char'){const name=amParts(z[2]||'')[0];if(amSafeName(name))futureChars.add(amKey(name));}
  }
  for(let i=0;i<lines.length;i++){
    const row=lines[i].replace(/^>\s*You\s+(?:try\s+to|say)\s+["'“]?/i,'').replace(/^>\s*You\s*/i,'').replace(/["'”]\s*$/,'').trim();
    const z=/^[!;:]mem\s+([a-z]+)(?:\s+([\s\S]*))?$/i.exec(row);
    if(!z)return 'Ошибка пакета, команда '+(i+1)+': используй строку вида ;mem char Имя | bio=... . Ничего не сохранено.';
    const verb=z[1].toLowerCase(),arg=(z[2]||'').trim();
    if(!arg)return 'Ошибка пакета, команда '+(i+1)+': отсутствует значение после '+verb+'. Ничего не сохранено.';
    if(['char','place','faction','arc'].includes(verb)){
      const pp=amParts(arg),name=pp.shift();
      if(!amSafeName(name)||!pp.length)return 'Ошибка пакета, команда '+(i+1)+': формат '+verb+' Имя | поле=значение. Ничего не сохранено.';
      ops.push(verb+'='+name);
      for(const field of pp){const f=/^([^=]+?)\s*=\s*([\s\S]*)$/.exec(field);
        if(!f)return 'Ошибка пакета, команда '+(i+1)+': поле «'+field+'» должно быть key=значение. Ничего не сохранено.';
        ops.push(f[1].trim()+'='+f[2].trim());}
    }else if(verb==='skill'){
      const pp=amParts(arg),name=pp.shift();
      if(!amSafeName(name)||pp.length<2||pp.length>3)return 'Ошибка пакета, команда '+(i+1)+': skill Персонаж | Навык | Уровень | Детали. Ничего не сохранено.';
      if(!m.characters[amKey(name)]&&!futureChars.has(amKey(name)))return 'Ошибка пакета, команда '+(i+1)+': персонаж «'+name+'» не существует в базе и не создаётся в этом пакете. Ничего не сохранено.';
      ops.push('char='+name,'skill='+pp.join(' | '));
    }else if(['world','date','here','rel','fact','event','plan'].includes(verb))ops.push(verb+'='+arg);
    else if(verb==='summary')ops.push('day='+arg);
    else if(verb==='delete')ops.push('delete='+arg);
    else return 'Ошибка пакета, команда '+(i+1)+': '+verb+' не поддерживается в пакетном изменении. Разрешены char/place/faction/arc/skill/rel/world/date/here/fact/event/summary/plan/delete. Ничего не сохранено.';
  }
  // Convert to the existing transactional validator. No writes before its validation.
  if(ops.length>55)return 'Ошибка пакета: превышен лимит 55 полей после развёртывания команд. Раздели пакет. Ничего не сохранено.';
  return amBatchCommand(m,'§'+ops.join('§')+'§:apply');
}
function amBatchCommand(m,rest){
  const source=String(rest||'').trim();
  if(/^(?:help|\?)$/i.test(source))return amHelp('batch');
  const tm=/^template(?:\s+(legacy))?(?:\s+(char|place|faction|arc|skill|rel|fact|event|day|plan|world|delete|all))?$/i.exec(source);
  if(tm)return tm[1]?amBatchLegacyTemplate((tm[2]||'all').toLowerCase()):(amBatchTemplate((tm[2]||'all').toLowerCase())||'Неизвестный шаблон. ;mem batch help');
  if(/(?:^|§|\n)\s*[!;:]mem\s+[a-z]+\b/i.test(source))return amBatchDirect(m,source);
  if(!source.includes('§'))return 'Не найдено полей §... . Пример: ;mem batch template char (получить готовую форму).';
  const parts=source.split('§');
  const prefix=parts.shift().trim();
  const directives=parts.map(x=>x.trim()).filter(Boolean);
  if(directives.length>55)return 'Ошибка пакета: не более 55 полей за одно действие. Ничего не сохранено.';
  if(!directives.length||!/^:apply[.!?]*$/i.test(directives[directives.length-1]))return 'Ошибка пакета: добавь §:apply В КОНЦЕ блока. Ничего не сохранено.';
  directives.pop();
  if(directives.some(x=>/^:apply\b/i.test(x)))return 'Ошибка пакета: §:apply допустим только в конце. Ничего не сохранено.';
  const initial=/^(?:(char|place|faction|arc)(?:\s+(.+))?)?$/i.exec(prefix);
  if(!initial)return 'Ошибка пакета: после ;mem batch можно указать только char/place/faction/arc и имя. Ничего не сохранено.';
  const operations=[];
  let current=null;
  if(initial[1]){current={kind:initial[1].toLowerCase(),name:amStr(initial[2]||'',80),fields:{},skills:[]};operations.push(current);}
  function invalid(i,why){return 'Ошибка пакета, поле '+(i+1)+': '+why+' Ничего не сохранено.';}
  const safeName=amSafeName;
  const allowedRel=['view','reason','tags','trust'];
  for(let i=0;i<directives.length;i++){
    const line=directives[i];const mm=/^([^=]+?)\s*=\s*([\s\S]*)$/.exec(line);
    if(!mm)return invalid(i,'ожидается §поле=значение.');
    const rawKey=amKey(mm[1]),key=AM_BATCH_ALIASES[rawKey]||rawKey,val=mm[2].trim();
    if(!val)return invalid(i,'пустое поле '+rawKey+'.');
    if(['char','place','faction','arc'].includes(key)){
      if(!safeName(val))return invalid(i,'некорректное имя объекта.');
      current={kind:key,name:val,fields:{},skills:[]};operations.push(current);continue;
    }
    if(key==='name'){
      if(!current||current.name)return invalid(i,'name допустимо только в неназванном разделе.');
      if(!safeName(val))return invalid(i,'некорректное имя объекта.');
      current.name=val;continue;
    }
    if(key==='skill'){
      if(!current||current.kind!=='char')return invalid(i,'skill можно добавлять только внутри char.');
      const p=amParts(val);if(p.length<2||p.length>3||!amStr(p[0],66)||p[0].length>65||!p[1]||p[1].length>65||(p[2]||'').length>170)return invalid(i,'формат skill: Навык | Уровень | Детали.');
      current.skills.push({name:p[0],level:p[1],details:p[2]||''});continue;
    }
    if(current&&AM_BATCH_FIELDS[current.kind].includes(key)){
      const max=['bio','description','summary'].includes(key)?650:260;
      if(val.length>max)return invalid(i,'поле '+key+' длиннее '+max+' символов.');
      current.fields[key]=val;continue;
    }
    // Non-entity operations can appear between named sections. They do not implicitly
    // attach fields to previously named entities.
    current=null;
    if(['world','here','date','fact','event','day','plan','rel','delete'].includes(key)){
      if(key==='delete'){
        const z=/^(char|place|faction|arc|rel|event|fact|plan|skill)\s+(.+)$/i.exec(val);
        if(!z)return invalid(i,'delete: тип и имя/ID (например char Алиса или fact 15).');
        if(['event','fact','plan'].includes(z[1].toLowerCase())&&!/^[1-9]\d*$/.test(z[2]))return invalid(i,'delete: ID должен быть положительным целым.');
        if(z[1].toLowerCase()==='skill'){const p=amParts(z[2]);if(p.length!==2||!safeName(p[0])||!p[1])return invalid(i,'delete skill: Персонаж | Навык.');}
        if(z[1].toLowerCase()==='rel'&&!/^(.+?)\s*->\s*(.+)$/.test(z[2]))return invalid(i,'delete rel: А -> Б.');
        if(!['skill','rel','event','fact','plan'].includes(z[1].toLowerCase())&&!safeName(z[2]))return invalid(i,'delete: некорректное имя.');
      }
      if(key==='world'&&val.length>1700)return invalid(i,'world длиннее 1700 символов.');
      if(key==='here'&&val.length>90)return invalid(i,'here длиннее 90 символов.');
      if(key==='date'){
        const dp=val.split(/\s+/);
        if(dp.length>2||!amDate(dp[0])||(dp[1]&&!amTime(dp[1])))return invalid(i,'дата: YYYY-MM-DD [HH:MM].');
      }
      if(key==='fact'){
        const pp=amParts(val);if(pp.length!==2||!pp[0]||pp[0].length>85||pp[1].length<8||pp[1].length>380)return invalid(i,'fact: Тема | Текст (8–380 символов).');
      }
      if(key==='event'){
        const pp=amParts(val);let idx=0;
        if(amDate(pp[0]))idx=1;
        if(pp.length<idx+1||pp.length>idx+2||pp[idx].length<8||pp[idx].length>300)return invalid(i,'event: [YYYY-MM-DD |] Событие | 1..3.');
        if(pp.length===idx+2&&!/^[123]$/.test(pp[idx+1]))return invalid(i,'значимость события: 1, 2 или 3.');
      }
      if(key==='day'){
        const pp=amParts(val);if(pp.length!==2||!amDate(pp[0])||!pp[1]||pp[1].length>750)return invalid(i,'day: YYYY-MM-DD | Итог (до 750 символов).');
      }
      if(key==='plan'){
        const pp=amParts(val);if(pp.length<2||pp.length>4||!amDate(pp[0])||!pp[1]||pp[1].length>90||(pp[2]||'').length>230||(pp[3]&&pp[3]!=='yearly'))return invalid(i,'plan: YYYY-MM-DD | Название | Примечание | yearly (необязательно).');
      }
      if(key==='rel'){
        const pp=amParts(val),z=/^(.+?)\s*->\s*(.+)$/.exec(pp.shift()||'');
        if(!z||!safeName(z[1])||!safeName(z[2])||amKey(z[1])===amKey(z[2])||!pp.length)return invalid(i,'rel: А -> Б | view=... или reason=... .');
        for(const f of pp){const zf=/^([^=]+?)\s*=\s*(.+)$/.exec(f);
          const fk=zf?(AM_BATCH_ALIASES[amKey(zf[1])]||amKey(zf[1])):'';
          if(!allowedRel.includes(fk)||!zf[2].trim())return invalid(i,'неверное поле отношения.');
          if(fk==='trust'&&(!/^-?\d+$/.test(zf[2].trim())||Number(zf[2])< -100||Number(zf[2])>100))return invalid(i,'trust должен быть целым от -100 до 100.');
          if(zf[2].trim().length>(fk==='reason'?360:190))return invalid(i,'значение '+fk+' слишком длинное.');
        }
      }
      operations.push({kind:key,value:val});continue;
    }
    return invalid(i,'поле '+rawKey+' не разрешено в текущем разделе.');
  }
  if(!operations.length)return 'В пакете нет записей. Ничего не сохранено.';
  for(let i=0;i<operations.length;i++){
    const op=operations[i];if(AM_BATCH_FIELDS[op.kind]){
      if(!safeName(op.name))return 'Ошибка пакета, объект '+(i+1)+': отсутствует или некорректно имя. Ничего не сохранено.';
      if(!Object.keys(op.fields).length&&!op.skills.length)return 'Ошибка пакета: у «'+op.name+'» нет полей или навыков. Ничего не сохранено.';
    }
  }
  // Work on a detached copy. If any limit or validation fails, original state is untouched.
  const shadow=JSON.parse(JSON.stringify(m));
  const previous=JSON.parse(JSON.stringify(amSnapshot(m)));
  const totals={char:0,place:0,faction:0,arc:0,skill:0,rel:0,event:0,fact:0,day:0,plan:0,date:0,world:0,here:0,delete:0};
  const removedCards=[];
  let changed=0,touchedPlaces=[];
  for(let i=0;i<operations.length;i++){
    const op=operations[i],kind=op.kind;let ok=true;
    if(AM_BATCH_FIELDS[kind]){
      const maps={char:shadow.characters,place:shadow.places,faction:shadow.factions,arc:shadow.arcs};
      const limits={char:AM_CFG.maxChars,place:AM_CFG.maxPlaces,faction:AM_CFG.maxFactions,arc:AM_CFG.maxArcs};
      const item=amUpsert(maps[kind],op.name,op.fields,AM_BATCH_FIELDS[kind],limits[kind]);
      if(!item)ok=false;
      else {
        for(const sk of op.skills){if(!amSkill(item,sk.name,sk.level,sk.details)){ok=false;break;}totals.skill++;}
        if(kind==='place'&&Object.prototype.hasOwnProperty.call(op.fields,'parent'))touchedPlaces.push(op.name);
        if(kind!=='arc')amDirty(shadow,kind,op.name);
      }
    }else{
      const pp=amParts(op.value);
      if(kind==='world')shadow.world=amStr(op.value,1700);
      else if(kind==='here')shadow.place=amStr(op.value,90);
      else if(kind==='date'){const dp=op.value.split(/\s+/);shadow.date=dp[0];if(dp[1])shadow.time=dp[1];}
      else if(kind==='fact'){if(!amFact(shadow,pp[0],pp[1],'user')){const has=shadow.facts.some(x=>amKey(x.about)===amKey(pp[0])&&amKey(x.text)===amKey(pp[1]));ok=has;}}
      else if(kind==='event'){
        const hasDate=!!amDate(pp[0]),d=hasDate?pp[0]:shadow.date,desc=hasDate?pp[1]:pp[0],imp=hasDate?pp[2]:pp[1];
        if(!amEvent(shadow,d,desc,imp||1,shadow.time,'user')){
          const dd=amDate(d)||'без даты';ok=shadow.events.some(x=>x.date===dd&&amKey(x.text)===amKey(desc));
        }
      }else if(kind==='day'){
        if(!shadow.days[pp[0]])shadow.days[pp[0]]={summary:'',events:[]};
        shadow.days[pp[0]].summary=pp[1];amCompactDays(shadow);
      }else if(kind==='plan'){
        const exists=shadow.plans.some(x=>x.date===pp[0]&&amKey(x.title)===amKey(pp[1]));
        if(!exists){if(shadow.plans.length>=AM_CFG.maxPlans)ok=false;
          else shadow.plans.push({id:amId(shadow),date:pp[0],title:pp[1],details:pp[2]||'',recurrence:pp[3]==='yearly'?'yearly':''});}
      }else if(kind==='delete'){
        const mm=/^(char|place|faction|arc|rel|event|fact|plan|skill)\s+(.+)$/i.exec(op.value);
        const type=mm[1].toLowerCase(),name=mm[2].trim();
        if(type==='skill'){
          const pair=amParts(name),c=shadow.characters[amKey(pair[0])];
          ok=!!(c&&c.skillSet&&c.skillSet[amKey(pair[1])]);
          if(ok){delete c.skillSet[amKey(pair[1])];amDirty(shadow,'char',c.name);}
        }else if(['event','fact','plan'].includes(type)){
          const col=type==='event'?'events':type==='fact'?'facts':'plans',id=Number(name),before=shadow[col].length;
          shadow[col]=shadow[col].filter(x=>x.id!==id);ok=shadow[col].length<before;
          if(ok&&type==='event')for(const d of Object.values(shadow.days))d.events=d.events.filter(x=>x!==id);
        }else if(type==='rel'){
          const r=/^(.+?)\s*->\s*(.+)$/.exec(name),key=r?amKey(r[1])+'→'+amKey(r[2]):'';
          ok=!!shadow.relations[key];if(ok){amDirty(shadow,'char',shadow.relations[key].from);delete shadow.relations[key];}
        }else{
          const map=type==='char'?shadow.characters:type==='place'?shadow.places:type==='faction'?shadow.factions:shadow.arcs;
          const key=amKey(name);ok=!!map[key];
          if(ok&&type==='place'&&Object.values(shadow.places).some(x=>amKey(x.parent)===key))ok=false;
          if(ok){delete map[key];
            if(type==='char')for(const [rk,rel] of Object.entries(shadow.relations))if(amKey(rel.from)===key||amKey(rel.to)===key){if(amKey(rel.from)!==key)amDirty(shadow,'char',rel.from);delete shadow.relations[rk];}
            if(type!=='arc')removedCards.push(AM_CARD+type+':'+key+']');
          }
        }
      }else if(kind==='rel'){
        const rel=pp.shift(),z=/^(.+?)\s*->\s*(.+)$/.exec(rel),params={};
        for(const f of pp){const x=/^([^=]+?)\s*=\s*(.+)$/.exec(f);params[AM_BATCH_ALIASES[amKey(x[1])]||amKey(x[1])]=x[2].trim();}
        const item=amRel(shadow,z[1],z[2],params);ok=!!item;
        if(ok)amDirty(shadow,'char',item.from);
      }
    }
    if(!ok)return 'Ошибка пакета, запись '+(i+1)+': достигнут лимит или невозможно сохранить значение. Ничего не сохранено.';
    totals[kind]++;changed++;
  }
  const parentError=amParentCheck(shadow,touchedPlaces);
  if(parentError)return 'Ошибка пакета: '+parentError+' Ничего не сохранено.';
  for(const key of Object.keys(amSnapshot(shadow)))m[key]=shadow[key];
  m.cardDirty=shadow.cardDirty;
  // Removing script-owned Story Cards is a post-commit side effect. Undo cannot restore them.
  if(removedCards.length&&typeof storyCards!=='undefined'&&Array.isArray(storyCards)&&typeof removeStoryCard==='function'){
    for(const tag of removedCards){const idx=storyCards.findIndex(c=>String(c.entry||'').startsWith(tag));
      if(idx>=0)try{removeStoryCard(idx);}catch(err){m.cardErrors++;}}
  }
  m.undo={snapshot:previous,kind:'batch',count:changed};
  return 'Пакет применён целиком ('+changed+' записей/операций). '+Object.entries(totals).filter(x=>x[1]).map(x=>x[0]+': '+x[1]).join('; ')+'.\nПроверка: ;mem status, ;mem list char (или place, faction, rel, arc, fact), ;mem day. Откат до следующего обновления: ;mem undo. Story Cards уже после записи могут потребовать отдельной правки при откате.';
}

/* ---------- v1.7.0: explicit, marker-restricted reset ---------- */
function amOwnedCardIndices(){
  if(typeof storyCards==='undefined'||!Array.isArray(storyCards))return null;
  // Markers written by amCards(), at offset 0. Do not use card names/keys:
  // custom and imported user cards must remain untouched.
  const pattern=/^\[AIDMEM:1:(?:char|place|faction):[^\]\r\n]+\](?:\r?\n|$)/;
  const result=[];
  for(let i=0;i<storyCards.length;i++){
    if(pattern.test(String(storyCards[i]&&storyCards[i].entry||'')))result.push(i);
  }
  return result;
}
// Safe live dry-run for each reset scope. Do not change m, storyCards or state here.
function amResetDataPreview(m){
  const chars=Object.values(amObj(m.characters));
  const skills=chars.reduce((n,c)=>n+Object.keys(amObj(c.skillSet)).length,0);
  const row=(label,count)=>'  '+label+': '+count;
  return 'БАЗА state.aidm — будет очищено:\n'+[
    row('Описание мира',amStr(m.world,1700)?1:0),
    row('Игровая дата',amStr(m.date,20)?1:0),
    row('Игровое время',amStr(m.time,10)?1:0),
    row('Текущее место героя',amStr(m.place,80)?1:0),
    row('Персонажи',chars.length),
    row('Навыки персонажей (включены в карточки персонажей)',skills),
    row('Локации',Object.keys(amObj(m.places)).length),
    row('Фракции',Object.keys(amObj(m.factions)).length),
    row('Направленные отношения',Object.keys(amObj(m.relations)).length),
    row('Факты',amArr(m.facts).length),
    row('События',amArr(m.events).length),
    row('Записи дней (включая сводки)',Object.keys(amObj(m.days)).length),
    row('Записи месяцев',Object.keys(amObj(m.months)).length),
    row('Сюжетные линии',Object.keys(amObj(m.arcs)).length),
    row('Календарные планы',amArr(m.plans).length),
    row('Фрагменты недавней истории',amArr(m.recent).length),
    row('Метки ранее импортированных карточек',Object.keys(amObj(m.imported)).length),
    row('Импортированные разделы Plot',Object.keys(amObj(m.plotImports)).length),
    row('Снимок Universal RPG',m.rpgSnapshot?1:0),
    row('Предложения автопамяти к проверке',amArr(m.reviewQueue).filter(x=>x.tier==='proposed').length),
    row('Непроверенные наблюдения',amArr(m.reviewQueue).filter(x=>x.tier==='observation').length),
    row('Журнал решений',amArr(m.reviewHistory).length),
    row('Сохранённые источники полей',Object.keys(amObj(m.provenance)).length),
    row('Очередь обновления Story Cards',amArr(m.cardDirty).length)
  ].join('\n')+'\n  Также будут сброшены: настройки, счётчики, последний откат и служебные данные.';
}
function amResetCardsPreview(owned){
  if(owned===null)return 'STORY CARDS: число собственных карточек недоступно (API storyCards недоступен). '+
    'Карточки нельзя безопасно удалить без списка.';
  const counts={char:0,place:0,faction:0};
  for(const idx of owned){
    const entry=String(storyCards[idx]&&storyCards[idx].entry||'');
    const z=/^\[AIDMEM:1:(char|place|faction):/.exec(entry);
    if(z)counts[z[1]]++;
  }
  return 'STORY CARDS MEMORY ENGINE — будет удалено '+owned.length+':\n'+
    '  Карточки персонажей: '+counts.char+'\n'+
    '  Карточки локаций: '+counts.place+'\n'+
    '  Карточки фракций: '+counts.faction+'\n'+
    '  За вызов удаляется не больше 30 карточек; остаток требует повторной команды.';
}
function amResetPreview(m,kind,owned){
  const mode=kind?kind.toUpperCase():'ВЫБОР РЕЖИМА';
  const lines=['ПРЕДПРОСМОТР СБРОСА '+mode+' — ничего не удалено.'];
  if(!kind||kind==='data'||kind==='all')lines.push(amResetDataPreview(m));
  if(!kind||kind==='cards'||kind==='all')lines.push(amResetCardsPreview(owned));
  if(kind==='data')lines.push('Все Story Cards остаются (включая карточки Memory Engine).');
  if(kind==='cards')lines.push('База персонажей, мест, отношений и других записей сохранится; очередь карточек очистится, cards выключится.');
  if(kind==='all')lines.push('База будет очищена ТОЛЬКО после удаления всех собственных Story Cards. При ошибке API база останется.');
  lines.push('Пользовательские Story Cards без метки Memory Engine, история приключения и Memory Bank не затрагиваются.');
  lines.push(kind?'Для выполнения введи отдельно: ;mem reset '+kind+' confirm':
    'Для выполнения выбери: ;mem reset data confirm / ;mem reset cards confirm / ;mem reset all confirm');
  lines.push('Операция необратима через ;mem undo. Сначала сделай копию приключения.');
  return lines.join('\n');
}
function amResetCommand(m,raw){
  const arg=String(raw||'').replace(/[.!?]+$/,'').trim().toLowerCase();
  const z=/^(data|cards|all)(?:\s+(confirm))?$/.exec(arg);
  const owned=amOwnedCardIndices();
  if(!arg)return amResetPreview(m,'',owned)+'\n;mem help reset — подробности.';
  if(!z)return 'Неизвестный режим сброса. Ничего не удалено.\n'+
    'Используй: ;mem reset data / ;mem reset cards / ;mem reset all';
  const kind=z[1];
  if(z[2]!=='confirm')return 'Нужно явное подтверждение.\n'+amResetPreview(m,kind,owned);
  if(kind==='data'){
    amResetState(m);
    return 'СБРОС DATA ВЫПОЛНЕН: очищена только база state.aidm. '+
      'Существующие Story Cards (включая карточки Memory Engine), история и Memory Bank не удалены.';
  }
  if(owned===null)return 'СБРОС ОТМЕНЁН: список Story Cards недоступен в Input. '+
    'База state.aidm сохранена. Проверь API и попробуй позже.';
  if(owned.length&&typeof removeStoryCard!=='function')return 'СБРОС ОТМЕНЁН: removeStoryCard недоступна. '+
    'База и карточки сохранены; удаление вручную возможно в интерфейсе AI Dungeon.';
  // Disable synchronization before touching any cards, including partial failure.
  // Otherwise the next Output hook could re-create deleted records.
  m.config.cards=false;
  if(kind==='all')m.config.auto=false; // stop regeneration during multi-step reset
  m.cardDirty=[];
  m.undo=null;
  const max=30,targets=owned.slice(-max).reverse(); // descending indices are stable under splicing
  let removed=0,errors=0;
  for(const index of targets){
    try{
      if(removeStoryCard(index)===false)throw Error('API returned false');
      removed++;
    }catch(err){errors++;m.cardErrors++;}
  }
  const remaining=owned.length-removed;
  const result='Story Cards Memory Engine: удалено '+removed+' из '+owned.length+
    '; осталось '+remaining+'; ошибок API '+errors+'.';
  if(kind==='cards'){
    return 'СБРОС CARDS: '+result+'\nБаза state.aidm сохранена. '+
      'Автосоздание карточек выключено (;mem cards off). '+
      (remaining?'Повтори ;mem reset cards confirm для оставшихся карточек.':'Готово.');
  }
  // ALL is deliberately not transactional across the remote Story Card API.
  // Keep database until every owned card is gone, even after a partial deletion.
  if(remaining)return 'СБРОС ALL НЕ ЗАВЕРШЁН: '+result+'\n'+
    'База state.aidm пока НЕ очищена. Автоматическая память и карточки выключены. '+
    'Повтори ;mem reset all confirm, чтобы продолжить.';
  amResetState(m);
  return 'СБРОС ALL ВЫПОЛНЕН: '+result+'\nБаза state.aidm очищена и инициализирована заново. '+
    'Пользовательские Story Cards, сюжет, Memory Bank и другие скрипты не затронуты.';
}

/* ---------- v1.3.1: topic-based, user-readable built-in help ---------- */
function amHelp(subject){
  const raw=amKey(subject||'');
  if(['transfer','перенос','экспорт памяти','копирование памяти'].includes(raw))return amTransferCommand(amInit(),'help');
  if(['review','проверка памяти','подтверждение','очередь','наблюдения','accept','reject'].includes(raw))return 'AID Memory v1.7.0 — ПРОВЕРКА АВТОПАМЯТИ\nПосле сцены рассказчик предлагает записи; до подтверждения они не изменяют биографии, отношения и Story Cards.\n;mem review — вся очередь; ;mem review ID — текст и источник.\n;mem accept ID — подтвердить предложение; ;mem accept ID replace — явно заменить вручную введённое поле.\n;mem edit ID | новое значение — исправить предложение, затем ;mem accept ID.\n;mem reject ID — отклонить; ;mem review log — журнал решений.\n;mem sources char Имя — источник текущих полей.\nНепроверенные наблюдения записываются как факты ТОЛЬКО после ;mem accept ID.\nАвтоматический отчёт не перезаписывает ручные данные. Старые записи без происхождения считаются защищёнными.';

  const topic=Object.prototype.hasOwnProperty.call(AM_HELP_ALIASES,raw)?AM_HELP_ALIASES[raw]:raw;
  if(topic==='all')return 'AID Memory v1.7.0 — СПРАВКА\nОБЩИЙ УКАЗАТЕЛЬ\n;mem review / review ID / review log — очередь, источник и решения.\n;mem accept ID [replace], ;mem edit ID | значение, ;mem reject ID — управление предложениями.\n;mem sources char Имя — происхождение подтверждённых полей.\n;mem transfer help — перенос памяти между приключениями.\n'+AM_HELP_PAGES.all;
  if(topic==='index')return 'AID Memory v1.7.0 — РАЗДЕЛЫ СПРАВКИ\n'+
    'Первые шаги: ;mem ping, ;mem status, ;mem help start, ;mem help syntax, ;mem help all\n'+
    'Мир: ;mem help world, ;mem help place, ;mem help faction\n'+
    'Персонажи: ;mem help char, ;mem help skill, ;mem help rel\n'+
    'История: ;mem help fact, ;mem help event, ;mem help day, ;mem help arc, ;mem help plan\n'+
    'Настройка: ;mem help batch, ;mem help auto, ;mem help cards, ;mem help review\n'+
    'Управление: ;mem help edit, ;mem help undo, ;mem help reset, ;mem help debug, ;mem help transfer\n'+
    'По-русски: ;mem help персонажи, ;mem help карта, ;mem help отношения, ;mem help календарь, ;mem help пакет.\n'+
    'Укажи тему после help, чтобы получить синтаксис, примеры и ограничения.';
  if(Object.prototype.hasOwnProperty.call(AM_HELP_PAGES,topic))return 'AID Memory v1.7.0 — СПРАВКА\n'+AM_HELP_PAGES[topic];
  return 'Неизвестный раздел справки «'+amStr(subject,70)+'».\n'+
    'Введи ;mem help для списка тем или ;mem help all для указателя команд.';
}
// Interpret only a command at the beginning of a player action, even when
// AI Dungeon wraps the text as Do, Say, or an instruction to type a command.
// Preserve all § directives and newline boundaries in batch inputs.
function amNormalizePlayerCommand(raw){
  let s=String(raw===undefined||raw===null?'':raw).slice(0,3950)
    .replace(/\r\n?/g,'\n').trim();
  // Some clients deliver the command inside an outer quote or fenced block.
  s=s.replace(/^```(?:text|plaintext)?\s*\n/i,'').replace(/\n?```\s*$/,'').trim();
  s=s.replace(/^(?:>\s*)?You\s+(?:(?:try|attempt)\s+to\s+)?(?:(?:say|type|write|enter|input|send|submit|run)\s*:?[ \t]*)?[\"'“]?/i,'').trim();
  s=s.replace(/^(?:>\s*)?You\s*:?[ \t]*/i,'').trim();
  s=s.replace(/^\s*(?:говорю|ввожу|пишу)\s*[:：]\s*/i,'');
  s=s.replace(/^[\"'“]+(?=[!;:]mem(?:\s|$))/i,'');
  s=s.replace(/[\"'”]\s*$/,'').trim();
  // A pasted one-line command may be preceded by an ordinary Do action verb.
  if(!/^[!;:]mem(?:\s|$)/i.test(s)){
    const z=/^(?:>\s*)?(?:You\s+)?(?:try\s+to\s+)?(?:type|write|say|enter|send|submit|run)\s+(?:the\s+command\s+)?[\"'“]?([!;:]mem(?:\s|$)[\s\S]*)/i.exec(s);
    if(z)s=z[1].replace(/[\"'”]\s*$/,'').trim();
  }
  return s;
}
function amCommand(m,raw){
  const original=String(raw||'');
  if(original.length>3950&&/[!;:]mem\s+batch\b/i.test(original))return 'Пакет превышает 3950 символов. Раздели его на два блока. Ничего не сохранено.';
  let s=amNormalizePlayerCommand(original);
  if(!/^[!;:]mem\s+(?:batch|import)(?:\s|$)/i.test(s))s=amStr(s,3950);
  const mch=/^[!;:]mem(?:\s+([\s\S]*))?$/i.exec(s);if(!mch)return null;
  let arg=(mch[1]||'').trim();
  if(/^[a-z]+[.!?]+$/i.test(arg))arg=arg.replace(/[.!?]+$/,'');
  if(/^help(?:\s+[^|§\r\n]+)?[.!?]+$/i.test(arg)||/^batch\s+(?:help|\?)[.!?]+$/i.test(arg))arg=arg.replace(/[.!?]+$/,'');
  const splitAt=arg.search(/\s/);
  const verb=(splitAt<0?arg:arg.slice(0,splitAt)).toLowerCase();
  let rest=splitAt<0?'':arg.slice(splitAt).trim();
  if(verb==='batch')return amBatchCommand(m,rest);
  if(verb==='transfer')return amTransferCommand(m,rest);
  if(!verb||verb==='help')return amHelp(verb==='help'?rest:'');
  if(verb==='debug'){
    const a=rest.replace(/[.!?]+$/,'').trim().toLowerCase();
    if(a==='on'||a==='full'||a==='off'){
      m.config.debug=a!=='off';m.config.debugFull=a==='full';
      if(a==='off')m.debugTrace=null;
      return 'AID Memory debug: '+a+'. '+(a==='off'?'Отладочные сообщения отключены.':'После игрового хода появится техническое сообщение; ;mem debug context — полный текст добавления.');
    }
    if(a==='context'){
      const d=amObj(m.debugTrace),c=amObj(d.context);
      return c.applied?'AID MEMORY — ПОСЛЕДНЕЕ ДОБАВЛЕНИЕ В КОНТЕКСТ ('+c.addedChars+' символов)\n'+c.content+'\n[Только добавление Memory Engine, не итоговый промпт AI Dungeon.]':
        'Контекст Memory Engine не добавлен: '+(c.reason||'нет зарегистрированного игрового хода с debug.');
    }
    if(a==='last')return amDebugText(m,true);
    if(!a||a==='status')return 'AID Memory debug: '+(m.config.debug?(m.config.debugFull?'full':'on'):'off')+'; последняя запись '+(m.debugTrace?'есть':'нет')+'.\n;mem debug on / full / off; ;mem debug last / context.';
    return 'Формат: ;mem debug on / full / off / status / last / context.';
  }
  if(verb==='status')return 'AID Memory v1.7.0: '+(m.config.auto?'извлечение включено':'извлечение выключено')+'; Story Cards '+(m.config.cards?'включены':'выключены')+'.\nИгровая дата: '+(m.date||'?')+' '+(m.time||'')+'; место: '+(m.place||'?')+'.\nПерсонажи '+Object.keys(m.characters).length+', места '+Object.keys(m.places).length+', фракции '+Object.keys(m.factions).length+', связи '+Object.keys(m.relations).length+', события '+m.events.length+', дни '+Object.keys(m.days).length+', арки '+Object.keys(m.arcs).length+', планы '+m.plans.length+'.\nАвтопакеты: '+m.accepted+'; без распознанного маркера: '+m.misses+'; ошибки карт: '+m.cardErrors+'; отклонённые связи родителей: '+m.validationErrors+'; источники Plot: '+Object.keys(m.plotImports||{}).length+'; снимок RPG: '+(m.rpgSnapshot?'да':'нет')+'.\nПредложения для проверки: '+m.reviewQueue.filter(x=>x.tier==='proposed').length+'; наблюдения: '+m.reviewQueue.filter(x=>x.tier==='observation').length+'.';
  if(verb==='ping')return 'AID Memory v1.7.0: Library и Input работают; сохранено персонажей '+Object.keys(m.characters).length+', мест '+Object.keys(m.places).length+'.';
  if(verb==='validate')return 'ПРОВЕРКА КАРТЫ\n'+(amPlaceIssues(m).join('\n')||'Ошибок вложенности не найдено.');
  if(verb==='auto'||verb==='cards'){rest=rest.replace(/[.!?]+$/,'');if(!/^(on|off)$/i.test(rest))return 'Формат: ;mem '+verb+' on/off';m.config[verb==='auto'?'auto':'cards']=rest==='on';return 'Режим '+verb+': '+rest;}
  if(['review','accept','edit','reject'].includes(verb))return amReviewCommand(m,verb,rest);
  if(verb==='sources')return amReviewProvenance(m,rest);
  if(verb==='reset')return amResetCommand(m,rest);
  if(verb==='undo')return amUndo(m);
  if(verb==='list')return amList(m,rest);
  if(verb==='import')return amImportCommand(m,rest);
  if(verb==='skill'){const p=amParts(rest),c=m.characters[amKey(p[0])];
    if(!c||!p[1]||!p[2])return 'Формат: ;mem skill Алиса | Дизайн | опытный | работает в студии (персонаж должен существовать).';
    if(!amSkill(c,p[1],p[2],p[3]))return 'Лимит или некорректное название навыка.';amDirty(m,'char',c.name);m.undo=null;return 'Навык персонажа '+c.name+' сохранён: '+p[1]+' = '+p[2];}
  if(verb==='skills'){const name=m.characters[amKey(rest)]?rest:rest.replace(/[.!?]+$/,'');const c=m.characters[amKey(name)];return c?c.name+': '+(amSkills(c)||c.skills||'навыков нет'):'Персонаж не найден.';}
  if(verb==='fact'){const p=amParts(rest),f=amFact(m,p[0],p[1],'user');if(!f)return 'Формат: ;mem fact Условия найма | Пробный период две недели';m.undo=null;return 'Факт #'+f.id+' сохранён: '+f.about+' — '+f.text;}
  if(verb==='summary'){const p=amParts(rest),d=amDate(p[0]);if(!d||!p[1])return 'Формат: ;mem summary 2016-01-02 | Краткий итог дня';if(!m.days[d])m.days[d]={summary:'',events:[]};m.days[d].summary=amStr(p[1],750);m.undo=null;return 'Итог '+d+' сохранён.';}
  if(verb==='delete'){
    const z=/^(char|place|faction|arc|rel|event|fact|plan|skill)\s+(.+)$/i.exec(rest);
    if(!z)return 'Формат: ;mem delete char Алиса / ;mem delete event 15';
    const type=z[1].toLowerCase(),name=z[2].trim();let ok=false;
    if(type==='skill'){const parts=amParts(name),c=m.characters[amKey(parts[0])];
      if(c&&c.skillSet&&c.skillSet[amKey(parts[1])]){delete c.skillSet[amKey(parts[1])];ok=true;amDirty(m,'char',c.name);}
    }else if(['event','fact','plan'].includes(type)){const col=type==='event'?'events':type==='fact'?'facts':'plans',id=Number(name),old=m[col].length;
      m[col]=m[col].filter(x=>x.id!==id);ok=m[col].length<old;
      if(type==='event')for(const d of Object.values(m.days))d.events=d.events.filter(x=>x!==id);
    }else if(type==='rel'){const r=/^(.+?)\s*->\s*(.+)$/.exec(name);const k=r?amKey(r[1])+'→'+amKey(r[2]):'';ok=!!m.relations[k];if(ok){amDirty(m,'char',m.relations[k].from);delete m.relations[k];}}
    else{const map=type==='char'?m.characters:type==='place'?m.places:type==='faction'?m.factions:m.arcs;const k=amKey(name);ok=!!map[k];
      if(ok&&type==='place'){const children=Object.values(m.places).filter(x=>amKey(x.parent)===k);if(children.length)return 'Сначала перенеси или удали дочерние локации: '+children.map(x=>x.name).join(', ')+'.';}
      if(ok){delete map[k];if(type==='char')for(const [key,rel] of Object.entries(m.relations))if(amKey(rel.from)===k||amKey(rel.to)===k){if(amKey(rel.from)!==k)amDirty(m,'char',rel.from);delete m.relations[key];}
        if(type!=='arc'&&typeof storyCards!=='undefined'&&typeof removeStoryCard==='function'){
          const idx=storyCards.findIndex(c=>String(c.entry||'').startsWith(AM_CARD+type+':'+k+']'));
          if(idx>=0)try{removeStoryCard(idx);}catch(err){m.cardErrors++;}
        }
      }
    }m.undo=null;return ok?'Удалено: '+type+' '+name:'Запись не найдена.';
  }
  if(verb==='world'){if(!rest)return m.world||'Описание мира не задано.';m.world=amStr(rest,1700);m.undo=null;return 'Мир обновлён: '+m.world;}
  if(verb==='date'){
    rest=rest.replace(/[.!?]+$/,'');const p=rest.split(/\s+/);if(!amDate(p[0]))return 'Формат: ;mem date 2016-01-02 09:06';
    if(p.length>2||p[1]&&!amTime(p[1]))return 'Время HH:MM некорректно.';
    m.date=p[0];if(p[1])m.time=p[1];m.undo=null;return 'Игровая дата: '+m.date+' '+m.time;}
  if(verb==='here'){if(!rest)return m.place||'Место не задано.';m.place=amStr(rest,90);m.undo=null;return 'Текущее место: '+m.place;}
  if(verb==='char'||verb==='place'||verb==='faction'||verb==='arc'){
    const p=amParts(rest);let name=amStr(p.shift(),85);if(!name)return 'Укажи название после ;mem '+verb;
    if(!p.length){const dict=verb==='char'?m.characters:verb==='place'?m.places:verb==='faction'?m.factions:m.arcs;
      if(!dict[amKey(name)]&&dict[amKey(name.replace(/[.!?]+$/,''))])name=name.replace(/[.!?]+$/,'');}
    const rawFields=p;
    if(!p.length){const dict=verb==='char'?m.characters:verb==='place'?m.places:verb==='faction'?m.factions:m.arcs;
      return dict[amKey(name)]?dict[amKey(name)].name+'\n'+amFmt(dict[amKey(name)]):'Нет записи. Используй разделители | и поля key=...';}
    const schema=verb==='char'?['bio','traits','appearance','skills','occupation','at']:verb==='place'?['description','parent','kind','status']:verb==='faction'?['description','territory','goal','status']:['summary','status','result','start','end'];
    const dest=verb==='char'?m.characters:verb==='place'?m.places:verb==='faction'?m.factions:m.arcs;
    const limit=verb==='char'?AM_CFG.maxChars:verb==='place'?AM_CFG.maxPlaces:verb==='faction'?AM_CFG.maxFactions:AM_CFG.maxArcs;
    if(!amSafeName(name))return 'Некорректное имя: нужно 2–80 символов, без специальных ключей и разделителя |.';
    const parsed=amParseFields(rawFields,schema);if(parsed.error)return parsed.error;
    const fields=parsed.fields;
    if(verb==='place'&&fields.parent){const issue=amValidParent(m,name,fields.parent);if(issue)return 'Локация не изменена: '+issue;}
    const u=amUpsert(dest,name,fields,schema,limit);if(!u)return 'Не удалось сохранить: проверь название или лимит записей.';
    if(verb!=='arc')amDirty(m,verb,name);m.undo=null;return 'Сохранено: '+verb+' '+u.name+'\n'+amFmt(u);}
  if(verb==='rel'){
    const p=amParts(rest),z=/^(.+?)\s*->\s*(.+)$/.exec(p.shift()||'');if(!z)return 'Формат: ;mem rel Дана -> Алиса | view=... | reason=... | tags=...';
    const parsed=amParseFields(p,['view','reason','tags','trust']);if(parsed.error)return parsed.error;
    if(!p.length)return 'Укажи хотя бы одно поле: view, reason, tags, trust.';
    if(parsed.fields.trust!==undefined&&(!/^-?\d+$/.test(parsed.fields.trust)||Number(parsed.fields.trust)<-100||Number(parsed.fields.trust)>100))
      return 'trust должен быть целым от -100 до 100; связь не изменена.';
    const r=amRel(m,z[1],z[2],parsed.fields);if(!r)return 'Не удалось сохранить связь.';
    amDirty(m,'char',r.from);m.undo=null;return 'Сохранено отношение '+r.from+' → '+r.to+': '+amFmt(r);}
  if(verb==='event'){
    const p=amParts(rest);let date=m.date,time=m.time,summary=p[0]||'';
    if(amDate(p[0])){date=p.shift();summary=p.shift()||'';}
    const fieldImportance=amDate(rest.split('|')[0].trim())?p[0]:p[1];
    if(p.length>(amDate(rest.split('|')[0].trim())?1:2)||fieldImportance!==undefined&&!/^[123]$/.test(fieldImportance))
      return 'Формат: ;mem event [Дата |] Событие (от 8 символов) | 1, 2 или 3.';
    const importance=fieldImportance?Number(fieldImportance):1;
    const e=amEvent(m,date,summary,importance,time,'user');if(!e)return 'Не удалось добавить событие: описание должно содержать минимум 8 символов и не повторять прежнюю запись.';
    m.undo=null;return 'Событие #'+e.id+' записано на '+e.date+': '+e.text;}
  if(verb==='plan'){
    const p=amParts(rest),date=amDate(p[0]),title=amStr(p[1],90);
    if(!date||!title||p.length>4||(p[3]&&p[3]!=='yearly')||p[1].length>90||(p[2]||'').length>230)return 'Формат: ;mem plan 2016-01-22 | Снежная буря | Нарушения транспорта | yearly (необязательно)';
    if(m.plans.length>=AM_CFG.maxPlans)return 'Лимит планов.';
    const o={id:amId(m),date,title,details:amStr(p[2],230),recurrence:p[3]==='yearly'?'yearly':''};m.plans.push(o);m.undo=null;return 'План #'+o.id+' в календаре: '+o.date+' — '+o.title;}
  if(verb==='show'){
    const z=/^(char|place|faction|arc|rel|fact)\s+(.+)$/i.exec(rest);if(!z)return 'Формат: ;mem show char Алиса / ;mem show fact 15';
    if(z[1].toLowerCase()==='fact'){const id=Number(z[2].replace(/[.!?]+$/,'')),fact=m.facts.find(x=>x.id===id);
      return fact?'Факт #'+fact.id+' — '+fact.about+'\nИсточник: '+(fact.source||'не указан')+(fact.cardType?'\nТип Story Card: '+fact.cardType:'')+(fact.triggers?'\nКлючи: '+fact.triggers:'')+'\n'+fact.text:'Факт не найден. Используй ;mem list fact.';}
    if(z[1].toLowerCase()==='rel'){const r=Object.values(m.relations).find(x=>amKey(x.from+' -> '+x.to)===amKey(z[2]));return r?amFmt(r):'Связь не найдена.';}
    const type=z[1].toLowerCase(),dict=type==='char'?m.characters:type==='place'?m.places:type==='faction'?m.factions:m.arcs;
    const name=dict[amKey(z[2])]?z[2]:z[2].replace(/[.!?]+$/,'');
    const item=dict[amKey(name)];return item?item.name+'\n'+amFmt(item):'Запись не найдена.';}
  if(verb==='day'){
    const date=amDate(rest)||m.date;if(!date)return 'Сначала задай игровую дату.';
    const d=m.days[date]||{events:[]},entries=m.events.filter(e=>e.date===date);
    const planned=m.plans.filter(p=>amPlanDate(p,date)===date).map(p=>'#'+p.id+' '+p.title).join('; ');
    return date+'\nЗапланировано (не подтверждено): '+(planned||'нет')+'\nИтог: '+(d.summary||'не сформирован')+'\n'+(entries.length?entries.slice(-18).map(e=>e.id+' '+(e.time||'')+' ['+e.importance+'/3] '+e.text).join('\n'):'Событий нет.');}
  if(verb==='timeline')return 'Летопись:\n'+Object.keys(m.days).sort().slice(-24).map(date=>date+' — '+amStr(m.days[date].summary||m.events.filter(e=>e.date===date).slice(0,2).map(e=>e.text).join('; '),140)).join('\n')+'\nКлючевые события (2–3/3):\n'+m.events.filter(e=>e.importance>=2).slice(-12).map(e=>'#'+e.id+' '+e.date+' ['+e.importance+'/3] '+amStr(e.text,145)).join('\n')+'\nБольшие события:\n'+Object.values(m.arcs).map(x=>x.name+': '+amStr(x.summary,110)).slice(-10).join('\n');
  if(verb==='calendar')return 'Календарь (удаление: ;mem delete plan ID):\n'+(m.plans.length?m.plans.slice().sort((a,b)=>amPlanDate(a,m.date).localeCompare(amPlanDate(b,m.date))).slice(0,35).map(x=>'#'+x.id+' '+amPlanDate(x,m.date)+' — '+x.title+(x.recurrence==='yearly'?' [ежегодно]':'')+(x.details?' ('+x.details+')':'')).join('\n'):'Планов нет.');
  if(verb==='recent')return 'Последние сцены (сырые фрагменты, не подтверждённые факты):\n'+(m.recent.slice(-15).map(x=>x.date+' '+x.text).join('\n')||'нет');
  if(verb==='pending')return 'Проверка памяти (предложения ещё не записаны в факты):\n'+amReviewList(m,'')+'\nБез корректного автоотчёта: '+m.misses+'.';
  if(verb==='map'){
    const places=Object.values(m.places).slice(0,55);
    const ordered=[],seen=new Set();
    function addNode(p,depth){const k=amKey(p.name);if(seen.has(k))return;seen.add(k);
      ordered.push('  '.repeat(Math.min(depth,8))+p.name+(p.kind?' ('+p.kind+')':'')+(p.parent&&!m.places[amKey(p.parent)]?' [нет родителя: '+p.parent+']':''));
      for(const child of places)if(amKey(child.parent)===k)addNode(child,depth+1);
    }
    for(const p of places)if(!p.parent||!m.places[amKey(p.parent)])addNode(p,0);
    for(const p of places)addNode(p,0);
    const tree=ordered.join('\n');
    const factions=Object.values(m.factions).slice(0,25).map(x=>x.name+(x.territory?' @ '+x.territory:'')+(x.goal?' — '+amStr(x.goal,80):'')).join('\n');
    return 'МИР: '+(m.world||'не описан')+'\nТекущее место: '+(m.place||'?')+'\nЛОКАЦИИ:\n'+(tree||'нет')+'\nФРАКЦИИ:\n'+(factions||'нет');}
  return 'Неизвестная команда ;mem '+verb+'. Справка: ;mem help';
}

// Command receipt is also placed in state.message immediately. If the Output
// hook is skipped by another Script or AI Dungeon, a diagnostic is still shown.
const modifier=(text)=>{
  try{
    if(typeof AM_ENGINE_BUILD==='undefined'||AM_ENGINE_BUILD!=='1.7.0'){
      const reason='Несовместимые вкладки Memory Engine: замени все четыре JS-файла из v1.7.0.';
      if(state&&state.aidm&&typeof state.aidm==='object')state.aidm.pendingUI=reason;
      state.message='[AID Memory] '+reason;
      return {text:'[AID Memory: '+reason+']'};
    }
    const m=amInit();
    m.skipAutoTurn=false;
    const prev=JSON.parse(JSON.stringify(amSnapshot(m)));
    const cmd=amCommand(m,text);
    if(cmd!==null){
      const action=amNormalizePlayerCommand(text).replace(/^[!;:]mem\s+/i,'').trim().split(/\s+/)[0].toLowerCase();
      if(action!=='undo'&&action!=='reset'&&action!=='accept'&&action!=='reject'&&action!=='edit'&&action!=='review'&&action!=='sources'&&action!=='transfer')
        amReviewMarkDiff(m,prev,action==='import'?'import':'user',action==='import'?'импорт из внешнего источника':'команда игрока');
      m.pendingUI=cmd;
      m.lastInput='';
      const preview=String(cmd).slice(0,750);
      state.message='[AID Memory: команда принята; Output должен показать ответ] '+preview;
      if(typeof console!=='undefined'&&console.log)console.log('AID Memory Input: команда перехвачена ('+String(text).slice(0,90)+')');
      return {text:'[Игрок открыл технический журнал памяти; команда принята. Не развивай сюжет.]'};
    }
    if(/[!;:]mem\b/i.test(String(text||''))){
      // A visibly typed command that wasn't recognized must never silently
      // turn into an ordinary story turn.
      const diagnostic='AID Memory: команда обнаружена, но формат входа не распознан. Введи отдельно ;mem ping в режиме Do. Начало входа: '+amStr(text,120);
      m.pendingUI=diagnostic;
      state.message='[AID Memory] '+diagnostic;
      return {text:'[AID Memory: синтаксис команды не распознан. Не развивай сюжет.]'};
    }
    m.pendingUI=null;
    if(typeof state.message==='string'){
      const old=state.message;
      if(/^\[AID Memory/i.test(old)||/^AID MEMORY DEBUG v/.test(old)||/^\[AID MEMORY — ожидает решения/.test(old))delete state.message;
      else if(old.includes('\n\nAID MEMORY DEBUG v'))state.message=old.split('\n\nAID MEMORY DEBUG v')[0];
    }
    const normalized=amNormalizePlayerCommand(text);
    m.skipAutoTurn=/^:[a-z][a-z0-9_-]*(?:\s|$)/i.test(normalized);
    m.lastInput=m.skipAutoTurn?'':amStr(text,1000);
    amDebugBegin(m,text);
    return {text};
  }catch(err){
    const detail=String(err&&err.message||err).slice(0,300);
    if(typeof console!=='undefined'&&console.log)console.log('AID Memory Input: '+detail);
    if(state&&state.aidm)state.aidm.pendingUI='[AID Memory v1.7.0] Ошибка Input: '+detail;
    state.message='[AID Memory Input ERROR] '+detail;
    return {text:'[AID Memory: ошибка команды; не развивай сюжет.]'};
  }
};
modifier(text);
