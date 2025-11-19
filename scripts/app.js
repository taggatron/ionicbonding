/* Ionic Bonding Interactive
 - Step 1: Show Bohr diagrams for Na (metal) and Cl (non-metal)
 - Click Na's valence electron to transfer it to Cl
 - Step 2: Drag ions (Na+, Cl-) to correct dropzones
*/

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  transferred: false,
  metalCharge: 0,
  nonmetalCharge: 0,
};

function init() {
  mountAtoms();
  setupStepper();
  setupDragAndDrop();
  setupReset();
  initLattice();
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
  // Reset state
  state.transferred = false;
  state.metalCharge = 0;
  state.nonmetalCharge = 0;
  // Reset UI
  $('#atom-metal').innerHTML = '';
  $('#atom-nonmetal').innerHTML = '';
  mountAtoms();
  $('#toStep2').disabled = true;
  setActiveStep('1');
  // Reset drag area
  const draggables = $('.draggables');
  draggables.innerHTML = '';
  draggables.appendChild(createIonCard('Na', '+', 'positive'));
  draggables.appendChild(createIonCard('Cl', '−', 'negative'));
  $$('.dropzone').forEach(z=>{
    z.classList.remove('correct','incorrect','over');
  });
  setupDragAndDrop();
  // Reset lattice
  $('#latticeView').innerHTML = '';
  initLattice();
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
    const e = valence[valence.length - 1];
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
    badge.textContent = charge > 0 ? `+${charge}` : `${charge}`;
  }
}

let metalAtom, nonMetalAtom;

function mountAtoms(){
  const metalStage = $('#atom-metal');
  const nonmetalStage = $('#atom-nonmetal');

  metalAtom = new Atom({
    container: metalStage,
    name: 'Sodium',
    symbol: 'Na',
    shells: [2, 8, 1], // 11 e-
    theme: 'metal'
  });

  nonMetalAtom = new Atom({
    container: nonmetalStage,
    name: 'Chlorine',
    symbol: 'Cl',
    shells: [2, 8, 7], // 17 e-
    theme: 'nonmetal'
  });

  // Activate only metal's valence electron(s)
  const clickable = metalAtom.valenceElectrons();
  clickable.forEach(e => {
    e.addEventListener('click', ()=>transferElectron(e));
  });
  // Visually disable non-valence electrons from all
  metalAtom.electronRefs.forEach(e => {
    if(!clickable.includes(e)) e.classList.add('disabled');
  });
  nonMetalAtom.electronRefs.forEach(e => e.classList.add('disabled'));
}

function svgToScreenCoords(svgElem, cx, cy){
  const pt = svgElem.createSVGPoint();
  pt.x = cx; pt.y = cy;
  const screenCTM = svgElem.getScreenCTM();
  const out = pt.matrixTransform(screenCTM);
  return {x: out.x, y: out.y};
}

function transferElectron(clickedElectron){
  if(state.transferred) return;

  // Determine start (metal valence approx center)
  const mIdx = metalAtom.shells.length - 1;
  const r = 70 + mIdx * metalAtom.radiusStep;
  // Pick current electron position
  const start = {
    x: Number(clickedElectron.getAttribute('cx')),
    y: Number(clickedElectron.getAttribute('cy'))
  };

  // Target on non-metal
  const target = nonMetalAtom.nextNonmetalSlotPosition();

  // Create a floating electron element absolutely positioned over the page for smooth cross-SVG animation
  const floating = document.createElement('div');
  floating.style.position = 'fixed';
  floating.style.width = '10px';
  floating.style.height = '10px';
  floating.style.borderRadius = '50%';
  floating.style.background = 'var(--electron)';
  floating.style.boxShadow = '0 0 12px rgba(0,229,255,0.9)';
  floating.style.zIndex = 5;

  const metalBox = metalAtom.root.getBoundingClientRect();
  const nonmetalBox = nonMetalAtom.root.getBoundingClientRect();

  const startScreen = svgToScreenCoords(metalAtom.root, start.x, start.y);
  const targetScreen = svgToScreenCoords(nonMetalAtom.root, target.x, target.y);

  floating.style.left = `${startScreen.x - 5}px`;
  floating.style.top = `${startScreen.y - 5}px`;

  document.body.appendChild(floating);

  // Remove electron from metal
  metalAtom.removeValenceElectron();

  // Animate to target
  floating.animate([
    { transform: 'translate(0,0)' },
    { transform: `translate(${targetScreen.x - startScreen.x}px, ${targetScreen.y - startScreen.y}px)` }
  ], {
    duration: 900,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
  }).onfinish = () => {
    floating.remove();
    nonMetalAtom.addValenceElectronAt(target.x, target.y);
    state.transferred = true;
    state.metalCharge = +1; // lost one e-
    state.nonmetalCharge = -1; // gained one e-
    metalAtom.showChargeBadge(state.metalCharge);
    nonMetalAtom.showChargeBadge(state.nonmetalCharge);
    $('#toStep2').disabled = false;
    $('#toStep2').focus();
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
  const placed = $$('.dropzone .ion-card').length;
  if(placed === 2){
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

/* ---------- Giant Ionic Lattice (2D slice) ---------- */
function initLattice(){
  const container = $('#latticeView');
  if(!container) return;
  const rows = 8; const cols = 8;
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
