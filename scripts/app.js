/* Ionic Bonding Interactive
 - Step 1: Show Bohr diagrams for Na (metal) and Cl (non-metal)
 - Click Na's valence electron to transfer it to Cl
 - Step 2: Drag ions (Na+, Cl-) to correct dropzones
*/

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  cation: 'Na',
  transferredCount: 0,
  requiredTransfers: 1,
  metalCharge: 0,
  nonmetalCharges: [], // array for multiple non-metals
};

function init() {
  setupCationPicker();
  mountAtoms();
  setupStepper();
  setupDragAndDrop();
  setupReset();
  initLattice();
  initIsoLattice();
}

document.addEventListener('DOMContentLoaded', init);

function setupStepper(){
  $$('.step').forEach(btn => {
    btn.addEventListener('click', () => {
      const step = btn.getAttribute('data-step');
      if(step === '2' && !state.transferred) return; // gate
      setActiveStep(step);
    });
  });
}

function setActiveStep(step){
  $$('.step').forEach(b=>b.classList.toggle('active', b.getAttribute('data-step')===step));
  $$('.panel').forEach(p=>p.classList.toggle('active', p.id === (step==='1'?'step1':'step2')));
}

function setupReset(){
  $('#resetBtn').addEventListener('click', resetAll);
  $('#restart').addEventListener('click', resetAll);
}

function resetAll(){
  state.transferredCount = 0;
  state.metalCharge = 0;
  state.nonmetalCharges = [];
  state.requiredTransfers = state.cation === 'Mg' ? 2 : 1;
  $('#atom-metal').innerHTML = '';
  $('#atom-nonmetal').innerHTML = '';
  mountAtoms();
  $('#toStep2').disabled = true;
  setActiveStep('1');
  buildIonCards();
  $$('.dropzone').forEach(z=>z.classList.remove('correct','incorrect','over'));
  setupDragAndDrop();
  $('#latticeView').innerHTML='';
  initLattice();
  const iso = $('#latticeIsoView'); if(iso) iso.innerHTML='';
  initIsoLattice();
  initDotCrossPending();
}

/* ---------- Atom and Electron rendering ---------- */
class Atom {
  constructor({container, name, symbol, shells, theme}){
    this.container = container;
    this.name = name;
    this.symbol = symbol;
    this.shells = shells; // array: electrons per shell, valence is last
    this.theme = theme; // 'metal' | 'nonmetal'
    this.svgNS = 'http://www.w3.org/2000/svg';
    this.size = 340;
    this.center = {x: this.size/2, y: this.size/2};
    this.radiusStep = 40;
    this.electronRefs = [];
    this.render();
  }
  el(name, attrs={}){
    const e = document.createElementNS(this.svgNS, name);
    Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k, v));
    return e;
  }
  render(){
    const svg = this.el('svg', {class:'atom', viewBox:`0 0 ${this.size} ${this.size}`});

    // defs
    const defs = this.el('defs');
    const grad = this.el('radialGradient', {id:`nucleusGradient`});
    grad.appendChild(this.el('stop', {offset:'0%', 'stop-color': this.theme==='metal'?'#ffd166':'#06d6a0'}));
    grad.appendChild(this.el('stop', {offset:'100%', 'stop-color': '#ffffff', 'stop-opacity':'0.05'}));
    defs.appendChild(grad);
    svg.appendChild(defs);

    // nucleus
    const nucleus = this.el('circle', {class:'nucleus', cx:this.center.x, cy:this.center.y, r:22});
    svg.appendChild(nucleus);
    const label = this.el('text', {class:'label', x:this.center.x, y:this.center.y+5});
    label.textContent = this.symbol;
    svg.appendChild(label);

    // shells
    this.shells.forEach((_, i)=>{
      const r = 70 + i * this.radiusStep;
      const shell = this.el('circle', {class:'shell', cx:this.center.x, cy:this.center.y, r});
      svg.appendChild(shell);
    });

    // electrons
    this.electronRefs = [];
    this.shells.forEach((count, i)=>{
      const r = 70 + i * this.radiusStep;
      for(let k=0;k<count;k++){
        const angle = (k / count) * Math.PI*2 - Math.PI/2;
        const x = this.center.x + Math.cos(angle)*r;
        const y = this.center.y + Math.sin(angle)*r;
        const e = this.el('circle', {class:'electron floater', cx:x, cy:y, r:6});
        e.dataset.shellIndex = i;
        e.dataset.index = k;
        svg.appendChild(e);
        this.electronRefs.push(e);
      }
    });

    this.root = svg;
    this.container.appendChild(svg);
  }
  valenceElectrons(){
    const idx = this.shells.length - 1;
    return this.electronRefs.filter(e => Number(e.dataset.shellIndex) === idx);
  }
  removeValenceElectron(){
    const valence = this.valenceElectrons();
    if(valence.length === 0) return null;
    // Support removing the specific clicked electron to avoid leaving the
    // originally clicked one visible (Mg case had mismatch when removing last).
    // If a target was passed (first arg), remove that; else remove last.
    // We allow optional parameter for backward compatibility.
    let target = arguments[0];
    let e;
    if(target && valence.includes(target)){
      e = target;
    } else {
      e = valence[valence.length - 1];
    }
    e.remove();
    const idx = this.shells.length - 1;
    this.shells[idx] = Math.max(0, this.shells[idx]-1);
    return e; // for position reference, though removed
  }
  valenceCenter(){
    const idx = this.shells.length - 1;
    const r = 70 + idx * this.radiusStep;
    return {r, ...this.center};
  }
  nextNonmetalSlotPosition(){
    const idx = this.shells.length - 1;
    const r = 70 + idx * this.radiusStep;
    const count = this.shells[idx];
    const max = 8; // simple octet model
    const targetIndex = count; // next empty slot index
    const angle = (targetIndex / max) * Math.PI*2 - Math.PI/2;
    const x = this.center.x + Math.cos(angle)*r;
    const y = this.center.y + Math.sin(angle)*r;
    return {x,y};
  }
  addValenceElectronAt(x, y){
    const e = this.el('circle', {class:'electron floater', cx:x, cy:y, r:6});
    this.root.appendChild(e);
    const idx = this.shells.length - 1;
    this.shells[idx] = Math.min(8, this.shells[idx] + 1);
    return e;
  }
  showChargeBadge(charge){
    let badge = this.container.querySelector('.charge-badge');
    if(!badge){
      badge = document.createElement('div');
      badge.className = 'charge-badge';
      this.container.appendChild(badge);
    }
    let display;
    if(typeof charge === 'number'){
      if(charge === 0){
        display = '0';
      } else {
        display = (charge > 0 ? '+' : '') + charge;
      }
    } else {
      const str = String(charge).trim();
      if(str === '') display = '';
      else if(/^[+-]/.test(str)) display = str; // already has sign
      else if(/^\d+$/.test(str)) display = '+' + str; // plain digits assume positive
      else display = str;
    }
    badge.textContent = display;
    if(display === '') badge.style.visibility = 'hidden'; else badge.style.visibility = 'visible';
  }
}

let metalAtom; // single
let nonMetalAtom; // single (Na case) OR null when group2
let nonMetalAtoms = []; // array when Mg selected

function mountAtoms(){
  const metalStage = $('#atom-metal');
  const nonmetalStage = $('#atom-nonmetal');
  nonmetalStage.classList.remove('sub-nonmetals');

  if(state.cation === 'Na'){
    $('#metalTitle').textContent = 'Sodium (Na) – metal';
    $('#nonmetalTitle').textContent = 'Chlorine (Cl) – non-metal';
    $('#metalHint').textContent = 'Click the outer electron to transfer it.';
    $('#nonmetalHint').textContent = 'Receives electron to complete its shell.';

    metalAtom = new Atom({
      container: metalStage,
      name: 'Sodium',
      symbol: 'Na',
      shells: [2,8,1],
      theme: 'metal'
    });
    nonMetalAtom = new Atom({
      container: nonmetalStage,
      name: 'Chlorine',
      symbol: 'Cl',
      shells: [2,8,7],
      theme: 'nonmetal'
    });
    nonMetalAtoms = [nonMetalAtom];
  } else { // Mg
    $('#metalTitle').textContent = 'Magnesium (Mg) – metal';
    $('#nonmetalTitle').textContent = 'Chlorine (Cl) – non-metals (x2)';
    $('#metalHint').textContent = 'Click each outer electron (2) to transfer.';
    $('#nonmetalHint').textContent = 'Each chlorine receives one electron.';

    metalAtom = new Atom({
      container: metalStage,
      name: 'Magnesium',
      symbol: 'Mg',
      shells: [2,8,2],
      theme: 'metal'
    });
    // Render two chlorine mini stages
    nonmetalStage.classList.add('sub-nonmetals');
    const clA = document.createElement('div'); clA.className='mini-stage'; nonmetalStage.appendChild(clA);
    const clB = document.createElement('div'); clB.className='mini-stage'; nonmetalStage.appendChild(clB);
    const atomA = new Atom({container: clA, name:'Chlorine', symbol:'Cl', shells:[2,8,7], theme:'nonmetal'});
    const atomB = new Atom({container: clB, name:'Chlorine', symbol:'Cl', shells:[2,8,7], theme:'nonmetal'});
    nonMetalAtoms = [atomA, atomB];
  }

  // Activate only metal's valence electrons
  const clickable = metalAtom.valenceElectrons();
  clickable.forEach(e => e.addEventListener('click', () => transferElectron(e)));
  metalAtom.electronRefs.forEach(e => { if(!clickable.includes(e)) e.classList.add('disabled'); });
  nonMetalAtoms.forEach(atom => atom.electronRefs.forEach(e => e.classList.add('disabled')));
}

function svgToScreenCoords(svgElem, cx, cy){
  const pt = svgElem.createSVGPoint();
  pt.x = cx; pt.y = cy;
  const screenCTM = svgElem.getScreenCTM();
  const out = pt.matrixTransform(screenCTM);
  return {x: out.x, y: out.y};
}

function transferElectron(clickedElectron){
  if(state.transferredCount >= state.requiredTransfers) return;

  // Determine start position
  const start = {
    x: Number(clickedElectron.getAttribute('cx')),
    y: Number(clickedElectron.getAttribute('cy'))
  };

  // Choose target non-metal needing electron (first with valence < 8)
  const targetAtom = nonMetalAtoms.find(a => a.shells[a.shells.length-1] < 8);
  if(!targetAtom) return;
  const target = targetAtom.nextNonmetalSlotPosition();

  const floating = document.createElement('div');
  Object.assign(floating.style, {
    position:'fixed', width:'10px', height:'10px', borderRadius:'50%', background:'var(--electron)', boxShadow:'0 0 12px rgba(0,229,255,0.9)', zIndex:5
  });
  const startScreen = svgToScreenCoords(metalAtom.root, start.x, start.y);
  const targetScreen = svgToScreenCoords(targetAtom.root, target.x, target.y);
  floating.style.left = `${startScreen.x - 5}px`; floating.style.top = `${startScreen.y - 5}px`;
  document.body.appendChild(floating);

  // Remove the specific electron clicked to ensure correct visual disappearance
  metalAtom.removeValenceElectron(clickedElectron);

  floating.animate([
    { transform:'translate(0,0)' },
    { transform:`translate(${targetScreen.x - startScreen.x}px, ${targetScreen.y - startScreen.y}px)` }
  ], {duration:900, easing:'cubic-bezier(0.2,0.8,0.2,1)'}).onfinish = () => {
    floating.remove();
    targetAtom.addValenceElectronAt(target.x, target.y);
    state.transferredCount++;
    // Update charges
    state.metalCharge = state.transferredCount;
    metalAtom.showChargeBadge(state.metalCharge);
    nonMetalAtoms.forEach((a,i)=>{
      const valence = a.shells[a.shells.length-1];
      const gained = valence - (state.cation==='Mg'?7:7); // base 7 -> gained 0 or 1
      a.showChargeBadge(gained === 1 ? -1 : '');
    });
    if(state.transferredCount >= state.requiredTransfers){
      // finalize charges
      if(state.cation === 'Mg') metalAtom.showChargeBadge(2); else metalAtom.showChargeBadge(1);
      nonMetalAtoms.forEach(a=> a.showChargeBadge(-1));
      $('#toStep2').disabled = false;
      $('#toStep2').focus();
      buildDotCrossDiagrams();
    }
  };
}

/* ---------- Drag and Drop ---------- */
function createIonCard(symbol, chargeText, chargeKey){
  const card = document.createElement('div');
  card.className = 'ion-card draggable';
  card.setAttribute('draggable', 'true');
  card.dataset.ion = symbol + (chargeText === '−' ? '-' : '+');
  card.dataset.charge = chargeKey; // 'positive' | 'negative'
  card.innerHTML = `
    <div class="ion-head">
      <span class="symbol">${symbol}</span><span class="charge">${chargeText}</span>
    </div>
    <div class="ion-body">${symbol === 'Na' ? 'Sodium Ion' : 'Chloride Ion'}</div>
  `;
  return card;
}

function setupDragAndDrop(){
  const draggables = $$('.draggable');
  const zones = $$('.dropzone');

  draggables.forEach(d => {
    d.addEventListener('dragstart', ev => {
      ev.dataTransfer.setData('text/plain', d.dataset.charge);
      ev.dataTransfer.setData('text/ion', d.dataset.ion);
      requestAnimationFrame(()=> d.classList.add('dragging'));
    });
    d.addEventListener('dragend', ()=> d.classList.remove('dragging'));
  });

  zones.forEach(z => {
    z.addEventListener('dragover', ev => {
      ev.preventDefault();
      z.classList.add('over');
    });
    z.addEventListener('dragleave', ()=> z.classList.remove('over'));
    z.addEventListener('drop', ev => {
      ev.preventDefault();
      z.classList.remove('over');
      const charge = ev.dataTransfer.getData('text/plain');
      const ion = ev.dataTransfer.getData('text/ion');
      const accept = z.dataset.accept;
      const dragged = $('.draggable.dragging');
      if(!dragged) return;
      if(charge === accept){
        z.classList.add('correct');
        z.classList.remove('incorrect');
        z.appendChild(dragged);
        dragged.setAttribute('draggable', 'false');
        dragged.style.opacity = '0.95';
        checkCompletion();
      }else{
        z.classList.remove('correct');
        z.classList.add('incorrect');
        z.classList.add('shake');
        setTimeout(()=>z.classList.remove('shake'), 400);
      }
    });
  });

  $('#toStep2').addEventListener('click', ()=> setActiveStep('2'));
}

function checkCompletion(){
  const totalNeeded = state.cation === 'Mg' ? 3 : 2; // Mg2+ plus 2 Cl- vs Na+ plus Cl-
  const placed = $$('.dropzone .ion-card').length;
  if(placed === totalNeeded){
    // brief confetti-like pulse
    $$('.dropzone').forEach(z => {
      z.animate([
        { transform:'scale(1)' },
        { transform:'scale(1.03)' },
        { transform:'scale(1)' }
      ], { duration: 350, easing: 'ease-out' });
    });
  }
}

function buildIonCards(){
  const draggables = $('.draggables');
  draggables.innerHTML = '';
  if(state.cation === 'Na'){
    draggables.appendChild(createIonCard('Na', '+', 'positive'));
    draggables.appendChild(createIonCard('Cl', '−', 'negative'));
  } else { // MgCl2
    const mgCard = document.createElement('div');
    mgCard.className = 'ion-card draggable';
    mgCard.setAttribute('draggable','true');
    mgCard.dataset.ion = 'Mg2+';
    mgCard.dataset.charge = 'positive';
    mgCard.innerHTML = `<div class="ion-head"><span class="symbol">Mg</span><span class="charge">2+</span></div><div class="ion-body">Magnesium Ion</div>`;
    draggables.appendChild(mgCard);
    // Two chloride ions
    draggables.appendChild(createIonCard('Cl', '−', 'negative'));
    draggables.appendChild(createIonCard('Cl', '−', 'negative'));
  }
}

function setupCationPicker(){
  const sel = $('#cationSelect');
  sel.addEventListener('change', () => {
    state.cation = sel.value;
    resetAll();
  });
}

/* ---------- Dot & Cross Diagram Rendering ---------- */
function initDotCrossPending(){
  const grid = $('#dcGrid');
  if(!grid) return;
  grid.innerHTML = '';
  $('#dcIntro').textContent = 'Complete the electron transfer to reveal ionic dot-and-cross diagrams.';
  // Show placeholder diagrams (neutral) faded
  const neutral = document.createElement('div');
  neutral.className = 'dc-diagram dc-pending';
  neutral.textContent = state.cation;
  grid.appendChild(neutral);
  const neutralCl = document.createElement('div');
  neutralCl.className = 'dc-diagram dc-pending';
  neutralCl.textContent = 'Cl';
  grid.appendChild(neutralCl);
}

function buildDotCrossDiagrams(){
  const grid = $('#dcGrid');
  if(!grid) return;
  grid.innerHTML = '';
  $('#dcIntro').textContent = 'Ionic dot-and-cross diagrams (valence shell shown with bracket notation).';
  if(state.cation === 'Na'){
    grid.appendChild(renderCationDiagram('Na', '+1'));
    grid.appendChild(renderAnionDiagram('Cl', '-1', 1));
  } else {
    grid.appendChild(renderCationDiagram('Mg', '+2'));
    grid.appendChild(renderAnionDiagram('Cl', '-1', 1));
    grid.appendChild(renderAnionDiagram('Cl', '-1', 1));
  }
}

function renderCationDiagram(symbol, charge){
  const d = document.createElement('div');
  d.className = 'dc-diagram bracket';
  d.innerHTML = `<span class="ion-charge">${charge}</span>${symbol}`;
  return d;
}

function renderAnionDiagram(symbol, charge, transferredCount){
  const d = document.createElement('div');
  d.className = 'dc-diagram bracket';
  d.innerHTML = `<span class="ion-charge">${charge}</span>${symbol}`;
  // positions around box (clockwise from top)
  const positions = [
    ['50%', '6%'], ['80%', '20%'], ['94%', '50%'], ['80%', '80%'], ['50%', '94%'], ['20%', '80%'], ['6%', '50%'], ['20%', '20%']
  ];
  // 7 original non-metal electrons shown as dots; transferred ones as crosses (here 1 per Cl)
  const transferredIndices = [];
  for(let i=0;i<transferredCount;i++){ transferredIndices.push((i*2) % 8); }
  positions.forEach((pos, idx)=>{
    const el = document.createElement('div');
    el.className = 'dc-electron ' + (transferredIndices.includes(idx) ? 'cross' : 'dot');
    el.style.left = `calc(${pos[0]} - 6px)`; el.style.top = `calc(${pos[1]} - 6px)`;
    d.appendChild(el);
  });
  return d;
}

/* ---------- Giant Ionic Lattice (2D slice) ---------- */
function initLattice(){
  const container = $('#latticeView');
  if(!container) return;
  // Determine lattice size based on mobile portrait breakpoint
  const isMobilePortrait = () => window.matchMedia('(max-width: 600px) and (orientation: portrait)').matches;
  const rows = isMobilePortrait() ? 5 : 7;
  const cols = isMobilePortrait() ? 5 : 7;
  // Alternating Na+ / Cl- pattern (checkerboard) for 2D slice
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const isNa = (r + c) % 2 === 0; // alternate
      const node = document.createElement('div');
      node.className = 'ion-node ' + (isNa ? 'na' : 'cl');
      node.dataset.type = isNa ? 'Na+' : 'Cl−';
      node.textContent = isNa ? 'Na+' : 'Cl−';
      node.dataset.row = r;
      node.dataset.col = c;
      node.addEventListener('mouseenter', () => highlightNeighbors(node, rows, cols));
      node.addEventListener('mouseleave', clearBondLines);
      container.appendChild(node);
    }
  }

  // Attach resize/orientation listeners once to dynamically rebuild lattice if orientation changes
  if(!window.__latticeListenersAttached){
    const reflow = () => {
      const cont = $('#latticeView');
      if(!cont) return;
      cont.innerHTML = '';
      initLattice();
    };
    window.addEventListener('resize', reflow);
    window.matchMedia('(orientation: portrait)').addEventListener('change', reflow);
    window.__latticeListenersAttached = true;
  }
}

function highlightNeighbors(node, rows, cols){
  clearBondLines();
  node.classList.add('focused');
  const r = Number(node.dataset.row); const c = Number(node.dataset.col);
  const container = $('#latticeView');
  const directions = [ [0,1], [1,0], [0,-1], [-1,0] ]; // planar neighbors
  directions.forEach(([dr, dc]) => {
    const nr = r + dr; const nc = c + dc;
    if(nr < 0 || nr >= rows || nc < 0 || nc >= cols) return;
    const neighbor = container.querySelector(`.ion-node[data-row='${nr}'][data-col='${nc}']`);
    if(!neighbor) return;
    drawBondLine(node, neighbor);
  });
  // Indicate out-of-plane neighbors (above/below) with subtle ghost circles
  addVerticalGhosts(node);
}

function elementCenter(el){
  const rect = el.getBoundingClientRect();
  return {x: rect.left + rect.width/2, y: rect.top + rect.height/2};
}

function drawBondLine(a, b){
  const container = $('#latticeView');
  const ca = elementCenter(a); const cb = elementCenter(b);
  // Convert global to container coordinates
  const cRect = container.getBoundingClientRect();
  const x1 = ca.x - cRect.left; const y1 = ca.y - cRect.top;
  const x2 = cb.x - cRect.left; const y2 = cb.y - cRect.top;
  const dx = x2 - x1; const dy = y2 - y1; const dist = Math.sqrt(dx*dx + dy*dy);
  const line = document.createElement('div');
  line.className = 'bond-line';
  line.style.left = x1 + 'px';
  line.style.top = (y1 - 2) + 'px';
  line.style.width = dist + 'px';
  line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
  container.appendChild(line);
}

function addVerticalGhosts(node){
  const container = $('#latticeView');
  const pos = elementCenter(node);
  const cRect = container.getBoundingClientRect();
  const baseX = pos.x - cRect.left; const baseY = pos.y - cRect.top;
  ['above','below'].forEach((dir,i)=>{
    const ghost = document.createElement('div');
    ghost.className = 'bond-line';
    ghost.style.width = '28px';
    ghost.style.left = (baseX - 14) + 'px';
    ghost.style.top = (baseY - (dir==='above'?40:-40)) + 'px';
    ghost.style.opacity = '0.35';
    ghost.style.background = 'linear-gradient(90deg,var(--accent),transparent)';
    ghost.style.transform = 'rotate(0deg)';
    container.appendChild(ghost);
  });
}

function clearBondLines(){
  $('#latticeView').querySelectorAll('.bond-line').forEach(l=>l.remove());
  $('#latticeView').querySelectorAll('.ion-node.focused').forEach(n=>n.classList.remove('focused'));
}

/* ---------- Isometric Lattice Rendering (3D impression) ---------- */
function initIsoLattice(){
  const container = $('#latticeIsoView');
  if(!container) return;
  const N = 7; // edge length of cube
  const spacing = 44; // base spacing
  const half = spacing * 0.5;
  const quarter = spacing * 0.25;
  const depthRaise = spacing * 0.6; // increased vertical lift per layer for a more cubic appearance
  const offsetX = container.clientWidth / 2; // center cube horizontally
  const offsetY = 240; // lifted upward slightly to center cube better

  // Build nodes with 3D parity alternation: (x+y+z) even = Na+, odd = Cl−
  for(let z=0; z<N; z++){
    for(let y=0; y<N; y++){
      for(let x=0; x<N; x++){
        const isNa = ((x + y + z) % 2) === 0;
        const node = document.createElement('div');
        node.className = 'iso-node ' + (isNa ? 'na' : 'cl');

        // isometric projection positioning
        const screenX = (x - y) * half;
        const screenY = (x + y) * quarter - z * depthRaise;

        // slight perspective scale by depth
        const scale = 1 - z * 0.03;
        node.style.transform = `translate(${offsetX + screenX}px, ${offsetY + screenY}px) scale(${scale})`;
        node.style.zIndex = 100 + x + y + z * 2; // ensure back-to-front paint order

        container.appendChild(node);
      }
    }
  }
}
