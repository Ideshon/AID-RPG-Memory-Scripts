/* AID Memory Engine v1.7.4 — Output */
const modifier=(text)=>{
  try{if(typeof AM_ENGINE_BUILD==='undefined'||AM_ENGINE_BUILD!=='1.7.4')throw Error('Несовместимые вкладки Memory Engine: установи все четыре JS-файла v1.7.4 вместе.');return amOutput(text,amInit());}
  catch(err){
    const detail=String(err&&err.message||err).slice(0,300);
    if(typeof console!=='undefined'&&console.log)console.log('AID Memory Output: '+detail);
    if(state&&state.aidm&&state.aidm.pendingUI!==null){const pending=state.aidm.pendingUI;state.aidm.pendingUI=null;return {text:'[AID Memory Output: ошибка отображения] '+detail+'\n'+pending};}
    return {text:String(text||'').trim()+'\n[AID Memory: ошибка Output: '+detail+']'};
  }
};
modifier(text);
