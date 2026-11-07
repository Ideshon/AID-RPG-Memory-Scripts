/* AID Memory Engine v1.8.0 — Context */
function amInject(text,m){
  if(m.pendingUI)return {text};
  if(m.skipAutoTurn){amDebugContext(m,false,'',text,text,'внешняя техническая команда',0);return {text};}
  const txt=String(text||'');const last=amStr(m.lastInput,550);
  const recent=amArr(history).slice(-5).map(h=>amStr(h&&h.text,260)).join(' ');
  const payload=amContext(m,last+' '+recent)+(m.config.auto?amProtocol(m.config.calendar):'');
  const requested='\n'+payload+'\n';
  const max=typeof info!=='undefined'&&info&&Number.isFinite(info.maxChars)?info.maxChars:0;
  if(!max||txt.length+requested.length<=max){
    const result=requested+txt;amDebugContext(m,true,requested,txt,result,'',0);return {text:result};
  }
  // Retire oldest part of HISTORY, while preserving plot essentials and latest action.
  const marker='Recent Story:',pos=txt.indexOf(marker);
  if(pos>=0){const start=pos+marker.length;const need=txt.length+requested.length-max+20;
    const safe=Math.max(0,txt.length-start-1600);
    if(safe>=need){const end=txt.indexOf('\n',start+need);
      const cut=(end>0&&end-start<safe)?end:start+need;
      const result=requested+txt.slice(0,start)+'\n[ранняя история сокращена]\n'+txt.slice(cut);
      amDebugContext(m,true,requested,txt,result,'удалена ранняя история',Math.max(0,cut-start));
      return {text:result};
    }
  }
  // Never discard last player action or Plot Essentials to inject notes.
  amDebugContext(m,false,'',txt,txt,'недостаточно места в контексте',0);
  return {text:txt};
}
const modifier=(text)=>{
  try{if(typeof AM_ENGINE_BUILD==='undefined'||AM_ENGINE_BUILD!=='1.8.0')throw Error('Несовместимые вкладки Memory Engine: установи все четыре JS-файла v1.8.0 вместе.');return amInject(text,amInit());}
  catch(err){
    if(typeof console!=='undefined'&&console.log)console.log('AID Memory Context: '+String(err&&err.message||err));
    return {text};
  }
};
modifier(text);
