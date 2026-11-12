
const D = window.__D;
const BR = ['청계','상암','마곡','동대문'];
const BCOL = {청계:'#156DFF',상암:'#5B9BFF',마곡:'#A9C8FF',동대문:'#26334D'};
const TABS = [['home','홈'],['compare','매장 비교'],['book','장부'],['cash','자금'],['wine','원가·재고'],['check','정산 진단'],['map','기능 지도']];
const S = {br:'전체', tab:'home', month:null, sel:null};
const F = ['food','show','cafe','liquor','etc','prepaid_use','cash','cnt','dc','svc','card','easy','kakao','coupang','baemin','sikkwon','ds_store','ds_partner','transfer','branch_pay','other','net','gross','charge','pay_total','diff_pay'];
const DOW = ['일','월','화','수','목','금','토'];

// ---------- helpers ----------
const fmt = n => Math.round(n).toLocaleString('ko-KR');
const won = n => fmt(n)+'원';
const man = n => { const v = n/1e4; return (Math.abs(v)>=1000? fmt(v) : (Math.round(v*10)/10).toLocaleString('ko-KR'))+'만'; };
const eok = n => (n/1e8).toFixed(2)+'억';
const pct = (a,b) => b ? (a/b-1)*100 : null;
const pctTxt = p => p==null ? '-' : `<span class="${p>=0?'up':'down'}">${p>=0?'▲':'▼'} ${Math.abs(p).toFixed(1)}%</span>`;
const dt = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d); };
const ds = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const addDays = (s,n) => { const d = dt(s); d.setDate(d.getDate()+n); return ds(d); };
const md = s => `${+s.slice(5,7)}/${+s.slice(8)}(${DOW[dt(s).getDay()]})`;
const brs = () => S.br==='전체' ? BR : [S.br];

// 일자별 합계 (선택 지점)
function series(list = brs()){
  const m = {};
  for (const b of list) for (const r of D.daily[b]) {
    const o = m[r.date] ||= {date:r.date, by:{}}; o.by[b] = r;
    for (const f of F) o[f] = (o[f]||0) + (r[f]||0);
  }
  return Object.values(m).sort((a,b)=>a.date<b.date?-1:1);
}
const sumF = (rows,f) => rows.reduce((s,r)=>s+(r[f]||0),0);
const LAST = BR.flatMap(b=>D.daily[b].map(r=>r.date)).sort().pop();     // 마지막 입력일
const CUR = LAST.slice(0,7), PREV = '2026-10';
S.month = CUR;

// 월말 예상: 지점별 요일 평균 × 남은 날 (shortcut: 공휴일·이벤트 미반영, 데이터가 2개월뿐이라 요일 평균만. 3개월 이상 쌓이면 추세 보정)
function forecast(b){
  const rows = D.daily[b], byDow = {};
  for (const r of rows) (byDow[dt(r.date).getDay()] ||= []).push(r.net);
  const avg = k => { const a = byDow[k]||[]; return a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0; };
  const [y,m] = CUR.split('-').map(Number), last = new Date(y,m,0).getDate();
  let rest = 0;
  for (let d = +LAST.slice(8)+1; d<=last; d++) rest += avg(new Date(y,m-1,d).getDay());
  return rest;
}
function goalKey(){ return `tsbnote_goal_${S.br}_${CUR}`; }
function getGoal(){ const v = localStorage.getItem(goalKey()); return v ? +v : brs().reduce((s,b)=>s+(D.monthly[b][PREV]||0),0); }

// 카드·간편 입금 예정일 (shortcut: 공휴일 미반영. 규칙 = 토·일 매출은 금요일 묶음, 거래일+3영업일. 10/12~10/21 실제 입금과 일치)
function depositDate(s){
  const d = dt(s); const w = d.getDay();
  if (w===6) d.setDate(d.getDate()-1); if (w===0) d.setDate(d.getDate()-2);
  let k = 0; while (k<3){ d.setDate(d.getDate()+1); if (d.getDay()%6) k++; }
  return ds(d);
}
console.assert(depositDate('2026-10-16')==='2026-10-21' && depositDate('2026-10-18')==='2026-10-21' && depositDate('2026-10-19')==='2026-10-22' && depositDate('2026-10-21')==='2026-10-26', 'depositDate 규칙 확인');

// ---------- UI shell ----------
function shell(){
  document.getElementById('asof').textContent = `${md(LAST)} 마감 기준 · 갱신 ${D.generated}`;
  document.getElementById('chips').innerHTML = ['전체',...BR].map(b=>`<button class="chip ${S.br===b?'on':''}" onclick="S.br='${b}';S.sel=null;render()">${b==='전체'?'전체 지점':b}</button>`).join('');
  document.getElementById('nav').innerHTML = TABS.map(([k,t])=>`<button class="${S.tab===k?'on':''}" onclick="S.tab='${k}';render();scrollTo(0,0)">${t}</button>`).join('');
  document.getElementById('foot').innerHTML = `데이터: 지점별 일정산 v3 시트(직원 마감 입력) · POS자동 탭(SD포스·OK포스 새벽 수집) · 클로브 통장 라벨링 · POS 디스펜서 기록 · 금액은 VAT 포함 실매출(선불권 충전액 제외) · 탭샵바 전략기획실 내부용`;
}
function render(){ shell(); document.getElementById('chips').style.display = S.tab==='compare' ? 'none' : ''; document.getElementById('main').innerHTML = ({home,compare,book,cash,wine,check,map})[S.tab](); }

// ---------- 홈 ----------
function home(){
  const rows = series(), y = rows.find(r=>r.date===LAST) || {net:0,cnt:0};
  const lw = rows.find(r=>r.date===addDays(LAST,-7)) || {net:0};
  const cur = rows.filter(r=>r.date.startsWith(CUR)), curSum = sumF(cur,'net');
  const dayN = +LAST.slice(8);
  const prevSame = series().filter(r=>r.date.startsWith(PREV) && +r.date.slice(8)<=dayN);
  const prevSum = sumF(prevSame,'net');
  const fc = curSum + brs().reduce((s,b)=>s+forecast(b),0);
  const goal = getGoal();
  const ach = curSum/goal*100, fach = fc/goal*100;
  const cnt = sumF(cur,'cnt');
  // 브리핑 (규칙 기반 해석)
  const wk = brs().map(b=>{ const a = D.daily[b].find(r=>r.date===LAST), p = D.daily[b].find(r=>r.date===addDays(LAST,-7)); return {b, p: a&&p ? pct(a.net,p.net) : null}; }).filter(x=>x.p!=null).sort((a,b)=>a.p-b.p);
  const iss = issues().filter(i=>brs().includes(i.b));
  const brief = [
    `어제 ${md(LAST)} ${S.br==='전체'?'4개 지점':S.br} 실매출은 <b>${won(y.net)}</b>, 지난주 같은 요일보다 ${pctTxt(pct(y.net,lw.net))}.`,
    `이번 달 누적 <b>${man(curSum)}</b>원으로 10월 같은 기간(1~${dayN}일)보다 ${pctTxt(pct(curSum,prevSum))}.`,
    `지금 흐름이면 월말 <b>${eok(fc)}</b>원 예상, 목표 대비 <b>${fach.toFixed(0)}%</b>.`,
    S.br==='전체' && wk.length ? `전주 대비 가장 약한 곳은 <b>${wk[0].b}</b>(${pctTxt(wk[0].p)}), 가장 강한 곳은 <b>${wk.at(-1).b}</b>(${pctTxt(wk.at(-1).p)}).` : '',
    iss.length ? `정산 진단에서 확인할 것 <b>${iss.filter(i=>i.lv==='hi').length}건</b>(큰 차이) · 전체 ${iss.length}건 → <a href="#" style="color:#156DFF" onclick="S.tab='check';render();return false">정산 진단</a>` : ''
  ].filter(Boolean);
  // 최근 14일 막대
  const last14 = [];
  for (let i=13;i>=0;i--){ const d = addDays(LAST,-i); const r = rows.find(x=>x.date===d); last14.push({d, v: r? r.net:0}); }
  const dep = deposits().filter(x=>x.dep>LAST).slice(0,3);
  return `<div class="grid two">
  <div class="card brief span2"><h3>TOM 브리핑 <span class="pill own">AI</span></h3><ul>${brief.map(x=>`<li>${x}</li>`).join('')}</ul></div>
  <div class="card"><h3>어제 매출 <small>${md(LAST)}</small></h3>
    <div class="big">${won(y.net)}</div>
    <div class="sub">지난주 ${md(addDays(LAST,-7))} ${won(lw.net)} 대비 ${pctTxt(pct(y.net,lw.net))}</div>
    <div class="kv"><div><span>결제 건수</span><b>${fmt(y.cnt)}건</b></div><div><span>객단가(건당)</span><b>${y.cnt?won(y.net/y.cnt):'-'}</b></div><div><span>할인+서비스</span><b>${man((y.dc||0)+(y.svc||0))}</b></div></div>
    ${mixBar(y)}
  </div>
  <div class="card"><h3>이번 달 매출 <span>목표 <input class="goal" value="${fmt(goal)}" onchange="localStorage.setItem(goalKey(), this.value.replace(/[^0-9]/g,''));render()"></span></h3>
    <div class="big">${won(curSum)}</div>
    <div class="prog"><i class="ghost" style="width:${Math.min(fach,100)}%"></i><i style="width:${Math.min(ach,100)}%"></i></div>
    <div class="sub">달성률 <b>${ach.toFixed(1)}%</b> · 월말 예상 ${eok(fc)} (<b>${fach.toFixed(0)}%</b>) · 기본 목표 = 10월 실적, 칸에 바꿔 넣으면 저장돼요</div>
    <div class="kv"><div><span>영업일</span><b>${cur.length}일</b></div><div><span>일평균</span><b>${man(curSum/Math.max(cur.length,1))}</b></div><div><span>객단가</span><b>${cnt?won(curSum/cnt):'-'}</b></div></div>
  </div>
  <div class="card"><h3>최근 14일 실매출</h3>${barsSVG(last14)}</div>
  <div class="card"><h3>지점 랭킹 <small>이번 달 누적</small></h3>${ranking()}</div>
  <div class="card"><h3>들어올 돈 <small>카드·간편결제 정산 추정</small></h3>
    ${dep.length? dep.map(x=>`<div class="row"><span>${md(x.dep)}</span><b>${won(x.amt)}</b></div>`).join('') : '<div class="sub">예정 없음</div>'}
    <div class="note">수수료 차감 전 · 패스파인더22 IBK로 먼저 들어와요 · <a href="#" onclick="S.tab='cash';render();return false">자금 탭</a></div></div>
  <div class="card"><h3>선불권 잔액 <small>고객에게 갚아야 할 돈(부채)</small></h3>${prepaidRows()}</div>
  </div>`;
}
function mixBar(r){
  const parts = [['주류',r.liquor,'#156DFF'],['푸드',r.food,'#5B9BFF'],['커피/티',r.cafe,'#A9C8FF'],['쇼케이스',r.show,'#26334D'],['기타',r.etc,'#D1D6DB']];
  const t = parts.reduce((s,p)=>s+(p[1]||0),0) || 1;
  return `<div class="stack">${parts.map(p=>`<i style="width:${(p[1]||0)/t*100}%;background:${p[2]}"></i>`).join('')}</div>
  <div class="legend">${parts.filter(p=>p[1]).map(p=>`<span><i style="background:${p[2]}"></i>${p[0]} ${((p[1]||0)/t*100).toFixed(0)}%</span>`).join('')}</div>`;
}
function barsSVG(arr){
  const W=520,H=170,pad=24,max=Math.max(...arr.map(a=>a.v),1),bw=(W-pad)/arr.length;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%">${arr.map((a,i)=>{const h=a.v/max*(H-46); const w=dt(a.d).getDay(); return `<rect x="${pad/2+i*bw+3}" y="${H-24-h}" width="${bw-6}" height="${h}" rx="4" fill="${a.d===LAST?'#156DFF':'#D6E4FF'}"><title>${md(a.d)} ${won(a.v)}</title></rect>
  <text x="${pad/2+i*bw+bw/2}" y="${H-8}" font-size="10" text-anchor="middle" fill="${w===0?'#F04452':w===6?'#156DFF':'#8B95A1'}">${+a.d.slice(8)}</text>${a.v?`<text x="${pad/2+i*bw+bw/2}" y="${H-28-h}" font-size="9" text-anchor="middle" fill="#8B95A1">${Math.round(a.v/1e4)}</text>`:''}`}).join('')}</svg><div class="note">막대 위 숫자 = 만원</div>`;
}
function ranking(){
  const dayN = +LAST.slice(8);
  const r = BR.map(b=>{ const c = D.daily[b].filter(x=>x.date.startsWith(CUR)); const s = sumF(c,'net'), n = sumF(c,'cnt');
    const p = sumF(D.daily[b].filter(x=>x.date.startsWith(PREV)&&+x.date.slice(8)<=dayN),'net'); return {b,s,n,p,days:c.length}; }).sort((a,b)=>b.s-a.s);
  const max = r[0].s||1;
  return r.map((x,i)=>`<div class="row" style="${S.br!=='전체'&&S.br!==x.b?'opacity:.45':''}"><span style="width:70px"><b>${i+1}</b> ${x.b}</span><span style="flex:1;padding:0 10px"><i class="bar" style="width:${x.s/max*100}%;background:${BCOL[x.b]}"></i></span><span style="text-align:right;min-width:150px"><b>${man(x.s)}</b> ${pctTxt(pct(x.s,x.p))}<br><small>객단가 ${x.n?won(x.s/x.n):'-'} · ${x.days}일</small></span></div>`).join('') + `<div class="note">▲▼ = 10월 같은 기간(1~${dayN}일) 대비</div>`;
}
function prepaidRows(){
  return brs().map(b=>{ const p = D.prepaid[`${b}|${CUR}`]; if(!p) return ''; return `<div class="row"><span>${b} ${p.close<0?'<span class="pill red">마이너스</span>':''}</span><span style="text-align:right"><b>${won(p.close)}</b><br><small>이번 달 충전 ${man(p.charge)} · 사용 ${man(p.use)}</small></span></div>`; }).join('');
}

// ---------- 장부 ----------
function book(){
  const rows = series(), mrows = rows.filter(r=>r.date.startsWith(S.month));
  const [y,m] = S.month.split('-').map(Number), first = new Date(y,m-1,1).getDay(), last = new Date(y,m,0).getDate();
  const max = Math.max(...mrows.map(r=>r.net),1);
  const flagged = new Set(issues().filter(i=>brs().includes(i.b)&&i.lv==='hi').map(i=>i.date));
  let cells = DOW.map((d,i)=>`<div class="h" style="color:${i===0?'#F04452':i===6?'#156DFF':''}">${d}</div>`).join('') + '<div></div>'.repeat(first);
  for (let d=1; d<=last; d++){
    const s = `${S.month}-${String(d).padStart(2,'0')}`, r = mrows.find(x=>x.date===s);
    const a = r ? .12 + .78*r.net/max : 0, dark = a>.55;
    cells += `<div class="d ${r?'':'empty'} ${S.sel===s?'sel':''}" style="background:${r?`rgba(21,109,255,${a})`:'#F7F8FA'};color:${dark?'#fff':'inherit'}" ${r?`onclick="S.sel='${s}';render()"`:''}>${d}${r?`<b>${Math.round(r.net/1e4)}만</b>`:''}${flagged.has(s)?'<span class="flag"></span>':''}</div>`;
  }
  const tot = {}; for (const f of F) tot[f] = sumF(mrows,f);
  const sel = S.sel && rows.find(r=>r.date===S.sel);
  return `<div class="grid two">
  <div class="card"><h3>실적 캘린더 <span class="seg">${['2026-10','2026-11'].map(k=>`<button class="${S.month===k?'on':''}" onclick="S.month='${k}';S.sel=null;render()">${+k.slice(5)}월</button>`).join('')}</span></h3>
    <div class="cal">${cells}</div><div class="note">칸 숫자 = 실매출(만원), 진할수록 많이 판 날 · 빨간 점 = 정산 진단 큰 차이 · 날짜를 누르면 상세</div></div>
  <div class="card">${sel ? dayDetail(sel) : `<h3>${+S.month.slice(5)}월 요약</h3>${monthSummary(tot, mrows.length)}`}</div>
  <div class="card span2"><h3>월별 실매출 추이 <small>운영 중인 4개 지점, 2026년</small></h3>${monthlySVG()}</div>
  </div>`;
}
function monthSummary(t, days){
  return `<div class="big">${won(t.net)}</div><div class="sub">총매출(할인 전) ${won(t.gross)} · 영업일 ${days}일 · 일평균 ${man(t.net/Math.max(days,1))}</div>
  <div class="kv"><div><span>결제 건수</span><b>${fmt(t.cnt)}</b></div><div><span>객단가</span><b>${t.cnt?won(t.net/t.cnt):'-'}</b></div><div><span>할인율</span><b>${t.gross?((t.dc/t.gross)*100).toFixed(1):0}%</b></div></div>
  <h3 style="margin-top:16px">품목 구성</h3>${mixBar(t)}
  <h3 style="margin-top:16px">결제 수단</h3>${payBar(t)}`;
}
function payBar(r){
  const p = [['카드',r.card,'#156DFF'],['간편결제',r.easy+r.kakao,'#5B9BFF'],['현금',r.cash,'#A9C8FF'],['선불권 사용',r.prepaid_use,'#FFC94D'],['배달·식권·데일리샷',r.coupang+r.baemin+r.sikkwon+r.ds_store+r.ds_partner,'#26334D'],['계좌이체·지점전용·기타',r.transfer+r.branch_pay+r.other,'#D1D6DB']];
  const t = p.reduce((s,x)=>s+(x[1]||0),0)||1;
  return `<div class="stack">${p.map(x=>`<i style="width:${(x[1]||0)/t*100}%;background:${x[2]}"></i>`).join('')}</div><div class="legend">${p.filter(x=>x[1]).map(x=>`<span><i style="background:${x[2]}"></i>${x[0]} ${man(x[1])} (${((x[1]||0)/t*100).toFixed(0)}%)</span>`).join('')}</div>`;
}
function dayDetail(r){
  const by = Object.entries(r.by);
  return `<h3>${md(r.date)} 상세 <a href="#" onclick="S.sel=null;render();return false" style="font-size:12px">닫기</a></h3>
  <div class="big">${won(r.net)}</div><div class="sub">결제 ${fmt(r.cnt)}건 · 객단가 ${r.cnt?won(r.net/r.cnt):'-'} · 할인 ${man(r.dc)} · 서비스 ${man(r.svc)}</div>
  ${mixBar(r)}${payBar(r)}
  ${by.length>1?`<table style="margin-top:12px"><tr><th>지점</th><th class="n">실매출</th><th class="n">건수</th><th class="n">객단가</th></tr>${by.map(([b,x])=>`<tr><td>${b}</td><td class="n">${fmt(x.net)}</td><td class="n">${x.cnt}</td><td class="n">${x.cnt?fmt(x.net/x.cnt):'-'}</td></tr>`).join('')}</table>`:''}`;
}
function monthlySVG(){
  const months = ['01','02','03','04','05','06','07','08','09','10','11'].map(m=>'2026-'+m);
  const fc = {}; for (const b of BR) fc[b] = forecast(b);
  const vals = months.map(m=>BR.map(b=>({b, v:(D.monthly[b][m]||0), f: m===CUR ? fc[b] : 0})));
  const tot = vals.map(v=>v.reduce((s,x)=>s+(brs().includes(x.b)?x.v+x.f:0),0));
  const W=1000,H=260,max=Math.max(...tot,1),bw=W/months.length;
  let g = '';
  vals.forEach((v,i)=>{ let yv = H-30;
    for (const x of v){ if(!brs().includes(x.b)) continue; const h = x.v/max*(H-60); yv -= h; g += `<rect x="${i*bw+14}" y="${yv}" width="${bw-28}" height="${h}" fill="${BCOL[x.b]}"><title>${months[i]} ${x.b} ${won(x.v)}</title></rect>`; }
    const f = v.reduce((s,x)=>s+(brs().includes(x.b)?x.f:0),0);
    if (f){ const h = f/max*(H-60); yv -= h; g += `<rect x="${i*bw+14}" y="${yv}" width="${bw-28}" height="${h}" fill="none" stroke="#156DFF" stroke-dasharray="4 3"><title>남은 기간 예상 ${won(f)}</title></rect>`; }
    g += `<text x="${i*bw+bw/2}" y="${yv-6}" font-size="12" text-anchor="middle" font-weight="700">${(tot[i]/1e8).toFixed(1)}억</text><text x="${i*bw+bw/2}" y="${H-10}" font-size="12" text-anchor="middle" fill="#8B95A1">${+months[i].slice(5)}월</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%">${g}</svg><div class="legend">${brs().map(b=>`<span><i style="background:${BCOL[b]}"></i>${b}</span>`).join('')}<span><i style="border:1px dashed #156DFF"></i>11월 남은 기간 예상</span></div>
  <div class="note">상암 3월, 마곡 7월 개점 · 폐점 지점(합정·도산대로·여의도)은 빠져 있어요 · 9월 이전은 옛 시트 형식(선불권 판매가 매출에 포함돼 10월부터와 기준이 조금 달라요)</div>`;
}

// ---------- 자금 ----------
function deposits(){
  const m = {};
  for (const b of brs()) { if (b==='동대문') continue;   // 동대문(두타·OK포스) 정산 경로 확인 전이라 제외
    for (const r of D.daily[b]) { const k = depositDate(r.date); (m[k] ||= {dep:k, amt:0, src:[]}); m[k].amt += r.card + r.easy + r.kakao; m[k].src.push(`${b} ${md(r.date)}`); } }
  return Object.values(m).sort((a,b)=>a.dep<b.dep?-1:1);
}
function cash(){
  const dep = deposits(), up = dep.filter(x=>x.dep>LAST), past = dep.filter(x=>x.dep<=LAST && x.dep>addDays(LAST,-10));
  return `<div class="grid two">
  <div class="card"><h3>들어올 돈 <small>카드·간편결제 매출 → 정산 입금 추정</small></h3>
    <div class="big">${won(up.reduce((s,x)=>s+x.amt,0))}</div><div class="sub">이미 마감된 매출 기준, 앞으로 들어올 금액</div>
    ${up.map(x=>`<div class="row"><span>${md(x.dep)}<br><small>${x.src.length>4? x.src.slice(0,2).join(', ')+` 외 ${x.src.length-2}건` : x.src.join(', ')}</small></span><b>${won(x.amt)}</b></div>`).join('')}
    <div class="note">규칙: 거래일 + 3영업일, 토·일 매출은 금요일 묶음과 함께 (10월 실제 입금과 대조해 정함) · 수수료 차감 전 · 공휴일 미반영 · 동대문 제외 · 국내 카드분은 '패스파인더 &lt;지점&gt;' 이름으로 패스파인더22 IBK에 먼저 입금 → 탭샵바 새마을로 옮겨야 사용 가능</div></div>
  <div class="card"><h3>최근 들어왔어야 할 돈 <span class="pill part">입금 확인은 다음 단계</span></h3>
    ${past.map(x=>`<div class="row"><span>${md(x.dep)}</span><b>${won(x.amt)}</b></div>`).join('')}
    <div class="note">캐시노트의 '입금 확인'처럼 실제 통장 입금과 맞춰 보려면 클로브 통장 내역(IBK)을 붙이면 돼요. 지금은 예상 금액만.</div></div>
  <div class="card"><h3>선불권 부채 <small>${+CUR.slice(5)}월</small></h3>${prepaidRows()}
    <div class="note">10/1부터 선불권은 충전 때 매출이 아니라 부채로 잡고, 쓸 때 매출로 인식해요. 마곡 마이너스는 10월 전에 충전된 금액이 쓰이는 것으로 보여 이월 잔액 확인이 필요해요.</div></div>
  <div class="card"><h3>매장 현금 시재 <small>일정산 '현금잔액' 마지막 값</small></h3>
    ${brs().map(b=>{ const r = D.daily[b].at(-1); return `<div class="row"><span>${b}<br><small>${r?md(r.date):''}</small></span><b>${r? won(r.cash_bal):'-'}</b></div>`; }).join('')}</div>
  ${clobeCards()}
  </div>`;
}

// ---------- 정산 진단 (캐시노트 '미지급 진단' 벤치마크) ----------
function issues(){
  const out = [];
  for (const b of BR){
    for (const p of (D.posdiff[b]||[])){
      const big = Object.values(p.diffs).filter(v=>Math.abs(v)>=1000);
      if (p.miss>=10) { out.push({b, date:p.date, lv:'low', kind:'입력 없음', text:`POS·시트 모두 매출 없음 (휴무로 보임)`}); continue; }
      if (!big.length && !p.miss) continue;
      const mx = Math.max(0,...big.map(Math.abs));
      out.push({b, date:p.date, lv: mx>=100000?'hi':'mid', kind:'POS ↔ 입력', amt:mx,
        text: Object.entries(p.diffs).filter(([k,v])=>!k.startsWith('J')||Math.abs(v)>=3).map(([k,v])=>`${k.replace(/^[A-Z~]+ /,'')} ${v>0?'+':''}${fmt(v)}`).join(' · ') + (p.miss?` · 빈칸 ${p.miss}개`:'')});
    }
    for (const r of D.daily[b]) if (r.date.startsWith(CUR) && Math.abs(r.diff_pay)>=1000 && !out.some(o=>o.b===b&&o.date===r.date&&o.kind==='POS ↔ 입력'))
      out.push({b, date:r.date, lv: Math.abs(r.diff_pay)>=100000?'hi':'mid', kind:'결제수단 합 차이', amt:Math.abs(r.diff_pay), text:`결제수단 합계 − 매출 = ${fmt(r.diff_pay)}`});
    const pp = D.prepaid[`${b}|${CUR}`]; if (pp && pp.close<0) out.push({b, date:CUR+'-01', lv:'mid', kind:'선불권 잔액', text:`월 잔액이 ${won(pp.close)} (마이너스)`});
  }
  return out;
}
function check(){
  const all = issues().filter(i=>brs().includes(i.b));
  const by = b => all.filter(i=>i.b===b);
  const pattern = {
    청계: '할인(K) − / 임의매출현금(P~T) + 가 같은 금액으로 반복돼요. 데일리샷·식권대장 같은 임의매출을 "할인" 칸에 넣는 습관으로 보여요.',
    상암: '선불권 사용(H)이 매일 POS보다 많이 입력돼요(터칭 사용분을 같이 넣는 듯). 간편결제 칸은 계속 빈칸이에요.',
    마곡: '대부분 작은 차이예요. 11/4 품목 합계(푸드·주류)가 POS보다 적게 입력됐어요.',
    동대문: '쇼케이스·서비스 칸의 작은 차이와, 11/2 카드 77,040원이 "기타 결제"로 들어간 건이 있어요.'
  };
  return `<div class="grid two">
  <div class="card span2"><h3>정산 진단 <span class="pill own">TSBnote</span></h3>
    <div class="big">${all.filter(i=>i.lv==='hi').length}<span style="font-size:16px;font-weight:600"> 건 큰 차이</span> <span style="font-size:16px;color:var(--gray);font-weight:500">/ 전체 ${all.length}건</span></div>
    <div class="sub">캐시노트 '미지급 진단'은 카드사 매입·입금 누락을 잡아요. 우리는 먼저 <b>POS(SD포스·OK포스) 숫자 ↔ 직원이 시트에 넣은 숫자</b>를 매일 자동으로 맞춰 봐요. 차이 = POS − 입력 (+면 입력 누락, −면 더 많이 입력).</div></div>
  ${brs().map(b=>`<div class="card"><h3>${b} <span>${by(b).filter(i=>i.lv==='hi').length? `<span class="pill red">큰 차이 ${by(b).filter(i=>i.lv==='hi').length}</span>`:'<span class="pill ok">양호</span>'}</span></h3>
    <div class="sub" style="margin-bottom:8px"><b>패턴</b> ${pattern[b]}</div>
    ${by(b).sort((x,y)=>x.date<y.date?1:-1).map(i=>`<div class="issue lv-${i.lv}"><b>${md(i.date)}</b> <small>${i.kind}</small><br>${i.text}</div>`).join('') || '<div class="sub">차이 없음</div>'}</div>`).join('')}
  </div>`;
}

// ---------- 매장 비교 (토스플레이스 본사 대시보드 벤치마크) ----------
const FIRST = BR.flatMap(b=>D.daily[b].map(r=>r.date)).sort()[0];   // 일자 상세가 있는 첫날 (2026-10-01)
const monday = s => { const d = dt(s); const w = (d.getDay()+6)%7; d.setDate(d.getDate()-w); return ds(d); };
const monthEnd = ym => { const [y,m] = ym.split('-').map(Number); return ds(new Date(y,m,0)); };
const shiftMonth = (s,k) => { const d = dt(s), day = d.getDate(); const t = new Date(d.getFullYear(), d.getMonth()+k, 1); t.setDate(Math.min(day, new Date(t.getFullYear(), t.getMonth()+1, 0).getDate())); return ds(t); };
const PRESETS = {
  yday:  ['어제',   () => [LAST, LAST]],
  tweek: ['이번 주', () => [monday(LAST), LAST]],
  lweek: ['지난주', () => [addDays(monday(LAST),-7), addDays(monday(LAST),-1)]],
  tmon:  ['이번 달', () => [CUR+'-01', LAST]],
  lmon:  ['지난달', () => [PREV+'-01', monthEnd(PREV)]],
};
S.cmp = { view:'store', preset:'tmon', from:CUR+'-01', to:LAST, unit:'day', stores:[...BR], sort:null, open:false, cols:{} };
// 비교 기간: 1일부터면 한 달 전 같은 날짜, 아니면 같은 길이만큼 바로 앞
function prevRange(f,t){ if (f.slice(8)==='01') return [shiftMonth(f,-1), shiftMonth(t,-1)];
  const n = Math.round((dt(t)-dt(f))/864e5)+1; return [addDays(f,-n), addDays(f,-1)]; }
const inR = (b,f,t) => D.daily[b].filter(r=>r.date>=f && r.date<=t);
const sumRows = (rows,keys) => rows.reduce((s,r)=>s+keys.reduce((x,k)=>x+(r[k]||0),0),0);
const M = {   // 지표 정의: [이름, 계산(rows), 표시]
  net:['실매출', r=>sumRows(r,['net']), 'won'], gross:['총매출(할인 전)', r=>sumRows(r,['gross']), 'won'], cnt:['결제건수', r=>sumRows(r,['cnt']), 'n'],
  aov:['객단가(실매출÷건수)', r=>{const c=sumRows(r,['cnt']); return c? sumRows(r,['net'])/c : null;}, 'won'],
  days:['영업일', r=>r.length, 'n'], perDay:['일평균', r=>r.length? sumRows(r,['net'])/r.length : null, 'won'],
  dc:['할인', r=>sumRows(r,['dc']), 'won'], svc:['서비스', r=>sumRows(r,['svc']), 'won'],
  card:['카드', r=>sumRows(r,['card']), 'won'], easy:['간편결제', r=>sumRows(r,['easy','kakao']), 'won'], cash:['현금', r=>sumRows(r,['cash']), 'won'],
  prepaid_use:['선불권 사용', r=>sumRows(r,['prepaid_use']), 'won'], delivery:['배달(배민·쿠팡)', r=>sumRows(r,['coupang','baemin']), 'won'],
  sikkwon:['식권대장', r=>sumRows(r,['sikkwon']), 'won'], dailyshot:['데일리샷', r=>sumRows(r,['ds_store','ds_partner']), 'won'],
  transfer:['계좌이체', r=>sumRows(r,['transfer']), 'won'], branch_pay:['지점 전용(두타 상품권)', r=>sumRows(r,['branch_pay']), 'won'], other:['기타 결제', r=>sumRows(r,['other']), 'won'],
  charge:['선불권 충전', r=>sumRows(r,['charge']), 'won'],
};
const VIEWS = {
  store:  ['매장별',     ['net','gross','cnt','aov','days','perDay','share','vs'], ['dc','svc','prepaid_use','charge','card','cash']],
  period: ['기간별',     ['net','cnt','aov','st'], ['gross','dc','svc','card','easy','cash','prepaid_use','delivery','dailyshot']],
  cat:    ['카테고리별', ['st','sum','share'], []],
  pay:    ['결제수단별', ['net','card','easy','cash','prepaid_use','delivery','sikkwon','dailyshot','transfer','branch_pay','other','cardShare'], []],
};
const XL = {share:'비중', vs:'전기 대비', st:'매장별 실매출', sum:'합계', cardShare:'카드 비중'};
const colsOf = v => S.cmp.cols[v] || (S.cmp.cols[v] = [...VIEWS[v][1]]);
const fmtV = (v,f) => v==null||Number.isNaN(v) ? '-' : f==='pct' ? (v>=0?'+':'')+v.toFixed(1)+'%' : f==='share' ? v.toFixed(1)+'%' : fmt(v);

function cmpTable(){
  const {view, from, to, stores, unit} = S.cmp, cols = colsOf(view);
  const [pf, pt] = prevRange(from, to);
  let head = [], rows = [], total = null, note = '';
  if (view==='store'){
    const tot = stores.reduce((s,b)=>s+M.net[1](inR(b,from,to)),0);
    head = cols.map(k=>[k, M[k]?.[0] || XL[k]]);
    rows = stores.map(b=>{ const r = inR(b,from,to), p = inR(b,pf,pt), v = {};
      for (const k of cols) v[k] = k==='share' ? (tot? M.net[1](r)/tot*100 : null) : k==='vs' ? (pf>=FIRST && p.length ? pct(M.net[1](r), M.net[1](p)) : null) : M[k][1](r);
      return {label:b, v, color:BCOL[b]}; });
    const all = stores.flatMap(b=>inR(b,from,to)), allP = stores.flatMap(b=>inR(b,pf,pt)), tv = {};
    for (const k of cols) tv[k] = k==='share' ? 100 : k==='vs' ? (pf>=FIRST && allP.length ? pct(M.net[1](all), M.net[1](allP)) : null) : k==='days' ? null : k==='perDay' ? (new Set(all.map(r=>r.date)).size ? M.net[1](all)/new Set(all.map(r=>r.date)).size : null) : M[k][1](all);
    total = {label:'합계', v:tv};
    note = `전기 대비 = ${md(pf)}~${md(pt)} 실매출과 비교`;
  } else if (view==='period'){
    const exp = cols.flatMap(k=>k==='st' ? stores.map(b=>'st_'+b) : [k]);
    head = exp.map(k=>[k, k.startsWith('st_') ? k.slice(3) : M[k][0]]);
    if (unit==='month'){
      const months = Object.keys(D.monthly['청계']).concat(...BR.map(b=>Object.keys(D.monthly[b]))).filter((x,i,a)=>a.indexOf(x)===i).sort();
      rows = months.map(m=>{ const v = {}; for (const k of exp) v[k] = k.startsWith('st_') ? (D.monthly[k.slice(3)][m] ?? null) : k==='net' ? stores.reduce((s,b)=>s+(D.monthly[b][m]||0),0) : (m>='2026-10' ? M[k][1](stores.flatMap(b=>D.daily[b].filter(r=>r.date.startsWith(m)))) : null); return {label:`${+m.slice(5)}월${m===CUR?' (진행 중)':''}`, v}; });
      note = '월별은 기간 칩과 상관없이 2026년 전체 · 9월 이전은 실매출만 있어요 (옛 시트 형식)';
    } else {
      const key = r => unit==='week' ? monday(r.date) : r.date, bk = {};
      for (const b of stores) for (const r of inR(b,from,to)) (bk[key(r)] ||= {}) && ((bk[key(r)][b] ||= []).push(r));
      rows = Object.keys(bk).sort().map(k=>{ const all = Object.values(bk[k]).flat(), v = {};
        for (const c of exp) v[c] = c.startsWith('st_') ? (bk[k][c.slice(3)] ? M.net[1](bk[k][c.slice(3)]) : null) : M[c][1](all);
        return {label: unit==='week' ? `${md(k)} 주` : md(k), v, sortKey:k}; });
      const all = stores.flatMap(b=>inR(b,from,to)), tv = {};
      for (const c of exp) tv[c] = c.startsWith('st_') ? M.net[1](inR(c.slice(3),from,to)) : M[c][1](all);
      total = {label:'합계', v:tv};
      if (unit==='week') note = '주 = 월요일 시작';
    }
  } else if (view==='cat'){
    const C = [['주류','liquor'],['푸드','food'],['커피/티','cafe'],['쇼케이스','show'],['기타','etc']];
    head = [...stores.map(b=>['st_'+b, b]), ['sum','합계'], ['share','점유율']];
    const grand = stores.reduce((s,b)=>s+sumRows(inR(b,from,to),C.map(c=>c[1])),0);
    rows = C.map(([n,f])=>{ const v = {}; let s = 0; for (const b of stores){ v['st_'+b] = sumRows(inR(b,from,to),[f]); s += v['st_'+b]; } v.sum = s; v.share = grand? s/grand*100 : null; return {label:n, v}; });
    const tv = {sum:grand, share:100}; for (const b of stores) tv['st_'+b] = sumRows(inR(b,from,to),C.map(c=>c[1])); total = {label:'합계', v:tv};
    note = '품목 금액 = POS 카테고리 그대로 (선불권 사용분 포함 전)';
  } else {
    head = cols.map(k=>[k, M[k]?.[0] || XL[k]]);
    const mk = r => { const v = {}; for (const k of cols) v[k] = k==='cardShare' ? (M.net[1](r)? M.card[1](r)/M.net[1](r)*100 : null) : M[k][1](r); return v; };
    rows = stores.map(b=>({label:b, v:mk(inR(b,from,to)), color:BCOL[b]}));
    total = {label:'합계', v:mk(stores.flatMap(b=>inR(b,from,to)))};
    note = '카드 = 국내·해외 카드 합 · 간편결제 = 제로페이·카카오페이 등';
  }
  const s = S.cmp.sort; if (s) rows.sort((a,b)=>((a.v[s.k]??-1e18)-(b.v[s.k]??-1e18))*s.d);
  const kind = k => k==='vs' ? 'pct' : (k==='share'||k==='cardShare') ? 'share' : 'n';
  S.cmp._csv = [['', ...head.map(h=>h[1])], ...(total?[[total.label, ...head.map(([k])=>total.v[k]??'')]]:[]), ...rows.map(r=>[r.label, ...head.map(([k])=>r.v[k]==null?'':Math.round(r.v[k]*10)/10)])];
  const maxShare = Math.max(...rows.map(r=>r.v.share||0), 1);
  const cell = (r,k) => { const v = r.v[k]; if (k==='vs' && v!=null) return `<td class="n"><span class="${v>=0?'up':'down'}">${fmtV(v,'pct')}</span></td>`;
    if (k==='share' && v!=null && r.label!=='합계') return `<td class="n"><span class="sbar"><i style="width:${v/maxShare*100}%"></i></span>${fmtV(v,'share')}</td>`;
    return `<td class="n">${fmtV(v, kind(k))}</td>`; };
  return `<div class="tw"><table class="dt"><thead><tr><th>${view==='period'?(unit==='month'?'월':unit==='week'?'주':'일자'):view==='cat'?'카테고리':'매장'}</th>${head.map(([k,l])=>`<th class="n sort" onclick="cmpSort('${k}')">${l}${s&&s.k===k?(s.d>0?' ↑':' ↓'):' <span class="si">⇅</span>'}</th>`).join('')}</tr></thead>
  <tbody>${total?`<tr class="tot"><td>${total.label}</td>${head.map(([k])=>cell(total,k)).join('')}</tr>`:''}${rows.map(r=>`<tr><td>${r.color?`<i class="dot" style="background:${r.color}"></i>`:''}${r.label}</td>${head.map(([k])=>cell(r,k)).join('')}</tr>`).join('')}</tbody></table></div>
  <div class="note">${note}</div>`;
}
function cmpSet(o){ Object.assign(S.cmp, o); render(); }
function cmpSort(k){ const s = S.cmp.sort; S.cmp.sort = s&&s.k===k ? (s.d<0 ? {k,d:1} : null) : {k,d:-1}; render(); }
function cmpPreset(p){ const [f,t] = PRESETS[p][1](); cmpSet({preset:p, from:f<FIRST?FIRST:f, to:t}); }
function cmpStore(b){ const st = S.cmp.stores; const n = st.includes(b) ? st.filter(x=>x!==b) : BR.filter(x=>st.includes(x)||x===b); if (n.length) cmpSet({stores:n}); }
function cmpCol(k){ const c = colsOf(S.cmp.view); S.cmp.cols[S.cmp.view] = c.includes(k) ? c.filter(x=>x!==k) : [...c, k]; render(); }
function cmpCsv(){ const csv = '\ufeff' + S.cmp._csv.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = `TSBnote_${VIEWS[S.cmp.view][0]}_${S.cmp.from}_${S.cmp.to}.csv`; a.click(); }
function compare(){
  const c = S.cmp, v = VIEWS[c.view], opt = [...v[1], ...v[2]].filter(k=>k!=='st'||c.view==='period');
  return `<div class="cmp"><aside class="side">${Object.entries(VIEWS).map(([k,x])=>`<button class="${c.view===k?'on':''}" onclick="cmpSet({view:'${k}',sort:null})">${x[0]}</button>`).join('')}</aside>
  <div class="card body"><h3 style="font-size:20px">${v[0]} 매출</h3>
    ${c.view==='period'?`<div class="subtabs">${[['day','일자별'],['week','주별'],['month','월별']].map(([k,l])=>`<button class="${c.unit===k?'on':''}" onclick="cmpSet({unit:'${k}',sort:null})">${l}</button>`).join('')}</div>`:''}
    <div class="fbar">${Object.entries(PRESETS).map(([k,[l]])=>`<button class="fchip ${c.preset===k?'on':''}" onclick="cmpPreset('${k}')">${l}</button>`).join('')}
      <span class="range"><input type="date" value="${c.from}" min="${FIRST}" max="${LAST}" onchange="cmpSet({preset:null,from:this.value})"> ~ <input type="date" value="${c.to}" min="${FIRST}" max="${LAST}" onchange="cmpSet({preset:null,to:this.value})"></span></div>
    <div class="fbar">${BR.map(b=>`<button class="fchip ${c.stores.includes(b)?'on':''}" onclick="cmpStore('${b}')">${c.stores.includes(b)?'✓ ':''}${b}</button>`).join('')}
      <span style="flex:1"></span>
      ${opt.length?`<span class="dd"><button class="fchip" onclick="cmpSet({open:!S.cmp.open})">☰ 항목 추가·삭제 ▾</button>${c.open?`<div class="menu">${opt.map(k=>`<label><input type="checkbox" ${colsOf(c.view).includes(k)?'checked':''} onchange="cmpCol('${k}')"> ${M[k]?.[0]||XL[k]}</label>`).join('')}</div>`:''}</span>`:''}
      <button class="fchip" onclick="cmpCsv()">⬇ 엑셀 다운로드</button></div>
    ${cmpTable()}
  </div></div>`;
}

// ---------- 자금 추가: 클로브 통장 (카드 정산 이체 대조, 지점 출금) ----------
function clobeCards(){
  const C = D.clobe; if (!C) return '';
  // 예상 카드·간편 입금(청계·상암·마곡) 누계 vs 패스파인더22 → 탭샵바 이체 누계
  const end = LAST, start = '2026-10-01', days = [];
  for (let d = start; d <= end; d = addDays(d,1)) days.push(d);
  const exp = {}; for (const b of ['청계','상암','마곡']) for (const r of D.daily[b]) { const k = depositDate(r.date); exp[k] = (exp[k]||0) + r.card + r.easy + r.kakao; }
  const got = {}; for (const x of C.pfin) got[x.date] = (got[x.date]||0) + x.amt;
  let a = 0, g = 0; const ser = days.map(d=>({d, e:(a += exp[d]||0), g:(g += got[d]||0)}));
  const W=520,H=190,max=Math.max(a,g,1), X=i=>20+i*(W-40)/(days.length-1), Y=v=>H-24-v/max*(H-50);
  const line = k => ser.map((p,i)=>`${i?'L':'M'}${X(i).toFixed(1)},${Y(p[k]).toFixed(1)}`).join('');
  const chart = `<svg viewBox="0 0 ${W} ${H}" width="100%"><path d="${line('e')}" fill="none" stroke="#A9C8FF" stroke-width="3"/><path d="${line('g')}" fill="none" stroke="#156DFF" stroke-width="3"/>
    ${[0, Math.floor(days.length/2), days.length-1].map(i=>`<text x="${X(i)}" y="${H-6}" font-size="11" text-anchor="middle" fill="#8B95A1">${md(days[i])}</text>`).join('')}</svg>`;
  // 지점 출금
  const G = ['청계','상암','마곡','동대문','본사','서여의도','폐점(도산·여의도·합정)','라벨 없음'];
  const grp = g => g.startsWith('폐점') ? ['도산','여의도','합정'] : [g];
  const A = ['급여','주류 매입','임차료'];
  const sumG = (g,acc) => grp(g).reduce((s,x)=>s+((C.cost[x]||{})[acc]||0),0);
  const totG = g => grp(g).reduce((s,x)=>s+Object.values(C.cost[x]||{}).reduce((p,q)=>p+q,0),0);
  const sales = b => BR.includes(b) ? sumF(D.daily[b].filter(r=>r.date>=start),'net') : null;
  return `<div class="card"><h3>카드 정산금 이체 대조 <span class="pill part">참고용</span></h3>
    <div class="kv" style="margin-top:0"><div><span>예상 카드·간편 입금 누계</span><b>${eok(a)}</b></div><div><span>패스파인더22 → 탭샵바 이체 누계</span><b>${eok(g)}</b></div><div><span>차이</span><b class="${g-a>=0?'up':'down'}">${man(g-a)}</b></div></div>
    ${chart}<div class="legend"><span><i style="background:#A9C8FF"></i>예상 입금 누계 (청계·상암·마곡 카드·간편)</span><span><i style="background:#156DFF"></i>실제 이체 누계 (클로브 통장)</span></div>
    <div class="note">카드 정산금은 패스파인더22 IBK로 먼저 들어오고, 필요할 때 탭샵바 새마을로 옮겨요. 그래서 두 선의 차이에는 9월 말 매출분 입금(10월 초 도착), 동대문 정산분, 패스파인더22 자체 자금, 그쪽에서 바로 나간 돈, 카드사 미입금이 섞여 있어요. 정확한 미입금 확인은 패스파인더22 IBK 통장·여신금융협회 자료를 붙이면 돼요. 10/1~${md(end)} 기준.</div></div>
  <div class="card span2"><h3>지점별 통장 출금 <small>클로브 그룹 라벨 · ${C.period.slice(4,6)}/${C.period.slice(6,8)}~${C.period.slice(13,15)}/${C.period.slice(15,17)} · 현금 기준</small></h3>
    <div class="tw"><table class="dt"><thead><tr><th>지점</th><th class="n">실매출(일정산)</th>${A.map(x=>`<th class="n">${x}</th>`).join('')}<th class="n">그 외</th><th class="n">출금 합계</th><th class="n">출금 ÷ 매출</th></tr></thead><tbody>
    ${G.map(g=>{ const t = totG(g), s = sales(g), parts = A.map(x=>sumG(g,x)); return `<tr><td>${BCOL[g]?`<i class="dot" style="background:${BCOL[g]}"></i>`:''}${g}</td><td class="n">${s==null?'-':fmt(s)}</td>${parts.map(v=>`<td class="n">${v?fmt(v):'-'}</td>`).join('')}<td class="n">${fmt(t-parts.reduce((p,q)=>p+q,0))}</td><td class="n"><b>${fmt(t)}</b></td><td class="n">${s? (t/s*100).toFixed(0)+'%' : '-'}</td></tr>`; }).join('')}
    </tbody></table></div>
    <div class="note">통장에서 나간 날 기준이라 손익(발생 기준)과 달라요. 10/30 점포 9월 급여처럼 지난달 몫이 이번 기간에 나가기도 하고, 회생 허가가 늦어 못 나간 비용은 빠져 있어요. '라벨 없음' ${man(totG('라벨 없음'))}원은 클로브에서 지점 그룹이 안 붙은 출금이라 그룹 규칙을 보강하면 지점별로 더 정확해져요.</div></div>`;
}

// ---------- 와인 재고 (BinWise 벤치마크) ----------
S.wp = 'tmon';
function wineRange(){ return S.wp==='tmon' ? [CUR+'-01', '9999'] : S.wp==='lmon' ? [PREV+'-01', monthEnd(PREV)] : [addDays(D.wine.asof.replace(/(\d{4})(\d\d)(\d\d)/,'$1-$2-$3'),-30), '9999']; }
function wine(){
  const W = D.wine; if (!W) return '<div class="card">디스펜서 데이터가 없어요.</div>';
  const bs = brs(), slots = W.slots.filter(x=>bs.includes(x.b)), [f,t] = wineRange();
  const rep = W.rep.filter(x=>bs.includes(x.b) && x.t>=f && x.t<=t);
  const low = slots.filter(x=>x.ml<150), empty = slots.filter(x=>x.ml<=0);
  const val = r => r.ml/10*r.p10;
  const asof = W.asof.replace(/(\d{4})(\d\d)(\d\d)/,'$1-$2-$3');
  const stale = slots.filter(x=>x.ml>0 && x.last && x.last < addDays(asof,-30)).sort((a,b)=>a.last<b.last?-1:1);
  // 와인별 집계
  const byW = {}; for (const r of rep){ const o = byW[r.w] ||= {w:r.w, n:0, ml:0, v:0, bs:new Set()}; o.n++; o.ml += r.ml; o.v += val(r); o.bs.add(r.b); }
  const top = Object.values(byW).sort((a,b)=>b.n-a.n||b.v-a.v).slice(0,10);
  // par: 9/1~ 주평균 교체 병수 × 1.5 (주 1회 발주 가정)
  const weeks = (dt(asof)-dt('2026-09-01'))/864e5/7, pw = {};
  for (const r of W.rep.filter(x=>bs.includes(x.b))) { const k = r.w+'|'+(bs.length>1?'전체':r.b); pw[k] = (pw[k]||0)+1; }
  const par = Object.entries(pw).map(([k,c])=>({w:k.split('|')[0], avg:c/weeks})).sort((a,b)=>b.avg-a.avg).slice(0,12);
  const brCmp = bs.map(b=>{ const x = rep.filter(r=>r.b===b); return {b, n:x.length, v:x.reduce((s,r)=>s+val(r),0), slots:W.slots.filter(s=>s.b===b).length}; });
  const mx = Math.max(...brCmp.map(x=>x.n),1);
  const seg = `<span class="seg">${[['tmon','이번 달'],['lmon','지난달'],['d30','최근 30일']].map(([k,l])=>`<button class="${S.wp===k?'on':''}" onclick="S.wp='${k}';render()">${l}</button>`).join('')}</span>`;
  const heat = bs.map(b=>{ const ds = {}; for (const s of W.slots.filter(x=>x.b===b)) (ds[s.d] ||= []).push(s);
    return `<div style="margin:10px 0 4px;font-weight:700;font-size:14px"><i class="dot" style="background:${BCOL[b]}"></i>${b} <small style="color:var(--gray);font-weight:500">디스펜서 ${Object.keys(ds).length}대 · 슬롯 ${W.slots.filter(x=>x.b===b).length}개</small></div>
    <div class="slots">${Object.entries(ds).sort().map(([d,arr])=>`<div class="disp" title="${arr[0].title}">${arr.sort((x,y)=>x.s-y.s).map(s=>{ const r = Math.max(0,Math.min(1,s.ml/s.cap)); const c = s.ml<150 ? '#F04452' : `rgba(21,109,255,${.15+.85*r})`; return `<i style="background:${c}" title="${s.w||'와인 미상'} · ${s.ml}ml · 마지막 교체 ${s.last||'-'}"></i>`; }).join('')}</div>`).join('')}</div>`; }).join('');
  return `<div class="grid two">
  <div class="card span2"><h3>와인·푸드 원가와 재고 <span class="pill own">BinWise 방식</span></h3>
    <div class="kv" style="grid-template-columns:repeat(4,1fr);margin-top:0"><div><span>탭 슬롯</span><b>${slots.length}개</b></div><div><span>거의 빔 (150ml 미만)</span><b class="down">${low.length}개</b></div><div><span>교체 병수 (${S.wp==='tmon'?'이번 달':S.wp==='lmon'?'지난달':'최근 30일'})</span><b>${rep.length}병</b></div><div><span>교체분 판매가치</span><b>${man(rep.reduce((s,r)=>s+val(r),0))}</b></div></div>
    <div class="note">판매가치 = 교체한 병 용량 × 10ml당 판매가 (다 팔렸을 때 받을 돈). POS 디스펜서 기록 기준 · 잔량 ${md(asof)} 현재</div></div>
  <div class="card span2"><h3>탭 잔량 지도 <small>칸 하나 = 슬롯 하나, 진할수록 많이 남음, 빨강 = 150ml 미만 · 칸에 마우스를 올리면 와인 이름</small></h3>${heat}</div>
  <div class="card"><h3>지점별 교체 병수 ${seg}</h3>
    ${brCmp.map(x=>`<div class="row"><span style="width:70px">${x.b}</span><span style="flex:1;padding:0 10px"><i class="bar" style="width:${x.n/mx*100}%;background:${BCOL[x.b]}"></i></span><span style="text-align:right;min-width:130px"><b>${x.n}병</b><br><small>판매가치 ${man(x.v)} · 슬롯 ${x.slots}개</small></span></div>`).join('')}
    <div class="note">슬롯 수 대비 교체가 적으면 탭이 천천히 도는 지점이에요.</div></div>
  <div class="card"><h3>많이 나간 와인 TOP 10 <small>교체 병수 기준</small></h3>
    <table class="dt"><thead><tr><th>와인</th><th class="n">병</th><th class="n">판매가치</th></tr></thead><tbody>${top.map(x=>`<tr><td>${x.w}${bs.length>1?`<br><small style="color:var(--gray)">${[...x.bs].join('·')}</small>`:''}</td><td class="n">${x.n}</td><td class="n">${fmt(x.v)}</td></tr>`).join('')}</tbody></table></div>
  <div class="card"><h3>보틀 재고 기준 (par) 제안 <small>9/1부터 주평균 × 1.5</small></h3>
    <table class="dt"><thead><tr><th>와인</th><th class="n">주평균 교체</th><th class="n">창고에 둘 병 수</th></tr></thead><tbody>${par.map(x=>`<tr><td>${x.w}</td><td class="n">${x.avg.toFixed(1)}병</td><td class="n"><b>${Math.ceil(x.avg*1.5)}병</b></td></tr>`).join('')}</tbody></table>
    <div class="note">주 1회 발주 가정. 창고(보틀) 실제 재고는 아직 데이터가 없어서, 재고 수량을 넣으면 '발주할 병 수'로 바뀌어요 (ERP lite 2단계).</div></div>
  <div class="card"><h3>오래 안 바뀐 탭 <small>마지막 교체 30일 이상 전</small></h3>
    ${stale.slice(0,10).map(s=>`<div class="row"><span>${s.w||'와인 미상'}<br><small>${s.b} · ${s.title} ${s.s}번</small></span><span style="text-align:right"><b>${s.ml}ml</b><br><small>${md(s.last)} 교체</small></span></div>`).join('') || '<div class="sub">없음</div>'}
    <div class="note">잘 안 나가는 와인 후보예요. 산화 위험도 있으니 메뉴 교체나 프로모션을 검토해요.</div></div>
  ${pourCard(rep, bs)}
  ${foodCard()}
  <div class="card"><h3>로스 확인 (variance) <span class="pill part">11/18 회신 대기</span></h3>
    <div class="sub">BinWise 방식: <b>차이 = 탭에서 빠진 양 − 잔으로 판 양</b>. 바 업계는 2~4% 이내를 목표로 해요.</div>
    <div class="issue lv-mid">탭에서 빠진 양(교체 기록)은 있지만, 와인별 '잔 판매 ml' 통계가 POS 관리자 화면에서 권한 오류(401)로 막혀 있어요. 11/13 이창훈 이사님께 통계 권한 또는 집계 API를 요청했어요 (회신 기한 11/18). 받으면 이 카드가 켜져요.</div></div>
  </div>`;
}


function pourCard(rep, bs){
  const W = D.wine, C = W.cost || {};
  if (!Object.keys(C).length) return `<div class="card"><h3>잔당 원가율 (pour cost) <span class="pill part">원가표 필요</span></h3><div class="sub">와인별 매입가 원가표가 연결되지 않았어요.</div></div>`;
  const val = r => r.ml/10*r.p10, cost = r => C[r.w] ? C[r.w].c*1.1 : null;   // 매입가는 VAT 별도 → 판매가(VAT 포함)와 맞추려고 ×1.1
  const m = rep.filter(r=>C[r.w]), sv = m.reduce((s,r)=>s+val(r),0), sc = m.reduce((s,r)=>s+cost(r),0);
  const pc = sv ? sc/sv*100 : null;
  const by = b => { const x = m.filter(r=>r.b===b); const v = x.reduce((s,r)=>s+val(r),0); return v ? x.reduce((s,r)=>s+cost(r),0)/v*100 : null; };
  const wv = {}; for (const r of m){ const o = wv[r.w] ||= {w:r.w, n:0, v:0, c:0}; o.n++; o.v += val(r); o.c += cost(r); }
  const hi = Object.values(wv).filter(x=>x.v).map(x=>({...x, p:x.c/x.v*100})).sort((a,b)=>b.p-a.p).slice(0,6);
  const col = p => p==null ? '' : p>50 ? 'down' : p<=35 ? 'up' : '';
  return `<div class="card"><h3>잔당 원가율 (pour cost) <span class="pill ok">원가표 연결됨</span></h3>
    <div class="kv" style="margin-top:0;grid-template-columns:repeat(${Math.min(bs.length,4)+1},1fr)"><div><span>${bs.length>1?'전체':bs[0]}</span><b class="${col(pc)}">${pc==null?'-':pc.toFixed(1)+'%'}</b></div>${bs.length>1?bs.map(b=>{const p=by(b);return `<div><span>${b}</span><b class="${col(p)}">${p==null?'-':p.toFixed(1)+'%'}</b></div>`;}).join(''):''}</div>
    <div class="sub" style="margin-top:10px">원가율 = 교체한 병 매입가(VAT 포함) ÷ 그 병을 잔으로 다 팔았을 때 매출. 참고로 BinWise가 말하는 바 업계 목표 18~24%는 칵테일·잔 와인 바 기준이에요. 우리처럼 셀프 탭으로 잔을 싸게 파는 모델은 더 높게 나오는 게 정상이라, 우리 기준선은 따로 정해야 해요. 지금은 50% 넘으면 빨강, 35% 이하면 파랑.</div>
    <h3 style="margin-top:14px;font-size:14px">원가율 높은 탭 와인</h3>
    ${hi.map(x=>`<div class="row"><span>${x.w}<br><small>${x.n}병 · 매입 ${fmt(C[x.w].c)}원(VAT 별도) · 10ml ${fmt(x.v/x.n/((W.rep.find(r=>r.w===x.w)||{ml:750}).ml/10))}원</small></span><b class="${col(x.p)}">${x.p.toFixed(0)}%</b></div>`).join('')}
    <div class="note">원가: ${W.costfile} · 이 기간 교체 ${rep.length}병 중 ${m.length}병 매칭 (${rep.length?Math.round(m.length/rep.length*100):0}%) · 이름이 안 맞는 와인은 빠져 있어요 · 실제 잔 판매가 아니라 '다 팔았을 때' 기준이라 로스·할인은 반영 안 됨</div></div>
`;
}


function foodCard(){
  const F = D.food; if (!F) return '';
  const ms = F.menus.filter(m=>m.cost>0), avg = ms.reduce((s,m)=>s+m.rate,0)/Math.max(ms.length,1)*100;
  const hi = [...ms].sort((a,b)=>b.rate-a.rate).slice(0,6), over = ms.filter(m=>m.rate>=F.warn);
  const bs = brs(), fs = bs.reduce((s,b)=>s+sumF(D.daily[b].filter(r=>r.date.startsWith(CUR)),'food'),0);
  return `<div class="card"><h3>푸드 메뉴 원가율 <span class="pill ok">원가표 연결됨</span></h3>
    <div class="kv" style="margin-top:0"><div><span>판매중 메뉴</span><b>${ms.length}개</b></div><div><span>메뉴 평균 원가율</span><b>${avg.toFixed(1)}%</b></div><div><span>${Math.round(F.warn*100)}% 넘는 메뉴</span><b class="${over.length?'down':''}">${over.length}개</b></div></div>
    <h3 style="margin-top:14px;font-size:14px">원가율 높은 메뉴</h3>
    ${hi.map(m=>`<div class="row"><span>${m.name}<br><small>판매가 ${fmt(m.price)} · 원가 ${fmt(m.cost)} (VAT 포함)</small></span><b class="${m.rate>=F.warn?'down':''}">${(m.rate*100).toFixed(0)}%</b></div>`).join('')}
    <div class="note">이번 달 푸드 매출 ${man(fs)}원에 메뉴 평균 원가율을 곱하면 푸드 원가는 약 ${man(fs*avg/100)}원(단순 평균 기준). 메뉴별 판매 수량이 붙으면 실제 원가율로 바뀌어요 · 원가: ${F.src} · 마지막 업데이트 ${F.updated}</div></div>`;
}

// ---------- 기능 지도 (캐시노트 벤치마크) ----------
function map(){
  const st = {ok:'<span class="pill ok">지금 됨</span>', part:'<span class="pill part">연결하면 됨</span>', no:'<span class="pill no">안 함·나중</span>', own:'<span class="pill own">우리만</span>'};
  const R = [
    ['장부','어제 매출 + 해석','홈 · 어제 매출, 전주 같은 요일 대비, TOM 브리핑','ok','일정산 v3'],
    ['장부','실적 캘린더','장부 · 일자별 히트맵, 누르면 품목·결제·지점 상세','ok','일정산 v3'],
    ['장부','매출 목표 달성률','홈 · 목표 직접 입력(기본 10월 실적), 달성률·예상 달성률','ok','일정산 v3'],
    ['장부','일/주/월 매출 분석, 객단가','홈·장부 · 결제 건수, 객단가, 품목·결제수단 구성, 월별 추이','ok','일정산 v3'],
    ['플러스','AI 매출부스터 (월말 예상)','홈 · 지점별 요일 평균으로 월말 예상','ok','일정산 v3 (단순 모델)'],
    ['본사','여러 매장 비교 (토스플레이스 본사 대시보드)','매장 비교 · 매장별·기간별·카테고리별·결제수단별, 기간 칩, 매장 선택, 항목 추가·삭제, 정렬, 엑셀 다운로드','ok','일정산 v3'],
    ['플러스','매출랭킹 (주변 매장)','홈 · 우리 4개 지점끼리 랭킹·전월 대비','ok','일정산 v3'],
    ['플러스','미지급 진단','정산 진단 · POS ↔ 직원 입력 자동 대조, 지점별 패턴','ok','POS자동 탭 (SD·OK포스)'],
    ['플러스','카드 매입·입금 누락 확인','정산 진단 다음 단계 · 카드사 매입 vs 통장 입금','part','클로브 (여신금융협회·IBK 이미 연결)'],
    ['자금','들어올 돈 (입금 예정)','자금 · 카드·간편 매출 → 입금일 추정','ok','일정산 v3 + 입금 규칙'],
    ['자금','입금 확인','자금 · 예상 카드 입금 누계 vs 패스파인더22→탭샵바 이체 누계 (참고)','part','클로브 통장 + 패스파인더22 IBK 필요'],
    ['자금','나갈 돈 (출금 예정)','허가 지급 일정·고정비','part','자금 일정표·허가 대장 (회생 기간 내부용)'],
    ['장부','비용 장부','자금 · 지점별 통장 출금 (급여·주류 매입·임차료), 출금÷매출','ok','클로브 통장 그룹 라벨 (현금 기준)'],
    ['장부','월 손익 (발생 기준)','월간 결산 (매출 − 비용, 그 달 몫으로)','part','클로브 라벨 + 미지급 장부'],
    ['카드','카드사별 매출','토스플레이스 카드사별 화면','no','패스파인더22 여신금융협회 자료 필요 (탭샵바 클로브엔 없음)'],
    ['리포트','일간 매출 리포트','이미 운영: 매일 08:00 일정산 요약 메일','ok','Apps Script'],
    ['리포트','주간 방문 / 월간 결산 리포트','이 화면 링크를 주간 메일로','part','루틴 1개'],
    ['TSB','선불권 부채 관리','충전·사용·잔액, 마이너스 경고','own','일정산 v3'],
    ['TSB','매장 현금 시재','지점별 현금잔액','own','일정산 v3'],
    ['BinWise','탭 잔량 지도·교체 병수·TOP 10','와인 재고 · 슬롯별 잔량, 지점별 교체, 많이 나간 와인','ok','POS 디스펜서 (교체 기록·슬롯 잔량)'],
    ['BinWise','보틀 재고 기준 (par)','와인 재고 · 주평균 교체 × 1.5','ok','POS 교체 기록 (창고 재고는 ERP lite 2단계)'],
    ['BinWise','잔당 원가율 (pour cost)','와인 재고 · 교체 병 매입가 ÷ 잔 판매가치, 지점별·와인별','ok','박선영 이사 와인 정보 시트 (매입가) + POS 교체 기록'],
    ['원가','푸드 메뉴 원가율','원가·재고 · 메뉴별 원가율, 35% 넘는 메뉴','ok','윤홍민 쉐프 TSB 푸드 원가 기준표'],
    ['BinWise','로스 확인 (variance)','탭에서 빠진 양 − 잔 판매량','part','POS 통계 권한(401) 또는 탭 기록 API (이창훈 이사)'],
    ['고객','재방문·고객 분석','터칭·선불권 회원 기준이면 일부 가능','no','POS 회원 데이터 확인 필요'],
    ['마케팅','리뷰 관리 / 검색 순위','네이버·카카오·구글 리뷰 모아보기','no','외부 수집 필요, 나중'],
    ['상권','상권 분석·지원정책','캐시노트 무료 기능을 그대로 참고','no','외부 데이터'],
    ['금융','카드매출 바로입금·외상결제·월세 카드결제·마켓','빼기: 빌리는 돈·새 지출이라 회생 기간 법원 허가 대상','no','법무팀 확인 필요'],
    ['AI','캐시노트 AI (캐시니)','TOM이 이 데이터로 답하고 브리핑','ok','Aside'],
  ];
  return `<div class="card"><h3>캐시노트 기능 → TSBnote <small>${R.filter(r=>r[3]==='ok'||r[3]==='own').length}개 지금 됨 · ${R.filter(r=>r[3]==='part').length}개 연결하면 됨</small></h3>
  <div class="tw"><table><tr><th>영역</th><th>캐시노트 기능</th><th>TSBnote</th><th>상태</th><th>데이터</th></tr>
  ${R.map(r=>`<tr><td><small>${r[0]}</small></td><td>${r[1]}</td><td>${r[2]}</td><td>${st[r[3]]}</td><td><small>${r[4]}</small></td></tr>`).join('')}</table></div>
  <div class="note">참고: 토스플레이스 본사 대시보드(매장 비교 탭 구조) · BinWise(와인 재고 탭) · 캐시노트 구성: 홈 '자금' 카드(들어올 돈·나갈 돈), 장부(일별 매출·비용, 실적 캘린더, 목표 달성률), 플러스 멤버십(미지급 진단, 매출 랭킹, AI 매출부스터, 리포트 3종, 리뷰 관리).</div></div>`;
}
render();
