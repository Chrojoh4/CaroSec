import {feeKind,feeKinds} from '../src/domain/fee-defaults.js';
const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
export function feeFields(row,fee={label:'Regular',kind:'regular',cents:null,unit:'per dog / event'}){
 const kind=feeKind(fee);row.dataset.feeKind=kind;
 const amountLabel=el('label',feeKinds[kind]+' price (CAD)'),amount=el('input');amount.name='amount';amount.type='number';amount.min='0';amount.step='.01';amount.required=true;amount.value=fee.cents==null?'':(fee.cents/100).toFixed(2);amountLabel.append(amount);row.append(amountLabel);
 const feoLabel=el('label','Offer FEO for this trial'),offered=el('input');offered.type='checkbox';offered.name='feo-offered';offered.checked=fee.offered===true;feoLabel.prepend(offered);feoLabel.className='stream-choice';feoLabel.hidden=kind!=='feo';row.append(feoLabel);
 const details=el('details');details.append(el('summary','Fee description and charging unit'));
 for(const [name,text,value] of [['label','Fee description',fee.label||''],['unit','Charging unit',fee.unit||'per dog / event']]){const label=el('label',text),input=el('input');input.name=name;input.value=value;input.required=true;label.append(input);details.append(label);}
 const kindLabel=el('label','Use this price as'),select=el('select');select.name='fee-kind';for(const [value,text] of Object.entries(feeKinds)){const option=el('option',text);option.value=value;select.append(option);}select.value=kind;kindLabel.append(select);details.append(kindLabel);row.append(details);
 select.addEventListener('change',()=>{row.dataset.feeKind=select.value;feoLabel.hidden=select.value!=='feo';});
}
export function readFeeFields(row){const kind=row.querySelector('[name=fee-kind]').value;return {label:row.querySelector('[name=label]').value.trim(),unit:row.querySelector('[name=unit]').value.trim(),cents:Math.round(Number(row.querySelector('[name=amount]').value)*100),kind,...(kind==='feo'?{offered:row.querySelector('[name=feo-offered]').checked}:{})};}
