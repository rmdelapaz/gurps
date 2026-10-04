/* Theme-aware Mermaid rendering: keeps each diagram's source and re-renders
   with matching colors whenever the page theme changes. Wide diagrams are
   never shrunk below a readable size; they scroll sideways instead. */
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';

const nodes = [...document.querySelectorAll('.mermaid')];
// Read each diagram's source; a literal <br/> in the HTML becomes an element,
// so turn those back into Mermaid line breaks before taking the text.
nodes.forEach((n) => {
  const copy = n.cloneNode(true);
  copy.querySelectorAll('br').forEach((br) => br.replaceWith('<br/>'));
  n.dataset.src = copy.textContent;
});

const THEMES = {
  light: {
    theme: 'base',
    themeVariables: {
      fontFamily: '"Source Sans 3", "Segoe UI", system-ui, sans-serif',
      primaryColor: '#f6e3e4', primaryTextColor: '#141b24', primaryBorderColor: '#a3212b',
      secondaryColor: '#e1ebf5', tertiaryColor: '#eceff3',
      lineColor: '#525d6b', textColor: '#141b24', mainBkg: '#f6e3e4', nodeBorder: '#a3212b',
      clusterBkg: '#f4f5f7', clusterBorder: '#b3bdca', edgeLabelBackground: '#ffffff',
      pieTitleTextColor: '#141b24', pieLegendTextColor: '#141b24', pieSectionTextColor: '#ffffff',
      pie1: '#a3212b', pie2: '#2f5f8a', pie3: '#b4570b', pie4: '#7b3fb0', pie5: '#1f7a3d', pie6: '#5b6573'
    }
  },
  dark: {
    theme: 'base',
    themeVariables: {
      darkMode: true,
      fontFamily: '"Source Sans 3", "Segoe UI", system-ui, sans-serif',
      primaryColor: '#3a1a1d', primaryTextColor: '#f3f5f8', primaryBorderColor: '#ff8f8a',
      secondaryColor: '#1b2c3e', tertiaryColor: '#1f262f',
      lineColor: '#a3aebb', textColor: '#f3f5f8', mainBkg: '#3a1a1d', nodeBorder: '#ff8f8a',
      clusterBkg: '#181d24', clusterBorder: '#3e4a57', edgeLabelBackground: '#181d24',
      pieTitleTextColor: '#f3f5f8', pieLegendTextColor: '#f3f5f8', pieSectionTextColor: '#ffffff',
      pieStrokeColor: '#181d24',
      pie1: '#a3212b', pie2: '#2f5f8a', pie3: '#b4570b', pie4: '#7b3fb0', pie5: '#1f7a3d', pie6: '#5b6573'
    }
  }
};

const MIN_SCALE = 0.8;          // ~13px text for Mermaid's 16px labels
const NARROW = 700;             // below this, left-to-right flowcharts render top-to-bottom

// Hard-coded node fills (style/classDef lines) are mostly pastels: keep their
// label text dark so it stays readable when the page theme is dark.
function pinLabelColors(src) {
  return src.replace(/^(\s*(?:style|classDef)\s+\S+\s+)([^\n]*)$/gm, (line, head, body) => {
    const m = body.match(/fill:\s*#([0-9a-f]{6}|[0-9a-f]{3})\b/i);
    if (!m || /(^|,)\s*color:/.test(body)) return line;
    let h = m[1]; if (h.length === 3) h = h.replace(/./g, '$&$&');
    const [r, g, bl] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    return head + body.replace(/;?\s*$/, '') + (lum > 0.18 ? ',color:#141b24' : ',color:#ffffff');
  });
}

function sourceFor(n) {
  let src = pinLabelColors(n.dataset.src);
  if (window.innerWidth < NARROW) {
    src = src.replace(/^(\s*(?:graph|flowchart))\s+(LR|RL)\b/m, '$1 TD');
  }
  return src;
}

function fit(n) {
  const svg = n.querySelector('svg');
  const hint = n.previousElementSibling && n.previousElementSibling.classList.contains('diagram-hint')
    ? n.previousElementSibling : null;
  if (!svg) return;
  const vb = svg.viewBox && svg.viewBox.baseVal;
  const natural = vb && vb.width ? vb.width : svg.getBoundingClientRect().width;
  const cs = getComputedStyle(n);
  const avail = n.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  // Slightly-too-wide diagrams just shrink a little; only really wide ones scroll.
  const wide = avail / natural < MIN_SCALE - 0.1;
  if (wide) {
    svg.style.maxWidth = 'none';
    svg.style.width = Math.round(natural * MIN_SCALE) + 'px';
    svg.removeAttribute('width');
    n.classList.add('is-wide');
    if (!hint) {
      const p = document.createElement('p');
      p.className = 'diagram-hint';
      p.textContent = '↔ This diagram is wide — scroll sideways to see all of it.';
      n.before(p);
    }
  } else {
    n.classList.remove('is-wide');
    if (hint) hint.remove();
  }
}

const vbWidth = (svgText) => {
  const m = svgText.match(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+) /);
  return m ? parseFloat(m[1]) : Infinity;
};

// A wide flowchart may fit better in the other direction
// (a broad top-down fan-out reads better left-to-right, and vice versa).
let altId = 0;
async function tryOtherDirection(n) {
  if (!n.classList.contains('is-wide')) return;
  const src = sourceFor(n);
  const m = src.match(/^(\s*(?:graph|flowchart))\s+(TD|TB|LR|RL|BT)\b/m);
  if (!m) return;
  const other = /^(LR|RL)$/.test(m[2]) ? 'TD' : 'LR';
  const alt = src.replace(m[0], `${m[1]} ${other}`);
  try {
    const { svg } = await mermaid.render(`alt-diagram-${altId++}`, alt);
    const svgEl = n.querySelector('svg');
    const current = svgEl && svgEl.viewBox ? svgEl.viewBox.baseVal.width : Infinity;
    if (vbWidth(svg) < current * 0.8) { n.innerHTML = svg; fit(n); }
  } catch (e) { /* keep the original rendering */ }
}

let rendering = Promise.resolve();
function render() {
  rendering = rendering.then(async () => {
    if (!nodes.length) return;
    const mode = (window.gurpsTheme && window.gurpsTheme()) === 'dark' ? 'dark' : 'light';
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', ...THEMES[mode] });
    nodes.forEach((n) => { n.removeAttribute('data-processed'); n.textContent = sourceFor(n); });
    try { await mermaid.run({ nodes }); } catch (e) { console.warn('Mermaid render failed:', e); }
    nodes.forEach(fit);
    for (const n of nodes) await tryOtherDirection(n);
  });
  return rendering;
}

render();
document.addEventListener('themechange', render);

// Re-fit on resize; re-render only when crossing the narrow breakpoint (diagram direction changes).
let wasNarrow = window.innerWidth < NARROW, t;
window.addEventListener('resize', () => {
  clearTimeout(t);
  t = setTimeout(() => {
    const isNarrow = window.innerWidth < NARROW;
    if (isNarrow !== wasNarrow) { wasNarrow = isNarrow; render(); }
    else nodes.forEach(fit);
  }, 150);
});
