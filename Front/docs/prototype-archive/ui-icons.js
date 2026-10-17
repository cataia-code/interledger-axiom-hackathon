'use strict';
// Lokora pictograms: rounded navy outlines and burgundy accents, from the supplied brand board.
var lokoraIconPaths={
 shop:'<path d="M5 14v14h22V14M12 28v-9h8v9"/><path class="icon-accent" d="M3 12l3-8h20l3 8c0 5-6 5-7 1-1 4-6 4-6 0-1 4-6 4-7 0-1 4-6 4-6-1z"/>',
 wallet:'<rect x="3" y="6" width="25" height="21" rx="4"/><path d="M3 12h25M7 19h6M7 22h4"/><circle class="icon-paper" cx="24" cy="23" r="7"/><g class="icon-accent-line"><circle cx="24" cy="23" r="7"/><ellipse cx="24" cy="23" rx="3" ry="7"/><path d="M17 23h14"/></g>',
 people:'<circle class="icon-accent" cx="16" cy="8" r="4"/><path class="icon-accent" d="M9 28v-6c0-10 14-10 14 0v6z"/><circle class="icon-solid" cx="5" cy="12" r="3"/><circle class="icon-solid" cx="27" cy="12" r="3"/><path class="icon-solid" d="M2 26v-6c0-4 5-5 7-2M30 26v-6c0-4-5-5-7-2"/>',
 growth:'<path class="icon-solid" d="M4 28v-7h5v7zM13 28V16h5v12zM22 28V9h5v19z"/><path class="icon-accent-line" d="M3 16C12 13 19 9 27 3M20 3h8v8"/>',
 pin:'<path d="M8 25c-12 7 28 7 16 0"/><path class="icon-accent" d="M16 27S5 16 5 11a11 11 0 0122 0c0 5-11 16-11 16z"/><circle class="icon-paper" cx="16" cy="11" r="4"/>',
 globe:'<circle cx="16" cy="16" r="12"/><ellipse cx="16" cy="16" rx="6" ry="12" transform="rotate(35 16 16)"/><path d="M5 11c8 7 15 10 23 8M8 26L25 6M5 19c6-9 13-12 22-9"/><g class="icon-accent"><circle cx="16" cy="3" r="2.5"/><circle cx="28" cy="12" r="2.5"/><circle cx="9" cy="27" r="2.5"/></g>',
 search:'<circle cx="13" cy="13" r="9"/><path class="icon-accent-line" d="M20 20l9 9"/>',
 ticket:'<path d="M3 7h26v6a4 4 0 000 8v6H3v-6a4 4 0 000-8z"/><path class="icon-accent-line" stroke-dasharray="2 4" d="M21 8v18"/><path class="icon-accent-line" d="M9 21l7-9"/><circle class="icon-accent" cx="9" cy="12" r="1"/><circle class="icon-accent" cx="16" cy="21" r="1"/>',
 user:'<circle cx="16" cy="10" r="6"/><path class="icon-accent-line" d="M5 28v-3c0-12 22-12 22 0v3z"/>',
 heart:'<path d="M16 27L5 17C-5 7 8-2 16 8 24-2 37 7 27 17z"/>',
 arrowLeft:'<path d="M27 16H5M14 6L4 16l10 10"/>',
 arrowRight:'<path d="M5 16h22M18 6l10 10-10 10"/>',
 chevron:'<path d="M12 7l9 9-9 9"/>',
 down:'<path d="M7 12l9 9 9-9"/>',
 locate:'<path d="M28 4L18 28l-3-11-11-3z"/><path class="icon-accent-line" d="M15 17l8-8"/>',
 shield:'<path d="M16 3L5 7v9c0 7 11 13 11 13s11-6 11-13V7z"/><path class="icon-accent-line" d="M10 16l4 4 8-9"/>',
 bank:'<path d="M3 11l13-8 13 8zM3 28h26M6 14v10M13 14v10M20 14v10M27 14v10"/><path class="icon-accent-line" d="M8 28h16"/>',
 info:'<circle cx="16" cy="16" r="13"/><path class="icon-accent-line" d="M16 15v8M16 9v1"/>',
 qr:'<path d="M3 3h10v10H3zM19 3h10v10H19zM3 19h10v10H3z"/><path class="icon-accent-line" d="M19 19h4v4h6v6h-7M19 28v-4M28 19v1"/>',
 flash:'<path class="icon-accent" d="M18 2L5 19h10l-1 11L28 12H17z"/>',
 star:'<path class="icon-gold" d="M16 3l4 9 10 1-8 7 2 10-8-5-9 5 2-10-8-7 11-1z"/>',
 leaf:'<path class="icon-accent-line" d="M7 26C2 12 11 4 28 4c0 17-8 26-21 22z"/><path d="M4 29L23 10M12 21v-8M12 21h8"/>',
 craft:'<path d="M4 10l12-7 12 7v13l-12 7-12-7zM4 10l12 7 12-7M16 17v13"/><path class="icon-accent-line" d="M10 6l12 7v13M10 26V13l12-7"/>',
 culture:'<path d="M4 6l24-3v15c0 13-24 15-24 1z"/><path class="icon-accent-line" d="M9 13h2M21 11h2M10 21c4 3 9 2 12-2"/>',
 coffee:'<path d="M4 11h19v8c0 12-19 12-19 0zM23 13h3c7 0 5 10-3 10M3 30h24"/><path class="icon-accent-line" d="M9 6V2M17 6V2"/>',
 food:'<path d="M3 16h26c-3 17-23 17-26 0zM2 12h28M10 29h12"/><path class="icon-accent-line" d="M10 7V3M17 7V1M24 7V3"/>',
 bag:'<rect x="5" y="10" width="22" height="19" rx="3"/><path class="icon-accent-line" d="M11 13V7c0-8 10-8 10 0v6"/>',
 check:'<circle cx="16" cy="16" r="13"/><path class="icon-accent-line" d="M9 16l5 5 10-11"/>',
 note:'<path d="M22 24H12l-6 5v-5H4V4h24v20z"/><path class="icon-accent-line" d="M9 10h14M9 16h9"/>',
 settings:'<path d="M7 5v22M16 5v22M25 5v22"/><g class="icon-accent"><circle cx="7" cy="12" r="3"/><circle cx="16" cy="21" r="3"/><circle cx="25" cy="11" r="3"/></g>'
};
function icon(name,cls){return '<svg class="lk-icon '+(cls||'')+'" viewBox="0 0 32 32" aria-hidden="true" focusable="false">'+(lokoraIconPaths[name]||lokoraIconPaths.globe)+'</svg>'}
// Convert legacy text symbols to the same icon system, without changing accessible text or data.
function applyLokoraIcons(root){
 var glyphs={'⌕':'search','⌖':'pin','⌄':'down','▱':'wallet','←':'arrowLeft','→':'arrowRight','↗':'growth','›':'chevron','★':'star','♡':'heart','♥':'heart','◎':'locate','⚡':'flash','♧':'note','♙':'shield','▤':'bank','ⓘ':'info','✳':'ticket','◉':'wallet','◈':'culture','♻':'leaf','💛':'heart','☕':'coffee','🧶':'craft','🍲':'food','👜':'bag','🎨':'culture','🍯':'leaf','✓':'check'};
 var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);var nodes=[];while(walker.nextNode())if(!walker.currentNode.parentElement.closest('svg,script,style'))nodes.push(walker.currentNode);
 nodes.forEach(function(node){var text=node.nodeValue;if(!Object.keys(glyphs).some(function(g){return text.indexOf(g)!==-1}))return;var fragment=document.createDocumentFragment();Array.from(text).forEach(function(char){if(glyphs[char]){var template=document.createElement('template');template.innerHTML=icon(glyphs[char],char==='★'?'rating-star':'inline-icon');fragment.appendChild(template.content)}else fragment.appendChild(document.createTextNode(char))});node.replaceWith(fragment)})
}
