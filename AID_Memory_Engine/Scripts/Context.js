/* AID Memory Engine v1.7.4 — Context */
const modifier=(text)=>{
  try{if(typeof AM_ENGINE_BUILD==='undefined'||AM_ENGINE_BUILD!=='1.7.4')throw Error('Несовместимые вкладки Memory Engine: установи все четыре JS-файла v1.7.4 вместе.');return amInject(text,amInit());}
  catch(err){
    if(typeof console!=='undefined'&&console.log)console.log('AID Memory Context: '+String(err&&err.message||err));
    return {text};
  }
};
modifier(text);
