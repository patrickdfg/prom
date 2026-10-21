// The control and output windows use the same slideshow keys.
window.CaptionPresentationKeys={
 action(event){
  if(event.defaultPrevented||event.isComposing||event.ctrlKey||event.metaKey||event.altKey)return null;
  const target=event.target;
  if(target?.isContentEditable||target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="slider"],[role="separator"]')||document.querySelector('dialog[open]'))return null;
  if(['ArrowRight','ArrowDown','PageDown',' ','Spacebar'].includes(event.key))return event.shiftKey&&[' ','Spacebar'].includes(event.key)?'previous':'next';
  if(['ArrowLeft','ArrowUp','PageUp'].includes(event.key))return 'previous';
  if(event.key==='Home')return 'first';
  if(event.key==='End')return 'last';
  return null;
 }
};
