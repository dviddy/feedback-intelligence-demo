/* Presentation controls for the precomputed synthetic product demo. */
const load = document.getElementById('loadDemoButton');
const content = document.getElementById('demoContent');
const maps = document.getElementById('journeyMaps');
load.addEventListener('click', () => {
  content.hidden = false;
  document.getElementById('initialState').hidden = true;
  document.getElementById('statusPanel').hidden = false;
  document.getElementById('status').textContent = 'Synthetic demo dataset loaded. Explore the summary, trends, journey maps and detailed feedback.';
});
document.getElementById('generateTop3').addEventListener('click', () => {
  maps.hidden = false;
  document.getElementById('journeyStatus').textContent = 'Generated 3 journey maps from precomputed synthetic evidence.';
});
