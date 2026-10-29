import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const tabs = await fetch(`${process.env.REVIEW_CDP || 'http://127.0.0.1:9224'}/json`).then(r => r.json())
const page = tabs.find(tab => tab.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }))
let id = 0
const pending = new Map()
const failures = []
ws.addEventListener('message', event => {
  const data = JSON.parse(event.data)
  if (data.id) { pending.get(data.id)?.(data); pending.delete(data.id) }
  if (data.method === 'Runtime.exceptionThrown') failures.push(data.params.exceptionDetails.text + ': ' + data.params.exceptionDetails.exception?.description)
  if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') failures.push(data.params.args.map(a => a.value ?? a.description).join(' '))
})
const send = (method, params = {}) => new Promise(resolve => { const key = ++id; pending.set(key, resolve); ws.send(JSON.stringify({ id: key, method, params })) })
const evaluate = async expression => {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (response.result.exceptionDetails) throw new Error(response.result.exceptionDetails.exception?.description)
  return response.result.result.value
}

const assert=(ok,message)=>{if(!ok)throw new Error(message)}
const wait=ms=>new Promise(r=>setTimeout(r,ms))
const attach=async(selector,path)=>{
 const root=(await send('DOM.getDocument')).result.root.nodeId
 const node=(await send('DOM.querySelector',{nodeId:root,selector})).result.nodeId
 assert(node,`Missing input ${selector}`)
 await send('DOM.setFileInputFiles',{nodeId:node,files:[path]})
}
await send('Runtime.enable')
await send('Page.bringToFront')
await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false})
await send('Page.navigate',{url:process.env.REVIEW_URL || 'http://127.0.0.1:4174/dev/activity-review'})
await wait(1500)
assert(await evaluate(`document.querySelector('h1')?.textContent==='Activity analysis & review'`),'Review route missing')
await attach('input[aria-label="Choose local audio"]',join(tmpdir(),'atlas-review-fixture.wav'))
for(let i=0;i<100;i++) {await wait(100);if(await evaluate(`!!document.querySelector('[aria-label="Review transport"]')`))break}
assert(await evaluate(`!!document.querySelector('[aria-label="Review transport"]')`),'Analysis did not finish')
assert(await evaluate(`document.querySelectorAll('canvas').length===1 && ![...document.querySelectorAll('button')].find(b=>b.textContent==='Play source').disabled`),'Analysis canvas or matching source missing')
await evaluate(`(()=>{window.__reportBlob=null;HTMLAnchorElement.prototype.click=function(){window.__exportName=this.download};const original=URL.createObjectURL;URL.createObjectURL=function(blob){window.__reportBlob=blob;return original.call(this,blob)}})()`)
await evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>b.textContent==='Export analysis + review JSON').click()})()`)
const initial=await evaluate(`window.__reportBlob.text().then(JSON.parse)`)
assert(initial.onsets.length>=4,'Known attacks not detected')
assert(initial.measurements.rmsDb.some(value=>value>-30),'Raw dynamics missing')
await evaluate(`(()=>{const s=document.querySelector('select[aria-label="Candidate in visible region"]');s.value=s.options[1].value;s.dispatchEvent(new Event('change',{bubbles:true}));})()`)
await wait(200)
await evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>b.textContent==='Reject').click();})()`)
await wait(200)
await evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>b.textContent==='Add onset at playhead').click();})()`)
await wait(200)
await evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>b.textContent==='Export analysis + review JSON').click()})()`)
const edited=await evaluate(`window.__reportBlob.text().then(JSON.parse)`)
assert(edited.onsets.some(o=>o.status==='rejected') && edited.onsets.some(o=>o.status==='manual'),'Review edits not exported')
await evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>b.textContent==='Play source').scrollIntoView({block:'center'});})()`)
await wait(100)
const point=await evaluate(`(()=>{const r=[...document.querySelectorAll('button')].find(b=>b.textContent==='Play source').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point})
await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point})
let advanced=false
for(let i=0;i<40;i++){await wait(200);advanced=await evaluate(`Number(document.querySelector('input[aria-label="Seek source"]').value)>.6`);if(advanced)break}
assert(advanced,'Shared-clock playback did not advance: '+JSON.stringify(await evaluate(`({visible:document.visibilityState,body:document.querySelector('[aria-label="Review transport"]').innerText,alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent)})`)))
await evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>b.textContent==='Pause')?.click()})()`)
await attach('input[aria-label="Import review JSON"]',join(tmpdir(),'atlas-review-fixture.json'))
await wait(300)
assert(await evaluate(`![...document.querySelectorAll('button')].find(b=>b.textContent==='Play source').disabled`),'Matching imported report did not enable playback')
await evaluate(`(()=>{const e=document.querySelector('input[aria-label="Onset threshold (higher = fewer)"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,4);e.dispatchEvent(new Event('input',{bubbles:true}));})()`)
for(let i=0;i<50;i++){await wait(100);if(await evaluate(`document.querySelector('[role=status]')?.textContent==='Detection updated. Candidates need review.'`))break}
assert(await evaluate(`document.querySelector('[role=status]')?.textContent==='Detection updated. Candidates need review.'`),'Worker re-detection failed')
await evaluate(`window.scrollTo(0,0)`);await wait(100)
const screenshot=(await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).result.data
await fs.writeFile(join(tmpdir(),'activity-review-desktop.png'),Buffer.from(screenshot,'base64'))
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
await wait(300)
assert(await evaluate(`document.documentElement.scrollWidth<=390`),'Mobile overflow')
const mobile=(await send('Page.captureScreenshot',{format:'png'})).result.data
await fs.writeFile(join(tmpdir(),'activity-review-mobile.png'),Buffer.from(mobile,'base64'))
assert(!failures.length,JSON.stringify(failures))
console.log('Passed review route, worker audio analysis, plots, candidate edits/export, shared-clock playback, report import/hash matching and mobile layout.')
ws.close()
