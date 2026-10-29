// Optional GPU regression: run Vite on port 4174 first. Reuses an automation
// browser when available and closes its own page/browser in finally. Set
// CHROME_BIN when Chrome is not installed at the default macOS path.
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const wait=ms=>new Promise(r=>setTimeout(r,ms))
let child, directory, browser, page, targetId
function connect(url){return new Promise((resolve,reject)=>{const socket=new WebSocket(url),pending=new Map();let id=0;socket.addEventListener('open',()=>resolve({socket,send:(method,params={})=>new Promise(done=>{const key=++id;pending.set(key,done);socket.send(JSON.stringify({id:key,method,params}))})}),{once:true});socket.addEventListener('error',reject,{once:true});socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id)}})})}
try {
 let version=await fetch('http://127.0.0.1:9224/json/version').then(r=>r.json()).catch(()=>null)
 if(!version){
  directory=await mkdtemp(join(tmpdir(),'orchestra-layering-'))
  child=spawn(process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--hide-scrollbars','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9224','--user-data-dir='+directory,'about:blank'],{stdio:'ignore'})
  for(let i=0;i<50&&!version;i++){await wait(100);version=await fetch('http://127.0.0.1:9224/json/version').then(r=>r.json()).catch(()=>null)}
 }
 if(!version)throw Error('Automation browser unavailable')
 browser=await connect(version.webSocketDebuggerUrl)
 const created=await browser.send('Target.createTarget',{url:'http://127.0.0.1:4174/'})
 targetId=created.result.targetId
 let info
 for(let i=0;i<30&&!info;i++){await wait(100);info=(await fetch('http://127.0.0.1:9224/json').then(r=>r.json())).find(t=>t.id===targetId)}
 page=await connect(info.webSocketDebuggerUrl)
 const evaluate=async expression=>{const r=await page.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.result.exceptionDetails)throw Error(r.result.exceptionDetails.exception?.description);return r.result.result.value}
 await page.send('Page.enable');await page.send('Page.bringToFront')
 await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
 await wait(2000)
 const result=await evaluate(`(async()=>{
 const THREE=await import('/node_modules/.vite/app/deps/three.js');
 const {EffectComposer}=await import('/node_modules/three/examples/jsm/postprocessing/EffectComposer.js');
 const {RenderPass}=await import('/node_modules/three/examples/jsm/postprocessing/RenderPass.js');
 const {CachedBloomPass}=await import('/src/features/orchestra-map/three/cached-bloom.ts');
 const {LayerRenderPass}=await import('/src/features/orchestra-map/three/layer-render-pass.ts');
 const {configureOrbBloom,configureOrbBloomSource}=await import('/src/features/liquid-orb/bloom.ts');
 const {createLiquidNodes}=await import('/src/features/orchestra-map/three/liquid-node-material.ts');
 const {orchestraSceneConfig}=await import('/src/features/orchestra-map/config.ts');
 const renderer=new THREE.WebGLRenderer({alpha:true});renderer.setSize(512,384);renderer.setClearColor(0,0);renderer.info.autoReset=false;
 const sourceTarget=new THREE.WebGLRenderTarget(512,384,{type:THREE.HalfFloatType});const composer=new EffectComposer(renderer,new THREE.WebGLRenderTarget(512,384));composer.renderToScreen=false;const camera=new THREE.OrthographicCamera(-2,2,1.5,-1.5,.1,20);camera.position.z=5;camera.lookAt(0,0,0);
 const geometry=new THREE.PlaneGeometry(2,2);
 geometry.setAttribute('nodePalette',new THREE.InstancedBufferAttribute(new Float32Array([1,0,0,0,0,1]),3));
 geometry.setAttribute('nodeFocus',new THREE.InstancedBufferAttribute(new Float32Array([1,.03]),1));
 geometry.setAttribute('nodeIdle',new THREE.InstancedBufferAttribute(new Float32Array([1,1]),1));
 const source=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial(),2);
 source.setMatrixAt(0,new THREE.Matrix4());source.setMatrixAt(1,new THREE.Matrix4().setPosition(.7,0,.5));source.instanceMatrix.needsUpdate=true;
 const nodes=[{id:'selected',instrument:'violin',sectionId:'strings',position:[0,0,0],radius:1},{id:'inactive',instrument:'cello',sectionId:'strings',position:[.7,0,.5],radius:1}];
 const orbs=createLiquidNodes(source,nodes,orchestraSceneConfig.visuals.interaction);
 const main=new THREE.Scene(),bloom=new THREE.Scene(),discs=new THREE.Scene();
 main.add(orbs.mesh,orbs.foreground.mesh);bloom.add(orbs.bloomMesh,orbs.foreground.bloomMesh);discs.add(orbs.discMesh,orbs.foreground.discMesh);
 const before=new LayerRenderPass(discs,camera,1<<1),after=new LayerRenderPass(discs,camera,(1<<1)|(1<<2));
 const blur=new CachedBloomPass(new THREE.Vector2(512,384),.1,.2,.8);configureOrbBloom(blur);configureOrbBloomSource(blur,sourceTarget.texture);
 composer.addPass(new RenderPass(main,camera));composer.addPass(before);composer.addPass(blur);composer.addPass(after);
 const state={emphasis:0,opacity:1,activity:0},empty=new Map(),pixel=new Uint8Array(4);
 const sample=x=>{renderer.readRenderTargetPixels(composer.readBuffer,Math.round((x+2)/4*512),192,1,1,pixel);return [...pixel]};
 const draw=(oldOcclusion=false)=>{
  const priority=orbs.foreground.mesh.visible&&!oldOcclusion;
  orbs.bloomMesh.material.uniforms.orbPriorityBloom.value=Number(priority);
  orbs.foreground.bloomMesh.material.uniforms.orbPriorityBloom.value=Number(priority);
  before.enabled=priority;after.layerMask=priority?1<<2:(1<<1)|(1<<2);
  renderer.info.reset();renderer.setRenderTarget(sourceTarget);renderer.autoClear=true;renderer.render(bloom,camera);
  blur.dirty=true;composer.render(0);return renderer.info.render.calls;
 };
 try {
 orbs.update(0,state,false,empty);const idleDraws=draw(),idle=sample(.35);
 if(idle[2]<=idle[0])throw Error('Fixture should initially show the inactive blue node: '+idle);
 orbs.update(0,state,false,empty,{level:'instrument',familyId:'strings',instrumentId:'violin'});
 const oldDraws=draw(true),oldHalo=sample(1.08);
 const selectedDraws=draw(),selected=sample(.35),halo=sample(1.08);
 if(selected[0]<200||selected[2]>5)throw Error('Selected red node is behind the closer inactive node: '+selected);
 if(halo[0]<=oldHalo[0]+3)throw Error('Blurred halo is still occluded outside the selected disc: '+JSON.stringify({oldHalo,halo}));
 if(selectedDraws!==oldDraws)throw Error('Layered bloom unexpectedly added draws');
 const music=new Map([['violin',{active:true,intensity:.8,attack:.5}]]);
 orbs.update(1,state,false,music,{level:'instrument',familyId:'strings',instrumentId:'violin'});draw();const rim=sample(1.06);
 if(rim.slice(0,3).some(v=>v<120))throw Error('Inactive disc occludes the selected white rim: '+rim);
 orbs.reset();orbs.update(0,state,false,empty,{level:'family',familyId:'strings'},false,'violin');draw();const wave=sample(.35);
 if(wave[0]<100||wave[2]>5)throw Error('Waving red node is occluded: '+wave);
 orbs.update(0,state,false,empty);const restoredDraws=draw(),restored=sample(.35);
 if(restored[2]<=restored[0]||restoredDraws!==idleDraws)throw Error('Foreground priority/draw count did not reset');
 return {idle,selected,oldHalo,halo,rim,wave,idleDraws,oldDraws,selectedDraws,restoredDraws};
 }finally{
 for(const batch of [orbs.mesh,orbs.bloomMesh,orbs.discMesh,...Object.values(orbs.foreground)]){batch.material.dispose();batch.dispose()}
 orbs.discMesh.geometry.dispose();orbs.mesh.geometry.dispose();source.geometry.dispose();source.material.dispose();source.dispose();sourceTarget.dispose();before.dispose();after.dispose();blur.dispose();composer.dispose();renderer.dispose();
 }
 })()`)
 console.log('GPU foreground halo, overlap and rim tests passed:',JSON.stringify(result))
}finally{
 if(browser&&targetId)await browser.send('Target.closeTarget',{targetId}).catch(()=>{})
 page?.socket.close()
 if(browser&&child){browser.socket.send(JSON.stringify({id:99999,method:'Browser.close'}));await wait(400)}
 browser?.socket.close()
 if(child&&child.exitCode===null){child.kill('SIGTERM');await wait(300)}
 if(directory)await rm(directory,{recursive:true,force:true}).catch(()=>{})
}
