'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Play, RotateCcw, Copy, Check, ChevronRight, ChevronDown, Info, AlertTriangle, CheckCircle2, Sparkles, Download, Eye, EyeOff, Hash, Layers, Code2, Braces, UserCog } from 'lucide-react';

/* ─── ATDL Parser — FIXatdl 1.1 ─── */
function parseATDL(xmlString) {
  if (!xmlString.trim()) return { strategies: [], errors: [] };
  let doc;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xmlString, 'application/xml');
    const pe = doc.querySelector('parsererror');
    if (pe) return { strategies: [], errors: ['XML Parse Error: ' + pe.textContent.slice(0, 300)] };
  } catch(e) { return { strategies: [], errors: ['Parse failed: ' + e.message] }; }

  const findAll = (parent, localName) => {
    const r = [];
    const walk = n => { if (!n || n.nodeType !== 1) return; if (n.localName === localName) r.push(n); Array.from(n.children).forEach(walk); };
    Array.from(parent.children).forEach(walk);
    return r;
  };
  const ga = (el, ...names) => { for (const n of names) { const v = el.getAttribute(n); if (v !== null) return v; } return ''; };

  const strategies = [];
  let ses = findAll(doc.documentElement, 'Strategy');
  if (ses.length === 0 && doc.documentElement.localName === 'Strategy') ses = [doc.documentElement];

  for (const s of ses) {
    const strat = { name: ga(s,'name','Name'), version: ga(s,'version','Version'), providerID: ga(s,'providerID','ProviderID'),
      uiRep: ga(s,'uiRep','UIRep') || ga(s,'name','Name'), description: '', parameters: [], groups: [] };
    const d = findAll(s,'Description')[0]; if (d) strat.description = d.textContent.trim();
    for (const p of findAll(s,'Parameter')) {
      const t = ga(p,'xsi:type','type') || 'String_t';
      const param = { name: ga(p,'name'), type: t, fixTag: ga(p,'fixTag','tag'),
        required: ga(p,'use')==='required' || ga(p,'required')==='true',
        defaultValue: ga(p,'defaultVal','default','initValue'), minValue: ga(p,'minValue','min'),
        maxValue: ga(p,'maxValue','max'), constValue: ga(p,'constValue','const'), description: '', enumPairs: [] };
      const dp = findAll(p,'Description')[0]; if (dp) param.description = dp.textContent.trim();
      findAll(p,'EnumPair').forEach(ep => param.enumPairs.push({ enumID: ga(ep,'enumID'), wireValue: ga(ep,'wireValue'), uiRep: ga(ep,'uiRep')||ga(ep,'enumID') }));
      strat.parameters.push(param);
    }
    const le = findAll(s,'StrategyLayout')[0];
    strat.groups = le ? parseLayoutGroups(le, strat.parameters, findAll, ga) : [{
      label: 'Parameters', collapsed: false, orientation: 'vertical', subGroups: [],
      controls: strat.parameters.map(p => ({ id:p.name, paramRef:p.name, label:p.name, type:inferControlType(p.type,p.enumPairs), tooltip:p.description, initValue:p.defaultValue, param:p })),
    }];
    strategies.push(strat);
  }
  return { strategies, errors: [] };
}

function parseLayoutGroups(layoutEl, parameters, findAll, ga) {
  const groups = [];
  const proc = (el, depth=0) => {
    const label = ga(el,'title','label','name') || (depth===0?'Settings':'');
    const controls = [], subGroups = [];
    for (const c of Array.from(el.children)) {
      if (c.localName === 'Control') {
        const pr = ga(c,'parameterRef'); const param = parameters.find(p=>p.name===pr);
        const et = ga(c,'xsi:type','type');
        controls.push({ id:ga(c,'ID','id')||pr, paramRef:pr, label:ga(c,'label','Label')||pr||'',
          type:et?mapCT(et):(param?inferControlType(param.type,param.enumPairs):'text'),
          initValue:ga(c,'initValue','defaultVal')||(param?.defaultValue||''),
          tooltip:ga(c,'tooltip','description')||(param?.description||''), param });
      } else if (c.localName === 'StrategyPanel') { const n=proc(c,depth+1); if(n) subGroups.push(n); }
    }
    return { label, orientation:ga(el,'orientation')||'vertical', collapsed:false, controls, subGroups };
  };
  for (const c of Array.from(layoutEl.children)) { if (c.localName==='StrategyPanel') groups.push(proc(c)); }
  if (groups.length===0) groups.push(proc(layoutEl));
  return groups;
}

function mapCT(t) {
  t = t.toLowerCase();
  if (t.includes('clock')||t.includes('time')) return 'time';
  if (t.includes('date')) return 'date';
  if (t.includes('radiobutton')||t.includes('singleselectlist')) return 'radio';
  if (t.includes('checkbox')) return 'checkbox';
  if (t.includes('dropdown')||t.includes('editablelist')||t.includes('multiselect')) return 'select';
  if (t.includes('slider')) return 'slider';
  return 'text';
}
function inferControlType(pt, ep) {
  if (ep&&ep.length>0) return ep.length<=4?'radio':'select';
  const t=(pt||'').toLowerCase();
  if (t.includes('bool')) return 'checkbox';
  if (t.includes('utctimestamp')||t.includes('time')) return 'time';
  if (t.includes('date')) return 'date';
  if (t.includes('float')||t.includes('price')||t.includes('qty')||t.includes('percent')||t.includes('int')) return 'spinner';
  return 'text';
}
function buildFIX(strategy, values) {
  if (!strategy) return '';
  const parts = [];
  for (const p of strategy.parameters) {
    if (p.constValue) { if (p.fixTag) parts.push(p.fixTag+'='+p.constValue); continue; }
    const v = values[p.name]; if (v===undefined||v===''||v===null) continue;
    let wv = v;
    if (p.enumPairs.length>0) { const f=p.enumPairs.find(e=>e.enumID===v); if(f) wv=f.wireValue; }
    if (p.fixTag) parts.push(p.fixTag+'='+wv);
  }
  return parts.join('\x01');
}

/* ─── Demo ATDL XML ─── */
const DEMO_ATDL = `<?xml version="1.0" encoding="utf-8"?>
<Strategies xmlns="http://www.fixprotocol.org/FIXatdl-1-1/Core" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <Strategy name="VWAP" uiRep="VWAP" version="1" providerID="Fixify-Demo">
    <Description>Volume-Weighted Average Price execution strategy.</Description>
    <Parameter name="StartTime"        xsi:type="UTCTimestamp_t" fixTag="7602" use="required" />
    <Parameter name="EndTime"          xsi:type="UTCTimestamp_t" fixTag="7603" use="required" />
    <Parameter name="MaxParticipation" xsi:type="Percentage_t"  fixTag="7610" minValue="0.01" maxValue="1.0" defaultVal="0.25" />
    <Parameter name="AllowDarkPool"    xsi:type="Boolean_t"     fixTag="7620" defaultVal="Y" />
    <Parameter name="TimeInForce"      xsi:type="Int_t"         fixTag="59">
      <EnumPair enumID="DAY" wireValue="0" uiRep="Day" />
      <EnumPair enumID="GTC" wireValue="1" uiRep="Good Till Cancel" />
      <EnumPair enumID="GTD" wireValue="6" uiRep="Good Till Date" />
    </Parameter>
    <Parameter name="DisplayQty" xsi:type="Qty_t" fixTag="1138" minValue="0" />
    <Parameter name="Notes"      xsi:type="String_t" fixTag="58" />
    <StrategyLayout>
      <StrategyPanel orientation="vertical" title="VWAP Schedule">
        <Control xsi:type="Clock_t"        ID="s1" label="Start Time"           parameterRef="StartTime" />
        <Control xsi:type="Clock_t"        ID="s2" label="End Time"             parameterRef="EndTime" />
        <Control xsi:type="Slider_t"       ID="s3" label="Max Participation %"  parameterRef="MaxParticipation" />
      </StrategyPanel>
      <StrategyPanel orientation="vertical" title="Routing Options">
        <Control xsi:type="CheckBox_t"     ID="s4" label="Allow Dark Pool"      parameterRef="AllowDarkPool" />
        <Control xsi:type="DropDownList_t" ID="s5" label="Time In Force"        parameterRef="TimeInForce" />
        <Control xsi:type="TextField_t"    ID="s6" label="Display Qty (Iceberg)" parameterRef="DisplayQty" />
        <Control xsi:type="TextField_t"    ID="s7" label="Trader Notes"         parameterRef="Notes" />
      </StrategyPanel>
    </StrategyLayout>
  </Strategy>

  <Strategy name="TWAP" uiRep="TWAP" version="1" providerID="Fixify-Demo">
    <Description>Time-Weighted Average Price — splits the order evenly across the window.</Description>
    <Parameter name="StartTime"     xsi:type="UTCTimestamp_t" fixTag="7602" use="required" />
    <Parameter name="EndTime"       xsi:type="UTCTimestamp_t" fixTag="7603" use="required" />
    <Parameter name="SliceInterval" xsi:type="Int_t"          fixTag="7615" defaultVal="60" />
    <Parameter name="OrderType"     xsi:type="Char_t"         fixTag="40">
      <EnumPair enumID="MARKET" wireValue="1" uiRep="Market" />
      <EnumPair enumID="LIMIT"  wireValue="2" uiRep="Limit" />
      <EnumPair enumID="PEGGED" wireValue="P" uiRep="Pegged" />
    </Parameter>
    <Parameter name="LimitOffset" xsi:type="Price_t"   fixTag="7616" />
    <Parameter name="Aggressive"  xsi:type="Boolean_t" fixTag="7618" defaultVal="N" />
    <StrategyLayout>
      <StrategyPanel orientation="vertical" title="Schedule">
        <Control xsi:type="Clock_t"           ID="t1" label="Start Time"         parameterRef="StartTime" />
        <Control xsi:type="Clock_t"           ID="t2" label="End Time"           parameterRef="EndTime" />
        <Control xsi:type="TextField_t"       ID="t3" label="Slice Interval (s)" parameterRef="SliceInterval" />
      </StrategyPanel>
      <StrategyPanel orientation="vertical" title="Price Settings">
        <Control xsi:type="RadioButtonList_t" ID="t4" label="Order Type"         parameterRef="OrderType" />
        <Control xsi:type="TextField_t"       ID="t5" label="Limit Offset"       parameterRef="LimitOffset" />
        <Control xsi:type="CheckBox_t"        ID="t6" label="Aggressive Mode"    parameterRef="Aggressive" />
      </StrategyPanel>
    </StrategyLayout>
  </Strategy>

  <Strategy name="POV" uiRep="Percentage of Volume" version="1" providerID="Fixify-Demo">
    <Description>Participate at a fixed percentage of real-time market volume.</Description>
    <Parameter name="TargetPct" xsi:type="Percentage_t" fixTag="7630" minValue="0.01" maxValue="0.50" defaultVal="0.10" use="required" />
    <Parameter name="MinPct"    xsi:type="Percentage_t" fixTag="7631" minValue="0.00" defaultVal="0.05" />
    <Parameter name="MaxPct"    xsi:type="Percentage_t" fixTag="7632" maxValue="0.50" defaultVal="0.20" />
    <Parameter name="Venue"     xsi:type="String_t"     fixTag="7640">
      <EnumPair enumID="PRIMARY"  wireValue="PRIMARY"  uiRep="Primary Exchange" />
      <EnumPair enumID="REGIONAL" wireValue="REGIONAL" uiRep="Regional Exchanges" />
      <EnumPair enumID="ALL"      wireValue="ALL"       uiRep="All Venues" />
    </Parameter>
    <Parameter name="StartTime" xsi:type="UTCTimestamp_t" fixTag="7602" />
    <Parameter name="EndTime"   xsi:type="UTCTimestamp_t" fixTag="7603" />
    <StrategyLayout>
      <StrategyPanel orientation="vertical" title="Participation Bands">
        <Control xsi:type="Slider_t" ID="p1" label="Target Participation %" parameterRef="TargetPct" />
        <Control xsi:type="Slider_t" ID="p2" label="Min Participation %"    parameterRef="MinPct" />
        <Control xsi:type="Slider_t" ID="p3" label="Max Participation %"    parameterRef="MaxPct" />
      </StrategyPanel>
      <StrategyPanel orientation="vertical" title="Venue and Schedule">
        <Control xsi:type="DropDownList_t" ID="p4" label="Venue Selection" parameterRef="Venue" />
        <Control xsi:type="Clock_t"        ID="p5" label="Start Time"       parameterRef="StartTime" />
        <Control xsi:type="Clock_t"        ID="p6" label="End Time"         parameterRef="EndTime" />
      </StrategyPanel>
    </StrategyLayout>
  </Strategy>

</Strategies>`;

/* ─── Control Field Renderer ─── */
function ControlField({ control, param, value, onChange, errors }) {
  const hasError = errors?.[control.paramRef];
  const bi = 'w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none transition-all';
  const is = { background:'var(--background)', borderColor:hasError?'#ef4444':'var(--border)', color:'var(--foreground)' };
  const label = control.label || control.paramRef || control.id;
  const ep = param?.enumPairs || [];

  const renderInput = () => {
    switch(control.type) {
      case 'checkbox': return (
        <label className='flex items-center gap-3 cursor-pointer'>
          <button type='button' onClick={() => onChange(value==='Y'||value===true?'N':'Y')}
            className={`relative w-9 h-5 rounded-full transition-colors ${(value==='Y'||value===true)?'bg-emerald-500':'bg-zinc-700'}`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${(value==='Y'||value===true)?'left-4':'left-0.5'}`}/>
          </button>
          <span className='text-xs font-mono' style={{color:'var(--foreground)'}}>{(value==='Y'||value===true)?'Enabled':'Disabled'}</span>
        </label>);

      case 'radio': return (
        <div className='flex flex-wrap gap-2'>
          {ep.map(e => (
            <button key={e.enumID} type='button' onClick={() => onChange(e.enumID)}
              className={`flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg border transition-all ${value===e.enumID?'':'opacity-60 hover:opacity-90'}`}
              style={value===e.enumID?{background:'var(--primary-faint)',borderColor:'var(--primary-border)',color:'var(--foreground)'}:{borderColor:'var(--border)',color:'var(--foreground)',background:'transparent'}}>
              <div className={`w-2.5 h-2.5 rounded-full border-2 shrink-0 ${value===e.enumID?'border-current bg-current':'border-zinc-500'}`} />
              {e.uiRep}
            </button>
          ))}
        </div>);

      case 'select': return (
        <select value={value||''} onChange={x=>onChange(x.target.value)} className={bi} style={{...is,cursor:'pointer'}}>
          <option value=''>— Select —</option>
          {ep.map(e=><option key={e.enumID} value={e.enumID}>{e.uiRep}</option>)}
        </select>);

      case 'slider': {
        const min=parseFloat(param?.minValue||'0'), max=parseFloat(param?.maxValue||'1');
        const step=(max-min)<=1?0.01:1, nv=parseFloat(value)||min;
        const pct=max>min?Math.round(((nv-min)/(max-min))*100):0;
        const dv=(max-min)<=1?`${Math.round(nv*100)}%`:nv;
        return (
          <div className='space-y-2'>
            <input type='range' min={min} max={max} step={step} value={nv} onChange={x=>onChange(x.target.value)}
              className='w-full h-1.5 rounded-full appearance-none cursor-pointer'
              style={{background:`linear-gradient(to right, var(--primary) ${pct}%, var(--border) ${pct}%)`}} />            <div className='flex justify-between items-center'>
              <span className='text-[10px] font-mono' style={{color:'var(--text-muted)'}}>{min}</span>
              <span className='text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg border'
                style={{background:'var(--primary-faint)',borderColor:'var(--primary-border)',color:'var(--foreground)'}}>{dv}</span>
              <span className='text-[10px] font-mono' style={{color:'var(--text-muted)'}}>{max}</span>
            </div>
          </div>);}

      case 'time': return <input type='time' value={value||''} onChange={x=>onChange(x.target.value)} className={bi} style={is} />;
      case 'date': return <input type='date' value={value||''} onChange={x=>onChange(x.target.value)} className={bi} style={is} />;
      case 'spinner': return <input type='number' value={value||''} onChange={x=>onChange(x.target.value)}
        min={param?.minValue||undefined} max={param?.maxValue||undefined}
        step={param?.type?.includes('Percentage')?'0.01':'1'} placeholder={param?.defaultValue||''} className={bi} style={is} />;
      default: return <input type='text' value={value||''} onChange={x=>onChange(x.target.value)} placeholder={param?.defaultValue||''} className={bi} style={is} />;
    }
  };

  return (
    <div className='space-y-1.5'>
      <div className='flex items-center gap-1.5 flex-wrap'>
        <label className='text-[11px] font-semibold uppercase tracking-wide' style={{color:'var(--text-muted)'}}>
          {label}{param?.required && <span className='text-red-400 ml-0.5'>*</span>}
        </label>
        {param?.fixTag && <span className='text-[9px] font-mono px-1.5 py-0.5 rounded'
          style={{background:'var(--primary-faint)',color:'var(--primary)',border:'1px solid var(--primary-border)'}}>Tag {param.fixTag}</span>}
        {(control.tooltip||param?.description) && <span title={control.tooltip||param?.description} className='cursor-help'>
          <Info className='h-3 w-3' style={{color:'var(--text-muted)'}} /></span>}
      </div>
      {renderInput()}
      {hasError && <p className='text-[10px] text-red-400 flex items-center gap-1'><AlertTriangle className='h-3 w-3' />{errors[control.paramRef]}</p>}
    </div>
  );
}

function PanelGroup({ group, values, onChange, errors, depth=0 }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className='rounded-xl border overflow-hidden'
      style={{borderColor:'var(--border)',background:depth>0?'var(--background)':'var(--card)'}}>
      {group.label && (
        <button onClick={()=>setCollapsed(c=>!c)}
          className='w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--primary-faint)] border-b'
          style={{borderColor:'var(--border)'}}>
          <span className='text-xs font-bold uppercase tracking-wider' style={{color:'var(--foreground)'}}>{group.label}</span>
          {collapsed?<ChevronRight className='h-3.5 w-3.5 shrink-0' style={{color:'var(--text-muted)'}} />:<ChevronDown className='h-3.5 w-3.5 shrink-0' style={{color:'var(--text-muted)'}} />}
        </button>
      )}
      {!collapsed && (
        <div className='p-4 space-y-5'>
          {group.controls.map((ctrl,i) => (
            <ControlField key={ctrl.id||i} control={ctrl} param={ctrl.param}
              value={values[ctrl.paramRef]??ctrl.param?.defaultValue??ctrl.initValue??''}
              onChange={val=>onChange(ctrl.paramRef,val)} errors={errors} />
          ))}
          {group.subGroups?.map((sg,i) => (
            <PanelGroup key={i} group={sg} values={values} onChange={onChange} errors={errors} depth={depth+1} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main Page Component ─── */
export default function ATDLRendererPage() {
  const [xmlInput, setXmlInput] = useState('');
  const [parsed, setParsed] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);
  const [activeStratIdx, setActiveStratIdx] = useState(0);
  const [values, setValues] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [fixPreview, setFixPreview] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showXml, setShowXml] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const fileRef = useRef(null);

  useEffect(()=>{ setIsLoaded(true); }, []);

  const handleParse = useCallback((xml) => {
    const src = xml !== undefined ? xml : xmlInput;
    if (!src.trim()) { setParsed(null); setParseErrors([]); return; }
    const result = parseATDL(src);
    setParsed(result); setParseErrors(result.errors); setActiveStratIdx(0);
    setValues({}); setValidationErrors({}); setFixPreview('');
    if (result.strategies.length > 0) setShowXml(false);
  }, [xmlInput]);

  const handleLoadDemo = useCallback(() => { setXmlInput(DEMO_ATDL); handleParse(DEMO_ATDL); }, [handleParse]);

  const handleFileUpload = (file) => {
    const reader = new FileReader();
    reader.onload = e => { const txt = e.target.result; setXmlInput(txt); handleParse(txt); };
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0]; if (file) handleFileUpload(file);
  }, []);

  const activeStrategy = parsed?.strategies?.[activeStratIdx];

  const handleValueChange = (paramRef, val) => {
    setValues(prev => {
      const next = { ...prev, [paramRef]: val };
      if (activeStrategy) setFixPreview(buildFIX(activeStrategy, next));
      return next;
    });
    setValidationErrors(prev => { const n={...prev}; delete n[paramRef]; return n; });
  };

  const handleValidate = () => {
    if (!activeStrategy) return;
    const errs = {};
    for (const p of activeStrategy.parameters) {
      if (p.constValue) continue;
      const v = values[p.name];
      if (p.required && (v===undefined||v===''||v===null)) errs[p.name]='Required field';
      if (v!==undefined&&v!=='') {
        const num=parseFloat(v);
        if (p.minValue!==''&&p.minValue!==undefined&&!isNaN(num)&&num<parseFloat(p.minValue)) errs[p.name]=`Min: ${p.minValue}`;
        if (p.maxValue!==''&&p.maxValue!==undefined&&!isNaN(num)&&num>parseFloat(p.maxValue)) errs[p.name]=`Max: ${p.maxValue}`;
      }
    }
    setValidationErrors(errs);
    if (Object.keys(errs).length===0) setFixPreview(buildFIX(activeStrategy,values));
  };

  const handleCopy = () => {
    if (!fixPreview) return;
    navigator.clipboard.writeText(fixPreview.replace(/\x01/g,'|')).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); });
  };

  const handleDownload = () => {
    if (!fixPreview) return;
    const blob = new Blob([fixPreview.replace(/\x01/g,'|')],{type:'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`${activeStrategy?.name||'atdl'}_params.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => { setValues({}); setValidationErrors({}); setFixPreview(''); };

  const isValid = parsed?.strategies?.length>0 && parseErrors.length===0;
  const vpCount = activeStrategy?.parameters?.filter(p=>!p.constValue).length??0;
  const filledCount = activeStrategy?.parameters?.filter(p=>!p.constValue&&values[p.name]!==undefined&&values[p.name]!=='').length??0;
  const errCount = Object.keys(validationErrors).length;

  return (
    <div className='min-h-screen flex flex-col' style={{background:'var(--background)',color:'var(--foreground)'}}
      onDragOver={e=>{e.preventDefault();setIsDragging(true);}}
      onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setIsDragging(false);}}
      onDrop={handleDrop}>

      {isDragging&&(
        <div className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-none'>
          <div className='flex flex-col items-center gap-4 p-14 rounded-2xl border-2 border-dashed' style={{borderColor:'var(--primary)',background:'var(--card)'}}>
            <Upload className='h-12 w-12 animate-bounce' style={{color:'var(--primary)'}} />
            <p className='text-base font-bold'>Drop ATDL .xml file here</p>
          </div>
        </div>
      )}

      <main className={`flex-1 max-w-[1400px] mx-auto w-full px-4 py-6 space-y-5 transition-opacity duration-300 ${isLoaded?'opacity-100':'opacity-0'}`}>

        {/* Header */}
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='text-xl font-bold tracking-tight flex items-center gap-2.5'>
              <div className='p-1.5 rounded-lg' style={{background:'var(--primary-faint)',border:'1px solid var(--primary-border)'}}>
                <UserCog className='h-5 w-5' style={{color:'var(--primary)'}} />
              </div>
              ATDL Renderer
            </h1>
            <p className='text-xs mt-1' style={{color:'var(--text-muted)'}}>
              Parse FIXatdl 1.1 strategy XML &middot; Render interactive parameter controls &middot; Generate FIX wire preview
            </p>
          </div>
          <div className='flex items-center gap-2 flex-wrap'>
            <button onClick={handleLoadDemo}
              className='px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors hover:bg-[var(--primary-faint)]'
              style={{borderColor:'var(--border)',color:'var(--foreground)'}}>
              Load Demo
            </button>
            <button onClick={()=>fileRef.current?.click()}
              className='px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors hover:bg-[var(--primary-faint)]'
              style={{borderColor:'var(--border)',color:'var(--foreground)'}}>
              <Upload className='h-3.5 w-3.5' /> Upload
            </button>
            <input ref={fileRef} type='file' accept='.xml,.atdl' className='hidden'
              onChange={e=>e.target.files?.[0]&&handleFileUpload(e.target.files[0])} />
          </div>
        </div>

        {/* XML Source Panel */}
        <div className='rounded-xl border overflow-hidden' style={{borderColor:'var(--border)',background:'var(--card)'}}>
          <button onClick={()=>setShowXml(v=>!v)}
            className='w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--primary-faint)] transition-colors border-b'
            style={{borderColor:'var(--border)'}}>
            <div className='flex items-center gap-2'>
              <Braces className='h-4 w-4' style={{color:'var(--primary)'}} />
              <span className='text-sm font-semibold'>ATDL XML Source</span>
              {isValid&&<span className='text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold'
                style={{background:'rgba(16,185,129,0.1)',borderColor:'rgba(16,185,129,0.3)',color:'#34d399'}}>
                {parsed.strategies.length} {parsed.strategies.length===1?'strategy':'strategies'} loaded</span>}
              {parseErrors.length>0&&<span className='text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold'
                style={{background:'rgba(239,68,68,0.1)',borderColor:'rgba(239,68,68,0.3)',color:'#f87171'}}>Parse Error</span>}
            </div>
            {showXml?<ChevronDown className='h-4 w-4 shrink-0' />:<ChevronRight className='h-4 w-4 shrink-0' />}
          </button>
          {showXml&&(
            <div className='p-4 space-y-3'>
              <textarea value={xmlInput} onChange={e=>setXmlInput(e.target.value)}
                placeholder='Paste FIXatdl 1.1 XML here, or drag and drop a .xml / .atdl file...'
                spellCheck={false} rows={14}
                className='w-full rounded-lg border p-3 text-xs font-mono resize-y outline-none transition-all'
                style={{background:'var(--background)',borderColor:'var(--border)',color:'var(--foreground)',minHeight:'200px',maxHeight:'500px'}} />
              <div className='flex gap-2'>
                <button onClick={()=>handleParse()}
                  className='px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-[1.02]'
                  style={{background:'var(--primary)',color:'var(--background)'}}>
                  <Play className='h-3.5 w-3.5' /> Parse &amp; Render
                </button>
                <button onClick={()=>{setXmlInput('');setParsed(null);setParseErrors([]);setFixPreview('');}}
                  className='px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors hover:bg-[var(--primary-faint)]'
                  style={{borderColor:'var(--border)',color:'var(--foreground)'}}>
                  <RotateCcw className='h-3 w-3' /> Clear
                </button>
              </div>
              {parseErrors.length>0&&<div className='p-3 rounded-lg border text-xs font-mono space-y-1'
                style={{background:'rgba(239,68,68,0.07)',borderColor:'rgba(239,68,68,0.3)',color:'#f87171'}}>
                {parseErrors.map((e,i)=><p key={i}>{e}</p>)}
              </div>}
            </div>
          )}
        </div>

        {/* Empty State */}
        {!isValid&&!xmlInput&&(
          <div className='rounded-2xl border-2 border-dashed flex flex-col items-center justify-center py-20 space-y-6'
            style={{borderColor:'var(--border)',background:'var(--card)'}}>
            <div className='p-5 rounded-2xl' style={{background:'var(--primary-faint)',border:'1px solid var(--primary-border)'}}>
              <UserCog className='h-12 w-12' style={{color:'var(--primary)'}} />
            </div>
            <div className='text-center space-y-2 max-w-md px-4'>
              <h2 className='text-base font-bold'>FIXatdl XML Renderer</h2>
              <p className='text-xs leading-relaxed' style={{color:'var(--text-muted)'}}>
                Parse FIXatdl 1.1 strategy definitions and dynamically render interactive parameter controls.
                Validates inputs, resolves EnumPairs, and generates the FIX wire message.
              </p>
            </div>
            <div className='flex gap-3 flex-wrap justify-center'>
              <button onClick={handleLoadDemo}
                className='px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all hover:scale-[1.02] shadow-lg'
                style={{background:'var(--primary)',color:'var(--background)'}}>
                <Sparkles className='h-4 w-4' /> Load Demo Strategies
              </button>
              <button onClick={()=>setShowXml(true)}
                className='px-5 py-2.5 rounded-xl text-sm font-semibold border flex items-center gap-2 transition-colors hover:bg-[var(--primary-faint)]'
                style={{borderColor:'var(--border)',color:'var(--foreground)'}}>
                <Code2 className='h-4 w-4' /> Paste XML
              </button>
            </div>
            <div className='flex flex-wrap gap-2 justify-center pt-1 max-w-lg'>
              {['Strategy Parameters','StrategyLayout Panels','Sliders','Toggles','Radio & Select','Validation','EnumPair Mapping','FIX Wire Preview','Multi-Strategy','Drag and Drop'].map(f=>(
                <span key={f} className='text-[10px] font-mono px-2.5 py-1 rounded-full border'
                  style={{borderColor:'var(--border)',color:'var(--text-muted)'}}>{f}</span>
              ))}
            </div>
          </div>
        )}

        {/* Main Renderer */}
        {isValid&&(
          <div className='space-y-4'>
            {parsed.strategies.length>1&&(
              <div className='flex flex-wrap gap-2 p-3 rounded-xl border items-center'
                style={{borderColor:'var(--border)',background:'var(--card)'}}>
                <span className='text-[10px] font-mono uppercase tracking-wider shrink-0 mr-1' style={{color:'var(--text-muted)'}}>Strategy:</span>
                {parsed.strategies.map((s,i)=>(
                  <button key={i} onClick={()=>{setActiveStratIdx(i);setValues({});setValidationErrors({});setFixPreview('');}}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${i===activeStratIdx?'scale-[1.02]':'opacity-60 hover:opacity-90'}`}
                    style={i===activeStratIdx?{background:'var(--primary-faint)',borderColor:'var(--primary-border)',color:'var(--foreground)'}:{borderColor:'var(--border)',color:'var(--foreground)',background:'transparent'}}>
                    <Layers className='h-3 w-3' style={{color:'var(--primary)'}} />
                    {s.uiRep||s.name}
                  </button>
                ))}
              </div>
            )}

            {activeStrategy&&(
              <div className='grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5'>

                {/* Left: Form */}
                <div className='space-y-4'>
                  <div className='p-4 rounded-xl border space-y-3' style={{borderColor:'var(--border)',background:'var(--card)'}}>
                    <div className='flex items-start justify-between gap-4'>
                      <div className='min-w-0'>
                        <h2 className='text-sm font-bold flex items-center gap-2 flex-wrap'>
                          <Layers className='h-4 w-4 shrink-0' style={{color:'var(--primary)'}} />
                          {activeStrategy.uiRep||activeStrategy.name}
                          {activeStrategy.version&&<span className='text-[9px] font-mono px-1.5 py-0.5 rounded border'
                            style={{borderColor:'var(--border)',color:'var(--text-muted)'}}>v{activeStrategy.version}</span>}
                        </h2>
                        {activeStrategy.description&&<p className='text-[11px] leading-relaxed mt-1' style={{color:'var(--text-muted)'}}>{activeStrategy.description}</p>}
                      </div>
                      <div className='shrink-0 text-right space-y-1.5'>
                        <span className='text-[10px] font-mono block' style={{color:'var(--text-muted)'}}>{filledCount}/{vpCount} filled</span>
                        <div className='w-28 h-1.5 rounded-full overflow-hidden' style={{background:'var(--border)'}}>
                          <div className='h-full rounded-full transition-all duration-500'
                            style={{width:`${vpCount>0?Math.round((filledCount/vpCount)*100):0}%`,background:'var(--primary)'}} />
                        </div>
                      </div>
                    </div>
                    <div className='flex flex-wrap gap-1.5'>
                      {activeStrategy.providerID&&<span className='text-[9px] font-mono px-2 py-0.5 rounded border'
                        style={{borderColor:'var(--border)',color:'var(--text-muted)',background:'var(--background)'}}>Provider: {activeStrategy.providerID}</span>}
                      <span className='text-[9px] font-mono px-2 py-0.5 rounded border'
                        style={{borderColor:'var(--border)',color:'var(--text-muted)',background:'var(--background)'}}>{activeStrategy.parameters.length} parameters</span>
                      <span className='text-[9px] font-mono px-2 py-0.5 rounded border'
                        style={{borderColor:'var(--border)',color:'var(--text-muted)',background:'var(--background)'}}>{activeStrategy.groups.length} panel{activeStrategy.groups.length!==1?'s':''}</span>
                    </div>
                  </div>
                  <div className='space-y-3'>
                    {activeStrategy.groups.map((group,i)=>(<PanelGroup key={i} group={group} values={values} onChange={handleValueChange} errors={validationErrors} />))}
                  </div>
                  <div className='flex flex-wrap gap-2 pt-1'>
                    <button onClick={handleValidate}
                      className='px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-[1.02] shadow-sm'
                      style={{background:'var(--primary)',color:'var(--background)'}}>
                      <CheckCircle2 className='h-3.5 w-3.5' /> Validate &amp; Preview FIX
                    </button>
                    <button onClick={handleReset}
                      className='px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors hover:bg-[var(--primary-faint)]'
                      style={{borderColor:'var(--border)',color:'var(--foreground)'}}>
                      <RotateCcw className='h-3.5 w-3.5' /> Reset
                    </button>
                    {fixPreview&&errCount===0&&<span className='px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5'
                      style={{borderColor:'rgba(16,185,129,0.4)',color:'#34d399',background:'rgba(16,185,129,0.08)'}}>
                      <CheckCircle2 className='h-3.5 w-3.5' /> Valid</span>}
                    {errCount>0&&<span className='px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5'
                      style={{borderColor:'rgba(239,68,68,0.4)',color:'#f87171',background:'rgba(239,68,68,0.08)'}}>
                      <AlertTriangle className='h-3.5 w-3.5' /> {errCount} error{errCount>1?'s':''}</span>}
                  </div>
                </div>

                {/* Right: Sidebar */}
                <div className='space-y-4'>
                  {/* Parameter reference table */}
                  <div className='rounded-xl border overflow-hidden' style={{borderColor:'var(--border)',background:'var(--card)'}}>
                    <div className='px-4 py-3 border-b flex items-center gap-2' style={{borderColor:'var(--border)'}}>
                      <Hash className='h-3.5 w-3.5' style={{color:'var(--primary)'}} />
                      <span className='text-xs font-bold'>Parameter Reference</span>
                    </div>
                    <div className='overflow-y-auto' style={{maxHeight:'280px'}}>
                      <table className='w-full text-[10px] font-mono'>
                        <thead>
                          <tr style={{borderBottom:'1px solid var(--border-subtle)',color:'var(--text-muted)'}}>
                            <th className='px-3 py-2 text-left font-semibold'>Name</th>
                            <th className='px-3 py-2 text-left font-semibold'>Tag</th>
                            <th className='px-3 py-2 text-left font-semibold'>Type</th>
                            <th className='px-3 py-2 text-left font-semibold'>Req</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeStrategy.parameters.map((p,i)=>(
                            <tr key={i} style={{borderBottom:'1px solid var(--border-subtle)'}}>
                              <td className='px-3 py-1.5 font-semibold' style={{color:'var(--foreground)'}}>{p.name}</td>
                              <td className='px-3 py-1.5' style={{color:'var(--primary)'}}>{p.fixTag||'—'}</td>
                              <td className='px-3 py-1.5' style={{color:'var(--text-muted)'}}>{p.type.replace('_t','')}</td>
                              <td className='px-3 py-1.5'>{p.required?<span style={{color:'#f87171'}}>●</span>:<span style={{color:'#555'}}>○</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* FIX Wire Preview */}
                  <div className='rounded-xl border overflow-hidden' style={{borderColor:'var(--border)',background:'var(--card)'}}>
                    <div className='px-4 py-3 border-b flex items-center justify-between' style={{borderColor:'var(--border)'}}>
                      <div className='flex items-center gap-2'>
                        <Code2 className='h-3.5 w-3.5' style={{color:'var(--primary)'}} />
                        <span className='text-xs font-bold'>FIX Wire Preview</span>
                      </div>
                      <div className='flex items-center gap-1.5'>
                        {fixPreview&&<>
                          <button onClick={handleCopy} title='Copy' className='p-1.5 rounded-lg border transition-colors hover:bg-[var(--primary-faint)]' style={{borderColor:'var(--border)'}}>
                            {copied?<Check className='h-3 w-3 text-emerald-400'/>:<Copy className='h-3 w-3' style={{color:'var(--text-muted)'}}/>}
                          </button>
                          <button onClick={handleDownload} title='Download' className='p-1.5 rounded-lg border transition-colors hover:bg-[var(--primary-faint)]' style={{borderColor:'var(--border)'}}>
                            <Download className='h-3 w-3' style={{color:'var(--text-muted)'}} />
                          </button>
                        </>}
                        <button onClick={()=>setShowPreview(v=>!v)} className='p-1.5 rounded-lg border transition-colors hover:bg-[var(--primary-faint)]' style={{borderColor:'var(--border)'}}>
                          {showPreview?<EyeOff className='h-3 w-3' style={{color:'var(--text-muted)'}}/>:<Eye className='h-3 w-3' style={{color:'var(--text-muted)'}}/>}
                        </button>
                      </div>
                    </div>
                    {showPreview&&(
                      <div className='p-4'>
                        {fixPreview?(
                          <div className='space-y-1.5'>
                            {fixPreview.split('\x01').filter(Boolean).map((part,i)=>{
                              const ei=part.indexOf('='); const tag=ei>-1?part.slice(0,ei):part; const val=ei>-1?part.slice(ei+1):'';
                              return (<div key={i} className='flex items-baseline gap-2 text-[10px] font-mono'>
                                <span className='shrink-0 w-12 text-right font-bold' style={{color:'var(--primary)'}}>{tag}</span>
                                <span style={{color:'var(--text-muted)'}}>=</span>
                                <span style={{color:'var(--foreground)'}}>{val}</span>
                              </div>);
                            })}
                          </div>
                        ):(
                          <p className='text-[11px] text-center py-6 leading-relaxed' style={{color:'var(--text-muted)'}}>
                            Fill in parameters and click<br/>
                            <strong style={{color:'var(--foreground)'}}>Validate &amp; Preview FIX</strong>
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {fixPreview&&(
                    <div className='rounded-xl border p-3 space-y-2' style={{borderColor:'var(--border)',background:'var(--background)'}}>
                      <p className='text-[9px] font-mono uppercase tracking-wider' style={{color:'var(--text-muted)'}}>
                        Raw SOH string <span className='normal-case opacity-70'>(SOH shown as |)</span>
                      </p>
                      <p className='text-[10px] font-mono break-all leading-relaxed' style={{color:'var(--foreground)'}}>
                        {fixPreview.replace(/\x01/g,'|')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
