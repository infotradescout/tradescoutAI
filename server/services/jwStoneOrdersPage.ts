import { JW_STONE_ORDERS_PATH } from "@shared/jwStoneCheckout";

export function renderJwStoneOrdersPage(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>JW Stone — Offers and Orders</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f6f3ed;color:#202b2e;font:16px/1.55 system-ui,sans-serif;overflow-wrap:anywhere}main{max-width:1120px;margin:auto;padding:24px}a{color:inherit}h1{font-size:clamp(24px,4vw,36px);margin:12px 0}h2{font-size:22px}h3{font-size:18px}.layout{display:grid;grid-template-columns:270px minmax(0,1fr);gap:24px}section,aside{min-width:0}article,.card{padding:20px;background:white;border:1px solid #d4d0c5;margin:12px 0}button,input,textarea,select{font:inherit;max-width:100%}button{min-height:44px;padding:9px 14px;border:1px solid #52666a;background:white;color:#202b2e;cursor:pointer}button.primary{background:#20393d;color:white}button:disabled{cursor:not-allowed;opacity:.55}label{display:block;margin:12px 0}input:not([type=checkbox]),select,textarea{width:100%;min-height:44px;padding:9px;border:1px solid #b6b8b4}input[type=checkbox]{width:20px;height:20px;vertical-align:middle;margin-right:8px}ul{padding-left:22px}.muted{font-size:14px;color:#596463}.notice{padding:14px;background:#fff7df;border:1px solid #c9ae64}.actions{display:flex;gap:10px;flex-wrap:wrap}.total{font-size:24px;font-weight:700}.error{padding:14px;background:#ffeded;color:#7a2020;overflow-wrap:anywhere}#list button{display:block;text-align:left;width:100%;margin:8px 0;overflow-wrap:anywhere}code{overflow-wrap:anywhere}hr{border:0;border-top:1px solid #ddd;margin:18px 0}@media(max-width:700px){main{padding:16px}.layout{grid-template-columns:1fr}#list{max-height:240px;overflow:auto}}
  </style></head><body><main><a href="/u/jw-stone">← JW Stone · Bundle Builder and collection</a><h1>Offers and orders</h1><p>Review offers, counteroffers and final quotes here. Confirming a quote is separate from making a payment.</p><p id="error" role="alert" hidden></p><div class="layout"><aside aria-label="Your JW Stone requests"><h2>Your requests</h2><button id="refresh-list" type="button">Refresh requests</button><div id="list" aria-live="polite">Loading your orders and offers…</div></aside><section id="detail" aria-label="Selected offer and order"><p>Select an order or offer to continue.</p></section></div></main><script src="${JW_STONE_ORDERS_PATH}/workspace.js" defer></script></body></html>`;
}

/** All API values enter textContent/value, never HTML. Bank/card details stay on hosted Checkout. */
export const jwStoneOrdersBrowserScript = String.raw`
'use strict';
(() => {
  const base='/api/u/jw-stone/orders',list=document.getElementById('list'),detail=document.getElementById('detail'),error=document.getElementById('error');
  let current=null,busy=false,pending=null;
  const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
  const showError=message=>{error.hidden=!message;error.className=message?'error':'';error.textContent=message||'';};
  function el(tag,text,parent,classes){const node=document.createElement(tag);if(text!=null)node.textContent=text;if(classes)node.className=classes;if(parent)parent.append(node);return node;}
  function button(text,parent,action,primary=false){const node=el('button',text,parent,primary?'primary':'');node.type='button';node.disabled=busy;node.addEventListener('click',action);return node;}
  async function api(path,data){const response=await fetch(base+path,{method:data?'POST':'GET',credentials:'same-origin',headers:{Accept:'application/json',...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});let value;try{value=await response.json();}catch{throw Error('The order service did not return a valid response. Your cart has not been changed.');}if(!response.ok)throw Error(value.message||'The order could not be updated. Refresh its status before trying again.');return value;}
  async function refreshList(){try{const records=await api('');list.replaceChildren();if(!records.length)el('p','No purchase requests or offers yet. Buy at listed prices or Make an Offer from your stone cart.',list);for(const row of records)button(row.title+' · '+row.status.replaceAll('_',' '),list,()=>load(row.requestId));}catch(e){showError(e.message);}}
  async function load(id){if(busy)return;try{current=await api('/'+encodeURIComponent(id));pending=null;const u=new URL(location.href);u.searchParams.set('request',id);history.replaceState(null,'',u);paint();showError('');}catch(e){showError(e.message);}}
  function amount(label,value,parent,readOnly=false){const wrapper=el('label',label,parent),input=document.createElement('input');input.type='number';input.step='.01';input.min='0';input.required=true;input.value=value==null?'':(value/100).toFixed(2);input.readOnly=readOnly;wrapper.append(input);return input;}
  function cents(input){if(!/^\d+(?:\.\d{1,2})?$/.test(input.value.trim()))throw Error('Enter every amount in dollars with at most two decimal places, including 0 where applicable.');const n=Math.round(Number(input.value)*100);if(!Number.isSafeInteger(n))throw Error('Invalid amount.');return n;}
  async function command(payload){
    if(busy||!current)return;const body={...payload,expectedRevision:current.state.revision};
    if(pending&&JSON.stringify(pending.body)!==JSON.stringify(body)){showError('Refresh order status before changing a command whose result is uncertain.');return;}
    pending=pending||{body,operationId:crypto.randomUUID()};busy=true;detail.querySelectorAll('button').forEach(b=>b.disabled=true);showError('');
    try{current=await api('/'+encodeURIComponent(current.requestId)+'/commands',{...body,operationId:pending.operationId});pending=null;paint();await refreshList();}
    catch(e){showError(e.message+' Use Refresh order/payment status to recover an uncertain result.');}
    finally{busy=false;detail.querySelectorAll('button').forEach(b=>b.disabled=false);}
  }
  async function refreshCurrent(){if(busy||!current)return;busy=true;try{await api('/'+encodeURIComponent(current.requestId)+'/reconcile',{});current=await api('/'+encodeURIComponent(current.requestId));pending=null;showError('');paint();await refreshList();}catch(e){showError(e.message);}finally{busy=false;detail.querySelectorAll('button').forEach(b=>b.disabled=false);}}
  function paint(){
    detail.replaceChildren();if(!current)return;
    const {state,intake}=current,purchase=intake.intent==='purchase',box=el('article',null,detail);
    el('h2',purchase?(current.role==='seller'?'Review purchase request':'Your purchase request'):(current.role==='seller'?'Review customer offer':'Your stone offer'),box);
    el('p','Order / request '+current.requestId,box,'muted');el('h3',state.status.replaceAll('_',' '),box);
    if(current.testMode)el('p','TEST MODE — this is not a live payment.',box,'notice');
    el('p',purchase?'Purchase at checked material prices · '+intake.lines.reduce((n,l)=>n+l.quantity,0)+' slabs':intake.scope==='cart'?'Whole-cart offer · '+intake.lines.reduce((n,l)=>n+l.quantity,0)+' slabs':'Individual-stone offer',box);
    if(intake.bundleApplied)el('p','The listed cart used each eligible stone’s own bundle rate.',box,'muted');
    const selections=el('ul',null,box);for(const line of intake.lines)el('li',line.quantity+' × '+line.materialName+' · '+line.dimensions.length+' × '+line.dimensions.height+' '+line.dimensions.unit+' · listed '+money(line.lineTotalCents),selections);
    el('p',purchase?'Checked material total: '+money(intake.listedSubtotalCents)+' · No negotiated offer was submitted.':'Original listed materials: '+money(intake.listedSubtotalCents)+' · Customer offered: '+money(intake.offeredTotalCents),box);
    if(purchase&&intake.pricingSource==='owned_reservation')el('p','Material prices were taken from your owned reservation '+intake.reservationId+'. Its original deadline is not extended by requesting a final total.',box,'muted');
    el('p',intake.fulfillment.method==='delivery'?'Delivery requested to '+intake.fulfillment.postalCode:'Pickup requested',box);
    if(state.reservationTransfer){const transfer=state.reservationTransfer;el('p','Your reserved slabs moved directly into this order without being made available to other buyers. Reservation '+transfer.reservationId+' · original deadline '+new Date(transfer.originalExpiresAt).toLocaleString()+'.',box,'notice');}
    if(state.note)el('p',state.note,box,'notice');
    if(state.quote){const q=state.quote;el('hr',null,box);el('h3','Final quote · revision '+q.revision,box);el('p','Materials '+money(q.materialCents)+' · Tax '+money(q.taxCents)+' · Delivery '+money(q.deliveryCents),box);el('p','Total '+money(q.totalCents),box,'total');el('p','Valid until '+new Date(q.expiresAt).toLocaleString(),box,'muted');if(q.notes)el('p',q.notes,box);}
    const confirmed=Boolean(state.quote&&state.quoteAcceptance&&state.quoteAcceptance.quoteId===state.quote.id&&state.quoteAcceptance.quoteRevision===state.quote.revision&&state.quoteAcceptance.totalCents===state.quote.totalCents);
    if(confirmed){const notice=el('p','Quote confirmed by buyer on '+new Date(state.quoteAcceptance.acceptedAt).toLocaleString()+'. Confirmation alone is not payment or a stock reservation.',box,'notice');notice.setAttribute('data-testid','jw-quote-confirmed');}
    el('p',current.paymentNotice,box,'notice');
    if(state.status==='paid')el('p','Payment confirmed. JW Stone is holding this order’s stock pending fulfillment. This page does not claim pickup or delivery has occurred.',box,'notice');
    const actions=el('div',null,box,'actions');button('Refresh order/payment status',actions,refreshCurrent);
    if(state.attempt?.url&&state.status==='checkout'&&state.attempt.outcome==='open'&&current.role==='buyer'){const u=new URL(state.attempt.url);if(u.protocol==='https:'&&u.hostname==='checkout.stripe.com'){const a=el('a','Continue secure checkout',actions);a.href=u.href;a.rel='noreferrer';}}
    const canQuote=['pending_review','quoted','declined','payment_failed','payment_expired'].includes(state.status);
    if(current.role==='seller'&&canQuote){
      const form=el('form',null,box);el('h3',purchase?'Confirm purchase total':'Confirm terms or counteroffer',form);
      const decisionLabel=el('label','Decision',form),decision=el('select',null,decisionLabel);decision.id='jw-sale-decision';decisionLabel.htmlFor=decision.id;decision.setAttribute('aria-label','Decision');
      const choices=purchase?[['confirm_purchase','Confirm purchase at checked material prices']]:[['accept_offer','Accept the customer’s material offer'],['counter_offer','Counteroffer with a different material amount']];
      for(const[value,text]of choices){const o=el('option',text,decision);o.value=value;}
      const material=amount('Material amount ($)',purchase?intake.listedSubtotalCents:intake.offeredTotalCents,form,true),tax=amount('Confirmed tax ($) — enter 0 if applicable',null,form),delivery=amount('Confirmed delivery ($)',intake.fulfillment.method==='pickup'?0:null,form,intake.fulfillment.method==='pickup');
      decision.onchange=()=>{material.readOnly=decision.value!=='counter_offer';if(material.readOnly)material.value=((purchase?intake.listedSubtotalCents:intake.offeredTotalCents)/100).toFixed(2);};
      const expiryLabel=el('label','Quote expires',form),expiry=el('input',null,expiryLabel);expiry.type='datetime-local';expiry.required=true;
      const noteLabel=el('label','Quote notes or decline reason',form),notes=el('textarea',null,noteLabel);notes.maxLength=2000;
      button('Send final quote',form,()=>{if(!form.reportValidity())return;try{command({action:'quote',decision:decision.value,materialCents:cents(material),taxCents:cents(tax),deliveryCents:cents(delivery),expiresAt:new Date(expiry.value).toISOString(),notes:notes.value});}catch(e){showError(e.message);}},true);
      button(purchase?'Decline purchase request':'Decline offer',form,()=>{if(!notes.value.trim()){showError('Enter a decline reason.');return;}command({action:'decline',notes:notes.value});});form.addEventListener('submit',event=>event.preventDefault());
      el('p','Quote changes and declines create a buyer notification. Revised terms require a new confirmation.',form,'muted');
    }
    if(current.role==='buyer'&&state.quote&&['quoted','payment_failed','payment_expired'].includes(state.status)){
      const expired=Date.parse(state.quote.expiresAt)<=Date.now();if(expired){el('p','This quote expired. JW Stone needs to issue current terms before payment.',box,'notice');return;}
      const label=el('label',null,box),accept=el('input',null,label);accept.type='checkbox';label.append(document.createTextNode('I accept this exact final quote and total of '+money(state.quote.totalCents)+'.'));
      if(!confirmed){
        button('Confirm quote without payment',box,()=>{if(!accept.checked){showError('Review and accept the final quote before continuing.');return;}command({action:'accept_quote',quoteId:state.quote.id,totalCents:state.quote.totalCents,acceptFinalQuote:true});},true);
        el('p','This saves your agreement and notifies JW Stone. It does not debit a bank account, charge a card, or reserve slabs.',box,'muted');
      }
      if(current.methods.length){
        const pay=el('div',null,box,'actions');for(const method of current.methods)button(method==='ach'?'Pay by ACH bank debit':'Pay by card',pay,()=>{if(!accept.checked){showError('Review and accept the final quote before continuing.');return;}command({action:'checkout',quoteId:state.quote.id,totalCents:state.quote.totalCents,method,acceptFinalQuote:true});},true);
      }
    }
  }
  document.getElementById('refresh-list').addEventListener('click',refreshList);
  refreshList();const selected=new URL(location.href).searchParams.get('request');if(selected)load(selected);
})();
`;