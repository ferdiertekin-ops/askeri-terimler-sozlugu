(()=>{
'use strict';

if(!('speechSynthesis' in window)&&!('SpeechSynthesisUtterance' in window))return;

const ordinalUnits={
1:'birinci',2:'ikinci',3:'üçüncü',4:'dördüncü',5:'beşinci',6:'altıncı',7:'yedinci',8:'sekizinci',9:'dokuzuncu',10:'onuncu',
11:'on birinci',12:'on ikinci',13:'on üçüncü',14:'on dördüncü',15:'on beşinci',16:'on altıncı',17:'on yedinci',18:'on sekizinci',19:'on dokuzuncu',
20:'yirminci',30:'otuzuncu',40:'kırkıncı',50:'ellinci',60:'altmışıncı',70:'yetmişinci',80:'sekseninci',90:'doksanıncı',100:'yüzüncü'
};
const tensWords={2:'yirmi',3:'otuz',4:'kırk',5:'elli',6:'altmış',7:'yetmiş',8:'seksen',9:'doksan'};

function romanToInt(roman){
 const values={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};
 let total=0,previous=0;
 for(let i=roman.length-1;i>=0;i--){
  const value=values[roman[i]]||0;
  if(value<previous)total-=value;else{total+=value;previous=value;}
 }
 return total;
}

function turkishOrdinal(number){
 if(ordinalUnits[number])return ordinalUnits[number];
 if(number>20&&number<100){
  const tens=Math.floor(number/10),unit=number%10;
  return unit?`${tensWords[tens]} ${ordinalUnits[unit]}`:ordinalUnits[number];
 }
 if(number>100&&number<200){
  const rest=number-100;
  return rest?`yüz ${turkishOrdinal(rest)}`:'yüzüncü';
 }
 return String(number);
}

function prepareTurkishSpeech(text){
 return String(text||'')
  .replace(/\b([IVXLCDM]+)\.(?=$|[\s)\],;:!?])/g,(_,roman)=>turkishOrdinal(romanToInt(roman)))
  .replace(/Â/g,'Aa').replace(/â/g,'aa')
  .replace(/Î/g,'İi').replace(/î/g,'ii')
  .replace(/Û/g,'Uu').replace(/û/g,'uu')
  .replace(/\s+/g,' ')
  .trim();
}

let activeButton=null;
function resetButton(){
 if(activeButton){activeButton.setAttribute('aria-pressed','false');activeButton=null;}
}

function speakTurkish(button){
 const prepared=prepareTurkishSpeech(button.dataset.speak);
 if(!prepared)return;
 window.speechSynthesis.cancel();
 resetButton();
 const utterance=new SpeechSynthesisUtterance(prepared);
 utterance.lang='tr-TR';
 utterance.rate=.86;
 utterance.pitch=1;
 activeButton=button;
 button.setAttribute('aria-pressed','true');
 utterance.onend=utterance.onerror=resetButton;
 window.speechSynthesis.speak(utterance);
}

document.addEventListener('click',event=>{
 const button=event.target.closest('.speak[data-lang="tr-TR"]');
 if(!button)return;
 event.preventDefault();
 event.stopPropagation();
 event.stopImmediatePropagation();
 speakTurkish(button);
},true);

window.addEventListener('beforeunload',()=>window.speechSynthesis.cancel());
})();
