/* ATS live topbar DOM helper — 2026-08-09 */
(function(){
  function applyTopbarLayout(){
    var topbar=document.querySelector('.preview-topbar');
    var title=document.querySelector('.preview-title');
    var actions=document.querySelector('.preview-topbar__actions');
    var lang=document.querySelector('.preview-lang-switch');
    if(!topbar||!title||!actions||!lang) return;

    title.classList.add('preview-title--topbar');

    if(lang.parentElement!==topbar){
      topbar.insertBefore(lang, actions);
    }
    if(title.parentElement!==topbar){
      topbar.insertBefore(title, actions);
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',applyTopbarLayout,{once:true});
  }else{
    applyTopbarLayout();
  }
})();