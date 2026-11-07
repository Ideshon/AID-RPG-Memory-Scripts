/* AID Memory Engine v1.8.0 — Library (independent Adventure Script).
   Uses ONLY public AI Dungeon Scripting API: state, history, storyCards,
   addStoryCard, updateStoryCard, info. Does not modify state.memory. */
const AM_ENGINE_BUILD='1.8.0';
const AM_CFG={contextChars:3200, reportChars:4800, maxChars:75, maxPlaces:85,
  maxFactions:35, maxRelations:130, maxEvents:250, maxDays:75, maxArcs:35,
  maxFacts:110, maxPlans:80, maxAutoCardsPerTurn:8};
const AM_TAG_START='[[AIDM_UPDATE]]',AM_TAG_END='[[/AIDM_UPDATE]]';
const AM_CARD='[AIDMEM:1:';
function amSafeName(value){
  const name=amStr(value,81),key=amKey(name);
  return name.length>=2&&name.length<=80&&!/[§|\r\n]/.test(name)&&
    !['__proto__','prototype','constructor','tostring','hasownproperty'].includes(key);
}
function amValidParent(m,name,parent){
  if(!parent)return '';
  const own=amKey(name),key=amKey(parent);
  if(!amSafeName(parent)||key===own)return 'Родитель должен существовать и отличаться от дочернего места.';
  if(!Object.prototype.hasOwnProperty.call(m.places,key))return 'Родитель «'+parent+'» не создан. Сначала добавь его как place.';
  const seen=new Set([own]);let cursor=key;
  while(cursor){
    if(seen.has(cursor))return 'Циклическая вложенность локаций запрещена.';
    seen.add(cursor);
    const obj=m.places[cursor];
    if(!obj||!obj.parent)break;
    cursor=amKey(obj.parent);
    // Existing incomplete links from old versions are tolerated, but not created again.
    if(!Object.prototype.hasOwnProperty.call(m.places,cursor))return 'В цепочке родителей отсутствует «'+obj.parent+'».';
  }
  return '';
}
function amParentCheck(m,names){
  for(const name of names){const obj=m.places[amKey(name)];
    if(obj&&obj.parent){const error=amValidParent(m,obj.name,obj.parent);if(error)return obj.name+': '+error;}
  }return '';
}
function amPlaceIssues(m){
  const warnings=[];
  for(const obj of Object.values(m.places)){
    if(obj.parent){const issue=amValidParent(m,obj.name,obj.parent);if(issue)warnings.push(obj.name+': '+issue);}
  }return warnings;
}
function amStr(v,n){return String(v===undefined||v===null?'':v).replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n||500);}
function amCardText(v,n){return String(v===undefined||v===null?'':v).replace(/\r\n?/g,'\n').split('\n').map(line=>line.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n').slice(0,n||500);}
function amCardMissingLines(source,known){
  const normalized=s=>String(s||'').replace(/\s+/g,' ').trim().toLocaleLowerCase().replace(/ё/g,'е');
  const present=normalized(known);
  return amCardText(source,3900).split('\n').filter(line=>line&&!present.includes(normalized(line))).join('\n');
}
function amCardWithExtra(entry,extra){
  const missing=amCardMissingLines(extra,entry);
  return entry+(missing?'\nДополнительные сведения из исходной карточки:\n'+missing:'');
}
function amKey(s){return amStr(s,110).toLocaleLowerCase().replace(/ё/g,'е');}
function amArr(o){return Array.isArray(o)?o:[];}
function amObj(o){return o&&typeof o==='object'&&!Array.isArray(o)?o:{};}
function amDate(s){const t=amStr(s,16);if(!/^\d{4}-\d\d-\d\d$/.test(t))return '';
  const m=/^(\d{4})-(\d\d)-(\d\d)$/.exec(t),y=+m[1],mo=+m[2],d=+m[3];
  const leap=y%4===0&&(y%100!==0||y%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  return y>0&&mo>=1&&mo<=12&&d>=1&&d<=days[mo-1]?t:'';}
function amTime(s){const t=amStr(s,10);if(!/^\d\d:\d\d$/.test(t))return '';let z=t.split(':').map(Number);return z[0]<24&&z[1]<60?t:'';}
// This factory is shared by first-run initialization and explicit user reset.
// It never touches another Adventure Script, state.memory or story history.
function amBlankState(){return {version:1,config:{auto:true,cards:true,calendar:true,debug:false,debugFull:false},
  world:'',date:'',time:'',place:'',characters:{},places:{},factions:{},relations:{},
  facts:[],events:[],days:{},months:{},arcs:{},plans:[],nextId:1,
  recent:[],lastInput:'',pendingUI:null,misses:0,accepted:0,cardErrors:0,
  plotImports:{},rpgSnapshot:null,
  lastSignature:'',skipAutoTurn:false,undo:null,cardDirty:[],imported:{},cardAdoptions:{},cardPreview:null,
  reviewQueue:[],reviewHistory:[],reviewSeen:[],reviewNextId:1,provenance:{},debugTrace:null};}
function amResetState(m){
  // Preserve the reference used by the Input modifier and its subsequent receipt.
  const fresh=amBlankState();
  for(const key of Object.keys(m))delete m[key];
  Object.assign(m,fresh);
}
function amInit(){
  if(state.aidm && typeof state.aidm==='object' && !Array.isArray(state.aidm)){
    if(state.aidm.version===undefined)state.aidm.version=1;
    if(state.aidm.version!==1)throw Error('Неизвестная версия state.aidm: '+state.aidm.version+'. Данные сохранены; установи совместимую версию скрипта.');
  }
  if(!state.aidm||typeof state.aidm!=='object'||Array.isArray(state.aidm))state.aidm=amBlankState();
  const m=state.aidm;
  for(const x of ['characters','places','factions','relations','days','months','arcs','imported','plotImports','provenance','cardAdoptions','cardLinks'])m[x]=amObj(m[x]);
  for(const x of ['facts','events','plans','recent','cardDirty','reviewQueue','reviewHistory','reviewSeen'])m[x]=amArr(m[x]);
  m.config=amObj(m.config);
  if(typeof m.config.auto!=='boolean')m.config.auto=true;
  if(typeof m.config.cards!=='boolean')m.config.cards=true;
  if(typeof m.config.calendar!=='boolean')m.config.calendar=true;
  if(!Number.isFinite(m.nextId))m.nextId=1;
  if(!Number.isFinite(m.validationErrors))m.validationErrors=0;
  if(m.pendingUI!==null&&typeof m.pendingUI!=='string')m.pendingUI=null;
  if(!Number.isFinite(m.misses))m.misses=0;
  if(!Number.isFinite(m.accepted))m.accepted=0;
  if(!Number.isFinite(m.cardErrors))m.cardErrors=0;
  if(typeof m.skipAutoTurn!=='boolean')m.skipAutoTurn=false;
  if(!Number.isSafeInteger(m.reviewNextId)||m.reviewNextId<1)m.reviewNextId=1;
  return m;
}
// Debug is observational. Store only the latest Memory Engine addition, never the
// platform's whole prompt or data from other Adventure Scripts.
function amDebugBegin(m,raw){
  if(!m.config.debug)return;
  m.debugTrace={turn:typeof info!=='undefined'&&info&&Number.isFinite(info.actionCount)?info.actionCount:null,
    input:{received:true,length:String(raw||'').length,preview:amStr(raw,130)},context:null,output:null};
}
function amDebugContext(m,applied,payload,original,returned,reason,pruned){
  if(!m.config.debug)return;
  if(!m.debugTrace)amDebugBegin(m,'(Input не зарегистрирован)');
  m.debugTrace.context={applied:!!applied,reason:reason||'',content:applied?String(payload||''):'',
    addedChars:applied?String(payload||'').length:0,removedHistoryChars:pruned||0,
    inputChars:String(original||'').length,outputChars:String(returned||'').length};
}
function amDebugOutput(m,status,detail){
  if(!m.config.debug)return;
  if(!m.debugTrace)amDebugBegin(m,'(Input не зарегистрирован)');
  m.debugTrace.output={status:status||'не определён',detail:amStr(detail,250),queued:amArr(m.reviewQueue).length};
}
function amDebugText(m,full){
  const t=amObj(m.debugTrace),i=amObj(t.input),c=amObj(t.context),o=amObj(t.output);
  if(!Object.keys(t).length)return 'Нет диагностических данных игрового хода. Продолжи сцену с включённым debug.';
  const lines=['AID MEMORY DEBUG v'+AM_ENGINE_BUILD+' — ход '+(t.turn===null?'?':t.turn),
    'Input: '+(i.received?'получен '+i.length+' симв.; '+i.preview:'нет данных'),
    'Context: '+(!Object.keys(c).length?'хук не зарегистрирован':c.applied?'добавлено '+c.addedChars+' симв.; удалено истории '+(c.removedHistoryChars||0):'НЕ добавлен'+(c.reason?' ('+c.reason+')':'')),
    'Output: '+(o.status||'ещё не зарегистрирован')+(o.detail?' — '+o.detail:''),
    'Предложения на проверке: '+amArr(m.reviewQueue).length];
  if(c.applied){
    const limit=full?7000:950,content=c.content||'';
    lines.push('ТЕКСТ, ДОБАВЛЕННЫЙ MEMORY ENGINE В CONTEXT:\n'+content.slice(0,limit)+(content.length>limit?'\n[Сокращено '+(content.length-limit)+' символов; ;mem debug context — полный фрагмент]':''));
  }else lines.push('Memory Engine не передал дополнительный текст в этом ходе.');
  lines.push('Это дополнение Memory Engine, не полный итоговый промпт AI Dungeon и других подключённых скриптов.');
  return lines.join('\n');
}
function amDebugNotify(m){
  if(!m.config.debug)return;
  const notice=amDebugText(m,!!m.config.debugFull);
  // Preserve the review notification. Other attached Scripts may also set state.message.
  const prior=typeof state.message==='string'?state.message:'';
  state.message=(prior&&prior.indexOf('AID MEMORY DEBUG v')<0?prior+'\n\n':'')+notice;
  if(typeof console!=='undefined'&&console.log)console.log('[AID Memory Debug] '+notice.slice(0,1500));
}

function amId(m){return m.nextId++;}
function amUpsert(map,name,patch,fields,limit){
  const key=amKey(name);if(!amSafeName(name))return null;
  let r=map[key];if(!r){if(Object.keys(map).length>=limit)return null;r={name:amStr(name,80)};map[key]=r;}
  for(const f of fields){if(typeof patch[f]==='string'&&patch[f].trim())r[f]=amStr(patch[f],f==='bio'||f==='description'||f==='summary'?650:260);}
  return r;
}
function amSkill(c,name,level,details){
  const k=amKey(name);if(!k)return false;
  c.skillSet=amObj(c.skillSet);if(!c.skillSet[k]&&Object.keys(c.skillSet).length>=28)return false;
  const p=c.skillSet[k]||{name:amStr(name,65)};
  if(level!==undefined&&String(level).trim())p.level=amStr(level,65);
  if(details!==undefined&&String(details).trim())p.details=amStr(details,170);
  c.skillSet[k]=p;return true;
}
function amSkills(c){return Object.values(amObj(c.skillSet)).map(x=>x.name+': '+(x.level||'уровень не указан')+(x.details?' ('+x.details+')':'')).join('; ');}
function amRel(m,from,to,p){
  const a=amKey(from),b=amKey(to);if(!amSafeName(from)||!amSafeName(to)||a===b)return null;
  const k=a+'→'+b;
  if(!m.relations[k]&&Object.keys(m.relations).length>=AM_CFG.maxRelations)return null;
  const r=m.relations[k]||{from:amStr(from,80),to:amStr(to,80)};
  for(const f of ['view','reason','tags'])if(typeof p[f]==='string'&&p[f].trim())r[f]=amStr(p[f],f==='reason'?360:190);
  if(p.trust!==undefined&&p.trust!==''&&Number.isFinite(Number(p.trust)))r.trust=Math.max(-100,Math.min(100,Math.round(Number(p.trust))));
  m.relations[k]=r;return r;
}
function amDirty(m,type,name){const k=type+'|'+amKey(name);if(!m.cardDirty.includes(k))m.cardDirty.push(k);m.cardDirty=m.cardDirty.slice(-250);}
function amEvent(m,date,details,importance,time,source){
  const d=amDate(date||(m.config.calendar?m.date:''))||'без даты',s=amStr(details,300);if(s.length<8)return null;
  const tail=m.events.slice(-12);
  if(tail.some(e=>e.date===d&&amKey(e.text)===amKey(s)))return null;
  const e={id:amId(m),date:d,time:amTime(time||(m.config.calendar?m.time:'')),text:s,importance:Math.max(1,Math.min(3,Math.round(Number(importance)||1))),source:source||'model'};
  m.events.push(e);m.events=m.events.slice(-AM_CFG.maxEvents);
  if(d!=='без даты'){
    if(!m.days[d])m.days[d]={summary:'',events:[]};
    m.days[d].events.push(e.id);m.days[d].events=m.days[d].events.slice(-24);
    amCompactDays(m);
  }return e;
}
function amCompactDays(m){
  const keys=Object.keys(m.days).sort();while(keys.length>AM_CFG.maxDays){const d=keys.shift(),rec=m.days[d];
    const month=d.slice(0,7),summ=amStr(rec.summary||m.events.filter(e=>e.date===d).slice(0,4).map(e=>e.text).join('; '),450);
    m.months[month]=amStr((m.months[month]||'')+' '+d+': '+summ,1200);delete m.days[d];
  }
  const mons=Object.keys(m.months).sort();while(mons.length>36)delete m.months[mons.shift()];
}
function amFact(m,about,value,source){
  const a=amStr(about,85),v=amStr(value,380);if(!v||v.length<8)return null;
  const existing=m.facts.find(x=>amKey(x.about)===amKey(a)&&amKey(x.text)===amKey(v));if(existing)return null;
  if(m.facts.length>=AM_CFG.maxFacts){
    const idx=m.facts.findIndex(x=>!amObj(m.cardAdoptions)[AM_CARD+'fact:'+x.id+']']);
    if(idx<0)return null;
    m.facts.splice(idx,1);
  }
  const f={id:amId(m),about:a,text:v,source:source||'model'};m.facts.push(f);return f;
}
function amReport(m,raw){
  const z=amObj(raw),before=JSON.stringify(amSnapshot(m)),dirtyBefore=m.cardDirty.slice(),changed=[];
  if(!Object.keys(z).length)return 0;
  if(m.config.calendar&&amDate(z.date))m.date=amDate(z.date);
  if(m.config.calendar&&amTime(z.time))m.time=amTime(z.time);
  if(typeof z.place==='string'&&z.place.trim())m.place=amStr(z.place,90);
  if(typeof z.world==='string'&&z.world.trim())m.world=amStr(z.world,1700);
  for(const c of amArr(z.characters).slice(0,7)){
    if(!amObj(c).name)continue;
    const p=amUpsert(m.characters,c.name,c,['bio','traits','appearance','skills','occupation','at'],AM_CFG.maxChars);
    if(p){for(const sk of amArr(c.skillSet).slice(0,12))if(amObj(sk).name)amSkill(p,sk.name,sk.level,sk.details);
      changed.push('персонаж '+p.name);amDirty(m,'char',p.name);}
  }
  const pendingParents=[];
  for(const p of amArr(z.places).slice(0,6)){
    if(!amObj(p).name)continue;
    const obj=amUpsert(m.places,p.name,p,['description','kind','status'],AM_CFG.maxPlaces);
    if(obj){if(typeof p.parent==='string'&&p.parent.trim())pendingParents.push({name:obj.name,parent:amStr(p.parent,80)});
      changed.push('место '+obj.name);amDirty(m,'place',obj.name);}
  }
  // One report may create parent and child simultaneously. Reject only invalid parent links.
  for(const link of pendingParents){
    const obj=m.places[amKey(link.name)],old=obj.parent;
    obj.parent=link.parent;
    if(amValidParent(m,obj.name,obj.parent)){if(old) obj.parent=old;else delete obj.parent;m.validationErrors++;}
  }
  for(const f of amArr(z.factions).slice(0,5)){
    if(!amObj(f).name)continue;
    const obj=amUpsert(m.factions,f.name,f,['description','territory','goal','status'],AM_CFG.maxFactions);
    if(obj){changed.push('фракция '+obj.name);amDirty(m,'faction',obj.name);}
  }
  for(const r of amArr(z.relations).slice(0,8)){
    if(!amObj(r).from||!r.to)continue;
    const obj=amRel(m,r.from,r.to,r);if(obj){changed.push('связь '+obj.from+'→'+obj.to);amDirty(m,'char',obj.from);}
  }
  for(const f of amArr(z.facts).slice(0,5))if(amObj(f).text){const v=amFact(m,f.about,f.text,'model');if(v)changed.push('факт');}
  for(const e of amArr(z.events).slice(0,5)){
    if(typeof e==='string'){if(amEvent(m,m.config.calendar?m.date:'без даты',e,1,m.config.calendar?m.time:'','model'))changed.push('событие');continue;}
    if(amObj(e).text&&amEvent(m,amDate(e.date)||(m.config.calendar?m.date:'без даты'),e.text,e.importance,e.time,'model'))changed.push('событие');
  }
  if(typeof z.daySummary==='string'&&m.date&&m.days[m.date]){
    m.days[m.date].summary=amStr(z.daySummary,750);changed.push('итог дня');
  }
  for(const d of amArr(z.daySummaries).slice(0,3)){
    if(amObj(d).date&&amDate(d.date)&&typeof d.summary==='string'&&d.summary.trim()){
      if(!m.days[d.date])m.days[d.date]={summary:'',events:[]};
      m.days[d.date].summary=amStr(d.summary,750);changed.push('итог '+d.date);
    }
  }
  for(const a of amArr(z.arcs).slice(0,4)){
    if(!amObj(a).name)continue;
    const obj=amUpsert(m.arcs,a.name,a,['summary','status','result','start','end'],AM_CFG.maxArcs);
    if(obj){changed.push('сюжет '+obj.name);}
  }
  for(const p of amArr(z.plans).slice(0,4)){
    if(!amObj(p).date||!amDate(p.date)||!p.title)continue;
    if(m.plans.some(x=>x.date===p.date&&amKey(x.title)===amKey(p.title)))continue;
    if(m.plans.length<AM_CFG.maxPlans){m.plans.push({id:amId(m),date:p.date,title:amStr(p.title,90),details:amStr(p.details,230),recurrence:p.recurrence==='yearly'?'yearly':''});changed.push('календарь');}
  }
  // The narrator frequently repeats an unchanged character/location. Repetition is
  // not a new transaction and must not replace the player's previous Undo slot.
  const actuallyChanged=JSON.stringify(amSnapshot(m))!==before;
  if(actuallyChanged){m.undo={snapshot:JSON.parse(before),kind:'auto',count:changed.length||1};m.accepted++;}
  else m.cardDirty=dirtyBefore;
  return actuallyChanged?(changed.length||1):0;
}
function amSnapshot(m){const p={};for(const k of ['world','date','time','place','characters','places','factions','relations','facts','events','days','months','arcs','plans','nextId','provenance','reviewQueue'])p[k]=m[k];return p;}
function amUndo(m){if(!m.undo)return 'Нет последнего пакета изменений для отката.';
  const b=m.undo.snapshot;for(const k of Object.keys(b))m[k]=b[k];m.undo=null;m.cardDirty=[];
  return 'Последний пакет изменений отменён в базе памяти. Уже созданные Story Cards не откатываются автоматически; отключи их командой ;mem cards off или поправь вручную.';}
function amRelText(r,limit){
  return amStr([r.view&&'мнение: '+r.view,r.reason&&'причина: '+r.reason,
    r.tags&&'метки: '+r.tags,Number.isFinite(r.trust)&&'доверие: '+r.trust+'/100'].filter(Boolean).join('; '),limit||240);
}
function amPriorityEvents(m,query){
  const q=amKey(query),tokens=q.split(/[^A-Za-zА-Яа-яЁё0-9]+/).filter(x=>x.length>3);
  const recent=m.events.slice(-90),lastId=recent.length?recent[recent.length-1].id:0;
  return recent.map(e=>({e,score:(m.config.calendar&&e.date===m.date?10:0)+(e.importance||1)*5+
    (tokens.some(t=>amKey(e.text).includes(t))?14:0)+Math.max(0,6-(lastId-e.id)/7)}))
    .sort((a,b)=>b.score-a.score||b.e.id-a.e.id).slice(0,4).map(x=>x.e);
}
function amCardRecord(m,type,key){return type==='fact'?m.facts.find(f=>String(f.id)===String(key)):(type==='char'?m.characters:type==='place'?m.places:m.factions)[key];}
function amCardSourceId(c){return c&&c.id!==undefined&&c.id!==null?'id:'+c.id:'';}
function amWriteCard(index,keys,entry,type,metadata){
  if(typeof updateStoryCard!=='function')throw Error('updateStoryCard недоступна');
  const c=metadata||storyCards[index]||{};
  const id=storyCards[index]&&storyCards[index].id;
  const result=updateStoryCard(index,keys,entry,type,c.title===undefined?c.name:c.title,c.description===undefined?c.notes:c.description);
  const written=storyCards[index];
  return result!==false&&written&&(id==null||written.id===id)&&written.keys===keys&&written.entry===entry&&written.type===type?result:false;
}
function amCardSpec(m,type,key){
  const item=amCardRecord(m,type,key);if(!item)return null;
  let details='';
  if(type==='fact')details=String(item.text||'');
  else if(type==='char'){
    details=[item.bio,item.traits&&'Характер: '+item.traits,item.appearance&&'Внешность: '+item.appearance,
      item.skills&&'Навыки (описание): '+item.skills,amSkills(item)&&'Навыки по отдельности: '+amSkills(item),item.occupation&&'Роль: '+item.occupation,item.at&&'Где находится: '+item.at].filter(Boolean).join('\n');
    const ties=Object.values(m.relations).filter(x=>amKey(x.from)===key).slice(0,4).map(x=>'К '+x.to+': '+amRelText(x,160));
    if(ties.length)details+='\nОтношения: '+ties.join('; ');
  }else if(type==='place')details=[item.kind&&'Тип: '+item.kind,item.parent&&'Входит в: '+item.parent,item.description,item.status&&'Состояние: '+item.status].filter(Boolean).join('\n');
  else details=[item.description,item.territory&&'Территория: '+item.territory,item.goal&&'Цель: '+item.goal,item.status&&'Состояние: '+item.status].filter(Boolean).join('\n');
  if(!details.trim())return null;
  const tag=AM_CARD+type+':'+key+']';
  const adopted=amObj(amObj(m.cardAdoptions)[tag]);
  const entry=amCardWithExtra(tag+'\n'+amCardText(details,type==='fact'?3900:1100),adopted.extra);
  return {tag,keys:amObj(adopted.original).keys||item.triggers||item.name||item.about,entry,type:adopted.original?adopted.original.type:(type==='fact'?item.cardType||'Custom':type==='char'?'character':type==='place'?'location':'faction')};
}
function amCardKeyMatches(keys,name){
  return String(keys||'').split(',').some(k=>amKey(k)===amKey(name));
}
function amCardKeysOverlap(left,right){
  return String(right||'').split(',').some(key=>key.trim()&&amCardKeyMatches(left,key.trim()));
}
function amCards(m){
  if(!m.config.cards||typeof storyCards==='undefined'||!Array.isArray(storyCards)||typeof addStoryCard!=='function')return;
  let done=0;const attempted=new Set();
  while(m.cardDirty.length&&done<AM_CFG.maxAutoCardsPerTurn){
    const task=m.cardDirty.shift();
    if(attempted.has(task)){m.cardDirty.push(task);break;}
    attempted.add(task);
    const [type,k]=task.split('|');
    const spec=amCardSpec(m,type,k);if(!spec)continue;
    const idx=storyCards.findIndex(c=>String(c.entry||'').startsWith(spec.tag));
    if(idx<0&&m.cardAdoptions[spec.tag])continue; // Preserve the backup for explicit recovery.
    try{
      let result;
      if(idx>=0){if(typeof updateStoryCard!=='function')throw Error('updateStoryCard недоступна');
        if(spec.entry.length>1000)throw Error('Story Card длиннее 1000 символов');
        result=amWriteCard(idx,spec.keys,spec.entry,spec.type);}
      else if(!storyCards.some(c=>{const link=amObj(m.cardLinks)[amCardSourceId(c)];return amCardKeyMatches(c.keys,spec.keys)||(link&&link.kind===type&&link.key===k);}))result=addStoryCard(spec.keys,spec.entry,spec.type,amCardRecord(m,type,k).name||amCardRecord(m,type,k).about);
      if(result===false)throw Error('Story Card API отклонил изменение');
      // Conflicting human-authored Story Cards are deliberately NOT overwritten.
    }catch(err){
      m.cardErrors++;
      // Retry on a later Output hook. Rotate so one failing card cannot block others.
      if(!m.cardDirty.includes(task))m.cardDirty.push(task);
    }
    done++;
  }
}
function amSelector(m,query){
  const q=amKey(query),tokens=q.split(/[^A-Za-zА-Яа-яЁё0-9]+/).filter(x=>x.length>2);
  function score(name,record){let s=0,k=amKey(name);if(k&&q.includes(k))s+=20;
    if(tokens.some(t=>k.includes(t)))s+=8;
    if(record&&record.at&&q.includes(amKey(record.at)))s+=2;
    return s;}
  const sort=o=>Object.values(o).map(x=>({x,score:score(x.name,x)})).filter(z=>z.score>0).sort((a,b)=>b.score-a.score).map(z=>z.x);
  // Keep the current place and its known ancestors in context, even when the player
  // writes 'I examine the desk' without repeating the room's name.
  const nearby=[],seen=new Set();let cursor=m.places[amKey(m.place)];
  while(cursor&&nearby.length<3&&!seen.has(amKey(cursor.name))){
    nearby.push(cursor);seen.add(amKey(cursor.name));cursor=m.places[amKey(cursor.parent)];
  }
  const selected=nearby.concat(sort(m.places).filter(x=>!seen.has(amKey(x.name)))).slice(0,4);
  return {chars:sort(m.characters).slice(0,5),places:selected,factions:sort(m.factions).slice(0,3),arcs:sort(m.arcs).slice(0,2)};
}
function amContext(m,query){
  const lines=['[AID MEMORY — справочные факты; при противоречии уточняй у игрока]'];
  if(m.world)lines.push('Мир: '+amStr(m.world,350));
  if(m.config.calendar&&(m.date||m.time)||m.place)lines.push('Игровое время/место: '+[m.config.calendar&&m.date,m.config.calendar&&m.time,m.place].filter(Boolean).join(' '));
  const s=amSelector(m,query);
  for(const p of s.places)lines.push('Место '+p.name+': '+amStr([p.kind&&'тип '+p.kind,p.parent&&'в '+p.parent,p.description,p.status&&'состояние '+p.status].filter(Boolean).join('; '),280));
  for(const e of amPriorityEvents(m,query))lines.push('Событие '+(m.config.calendar?e.date+' '+(e.time||'')+' ':'')+'[важность '+e.importance+'/3]: '+amStr(e.text,190));
  for(const c of s.chars)lines.push('Персонаж '+c.name+': '+amStr([c.bio,c.occupation,c.traits&&'характер '+c.traits,c.appearance&&'вид '+c.appearance,c.skills&&'навыки '+c.skills,amSkills(c)&&'список навыков '+amSkills(c),c.at&&'сейчас '+c.at].filter(Boolean).join('; '),440));
  const activeKeys=s.chars.map(c=>amKey(c.name));
  for(const r of Object.values(m.relations).filter(x=>activeKeys.includes(amKey(x.from))||activeKeys.includes(amKey(x.to))).slice(0,5))lines.push('Отношение '+r.from+'→'+r.to+': '+amRelText(r,230));
  for(const f of s.factions)lines.push('Фракция '+f.name+': '+amStr([f.description,f.territory&&'территория '+f.territory,f.goal&&'цель '+f.goal,f.status].filter(Boolean).join('; '),250));
  for(const a of s.arcs)lines.push('Сюжет '+a.name+': '+amStr([a.status&&'статус '+a.status,a.summary,a.result&&'итог '+a.result,a.start&&'начало '+a.start,a.end&&'конец '+a.end].filter(Boolean).join('; '),300));
  // Story Card trigger aliases are significant: the first key is not necessarily
  // the phrase that the player uses in the scene.
  let facts=m.facts.filter(x=>{
    const aliases=[x.about].concat(String(x.triggers||'').split(',').slice(0,14));
    return aliases.some(alias=>alias.trim().length>=3&&amKey(query).includes(amKey(alias.trim())));
  }).slice(-4);
  for(const f of facts)lines.push('Факт '+f.about+': '+amStr(f.text,350));
  // Imported Plot text is reference material, not an instruction to override
  // the story's current instructions. Strict small context budgets prevent flooding.
  const pi=amObj(m.plotImports);
  for(const tag of ['essentials','summary']){
    const p=pi[tag];if(p&&p.text){
      const relevant=tag==='essentials'||amKey(query).split(/[^a-zа-яё0-9]+/).some(w=>w.length>5&&amKey(p.text).includes(w));
      if(relevant)lines.push('Источник Plot ('+tag+', сохранённая копия): '+amStr(p.text,tag==='essentials'?280:240));
    }
  }
  // Imported AI Instructions and Author's Note are archived but never
  // re-injected as instructions by Memory Engine (prevents duplicate directives).
  const snap=m.rpgSnapshot;
  if(snap&&snap.hero&&snap.hero.name)lines.push('Снимок Universal RPG (только справка, не актуальная механика): '+amStr([
    snap.hero.name,snap.hero.race&&'вид '+snap.hero.race,snap.hero.class&&'класс '+snap.hero.class,
    snap.hero.occupation&&'роль '+snap.hero.occupation,
    snap.location&&'место снимка '+snap.location].filter(Boolean).join('; '),320));
  const day=m.config.calendar&&m.days[m.date];if(day&&day.summary)lines.push('Итог текущего дня: '+amStr(day.summary,400));
  const month=m.config.calendar&&m.date&&m.months[m.date.slice(0,7)];
  if(month)lines.push('Сводка прежних дней месяца: '+amStr(month,260));
  const today=m.plans.filter(x=>m.config.calendar&&m.date&&amPlanDate(x,m.date)===m.date).slice(0,3);
  for(const p of today)lines.push('Календарное событие НА СЕГОДНЯ (запланировано, не факт что уже произошло): '+p.title+'. '+(p.details||'')+'. Если событие далеко от героя, сообщай о нём через новости, не перемещая героя.');
  const future=m.plans.filter(x=>m.config.calendar&&m.date&&amPlanDate(x,m.date)>m.date).sort((a,b)=>amPlanDate(a,m.date).localeCompare(amPlanDate(b,m.date))).slice(0,2);
  for(const p of future)lines.push('Предстоящее '+amPlanDate(p,m.date)+': '+p.title+' '+(p.details||''));
  // Unstructured fallback. Treat as scene excerpts, never as verified entities.
  const fall=m.recent.filter(x=>!m.config.calendar||!x.date||x.date===m.date||m.date==='').slice(-3);
  if(m.misses>0)for(const x of fall)lines.push('Фрагмент недавней сцены (непроверенный): '+amStr(x.text,190));
  lines.push('[КОНЕЦ AID MEMORY]');
  return lines.join('\n').slice(0,AM_CFG.contextChars);
}
function amProtocol(calendarEnabled){return '\n[AID Memory Recorder — скрытая служебная инструкция. После художественного текста выведи '+AM_TAG_START+'{JSON}'+AM_TAG_END+'. '+
  'Пиши только НОВЫЕ явно произошедшие изменения, не повторяй существующие записи. JSON не более 4 изменённых объектов на ответ. '+
  'Не объявляй слухи, планы, догадки или предположения доказанными фактами. Для них используй observations:[{about,text}]. '+
  'Остальные поля ТОЛЬКО для подтверждённого текстом сцены: characters:[{name,bio,traits,appearance,skills,skillSet:[{name,level,details}],occupation,at}], '+
  'relations:[{from,to,view,reason,tags,trust}], places:[{name,parent,description,kind,status}], '+
  'factions:[{name,description,territory,goal,status}], events:[{text,importance'+(calendarEnabled?',date,time':'')+'}], facts:[{about,text}], '+
  'arcs:[{name,summary,status,result,start,end}], '+
  (calendarEnabled?'plans:[{date,title,details,recurrence}], daySummary:"...",daySummaries:[{date,summary}], ':'')+
  'world:"...",place:"..."'+(calendarEnabled?',date:"YYYY-MM-DD",time:"HH:MM"':'')+'. '+
  'Не придумывай числовое trust и не меняй механику RPG. Если изменений нет: {}. '+
  'Данные JSON станут ПРЕДЛОЖЕНИЯМИ игроку и не будут внесены в подтверждённую память без его команды. '+
  'Сохраняй другие служебные блоки и ставь AIDM_UPDATE последним, без Markdown внутри.]';}

function amPlanDate(p,now){
  if(p.recurrence!=='yearly'||!amDate(now))return p.date;
  const md=p.date.slice(5);let year=Number(now.slice(0,4));
  for(let i=0;i<5;i++,year++){const d=amDate(String(year).padStart(4,'0')+'-'+md);if(d&&d>=now)return d;}
  return p.date;
}
function amParts(s){return String(s||'').split('|').map(x=>x.trim());}
function amParseFields(parts,allowed){
  const values={},valid=new Set(allowed);
  for(const part of parts){
    const match=/^([^=]+?)\s*=\s*([\s\S]*)$/.exec(part);
    if(!match)return {error:'Поле «'+part+'» должно иметь вид key=значение.'};
    const raw=amKey(match[1]);
    const key=AM_BATCH_ALIASES[raw]||raw;
    if(!valid.has(key))return {error:'Неизвестное поле «'+match[1].trim()+'». Разрешены: '+allowed.join(', ')+'.'};
    const val=match[2].trim();
    if(!val)return {error:'Пустое поле «'+key+'» нельзя сохранить. Укажи текст.'};
    const max=['bio','description','summary'].includes(key)?650:key==='reason'?360:260;
    if(val.length>max)return {error:'Поле «'+key+'» длиннее '+max+' символов.'};
    values[key]=val;
  }
  return {fields:values};
}
function amFmt(obj){return Object.entries(obj).filter(([k,v])=>v!==''&&k!=='name').map(([k,v])=>k+'='+v).join('; ');}
function amList(m,which){
  const cleaned=amStr(which,120).replace(/[.!?]+$/,'').trim().toLowerCase();
  // A few help pages previously showed char/place/... as shorthand, not a literal command.
  // Accept more than one category for convenience; a single category remains supported.
  const sections=cleaned.split(/\s*(?:\/|,|\s+или\s+)\s*/i).filter(Boolean);
  if(sections.length>1){
    if(sections.length>6)return 'Укажи не более шести категорий: char, place, faction, rel, arc, fact.';
    const invalid=sections.some(x=>!['char','characters','персонажи','place','places','места','faction','factions','фракции','rel','relations','связи','arc','arcs','сюжеты','fact','facts','факты'].includes(x));
    if(invalid)return 'Раздел: char, place, faction, rel, arc, fact. Пример: ;mem list char или ;mem list char/place.';
    return sections.map(x=>'['+x.toUpperCase()+']\n'+amList(m,x)).join('\n\n');
  }
  const cat=sections[0]||'';let a=[];
  if(['char','characters','персонажи'].includes(cat))a=Object.values(m.characters).map(x=>x.name);
  else if(['place','places','места'].includes(cat))a=Object.values(m.places).map(x=>x.name+(x.parent?' ← '+x.parent:''));
  else if(['faction','factions','фракции'].includes(cat))a=Object.values(m.factions).map(x=>x.name);
  else if(['rel','relations','связи'].includes(cat))a=Object.values(m.relations).map(x=>x.from+' → '+x.to+': '+(x.view||''));
  else if(['arc','arcs','сюжеты'].includes(cat))a=Object.values(m.arcs).map(x=>x.name+' ['+(x.status||'')+']');
  else if(['fact','facts','факты'].includes(cat))a=m.facts.map(x=>'#'+x.id+' '+x.about+' — '+amStr(x.text,110));
  else return 'Раздел: char, place, faction, rel, arc, fact. Пример: ;mem list char или ;mem list place.';
  return (a.length?a.slice(-75).join('\n'):'Пока пусто.')+'\nВсего: '+a.length;
}
/* ---------- v1.2: transactional multi-record setup ---------- */
const AM_BATCH_FIELDS={
  char:['bio','traits','appearance','skills','occupation','at'],
  place:['description','parent','kind','status'],
  faction:['description','territory','goal','status'],
  arc:['summary','status','result','start','end']
};
const AM_BATCH_ALIASES={
  'био':'bio','биография':'bio','характер':'traits','внешность':'appearance',
  'навыки':'skills','роль':'occupation','профессия':'occupation','место':'at',
  'описание':'description','родитель':'parent','тип':'kind','цель':'goal',
  'статус':'status','территория':'territory','мнение':'view','причина':'reason',
  'метки':'tags','доверие':'trust','итог':'result','сводка':'summary',
  'имя':'name','дата':'date','мир':'world','факт':'fact','событие':'event',
  'отношение':'rel','персонаж':'char','локация':'place','фракция':'faction',
  'сюжет':'arc','план':'plan','навык':'skill','день':'day','здесь':'here'
};

/* v1.7.0: evidence-aware proposals. Model output is NEVER committed directly. */
function amReviewKey(e){return [e.kind,amKey(e.name),amKey(e.field),String(e.value).trim().toLowerCase().replace(/\s+/g,' ').slice(0,500)].join('|');}
function amReviewPath(e){return [e.kind,amKey(e.name),amKey(e.field)].join('|');}
function amReviewLabel(e){
  const types={char:'Персонаж',place:'Локация',faction:'Фракция',rel:'Отношение',skill:'Навык',arc:'Сюжет',fact:'Факт',event:'Событие',plan:'Календарь',day:'Итог дня',world:'Мир',date:'Дата',time:'Время',here:'Текущее место',observation:'Наблюдение'};
  return (types[e.kind]||e.kind)+(e.name?' '+e.name:'')+(e.field&&e.field!=='text'?' · '+e.field:'');
}
function amReviewValue(e){return typeof e.value==='string'?e.value:JSON.stringify(e.value);}
function amReviewCurrent(m,e){
  const k=amKey(e.name),f=e.field;
  if(e.kind==='char'||e.kind==='place'||e.kind==='faction'||e.kind==='arc'){
    const dict=e.kind==='char'?m.characters:e.kind==='place'?m.places:e.kind==='faction'?m.factions:m.arcs;
    return dict[k]&&dict[k][f];
  }
  if(e.kind==='skill'){const c=m.characters[k];return c&&c.skillSet&&c.skillSet[amKey(f)]&&JSON.stringify(c.skillSet[amKey(f)]);}
  if(e.kind==='rel'){return m.relations[k]&&m.relations[k][f];}
  if(e.kind==='world')return m.world;if(e.kind==='date')return m.date;
  if(e.kind==='time')return m.time;if(e.kind==='here')return m.place;
  if(e.kind==='day')return m.days[e.name]&&m.days[e.name].summary;
  return undefined;
}
function amReviewValid(e,m,staging){
  if(!e||typeof e.value!=='string'||!e.value.trim())return false;
  if(e.value.length>1700)return false;
  if(['char','place','faction','arc'].includes(e.kind)){
    const fields={char:['bio','traits','appearance','skills','occupation','at'],place:['description','parent','kind','status'],faction:['description','territory','goal','status'],arc:['summary','status','result','start','end']};
    if(!amSafeName(e.name)||!fields[e.kind].includes(e.field))return false;
    if(e.value.length>(['bio','description','summary'].includes(e.field)?650:260))return false;
    if(e.kind==='place'&&e.field==='parent'&&!staging&&amValidParent(m,e.name,e.value))return false;
    return true;
  }
  if(e.kind==='rel')return /^(.+?)→(.+)$/.test(e.name)&&['view','reason','tags','trust'].includes(e.field)&&
    (e.field!=='trust'||(/^-?\d+$/.test(e.value)&&Number(e.value)>=-100&&Number(e.value)<=100))&&e.value.length<=360;
  if(e.kind==='skill'){if(!amSafeName(e.name)||!amSafeName(e.field)||e.value.length>500)return false;
    try{const sk=JSON.parse(e.value);return amKey(sk.name)===amKey(e.field)&&String(sk.level||'').length<=65&&String(sk.details||'').length<=170;}catch(err){return false;}}
  if(e.kind==='fact'||e.kind==='observation')return e.value.length>=8&&e.value.length<=380&&amStr(e.name,85).length>=2;
  if(e.kind==='event')return e.value.length>=8&&e.value.length<=300;
  if(e.kind==='plan')return !!amDate(e.extra&&e.extra.date)&&amSafeName(e.name)&&e.value.length<=230;
  if(e.kind==='day')return !!amDate(e.name)&&e.value.length<=750;
  if(e.kind==='world')return e.value.length<=1700;
  if(e.kind==='date')return !!amDate(e.value);
  if(e.kind==='time')return !!amTime(e.value);
  if(e.kind==='here')return e.value.length<=90;
  return false;
}
function amReviewStage(m,data,scene,turn){
  const z=amObj(data),items=[],before=m.reviewQueue.length;
  const origin={type:'narrator',turn:Number.isFinite(turn)?turn:null,date:m.date||'',excerpt:amStr(scene,150)};
  const add=(kind,name,field,value,extra)=>{
    if(items.length>=12||typeof value!=='string'||!value.trim())return;
    const e={kind,name:amStr(name,90),field:amStr(field,75),value:amStr(value,1700),extra:amObj(extra),source:origin,tier:kind==='observation'?'observation':'proposed'};
    if(!amReviewValid(e,m,true))return;
    const old=amReviewCurrent(m,e);
    if(old!==undefined&&amKey(old)===amKey(e.value))return;
    if(kind==='fact'&&m.facts.some(f=>amKey(f.about)===amKey(e.name)&&amKey(f.text)===amKey(e.value)))return;
    if(kind==='event'&&m.events.some(f=>amKey(f.text)===amKey(e.value)&&f.date===(e.extra.date||m.date||'без даты')))return;
    if(kind==='plan'&&m.plans.some(p=>p.date===e.extra.date&&amKey(p.title)===amKey(e.name)))return;
    if(items.some(p=>amReviewKey(p)===amReviewKey(e)))return;
    items.push(e);
  };
  const entities=[['characters','char',['bio','traits','appearance','skills','occupation','at']],['places','place',['description','parent','kind','status']],['factions','faction',['description','territory','goal','status']],['arcs','arc',['summary','status','result','start','end']]];
  for(const [tag,kind,fields] of entities)for(const v of amArr(z[tag]).slice(0,4)){
    if(!amObj(v).name||!amSafeName(v.name))continue;
    for(const field of fields)if(typeof v[field]==='string')add(kind,v.name,field,v[field]);
    if(kind==='char')for(const sk of amArr(v.skillSet).slice(0,5))if(amObj(sk).name&&amSafeName(sk.name))
      add('skill',v.name,sk.name,JSON.stringify({name:amStr(sk.name,65),level:amStr(sk.level,65),details:amStr(sk.details,170)}));
  }
  for(const r of amArr(z.relations).slice(0,5)){
    if(!amObj(r).from||!amSafeName(r.from)||!amSafeName(r.to)||amKey(r.from)===amKey(r.to))continue;
    const name=amStr(r.from,80)+'→'+amStr(r.to,80);
    for(const field of ['view','reason','tags','trust'])if(r[field]!==undefined&&r[field]!==null)add('rel',name,field,String(r[field]));
  }
  for(const f of amArr(z.facts).slice(0,4))if(amObj(f).text)add('fact',amStr(f.about||'Факт сцены',85),'text',String(f.text));
  for(const e of amArr(z.events).slice(0,4)){
    if(typeof e==='string')add('event','','text',e,{date:m.config.calendar?m.date||'без даты':'без даты',importance:1,time:m.config.calendar?m.time:''});
    else if(amObj(e).text)add('event','','text',String(e.text),{date:m.config.calendar?amDate(e.date)||m.date||'без даты':'без даты',time:m.config.calendar?amTime(e.time)||m.time:'',importance:[1,2,3].includes(Number(e.importance))?Number(e.importance):1});
  }
  for(const p of (m.config.calendar?amArr(z.plans):[]).slice(0,4))if(amObj(p).title&&amDate(p.date))
    add('plan',String(p.title),'details',String(p.details||'Запланированное событие'),{date:p.date,recurrence:p.recurrence==='yearly'?'yearly':''});
  for(const d of (m.config.calendar?amArr(z.daySummaries):[]).slice(0,3))if(amObj(d).summary&&amDate(d.date))add('day',d.date,'summary',String(d.summary));
  if(m.config.calendar&&typeof z.daySummary==='string'&&m.date)add('day',m.date,'summary',z.daySummary);
  if(typeof z.world==='string')add('world','','world',z.world);
  if(typeof z.place==='string')add('here','','place',z.place);
  if(m.config.calendar&&typeof z.date==='string')add('date','','date',z.date);
  if(m.config.calendar&&typeof z.time==='string')add('time','','time',z.time);
  for(const v of amArr(z.observations).slice(0,4))if(amObj(v).text)add('observation',String(v.about||'Наблюдение сцены'),'text',String(v.text));
  let added=0;
  for(const e of items){
    if(m.reviewQueue.length>=60)break;
    const key=amReviewKey(e);
    if(m.reviewQueue.some(x=>amReviewKey(x)===key))continue;
    if(m.reviewSeen.some(x=>x.key===key&&(origin.turn===null||x.turn===null||origin.turn-x.turn<25)))continue;
    e.id=m.reviewNextId++;e.originalKey=key;m.reviewQueue.push(e);added++;
  }
  return m.reviewQueue.slice(before).map(e=>e);
}
function amReviewSource(e){const s=amObj(e.source);return 'рассказчик'+(s.turn!==null&&s.turn!==undefined?' · ход '+s.turn:'')+(s.date?' · '+s.date:'')+(s.excerpt?' · '+s.excerpt:'');}
function amReviewNotice(newItems){
  if(!newItems.length)return '';
  const show=newItems.slice(0,3).map(e=>'#'+e.id+' '+(e.tier==='observation'?'[НЕПРОВЕРЕНО] ':'[ПРЕДЛОЖЕНИЕ] ')+amReviewLabel(e)+': '+amStr(amReviewValue(e),105));
  return '\n\n[AID MEMORY — ожидает решения: '+newItems.length+']\nИсточник: рассказчик, ход '+(newItems[0].source.turn===null?'неизвестен':newItems[0].source.turn)+'. Точная выдержка: ;mem review ID\n'+show.join('\n')+
    (newItems.length>3?'\nЕщё '+(newItems.length-3)+' — ;mem review':'')+
    '\n;mem accept ID — подтвердить; ;mem edit ID | новый текст — исправить; ;mem reject ID — отказаться.\n;mem review — посмотреть все и источники.';
}
function amReviewInfo(e,detail){return '#'+e.id+' '+(e.tier==='observation'?'НЕПРОВЕРЕННОЕ НАБЛЮДЕНИЕ':'ПРЕДЛОЖЕНИЕ')+' — '+amReviewLabel(e)+': '+amStr(amReviewValue(e),detail?700:180)+
    (detail?'\nИсточник: '+amReviewSource(e)+'\nДействия: ;mem accept '+e.id+' / ;mem edit '+e.id+' | новый текст / ;mem reject '+e.id:'');}
function amReviewList(m,arg){
  const p=amStr(arg,100).toLowerCase();if(p==='log'||p==='history')return 'ЖУРНАЛ РЕШЕНИЙ (последние 20):\n'+(m.reviewHistory.slice(-20).map(x=>'#'+x.id+' '+x.action+' '+x.label+' ['+x.origin+']').join('\n')||'Записей нет.');
  if(/^\d+$/.test(p)){const e=m.reviewQueue.find(x=>x.id===Number(p));return e?amReviewInfo(e,true):'Предложение #'+p+' не найдено.';}
  return 'ОЖИДАЮТ ПРОВЕРКИ ('+m.reviewQueue.length+'), включая наблюдения '+m.reviewQueue.filter(e=>e.tier==='observation').length+':\n'+
    (m.reviewQueue.slice(0,30).map(e=>amReviewInfo(e,false)).join('\n')||'Очередь пуста.')+
    (m.reviewQueue.length>30?'\nПоказаны первые 30 записей.':'')+'\n;mem review ID — источник и полный текст. ;mem review log — журнал решений.';
}
function amReviewApply(m,e){
  const v=e.value,z={};
  if(['char','place','faction','arc'].includes(e.kind)){
    const dict={char:'characters',place:'places',faction:'factions',arc:'arcs'};z[dict[e.kind]]=[{name:e.name,[e.field]:v}];
  }else if(e.kind==='skill'){let val;try{val=JSON.parse(v);}catch(err){return false;}
    z.characters=[{name:e.name,skillSet:[val]}];
  }else if(e.kind==='rel'){
    const p=e.name.split('→');if(p.length!==2)return false;
    z.relations=[{from:p[0],to:p[1],[e.field]:e.field==='trust'?Number(v):v}];
  }else if(e.kind==='fact'||e.kind==='observation')z.facts=[{about:e.name,text:v}];
  else if(e.kind==='event')z.events=[{text:v,importance:e.extra.importance,date:e.extra.date,time:e.extra.time}];
  else if(e.kind==='plan')z.plans=[{date:e.extra.date,title:e.name,details:v,recurrence:e.extra.recurrence}];
  else if(e.kind==='day')z.daySummaries=[{date:e.name,summary:v}];
  else if(e.kind==='world')z.world=v;
  else if(e.kind==='here')z.place=v;
  else if(e.kind==='date')z.date=v;
  else if(e.kind==='time')z.time=v;
  const old=JSON.stringify(amSnapshot(m));amReport(m,z);
  if(JSON.stringify(amSnapshot(m))===old)return false;
  if(e.kind==='fact'||e.kind==='observation'){
    const fact=m.facts.find(x=>amKey(x.about)===amKey(e.name)&&amKey(x.text)===amKey(v));
    if(fact)fact.source='approved:narrator';
  }
  if(e.kind==='event'){
    const event=m.events.find(x=>amKey(x.text)===amKey(v));if(event)event.source='approved:narrator';
  }
  return true;
}
function amReviewCommand(m,verb,rest){
  if(verb==='review')return amReviewList(m,rest);
  const hit=/^([1-9]\d*)(?:\s+([\s\S]*))?$/.exec(amStr(rest,2000));
  if(!hit)return 'Формат: ;mem '+verb+' ID'+(verb==='edit'?' | новое значение':'')+'. Список: ;mem review';
  const id=Number(hit[1]),e=m.reviewQueue.find(x=>x.id===id);
  if(!e)return 'Запись #'+id+' не найдена в очереди. ;mem review';
  if(verb==='edit'){
    const p=/^\|\s*(?:value\s*=\s*)?([\s\S]+)$/.exec(hit[2]||'');
    if(!p)return 'Исправление: ;mem edit '+id+' | исправленный текст';
    let value=p[1].trim();
    if(e.kind==='skill'){try{const sk=JSON.parse(e.value),z=/^(level|details)\s*=\s*([\s\S]+)$/.exec(value);
      if(z)sk[z[1]]=z[2];else sk.level=value;value=JSON.stringify(sk);}catch(err){return 'Ошибка структуры навыка.';}}
    const updated=Object.assign({},e,{value});
    if(!amReviewValid(updated,m))return 'Недопустимое значение. Запись не изменена; проверь формат, длину, trust, дату или родительскую локацию.';
    e.value=value;e.edited=true;e.source=Object.assign({},e.source,{editedBy:'user'});
    return 'Предложение #'+id+' исправлено, но ещё не сохранено.\n'+amReviewInfo(e,true)+'\nДля подтверждения: ;mem accept '+id;
  }
  if(verb==='reject'){
    m.reviewQueue=m.reviewQueue.filter(x=>x.id!==id);
    m.reviewSeen.push({key:amReviewKey(e),turn:e.source.turn});
    if(e.originalKey&&e.originalKey!==amReviewKey(e))m.reviewSeen.push({key:e.originalKey,turn:e.source.turn});
    m.reviewSeen=m.reviewSeen.slice(-100);
    m.reviewHistory.push({id,action:'отклонено',label:amReviewLabel(e),origin:'narrator'});m.reviewHistory=m.reviewHistory.slice(-100);
    return 'Предложение #'+id+' отклонено. Подтверждённые сведения не изменены.';
  }
  const replace=/^replace$/i.test((hit[2]||'').trim());
  if(hit[2]&&!replace)return 'Формат: ;mem accept '+id+' или ;mem accept '+id+' replace (явно заменить ручное/импортированное поле).';
  if(!m.config.calendar&&['date','time','day','plan'].includes(e.kind))return 'Календарь Memory Engine выключен. Включи ;mem date on, чтобы подтвердить календарное предложение.';
  if(!amReviewValid(e,m))return 'Нельзя применить предложение #'+id+': неверное поле или ссылка, проверь ;mem review '+id+'.';
  const current=amReviewCurrent(m,e),path=amReviewPath(e),origin=m.provenance[path];
  if(current!==undefined&&amKey(current)!==amKey(e.value)&&!replace&&!e.edited&&
    (!origin||origin.origin==='user'||origin.origin==='import'))
    return 'КОНФЛИКТ: '+amReviewLabel(e)+' уже содержит подтверждённое значение «'+amStr(current,130)+'».\n'+
      'Предложение: '+amStr(amReviewValue(e),130)+'\nНе изменено. Для осознанной замены: ;mem accept '+id+' replace';
  if(current!==undefined&&amKey(current)===amKey(e.value)){
    m.reviewQueue=m.reviewQueue.filter(x=>x.id!==id);return 'Предложение #'+id+' уже совпадает с подтверждённой записью, повтор не добавлен.';
  }
  const old=JSON.parse(JSON.stringify(amSnapshot(m)));
  try{
    if(!amReviewApply(m,e))return 'Не получилось сохранить #'+id+' (лимит, дубликат или недопустимая связь). Предложение осталось в очереди.';
    amReviewMarkDiff(m,old,'approved','подтверждено пользователем из ответа рассказчика #'+id);
    m.reviewQueue=m.reviewQueue.filter(x=>x.id!==id);
    m.reviewSeen.push({key:amReviewKey(e),turn:e.source.turn});
    if(e.originalKey&&e.originalKey!==amReviewKey(e))m.reviewSeen.push({key:e.originalKey,turn:e.source.turn});
    m.reviewSeen=m.reviewSeen.slice(-100);
    m.reviewHistory.push({id,action:e.edited?'исправлено и подтверждено':'подтверждено',label:amReviewLabel(e),origin:'narrator'});m.reviewHistory=m.reviewHistory.slice(-100);
    return 'Подтверждено и сохранено #'+id+': '+amReviewLabel(e)+' — '+amStr(amReviewValue(e),200)+'\nИсточник: '+amReviewSource(e);
  }catch(err){
    for(const [k,v]of Object.entries(old))m[k]=v;
    return 'Не удалось применить #'+id+': '+amStr(err.message||err,140)+'. Состояние записей восстановлено.';
  }
}
function amReviewMarkDiff(m,old,origin,note){
  const before=amObj(old),source={origin,note:amStr(note||'',130),date:m.date||''};
  function set(path,a,b){if(JSON.stringify(a)!==JSON.stringify(b)&&b!==undefined)m.provenance[path]=source;}
  for(const f of ['world','date','time','place'])set((f==='place'?'here':f)+'||'+(f==='place'?'place':f),before[f],m[f]);
  for(const [collection,tag] of [['characters','char'],['places','place'],['factions','faction'],['arcs','arc'],['relations','rel']]){
    const prev=amObj(before[collection]),curr=amObj(m[collection]);
    for(const [key,item] of Object.entries(curr)){
      const older=amObj(prev[key]);
      for(const [field,value] of Object.entries(item)){
        if(field==='name'||field==='from'||field==='to')continue;
        if(field==='skillSet'){
          for(const [sk,data] of Object.entries(amObj(value)))set('skill|'+key+'|'+sk,amObj(older.skillSet)[sk],data);
        }else set(tag+'|'+key+'|'+amKey(field),older[field],value);
      }
    }
  }
  for(const [d,day] of Object.entries(amObj(m.days)))set('day|'+d+'|summary',amObj(before.days)[d]&&before.days[d].summary,day.summary);
  for(const entry of m.facts)if(!amArr(before.facts).some(x=>x.id===entry.id))set('fact|'+entry.id+'|text',undefined,entry.text);
  for(const entry of m.events)if(!amArr(before.events).some(x=>x.id===entry.id))set('event|'+entry.id+'|text',undefined,entry.text);
}
function amReviewProvenance(m,raw){
  if(!raw)return 'ИСТОЧНИКИ: записей '+Object.keys(m.provenance).length+'.\n;mem sources char Алиса / ;mem sources rel Алиса -> Дана / ;mem sources place Офис';
  const parts=raw.trim().split(/\s+/),tag=parts.shift(),name=parts.join(' '),mapped=tag==='relation'?'rel':tag;
  if(!['char','place','faction','arc','rel','skill','day'].includes(mapped))return 'Формат: ;mem sources char Алиса / rel Алиса -> Дана / place Офис';
  const key=amKey(name.replace(/\s*->\s*/,'→'));
  const prefix=mapped+'|'+key+'|';
  const rows=Object.entries(m.provenance).filter(([k])=>k.startsWith(prefix)).slice(0,30);
  return 'ИСТОЧНИКИ '+mapped+' '+name+':\n'+(rows.map(([k,v])=>k.slice(prefix.length)+' — '+v.origin+(v.note?' ('+v.note+')':'')).join('\n')||'Нет зафиксированных источников (данные могут быть из старой версии).');
}


const AM_TRANSFER_CHUNK=1600, AM_TRANSFER_MAX_PARTS=400;
function amTransferUTF8Encode(str){
  const bytes=[];
  for(let i=0;i<str.length;i++){
    let code=str.codePointAt(i);if(code>65535)i++;
    if(code<128)bytes.push(code);
    else if(code<2048)bytes.push(192|(code>>6),128|(code&63));
    else if(code<65536)bytes.push(224|(code>>12),128|((code>>6)&63),128|(code&63));
    else bytes.push(240|(code>>18),128|((code>>12)&63),128|((code>>6)&63),128|(code&63));
  }
  const abc='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';let output='';
  for(let i=0;i<bytes.length;i+=3){
    const a=bytes[i],b=bytes[i+1],c=bytes[i+2];
    output+=abc[a>>2]+abc[((a&3)<<4)|(b===undefined?0:b>>4)];
    if(b!==undefined)output+=abc[((b&15)<<2)|(c===undefined?0:c>>6)];
    if(c!==undefined)output+=abc[c&63];
  }
  return output;
}
function amTransferUTF8Decode(input){
  if(!/^[A-Za-z0-9_-]*$/.test(input)||input.length%4===1)throw Error('Некорректная кодировка обмена.');
  const abc='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';const bytes=[];
  for(let i=0;i<input.length;i+=4){
    const a=abc.indexOf(input[i]),b=abc.indexOf(input[i+1]),c=i+2<input.length?abc.indexOf(input[i+2]):-1,d=i+3<input.length?abc.indexOf(input[i+3]):-1;
    if(a<0||b<0||c===-2||d===-2)throw Error('Ошибка символов в части.');
    bytes.push((a<<2)|(b>>4));
    if(c>=0)bytes.push(((b&15)<<4)|(c>>2));
    else if((b&15)!==0)throw Error('Недопустимый хвост части.');
    if(d>=0){if(c<0)throw Error('Повреждённый блок кодировки.');bytes.push(((c&3)<<6)|d);}
    else if(c>=0&&(c&3)!==0)throw Error('Недопустимый хвост части.');
  }
  let output='';
  for(let i=0;i<bytes.length;){
    const a=bytes[i++];let code;
    if(a<128){code=a;}
    else if(a>=194&&a<=223){if(i>=bytes.length||bytes[i]<128||bytes[i]>191)throw Error('Ошибка UTF-8');code=((a&31)<<6)|(bytes[i++]&63);}
    else if(a>=224&&a<=239){if(i+1>=bytes.length)throw Error('Обрыв UTF-8');const b=bytes[i++],c=bytes[i++];if(b<128||b>191||c<128||c>191||(a===224&&b<160)||(a===237&&b>=160))throw Error('Ошибка UTF-8');code=((a&15)<<12)|((b&63)<<6)|(c&63);}
    else if(a>=240&&a<=244){if(i+2>=bytes.length)throw Error('Обрыв UTF-8');const b=bytes[i++],c=bytes[i++],d=bytes[i++];if(b<128||b>191||c<128||c>191||d<128||d>191||(a===240&&b<144)||(a===244&&b>=144))throw Error('Ошибка UTF-8');code=((a&7)<<18)|((b&63)<<12)|((c&63)<<6)|(d&63);}
    else throw Error('Ошибка UTF-8');
    output+=String.fromCodePoint(code);
  }
  return output;
}
function amTransferChecksum(input){
  let fnv=2166136261,adlerA=1,adlerB=0;
  for(let i=0;i<input.length;i++){const code=input.charCodeAt(i);fnv=Math.imul(fnv^code,16777619);adlerA=(adlerA+code)%65521;adlerB=(adlerB+adlerA)%65521;}
  return (fnv>>>0).toString(16).padStart(8,'0')+(((adlerB<<16)|adlerA)>>>0).toString(16).padStart(8,'0');
}
function amTransferScopeData(m,scope){
  const root={world:m.world||'',places:m.places,factions:m.factions,
    facts:amArr(m.facts).map(f=>{const x=Object.assign({},f);delete x.sourceCardId;return x;}),
    plotImports:m.plotImports,provenance:m.provenance};
  if(scope==='all')Object.assign(root,{date:m.date,time:m.time,place:m.place,
    characters:m.characters,relations:m.relations,events:m.events,days:m.days,
    months:m.months,arcs:m.arcs,plans:m.plans,nextId:m.nextId,
    reviewHistory:m.reviewHistory,reviewSeen:m.reviewSeen,reviewNextId:m.reviewNextId});
  return JSON.parse(JSON.stringify({format:'AIDM_PORTABLE',version:1,scope,
    engine:AM_ENGINE_BUILD,data:root}));
}
function amTransferCounts(m){
  return 'персонажи '+Object.keys(amObj(m.characters)).length+', локации '+Object.keys(amObj(m.places)).length+
    ', фракции '+Object.keys(amObj(m.factions)).length+', связи '+Object.keys(amObj(m.relations)).length+
    ', факты '+amArr(m.facts).length+', события '+amArr(m.events).length+', планы '+amArr(m.plans).length;
}
function amTransferHasCanon(m){return !!(m.world||m.date||m.time||m.place||m.rpgSnapshot||
  Object.keys(amObj(m.characters)).length||Object.keys(amObj(m.places)).length||
  Object.keys(amObj(m.factions)).length||Object.keys(amObj(m.relations)).length||
  amArr(m.facts).length||amArr(m.events).length||Object.keys(amObj(m.days)).length||
  Object.keys(amObj(m.months)).length||Object.keys(amObj(m.arcs)).length||
  amArr(m.plans).length||Object.keys(amObj(m.plotImports)).length);
}
function amTransferValidate(src){
  if(!src||typeof src!=='object'||Array.isArray(src)||src.format!=='AIDM_PORTABLE'||src.version!==1||!['all','world'].includes(src.scope))throw Error('Неверный формат или версия файла переноса.');
  const d=src.data;if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Нет данных переноса.');
  const maps=[['characters',AM_CFG.maxChars],['places',AM_CFG.maxPlaces],['factions',AM_CFG.maxFactions],['relations',AM_CFG.maxRelations],['arcs',AM_CFG.maxArcs],['days',AM_CFG.maxDays],['months',100],['provenance',3500],['plotImports',10]];
  for(const [key,limit] of maps){if(d[key]===undefined)continue;if(!d[key]||typeof d[key]!=='object'||Array.isArray(d[key])||Object.keys(d[key]).length>limit)throw Error('Некорректная таблица '+key);}
  const lists=[['facts',AM_CFG.maxFacts],['events',AM_CFG.maxEvents],['plans',AM_CFG.maxPlans],['reviewHistory',200],['reviewSeen',180]];
  for(const [key,limit] of lists){if(d[key]===undefined)continue;if(!Array.isArray(d[key])||d[key].length>limit)throw Error('Некорректный массив '+key);}
  if(typeof d.world!=='string'||d.world.length>1700||d.date&&!amDate(d.date)||d.time&&!amTime(d.time))throw Error('Некорректный мир или календарь.');
  for(const group of ['characters','places','factions','arcs'])for(const [key,value] of Object.entries(amObj(d[group]))){
    if(!value||typeof value!=='object'||!amSafeName(value.name)||amKey(value.name)!==key)throw Error('Некорректная запись в '+group+'.');
  }
  for(const list of ['facts','events','plans'])for(const row of amArr(d[list]))if(!row||typeof row!=='object'||!Number.isSafeInteger(row.id)||row.id<1)throw Error('Повреждённые ID в '+list+'.');
  return d;
}

/* v1.4.6: shared read-only help pages; moved here to keep Input under 64 KiB. */
const AM_HELP_PAGES={
  "start": "БЫСТРЫЙ СТАРТ И ОБЩАЯ СПРАВКА\n;mem ping — проверить загрузку новой версии.\n;mem status — убедиться, что Memory Engine работает.\n;mem import — импортировать Story Cards: персонажи, места, фракции и другие типы как факты.\n;mem date 2016-01-02 09:06 — установить ВНУТРИИГРОВУЮ дату.\n;mem map / ;mem list char / ;mem timeline / ;mem calendar — посмотреть сохранённое.\n;mem auto on и ;mem cards on — автоизвлечение и собственные Story Cards (обычно включены).\nВ обычной игре ничего вводить не нужно: модель попытается присылать структурированные обновления.\nПодробная справка: ;mem help char, ;mem help place, ;mem help batch; все разделы: ;mem help all.",
  "status": "СОСТОЯНИЕ И ПРОВЕРКА\n;mem ping — быстрая проверка подключения, не изменяет данные.\n;mem status — включённые режимы, дата, текущее место, число записей и счётчики ошибок.\n;mem pending — число успешно обработанных автопакетов, пропусков и последние события (НЕ подтверждение изменений).\n;mem recent — короткие сырые фрагменты последних сцен. Они могут быть неточны.\n;mem validate — проверка связей parent у локаций, в том числе старых повреждённых.\nВажно: рост misses означает отсутствие распознанного JSON-маркера в ответах модели; это не всегда ошибка скрипта.\nСвязанные темы: ;mem help auto, ;mem help cards, ;mem help debug.",
  "world": "МИР И ТЕКУЩЕЕ МЕСТО\n;mem world Описание мира — сохранить общий сеттинг (до 1700 символов, длинный текст будет обрезан).\n;mem world — показать сохранённый сеттинг.\n;mem here Название места — указать текущее место героя в памяти.\n;mem here — показать его; ;mem map — показать мировую карту и фракции.\nУказание here НЕ создаёт локацию и НЕ синхронизирует её с другой RPG-системой.\nДля иерархии комнат и зданий: ;mem help place.",
  "place": "ЛОКАЦИИ, PARENT И КАРТА\n;mem place Название | description=... | kind=... | status=... | parent=...\ndescription — постоянная обстановка; kind — описательный тип (город, здание, комната); status — текущее состояние.\nparent — существующая родительская локация. Сначала создай родителя; циклы запрещены.\nПример 1: ;mem place Строй-Арт | kind=здание | description=Офис на пятом этаже\nПример 2: ;mem place Кабинет Даны | parent=Строй-Арт | kind=комната | status=Открыт\n;mem list place — список; ;mem show place Кабинет Даны — поля; ;mem map — дерево локаций.\n;mem validate — ошибки parent; ;mem delete place Название — удаление (невозможно, пока есть дочерние локации).\nkind/status не рассчитывают маршруты и не блокируют вход. В batch допускается создать родителя позднее в том же пакете.\nСм. ;mem help batch и ;mem help faction.",
  "faction": "ФРАКЦИИ И ОРГАНИЗАЦИИ\n;mem faction Название | description=... | territory=... | goal=... | status=...\ndescription — описание; territory — территория влияния (текст); goal — цели; status — состояние организации.\nПример: ;mem faction Строй-Арт | description=Дизайнерская студия | territory=Де-Мойн | goal=Расширить рынок | status=Работает\n;mem list faction — список; ;mem show faction Строй-Арт — карточка; ;mem map — фракции вместе с местами.\n;mem delete faction Строй-Арт — удалить запись.\nПоля помогают рассказчику, но не симулируют автономную экономику, войны или границы территорий.",
  "char": "ПЕРСОНАЖИ И ИХ ОПИСАНИЯ\n;mem char Имя | bio=... | traits=... | appearance=... | occupation=... | skills=... | at=...\nbio — биография; traits — характер; appearance — внешность; occupation — профессия; skills — общий текст о способностях; at — известное место.\nПример: ;mem char Алиса | bio=Молодая художница | traits=Упорная | occupation=Стажёр\nИзменить одно поле: ;mem char Алиса | at=Офис Даны\n;mem char Алиса — показать поля, если запись есть; ;mem list char — список; ;mem show char Алиса — карточка.\nСоздание требует минимум одно непустое поле. Пустое значение не очищает ранее заполненное поле.\nОтдельные навыки: ;mem help skill. Отношения: ;mem help rel. Удаление: ;mem delete char Алиса.",
  "skill": "ОПИСАТЕЛЬНЫЕ НАВЫКИ NPC\n;mem skill Персонаж | Навык | Уровень | Подробности\nПример: ;mem skill Алиса | Рисование | высокий | Рисует эскизы от руки\nПерсонаж должен быть заранее создан. Уровень — произвольный текст, а не числовой RPG-показатель.\n;mem skills Алиса — список отдельных навыков; ;mem delete skill Алиса | Рисование — удалить навык.\nПоле char.skills — общее текстовое описание; команда skill — отдельные именованные навыки (до 28 на персонажа).\nДля заполнения нескольких навыков: ;mem batch template skill; строки §;mem skill Имя | Навык | Уровень | Детали.",
  "rel": "НАПРАВЛЕННЫЕ ОТНОШЕНИЯ\n;mem rel А -> Б | view=... | reason=... | tags=... | trust=...\nview — отношение А к Б; reason — его причина; tags — произвольные метки; trust — целое от -100 до 100.\nПример: ;mem rel Дана -> Алиса | view=Симпатия | reason=Хорошее портфолио | trust=25\nА→Б и Б→А — НЕ одна и та же связь: для обратного отношения создай отдельную запись.\n;mem list rel — список; ;mem show rel Дана -> Алиса — просмотр; ;mem delete rel Дана -> Алиса — удалить направление.\nНеверный trust отклоняется. trust не изменяет броски, поведение или численные навыки механически.",
  "fact": "УСТОЙЧИВЫЕ ФАКТЫ\n;mem fact Тема | Текст факта (минимум 8 символов)\nПример: ;mem fact Договор | Испытательный срок Алисы составляет две недели\nПри создании возвращается ID: ;mem edit fact ID | Новый текст — исправить с сохранением ID; ;mem edit fact ID | Новая тема | Новый текст — сменить тему и текст; ;mem delete fact ID — удалить.\nПовтор абсолютно такого же факта не создаёт дубликат.\nВ v1.3.1 доступны ;mem list fact и ;mem show fact ID. Для удаления используй ;mem delete fact ID.\nФакт выбирается в контекст преимущественно при упоминании его темы в текущем действии.",
  "event": "СОБЫТИЯ И ВАЖНОСТЬ\n;mem event Событие | 1   — событие на текущую дату (если задана).\n;mem event YYYY-MM-DD | Текст события | 1..3 — событие на указанную дату.\n1 = мелкая деталь; 2 = важное; 3 = ключевое. Важность влияет на приоритет памяти, а не на RPG-механику.\nПример: ;mem event 2016-01-02 | Алиса познакомилась с Даной на работе | 2\nОписание не короче 8 символов. Полностью повторяющееся событие за ту же дату не дублируется.\nСкрипт возвращает ID: ;mem delete event ID — удаление. ;mem day — события дня; ;mem timeline — летопись.\nСм. ;mem help day и ;mem help arc.",
  "day": "ДНЕВНЫЕ ИТОГИ И ЛЕТОПИСЬ\n;mem date 2016-01-02 09:06 — установить дату и часы (или только дату).\n;mem summary 2016-01-02 | Итог дня — написать или заменить сводку указанного дня.\n;mem day — текущий день; ;mem day 2016-01-02 — выбранный день.\n;mem timeline — последние 24 дня, ключевые события и сюжетные линии.\nПример: ;mem summary 2016-01-02 | Алиса получила работу и познакомилась с коллегами\nСтарые дневные сведения со временем уплотняются в месячные сводки; это не полный журнал всех сообщений.\nВремя календаря Memory Engine не синхронизируется автоматически с Universal RPG.\nСм. ;mem help event и ;mem help plan.",
  "arc": "КРУПНЫЕ СЮЖЕТНЫЕ ЛИНИИ\n;mem arc Название | summary=... | status=... | result=... | start=... | end=...\nsummary — общий сюжет; status — текущая фаза; result — итог; start/end — записанные текстом начало и конец.\nПример: ;mem arc Первая работа | summary=Алиса осваивается в студии | status=В процессе | start=2016-01-02\nОбновить: ;mem arc Первая работа | status=Завершена | result=Алису приняли в штат\n;mem list arc — список; ;mem show arc Первая работа — поля; ;mem delete arc Первая работа — удалить.\nПоля не запускают самостоятельно задания и не завершают их по таймеру.",
  "plan": "ПЛАНЫ И КАЛЕНДАРЬ\n;mem plan YYYY-MM-DD | Название | Примечание | yearly (необязательно)\nПример: ;mem plan 2016-01-22 | Собеседование | Встреча с директором\nЕжегодно: ;mem plan 2016-05-01 | День рождения | Поздравить Алису | yearly\n;mem calendar — даты и ID планов; ;mem day — планы текущего дня рядом с событиями.\n;mem delete plan ID — удалить по числовому ID, который виден при создании и в calendar.\nПлан ≠ произошедшее событие. Скрипт напоминает о планах в контексте, но не исполняет их автоматически.\nДля исправления неверной записи обычно удаляют план по ID и создают новый.\nСм. ;mem help event и ;mem help day.",
  "batch": "ПАКЕТНОЕ ЗАПОЛНЕНИЕ (одно действие)\nРекомендуемый формат — те же команды, что и по одной:\n;mem batch\n§;mem char Алиса | bio=Начинающая дизайнер | traits=Упорная\n§;mem skill Алиса | Рисование | высокий | Делает эскизы\n§;mem place Строй-Арт | kind=здание | description=Офис компании\n§;mem rel Алиса -> Дана | view=Уважение | trust=40\n§:apply\nКаждая строка — почти неизменённая одиночная команда; добавь перед ней § для надёжности в режиме Do. Последняя строка обязательно §:apply. Поддерживаются char, skill, place, faction, rel, arc, world, date, here, fact, event, summary, plan, delete.\nШаблоны: ;mem batch template char / skill / rel / place / faction / world / fact / event / day / arc / plan / delete / all.\nСтарый формат §bio=... поддерживается; шаблоны: ;mem batch template legacy char / place / faction / arc / all.\nПакет применяется целиком или не применяется вовсе; максимум 3950 символов и 55 развёрнутых полей. Родитель и дочерняя локация могут создаваться в одном пакете. Отмена: ;mem undo (Story Cards отдельно не откатываются).\nДопускаются строки без §, если редактор сохраняет переносы; вариант § надёжнее.",
  "auto": "АВТОМАТИЧЕСКОЕ ЗАПОМИНАНИЕ\n;mem auto on — включить обработку модельных JSON-отчётов (по умолчанию включено).\n;mem auto off — не записывать новые данные из JSON-отчётов; ручные команды работают.\nПри включении Context просит рассказчика добавлять [[AIDM_UPDATE]]{JSON}[[/AIDM_UPDATE]].\nOutput скрывает маркер от игрока, проверяет JSON и добавляет предложения в ;mem review; без подтверждения игрока сведения не считаются фактами.\n;mem pending — сведения об успехах/пропусках; ;mem recent — сырой текст сцен.\nАвтозапись может ошибаться и не является независимой проверкой истины.\nДля карточек: ;mem help cards; для диагностики: ;mem help debug.",
  "import": "ИМПОРТ ИСТОЧНИКОВ v1.8.0\n;mem import — добавить новые Story Cards и доступные через API Plot Essentials/Author’s Note.\n;mem import preview — количество доступных Story Cards и полей Plot, без изменений.\n;mem import refresh — сверить ранее импортированные Custom/Item/Lore; обновить их название, текст, ключи и тип. У стандартных Character/Location/Faction уже изменённые вручную поля не перезаписываются.\n;mem list fact и ;mem show fact ID — оригинальный Custom-тип и все ключи-триггеры.\n;mem import plot — варианты; ;mem import plot auto — взять доступные state.memory.context/authorsNote (эти поля могли быть изменены другим скриптом).\n;mem import plot summary | Текст — вставить Story Summary вручную; допустимы essentials, authorsnote, instructions.\n;mem import plot status — посмотреть, какие Plot-источники сохранены. AI Instructions/Story Summary API не выдаёт отдельными полями.\n;mem import rpg — протокол; ;mem import rpg card — поиск [AID_RPG_EXPORT:1] Story Card; ;mem import rpg paste | {JSON} — принять экспорт вручную; ;mem import rpg status — посмотреть снимок.\nUniversal RPG хранит свой state отдельно: без его экспорта автоматической синхронизации нет.",
  "cards": "STORY CARDS И ИМПОРТ\n;mem cards on/off — включить или отключить обновление собственных Story Cards (обычно on).\n;mem import — импортировать Character/Location/Faction в соответствующие разделы, а Custom/Class/Race/другие типы — как факты.\nНеизвестные типы Story Cards (Custom, Class, Race, Item и т. п.) сохраняются как именованные факты. Проверка: ;mem list fact и ;mem show fact ID.\nПри импорте нестандартных карточек сохраняются их type и все keys (показываются в ;mem show fact ID). Полный список способов: ;mem help import.\nИмпорт НЕ удаляет исходные карточки и НЕ превращает произвольный текст отношений в направленные связи.\nСкрипт помечает свои карточки [AIDMEM:1:...] и не перезаписывает чужие карточки с теми же ключами.\nЗа один Output выполняется до 8 попыток обработки изменённых карточек; это не гарантия мгновенного обновления.\nПри ;mem undo карточки автоматически не откатываются, их нужно проверить отдельно.\nОтдельного визуального интерфейса Banshee здесь нет. См. ;mem help auto и ;mem help undo.",
  "edit": "ПОИСК ПО ТИПАМ, ПРОСМОТР И УДАЛЕНИЕ\n;mem list char (или place, faction, rel, arc, fact) — краткие списки поддерживаемых типов.\n;mem show char/place/faction/arc Название — данные конкретной записи.\n;mem show rel А -> Б — направленное отношение. Для навыков: ;mem skills Имя.\n;mem delete char/place/faction/arc Название — удалить запись.\n;mem delete rel А -> Б — удалить одно направление.\n;mem delete skill Персонаж | Навык — удалить описательный навык.\n;mem delete event/fact/plan ID — удалить запись по числовому ID.\nУдаление персонажа убирает его отношения; место с дочерними локациями удалить нельзя.\nЧужие Story Cards не удаляются автоматически; undo НЕ отменяет отдельную команду delete.\nНет универсального ;mem search, ;mem export, ;mem clear. Факты доступны через ;mem list fact и ;mem show fact ID.",
  "undo": "ОТКАТ И ИСПРАВЛЕНИЕ ОШИБОК\n;mem undo — откатить последний доступный автопакет или завершённый batch.\nЭто НЕ история всех изменений: после обычной прямой команды откат может стать недоступен.\nОткат возвращает state.aidm, но НЕ синхронизированные Story Cards.\nДля конкретной ошибки лучше исправить поле: ;mem char Имя | traits=Исправленное описание.\nДля неверного события: ;mem delete event ID; для плана: ;mem delete plan ID.\nДля проверки: ;mem status, ;mem validate, ;mem map и ;mem timeline.\nПеред массовыми изменениями желательно сохранить копию приключения, если это позволяет интерфейс.",
  "debug": "ДИАГНОСТИКА И ОГРАНИЧЕНИЯ\n;mem ping — проверить загрузку Input/Library без изменения базы.\n;mem status — количество записей и счётчики misses, cardErrors, validationErrors.\n;mem validate — проверить вложенность локаций (отсутствующие родители и циклы).\n;mem pending — статистика автопакетов и последние события; ;mem recent — необработанные сценические фрагменты.\n;mem debug on — показать запуск Input/Context/Output и выдержку добавленного контекста; ;mem debug full — полный добавленный текст после каждого хода; ;mem debug off — отключить.\n;mem debug last / ;mem debug context — диагностика последнего игрового хода и полный фрагмент. Debug не показывает итоговый промпт других подключённых скриптов.\nЕсли команды не выполняются: проверь подключение Adventure Script и четыре вкладки Library/Input/Context/Output.\nЕсли сюжет вместо квитанции: проверь Input и Output, а также конфликт с другим скриптом.\nЕсли не появляются автоматические факты: проверь, есть ли JSON-маркер в ответе модели, и попробуй другую модель.\nСкрипт НЕ запускает отдельную LLM, НЕ синхронизирует часы RPG и НЕ строит графическую карту.\nТехническая команда может всё равно инициировать вызов модели; это не бесплатный служебный запрос.",
  "syntax": "СИНТАКСИС И ПРАВИЛА ВВОДА\nОсновной префикс: ;mem (точка с запятой, затем mem). Пример: ;mem status.\nСтарые !mem и :mem распознаются, но ! может переключать режим Story, а : может пересечься с RPG.\nОдна обычная команда — одно действие в режиме Do. Параметры разделяются вертикальной чертой |.\nНазвания полей: bio=..., parent=..., trust=... . В одной команде можно указать несколько полей.\nИмена объектов 2–80 символов; одинаковые имена без различия регистра и е/ё считаются одним объектом.\nНеизвестные/пустые поля одиночных char/place/faction/arc/rel отклоняются; это не удаляет прежние данные.\nНесколько объектов одним сообщением — ;mem batch, затем §;mem char Имя | bio=... и другие обычные команды; заверши §:apply. Старые §поле=значение также поддерживаются.\nРежим Do иногда добавляет точку: ;mem world. / ;mem list char. / ;mem help char. — это тоже принимается.\nВводи ;mem help topic для справки по параметрам, где topic = char/place/rel/plan и т. д.",
  "reset": "СБРОС ПАМЯТИ (опасные команды)\n;mem reset — предпросмотр всех категорий базы и собственных Story Cards без удаления.\n;mem reset data / cards / all — отдельный подробный предпросмотр по выбранному режиму без удаления.\n;mem reset data confirm — удалить только state.aidm: персонажей, локации, отношения, летопись, настройки, импорт и очередь карт; другие Story Cards остаются.\n;mem reset cards confirm — удалить только карточки с маркером [AIDMEM:1:char/place/faction:...] в начале Entry; база остаётся, cards переключается в off.\n;mem reset all confirm — удалить собственные Story Cards и затем полностью обнулить state.aidm.\nЕсли API недоступен, база при all НЕ очищается. За один вызов удаляется не более 30 карточек: повторяй команду, пока удаление не завершится.\nНе удаляются сюжет, ручные и импортированные Story Cards, Memory Bank, state.memory или данные других скриптов.\nПроверка без confirm показывает точные текущие количества, но не удаляет данные. Количества пересчитываются при каждом вызове.\nКоманды необратимы через ;mem undo. Сначала сделай копию приключения.\nСм. ;mem help cards и ;mem help debug.",
  "all": "ВСЕ КОМАНДЫ — КРАТКИЙ УКАЗАТЕЛЬ\nСамопроверка: ping (версия и доступ к состоянию).\nПросмотр: status, map, list char/place/faction/rel/arc/fact, show char/place/faction/arc/rel/fact, pending, recent.\nМир: world Текст; here Место; place Название | поля; faction Название | поля.\nПерсонажи: char Имя | поля; skill Имя | Навык | Уровень | Детали; skills Имя.\nОтношения: rel А -> Б | view=... | reason=... | tags=... | trust=-100..100.\nИстория: fact Тема | Текст; edit fact ID | Новый текст; event [Дата |] Текст | 1..3; summary Дата | Итог; arc Название | поля.\nКалендарь: date on/off; date YYYY-MM-DD [HH:MM]; day [Дата]; timeline; plan Дата | Название | Детали | yearly; calendar.\nУправление: batch, auto on/off, cards on/off, import (Story Cards/Plot), import rpg card/paste, validate, undo, reset data/cards/all confirm, delete Тип Значение.\nСправка по любому разделу: ;mem help char/place/faction/rel/event/day/plan/batch/auto/cards/edit/debug.\nНачать быстро: ;mem help start."
};
const AM_HELP_ALIASES={"":"index","help":"index","?":"index","topics":"index","темы":"index","разделы":"index","begin":"start","quick":"start","старт":"start","начало":"start","быстрый старт":"start","config":"status","состояние":"status","статус":"status","мир":"world","here":"world","здесь":"world","локация героя":"world","places":"place","map":"place","location":"place","locations":"place","локация":"place","локации":"place","карта":"place","места":"place","factions":"faction","фракция":"faction","фракции":"faction","организации":"faction","character":"char","characters":"char","персонаж":"char","персонажи":"char","герои":"char","skills":"skill","навык":"skill","навыки":"skill","relation":"rel","relations":"rel","отношение":"rel","отношения":"rel","связи":"rel","facts":"fact","факты":"fact","факт":"fact","events":"event","события":"event","событие":"event","date":"day","summary":"day","timeline":"day","летопись":"day","хроника":"day","дата":"day","сводка":"day","день":"day","дни":"day","arcs":"arc","сюжет":"arc","сюжеты":"arc","линии":"arc","сюжетные линии":"arc","calendar":"plan","plans":"plan","календарь":"plan","планы":"plan","план":"plan","setup":"batch","пакет":"batch","пакетное заполнение":"batch","шаблон":"batch","шаблоны":"batch","авто":"auto","автоматизация":"auto","автопамять":"auto","storycards":"cards","story cards":"cards","card":"cards","import":"import","plot":"import","сюжетные компоненты":"import","rpg":"import","карточки":"cards","импорт":"import","list":"edit","show":"edit","delete":"edit","удаление":"edit","списки":"edit","просмотр":"edit","редактирование":"edit","откат":"undo","отмена":"undo","reset":"reset","сброс":"reset","очистка":"reset","очистить память":"reset","validate":"debug","pending":"debug","recent":"debug","диагностика":"debug","ошибки":"debug","проверка":"debug","отладка":"debug","format":"syntax","формат":"syntax","синтаксис":"syntax","ввод":"syntax","все":"all","команды":"all"};


function amCardTarget(m,c){
  if(!c||String(c.entry||'').startsWith(AM_CARD)||String(c.entry||'').startsWith('[AID_RPG_EXPORT:1]'))return null;
  const linked=amObj(m.cardLinks)[amCardSourceId(c)];
  if(linked){const item=amCardRecord(m,linked.kind,linked.key);return item?{kind:linked.kind,key:linked.key,name:item.name||item.about}:null;}
  const type=amKey(c.type||'');
  const kind=['character','персонаж'].includes(type)?'char':['location','место','локация'].includes(type)?'place':
    ['faction','фракция','организация'].includes(type)?'faction':'';
  if(!kind){
    const matches=m.facts.filter(f=>f.sourceCardId===amCardSourceId(c)||(amKey(f.about)===amKey(c.title||c.name||String(c.keys||'').split(',')[0])&&f.cardType===c.type));
    return matches.length===1?{kind:'fact',key:String(matches[0].id),name:matches[0].about}:null;
  }
  const dict=kind==='char'?m.characters:kind==='place'?m.places:m.factions;
  const names=String(c.keys||'').split(',').concat([c.name,c.title]).filter(Boolean);
  const matches=[...new Set(names.map(amKey).filter(key=>Object.prototype.hasOwnProperty.call(dict,key)))];
  return matches.length===1?{kind,key:matches[0],name:dict[matches[0]].name}:null;
}
function amCardFingerprint(c){return JSON.stringify([c.id,c.keys,c.entry,c.type,c.name,c.title,c.description,c.notes]);}
function amCardPreviewText(v,n){const s=String(v||'').replace(/\r\n?/g,'\n');return s.length>n?s.slice(0,n)+'…':s;}

function amCardMaintenanceCommand(m,arg){
  if(/^repair$/i.test(arg)){
    let repaired=0,missing=0,conflicts=0;
    for(const tag of Object.keys(m.cardAdoptions)){
      const saved=m.cardAdoptions[tag];
      const idx=storyCards.findIndex(c=>String(c.entry||'').startsWith(tag)||(saved.cardId!=null&&c.id===saved.cardId));
      if(idx<0){missing++;continue;}
      if(!String(storyCards[idx].entry||'').startsWith(tag)){conflicts++;continue;}
      const c=storyCards[idx],meta=Object.assign({},saved.original,{title:saved.original.title===undefined?c.title:saved.original.title});
      try{if(amWriteCard(idx,c.keys,c.entry,saved.original.type,meta)!==false)repaired++;else m.cardErrors++;}catch(e){m.cardErrors++;}
    }
    return 'Проверено/исправлено карточек: '+repaired+'; отсутствуют: '+missing+'; изменён маркер вручную: '+conflicts+'. Для отсутствующей: ;mem cards restore TYPE ИМЯ, затем confirm. Копии: ;mem cards backups.';
  }
  const show=/^show\s+(char|place|faction|fact)\s+(.+)$/i.exec(arg);
  if(show){
    const key=amKey(show[2]),tag=AM_CARD+show[1].toLowerCase()+':'+key+']',saved=m.cardAdoptions[tag];
    const idx=storyCards.findIndex(c=>String(c.entry||'').startsWith(tag)||(saved&&saved.cardId!=null&&c.id===saved.cardId));
    if(idx<0)return 'Активная Story Card не найдена. '+(saved?'Исходная копия сохранена: ;mem cards backup '+show[1]+' '+show[2]:'Запись памяти: ;mem show '+show[1]+' '+show[2]);
    const c=storyCards[idx];return 'STORY CARD #'+idx+'; ID '+c.id+'; тип '+c.type+'; имя '+(c.title||c.name||'?')+'; ключи '+c.keys+'\n'+c.entry;
  }
  const link=/^link\s+(\d+)\s*\|\s*(char|place|faction|fact)\s*\|\s*([^|]+?)(?:\s*\|\s*(confirm))?$/i.exec(arg);
  if(link){
    const idx=Number(link[1]),c=storyCards[idx],kind=link[2].toLowerCase(),key=amKey(link[3]),item=amCardRecord(m,kind,key);
    if(!c||!item||!amCardSourceId(c))return 'Нужны индекс существующей Story Card со стабильным ID и существующая запись памяти. Формат: ;mem cards link 1 | char | Алиса';
    if(String(c.entry||'').startsWith(AM_CARD)||String(c.entry||'').startsWith('[AID_RPG_EXPORT:1]'))return 'Связывать можно ручные карточки. Экспорт RPG служебный; управляемая карточка уже имеет связь.';
    const tag=AM_CARD+kind+':'+key+']';
    if(Object.values(m.cardLinks).some(x=>x.kind===kind&&x.key===key&&x.cardId!==c.id)||Object.values(m.cardAdoptions).some(x=>x.cardId===c.id))return 'Уже есть явная связь или резервная копия этой карточки. Сначала восстанови карточку или сними прежнюю связь.';
    const fingerprint=amCardFingerprint(c),signature=JSON.stringify(item);
    if(!link[4]){m.cardPreview={op:'link',index:idx,fingerprint,signature,tag};return 'СВЯЗЬ #'+idx+' → '+kind+' '+(item.name||item.about)+'. Импорт будет использовать эту запись; исходный текст останется в карточке до adopt. Существующие записи памяти не удаляются. Подтверди: ;mem cards link '+idx+' | '+kind+' | '+link[3]+' | confirm';}
    const p=amObj(m.cardPreview);if(p.op!=='link'||p.index!==idx||p.fingerprint!==fingerprint||p.signature!==signature||p.tag!==tag)return 'Данные изменились или нет предпросмотра. Повтори команду связи без confirm.';
    m.cardLinks[amCardSourceId(c)]={kind,key,cardId:c.id};m.cardPreview=null;
    return 'Карточка #'+idx+' связана с '+kind+' '+(item.name||item.about)+'. Если есть отдельная собственная карточка: ;mem cards remove-own '+kind+' '+key+'. Затем передача: ;mem cards adopt '+idx;
  }
  const unlink=/^unlink\s+(\d+)(?:\s+(confirm))?$/i.exec(arg);
  if(unlink){
    const idx=Number(unlink[1]),c=storyCards[idx],id=amCardSourceId(c),bound=m.cardLinks[id];
    if(!bound)return 'Явная связь не найдена.';
    if(m.cardAdoptions[AM_CARD+bound.kind+':'+bound.key+']'])return 'Сначала восстанови управляемую карточку через cards restore.';
    const fingerprint=amCardFingerprint(c);
    if(!unlink[2]){m.cardPreview={op:'unlink',index:idx,fingerprint};return 'Будет удалена только явная связь. Подтверди: ;mem cards unlink '+idx+' confirm';}
    const p=amObj(m.cardPreview);if(p.op!=='unlink'||p.index!==idx||p.fingerprint!==fingerprint)return 'Повтори unlink без confirm.';
    delete m.cardLinks[id];m.cardPreview=null;return 'Явная связь удалена. Карточка и запись памяти сохранены.';
  }
  return null;
}

function amHelp(subject){
  const raw=amKey(subject||'');
  if(['transfer','перенос','экспорт памяти','копирование памяти'].includes(raw))return amTransferCommand(amInit(),'help');
  if(['cards','card','карточки','карточка','storycards','story cards','story card'].includes(raw))return amCardsCommand(amInit(),'help');
  if(['review','проверка памяти','подтверждение','очередь','наблюдения','accept','reject'].includes(raw))return 'AID Memory v1.8.0 — ПРОВЕРКА АВТОПАМЯТИ\nПосле сцены рассказчик предлагает записи; до подтверждения они не изменяют биографии, отношения и Story Cards.\n;mem review — вся очередь; ;mem review ID — текст и источник.\n;mem accept ID — подтвердить предложение; ;mem accept ID replace — явно заменить вручную введённое поле.\n;mem edit ID | новое значение — исправить предложение, затем ;mem accept ID.\n;mem reject ID — отклонить; ;mem review log — журнал решений.\n;mem sources char Имя — источник текущих полей.\nНепроверенные наблюдения записываются как факты ТОЛЬКО после ;mem accept ID.\nАвтоматический отчёт не перезаписывает ручные данные. Старые записи без происхождения считаются защищёнными.';

  const topic=Object.prototype.hasOwnProperty.call(AM_HELP_ALIASES,raw)?AM_HELP_ALIASES[raw]:raw;
  if(topic==='all')return 'AID Memory v1.8.0 — СПРАВКА\nОБЩИЙ УКАЗАТЕЛЬ\n;mem review / review ID / review log — очередь, источник и решения.\n;mem accept ID [replace], ;mem edit ID | значение, ;mem reject ID — управление предложениями.\n;mem sources char Имя — происхождение подтверждённых полей.\n;mem transfer help — перенос памяти между приключениями.\n'+AM_HELP_PAGES.all;
  if(topic==='index')return 'AID Memory v1.8.0 — РАЗДЕЛЫ СПРАВКИ\n'+
    'Первые шаги: ;mem ping, ;mem status, ;mem help start, ;mem help syntax, ;mem help all\n'+
    'Мир: ;mem help world, ;mem help place, ;mem help faction\n'+
    'Персонажи: ;mem help char, ;mem help skill, ;mem help rel\n'+
    'История: ;mem help fact, ;mem help event, ;mem help day, ;mem help arc, ;mem help plan\n'+
    'Настройка: ;mem help batch, ;mem help auto, ;mem help cards, ;mem help review\n'+
    'Управление: ;mem help edit, ;mem help undo, ;mem help reset, ;mem help debug, ;mem help transfer\n'+
    'По-русски: ;mem help персонажи, ;mem help карта, ;mem help отношения, ;mem help календарь, ;mem help пакет.\n'+
    'Укажи тему после help, чтобы получить синтаксис, примеры и ограничения.';
  if(Object.prototype.hasOwnProperty.call(AM_HELP_PAGES,topic))return 'AID Memory v1.8.0 — СПРАВКА\n'+AM_HELP_PAGES[topic];
  return 'Неизвестный раздел справки «'+amStr(subject,70)+'».\n'+
    'Введи ;mem help для списка тем или ;mem help all для указателя команд.';
}
// Interpret only a command at the beginning of a player action, even when
// AI Dungeon wraps the text as Do, Say, or an instruction to type a command.
// Preserve all § directives and newline boundaries in batch inputs.
