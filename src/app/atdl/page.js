'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  UploadCloud, FileText, Play, RotateCcw, Copy, Check,
  ChevronRight, ChevronDown, Info, AlertTriangle,
  CheckCircle2, Sparkles, Download, Eye, EyeOff, Hash, Layers,
  Code2, UserCog, BarChart3, Trash2,
  X
} from 'lucide-react';

/* ─── ATDL Parser — FIXatdl 1.1 ─── */
function parseATDL(xmlString) {
  if (!xmlString.trim()) return { strategies: [], errors: [] };
  let doc;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xmlString, 'application/xml');
    const pe = doc.querySelector('parsererror');
    if (pe) return { strategies: [], errors: ['XML Parse Error: ' + pe.textContent.slice(0, 300)] };
  } catch (e) { return { strategies: [], errors: ['Parse failed: ' + e.message] }; }

  const findAll = (parent, localName) => {
    const r = [];
    const walk = n => {
      if (!n || n.nodeType !== 1) return;
      if (n.localName === localName) r.push(n);
      Array.from(n.children).forEach(walk);
    };
    Array.from(parent.children).forEach(walk);
    return r;
  };
  const ga = (el, ...names) => {
    for (const n of names) { const v = el.getAttribute(n); if (v !== null) return v; }
    return '';
  };

  const strategies = [];
  let ses = findAll(doc.documentElement, 'Strategy');
  if (ses.length === 0 && doc.documentElement.localName === 'Strategy') ses = [doc.documentElement];

  for (const s of ses) {
    const strat = {
      name: ga(s, 'name', 'Name'),
      version: ga(s, 'version', 'Version'),
      providerID: ga(s, 'providerID', 'ProviderID'),
      uiRep: ga(s, 'uiRep', 'UIRep') || ga(s, 'name', 'Name'),
      description: '',
      parameters: [],
      groups: [],
    };
    const descEl = findAll(s, 'Description')[0];
    if (descEl) strat.description = descEl.textContent.trim();

    for (const p of findAll(s, 'Parameter')) {
      const t = ga(p, 'xsi:type', 'type') || 'String_t';
      const param = {
        name: ga(p, 'name'),
        type: t,
        fixTag: ga(p, 'fixTag', 'tag'),
        required: ga(p, 'use') === 'required' || ga(p, 'required') === 'true',
        defaultValue: ga(p, 'defaultVal', 'default', 'initValue'),
        minValue: ga(p, 'minValue', 'min'),
        maxValue: ga(p, 'maxValue', 'max'),
        constValue: ga(p, 'constValue', 'const'),
        description: '',
        enumPairs: [],
      };
      const dp = findAll(p, 'Description')[0];
      if (dp) param.description = dp.textContent.trim();
      findAll(p, 'EnumPair').forEach(ep =>
        param.enumPairs.push({ enumID: ga(ep, 'enumID'), wireValue: ga(ep, 'wireValue'), uiRep: ga(ep, 'uiRep') || ga(ep, 'enumID') })
      );
      strat.parameters.push(param);
    }

    const le = findAll(s, 'StrategyLayout')[0];
    strat.groups = le
      ? parseLayoutGroups(le, strat.parameters, findAll, ga)
      : [{
          label: 'Parameters', orientation: 'vertical', subGroups: [],
          controls: strat.parameters.map(p => ({
            id: p.name, paramRef: p.name, label: p.name,
            type: inferControlType(p.type, p.enumPairs),
            tooltip: p.description, initValue: p.defaultValue, param: p,
          })),
        }];
    strategies.push(strat);
  }
  return { strategies, errors: [] };
}

function parseLayoutGroups(layoutEl, parameters, findAll, ga) {
  const proc = (el, depth = 0) => {
    const label = ga(el, 'title', 'label', 'name') || (depth === 0 ? 'Settings' : '');
    const controls = [];
    const subGroups = [];
    for (const c of Array.from(el.children)) {
      if (c.localName === 'Control') {
        const pr = ga(c, 'parameterRef');
        const param = parameters.find(p => p.name === pr);
        const et = ga(c, 'xsi:type', 'type');
        controls.push({
          id: ga(c, 'ID', 'id') || pr,
          paramRef: pr,
          label: ga(c, 'label', 'Label') || pr || '',
          type: et ? mapCT(et) : (param ? inferControlType(param.type, param.enumPairs) : 'text'),
          initValue: ga(c, 'initValue', 'defaultVal') || (param?.defaultValue || ''),
          tooltip: ga(c, 'tooltip', 'description') || (param?.description || ''),
          param,
        });
      } else if (c.localName === 'StrategyPanel') {
        const n = proc(c, depth + 1);
        if (n) subGroups.push(n);
      }
    }
    return { label, orientation: ga(el, 'orientation') || 'vertical', controls, subGroups };
  };
  const groups = [];
  for (const c of Array.from(layoutEl.children)) {
    if (c.localName === 'StrategyPanel') groups.push(proc(c));
  }
  if (groups.length === 0) groups.push(proc(layoutEl));
  return groups;
}

function mapCT(t) {
  t = t.toLowerCase();
  if (t.includes('clock') || t.includes('time')) return 'time';
  if (t.includes('date')) return 'date';
  if (t.includes('radiobutton') || t.includes('singleselectlist')) return 'radio';
  if (t.includes('checkbox')) return 'checkbox';
  if (t.includes('dropdown') || t.includes('editablelist') || t.includes('multiselect')) return 'select';
  if (t.includes('slider')) return 'slider';
  return 'text';
}

function inferControlType(pt, ep) {
  if (ep && ep.length > 0) return ep.length <= 4 ? 'radio' : 'select';
  const t = (pt || '').toLowerCase();
  if (t.includes('bool')) return 'checkbox';
  if (t.includes('utctimestamp') || t.includes('time')) return 'time';
  if (t.includes('date')) return 'date';
  if (t.includes('float') || t.includes('price') || t.includes('qty') || t.includes('percent') || t.includes('int')) return 'spinner';
  return 'text';
}

function buildFIX(strategy, values) {
  if (!strategy) return '';
  const parts = [];
  for (const p of strategy.parameters) {
    if (p.constValue) { if (p.fixTag) parts.push(p.fixTag + '=' + p.constValue); continue; }
    const v = values[p.name];
    if (v === undefined || v === '' || v === null) continue;
    let wv = String(v);
    if (p.enumPairs.length > 0) {
      const f = p.enumPairs.find(e => e.enumID === v);
      if (f) wv = f.wireValue;
    }
    if (p.fixTag) parts.push(p.fixTag + '=' + wv);
  }
  return parts.join('\u0001');
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
    <Parameter name="DisplayQty" xsi:type="Qty_t"    fixTag="1138" minValue="0" />
    <Parameter name="Notes"      xsi:type="String_t" fixTag="58" />
    <StrategyLayout>
      <StrategyPanel orientation="vertical" title="Schedule">
        <Control xsi:type="Clock_t"  ID="s1" label="Start Time"          parameterRef="StartTime" />
        <Control xsi:type="Clock_t"  ID="s2" label="End Time"            parameterRef="EndTime" />
        <Control xsi:type="Slider_t" ID="s3" label="Max Participation %"  parameterRef="MaxParticipation" />
      </StrategyPanel>
      <StrategyPanel orientation="vertical" title="Routing Options">
        <Control xsi:type="CheckBox_t"     ID="s4" label="Allow Dark Pool"       parameterRef="AllowDarkPool" />
        <Control xsi:type="DropDownList_t" ID="s5" label="Time In Force"         parameterRef="TimeInForce" />
        <Control xsi:type="TextField_t"    ID="s6" label="Display Qty (Iceberg)" parameterRef="DisplayQty" />
        <Control xsi:type="TextField_t"    ID="s7" label="Trader Notes"          parameterRef="Notes" />
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
        <Control xsi:type="Clock_t"     ID="t1" label="Start Time"         parameterRef="StartTime" />
        <Control xsi:type="Clock_t"     ID="t2" label="End Time"           parameterRef="EndTime" />
        <Control xsi:type="TextField_t" ID="t3" label="Slice Interval (s)" parameterRef="SliceInterval" />
      </StrategyPanel>
      <StrategyPanel orientation="vertical" title="Price Settings">
        <Control xsi:type="RadioButtonList_t" ID="t4" label="Order Type"    parameterRef="OrderType" />
        <Control xsi:type="TextField_t"       ID="t5" label="Limit Offset"  parameterRef="LimitOffset" />
        <Control xsi:type="CheckBox_t"        ID="t6" label="Aggressive Mode" parameterRef="Aggressive" />
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
        <Control xsi:type="Clock_t"        ID="p5" label="Start Time"      parameterRef="StartTime" />
        <Control xsi:type="Clock_t"        ID="p6" label="End Time"        parameterRef="EndTime" />
      </StrategyPanel>
    </StrategyLayout>
  </Strategy>

</Strategies>`;

/* ─── Control Field ─── */
function ControlField({ control, param, value, onChange, errors }) {
  const hasError = errors?.[control.paramRef];
  const baseInput = 'w-full px-3 py-2 rounded-lg border text-xs font-mono outline-none transition-all';
  const inputStyle = {
    background: 'var(--background)',
    borderColor: hasError ? '#ef4444' : 'var(--border)',
    color: 'var(--foreground)',
  };
  const label = control.label || control.paramRef || control.id;
  const ep = param?.enumPairs || [];

  const renderInput = () => {
    switch (control.type) {
      case 'checkbox': {
        const on = value === 'Y' || value === true || value === 'true';
        return (
          <label className='flex items-center gap-3 cursor-pointer select-none'>
            <button
              type='button'
              onClick={() => onChange(on ? 'N' : 'Y')}
              className='relative w-10 h-[22px] rounded-full transition-colors duration-200 shrink-0'
              style={{ background: on ? 'var(--primary)' : 'var(--border)' }}
            >
              <div
                className='absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all duration-200'
                style={{ left: on ? '22px' : '3px' }}
              />
            </button>
            <span className='text-xs font-mono' style={{ color: on ? 'var(--foreground)' : 'var(--text-muted)' }}>
              {on ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        );
      }
      case 'radio':
        return (
          <div className='flex flex-wrap gap-2'>
            {ep.map(e => (
              <button
                key={e.enumID}
                type='button'
                onClick={() => onChange(e.enumID)}
                className='flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg border transition-all'
                style={value === e.enumID
                  ? { background: 'var(--primary-faint)', borderColor: 'var(--primary-border)', color: 'var(--foreground)' }
                  : { borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'transparent' }
                }
              >
                <div
                  className='w-2.5 h-2.5 rounded-full border-2 shrink-0 transition-all'
                  style={value === e.enumID
                    ? { borderColor: 'var(--primary)', background: 'var(--primary)' }
                    : { borderColor: 'var(--text-muted)' }
                  }
                />
                {e.uiRep}
              </button>
            ))}
          </div>
        );
      case 'select':
        return (
          <select value={value || ''} onChange={x => onChange(x.target.value)} className={baseInput} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value=''>— Select —</option>
            {ep.map(e => <option key={e.enumID} value={e.enumID}>{e.uiRep}</option>)}
          </select>
        );
      case 'slider': {
        const min = parseFloat(param?.minValue || '0');
        const max = parseFloat(param?.maxValue || '1');
        const step = (max - min) <= 1 ? 0.01 : 1;
        const nv = value !== '' && value !== undefined ? parseFloat(value) : min;
        const pct = max > min ? Math.round(((nv - min) / (max - min)) * 100) : 0;
        const disp = (max - min) <= 1 ? (Math.round(nv * 100) + '%') : nv;
        return (
          <div className='space-y-2'>
            <input
              type='range' min={min} max={max} step={step} value={nv}
              onChange={x => onChange(x.target.value)}
              className='w-full h-1.5 rounded-full appearance-none cursor-pointer'
              style={{ background: `linear-gradient(to right, var(--primary) ${pct}%, var(--border) ${pct}%)` }}
            />
            <div className='flex justify-between items-center'>
              <span className='text-[10px] font-mono' style={{ color: 'var(--text-muted)' }}>{min}</span>
              <span className='text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg border'
                style={{ background: 'var(--primary-faint)', borderColor: 'var(--primary-border)', color: 'var(--foreground)' }}
              >{disp}</span>
              <span className='text-[10px] font-mono' style={{ color: 'var(--text-muted)' }}>{max}</span>
            </div>
          </div>
        );
      }
      case 'time':
        return <input type='time' value={value || ''} onChange={x => onChange(x.target.value)} className={baseInput} style={inputStyle} />;
      case 'date':
        return <input type='date' value={value || ''} onChange={x => onChange(x.target.value)} className={baseInput} style={inputStyle} />;
      case 'spinner':
        return (
          <input type='number' value={value || ''} onChange={x => onChange(x.target.value)}
            min={param?.minValue || undefined} max={param?.maxValue || undefined}
            step={param?.type?.toLowerCase().includes('percent') ? '0.01' : '1'}
            placeholder={param?.defaultValue || ''} className={baseInput} style={inputStyle}
          />
        );
      default:
        return <input type='text' value={value || ''} onChange={x => onChange(x.target.value)} placeholder={param?.defaultValue || ''} className={baseInput} style={inputStyle} />;
    }
  };

  return (
    <div className='space-y-1.5'>
      <div className='flex items-center gap-1.5 flex-wrap'>
        <label className='text-[11px] font-semibold uppercase tracking-wide' style={{ color: 'var(--text-muted)' }}>
          {label}{param?.required && <span className='text-red-400 ml-0.5'>*</span>}
        </label>
        {param?.fixTag && (
          <span className='text-[9px] font-mono px-1.5 py-0.5 rounded'
            style={{ background: 'var(--primary-faint)', color: 'var(--primary)', border: '1px solid var(--primary-border)' }}
          >Tag {param.fixTag}</span>
        )}
        {(control.tooltip || param?.description) && (
          <span title={control.tooltip || param?.description} className='cursor-help'>
            <Info className='h-3 w-3' style={{ color: 'var(--text-muted)' }} />
          </span>
        )}
      </div>
      {renderInput()}
      {hasError && (
        <p className='text-[10px] text-red-400 flex items-center gap-1'>
          <AlertTriangle className='h-3 w-3' />{errors[control.paramRef]}
        </p>
      )}
    </div>
  );
}

/* ─── Panel Group (recursive, collapsible) ─── */
function PanelGroup({ group, values, onChange, errors, depth = 0 }) {
  const [collapsed, setCollapsed] = useState(false);
  const hasControls = group.controls.length > 0;
  const hasSubGroups = group.subGroups?.length > 0;
  if (!hasControls && !hasSubGroups) return null;
  return (
    <div className='rounded-xl border overflow-hidden'
      style={{ borderColor: 'var(--border)', background: depth > 0 ? 'var(--background)' : 'var(--card)', marginTop: depth > 0 ? '12px' : '0' }}
    >
      {group.label && (
        <button
          onClick={() => setCollapsed(c => !c)}
          className='w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--primary-faint)]'
          style={{ borderBottom: !collapsed ? '1px solid var(--border)' : 'none' }}
        >
          <div className='flex items-center gap-2'>
            {depth > 0 && <ChevronRight className='h-3 w-3' style={{ color: 'var(--primary)' }} />}
            <span className='text-xs font-bold uppercase tracking-wider' style={{ color: 'var(--foreground)' }}>{group.label}</span>
            <span className='text-[9px] font-mono' style={{ color: 'var(--text-muted)' }}>{group.controls.length} field{group.controls.length !== 1 ? 's' : ''}{hasSubGroups ? ` + ${group.subGroups.length} sub-panel${group.subGroups.length !== 1 ? 's' : ''}` : ''}</span>
          </div>
          {collapsed
            ? <ChevronRight className='h-3.5 w-3.5 shrink-0' style={{ color: 'var(--text-muted)' }} />
            : <ChevronDown className='h-3.5 w-3.5 shrink-0' style={{ color: 'var(--text-muted)' }} />
          }
        </button>
      )}
      {!collapsed && (
        <div className='p-4 space-y-5'>
          {group.controls.map((ctrl, i) => (
            <ControlField key={ctrl.id || i} control={ctrl} param={ctrl.param}
              value={values[ctrl.paramRef] ?? ctrl.param?.defaultValue ?? ctrl.initValue ?? ''}
              onChange={val => onChange(ctrl.paramRef, val)} errors={errors}
            />
          ))}
          {/* Sub-panels rendered inline below controls */}
          {group.subGroups?.map((sg, i) => (
            <PanelGroup key={i} group={sg} values={values} onChange={onChange} errors={errors} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Analytics Panel ─── */
function AnalyticsPanel({ strategy, parsed, values, fixParts }) {
  const params = strategy?.parameters || [];
  const total = params.filter(p => !p.constValue).length;
  const filled = params.filter(p => !p.constValue && values[p.name] !== undefined && values[p.name] !== '').length;
  const required = params.filter(p => p.required && !p.constValue).length;
  const requiredFilled = params.filter(p => p.required && !p.constValue && values[p.name] !== undefined && values[p.name] !== '').length;
  const consts = params.filter(p => p.constValue).length;
  const fillPct = total > 0 ? Math.round((filled / total) * 100) : 0;
  const reqPct = required > 0 ? Math.round((requiredFilled / required) * 100) : 100;

  // Strategy-level counts from full parsed result
  const strategyCount = parsed?.strategies?.length ?? 1;
  const totalParamsAllStrats = parsed?.strategies?.reduce((sum, s) => sum + s.parameters.length, 0) ?? params.length;
  const totalPanelsAllStrats = parsed?.strategies?.reduce((sum, s) => sum + s.groups.length, 0) ?? (strategy?.groups?.length ?? 0);
  const optional = params.filter(p => !p.required && !p.constValue).length;
  const withEnums = params.filter(p => p.enumPairs?.length > 0).length;

  return (
    <div className='rounded-xl border overflow-hidden' style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
      <div className='px-4 py-3 border-b flex items-center gap-2' style={{ borderColor: 'var(--border)' }}>
        <BarChart3 className='h-3.5 w-3.5' style={{ color: 'var(--primary)' }} />
        <span className='text-xs font-bold'>Analytics</span>
      </div>
      <div className='p-4 space-y-4'>
        <div className='space-y-2'>
          <div className='flex justify-between'>
            <span className='text-[10px] font-mono uppercase tracking-wider' style={{ color: 'var(--text-muted)' }}>Fill Progress</span>
            <span className='text-[10px] font-mono font-bold' style={{ color: 'var(--foreground)' }}>{filled}/{total}</span>
          </div>
          <div className='h-1.5 rounded-full overflow-hidden' style={{ background: 'var(--border)' }}>
            <div className='h-full rounded-full transition-all duration-500'
              style={{ width: fillPct + '%', background: fillPct === 100 ? '#10b981' : 'var(--primary)' }} />
          </div>
        </div>
        <div className='space-y-2'>
          <div className='flex justify-between'>
            <span className='text-[10px] font-mono uppercase tracking-wider' style={{ color: 'var(--text-muted)' }}>Required Fields</span>
            <span className='text-[10px] font-mono font-bold' style={{ color: reqPct === 100 ? '#10b981' : '#f87171' }}>{requiredFilled}/{required}</span>
          </div>
          <div className='h-1.5 rounded-full overflow-hidden' style={{ background: 'var(--border)' }}>
            <div className='h-full rounded-full transition-all duration-500'
              style={{ width: reqPct + '%', background: reqPct === 100 ? '#10b981' : '#ef4444' }} />
          </div>
        </div>

        {/* Current strategy stat chips */}
        <div className='grid grid-cols-3 gap-2'>
          {[
            { label: 'Total', value: total, color: 'var(--text-muted)' },
            { label: 'Required', value: required, color: '#f87171' },
            { label: 'Optional', value: optional, color: 'var(--foreground)' },
          ].map(s => (
            <div key={s.label} className='rounded-lg p-2 text-center border' style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
              <div className='text-sm font-bold' style={{ color: s.color }}>{s.value}</div>
              <div className='text-[9px] font-mono uppercase tracking-wider mt-0.5' style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Strategy overview */}
        <div className='space-y-1.5'>
          <p className='text-[10px] font-mono uppercase tracking-wider' style={{ color: 'var(--text-muted)' }}>Document Overview</p>
          <div className='rounded-lg border overflow-hidden' style={{ borderColor: 'var(--border)' }}>
            {[
              { label: 'Strategies', value: strategyCount },
              { label: 'Total Parameters', value: totalParamsAllStrats },
              { label: 'Total Panels', value: totalPanelsAllStrats },
              { label: 'Const Parameters', value: consts },
              { label: 'Enum Parameters', value: withEnums },
            ].map((row, i) => (
              <div key={row.label}
                className='flex items-center justify-between px-3 py-1.5'
                style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}
              >
                <span className='text-[10px] font-mono' style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                <span className='text-[10px] font-mono font-bold' style={{ color: 'var(--foreground)' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
        {fixParts.length > 0 && (
          <div className='rounded-lg p-3 border' style={{ borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.06)' }}>
            <p className='text-[10px] font-mono uppercase tracking-wider mb-1' style={{ color: '#10b981' }}>
              FIX Output — {fixParts.length} tag{fixParts.length !== 1 ? 's' : ''}
            </p>
            <p className='text-[10px] font-mono break-all' style={{ color: 'var(--text-muted)' }}>
              {fixParts.map(p => p.split('=')[0]).join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function XmlContentModal({ isOpen, onClose, content, onChange, onParse, errors }) {
  if (!isOpen) return null;
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-3'>
      <div className='absolute inset-0 bg-black/80' style={{ zIndex: 10 }} onClick={onClose} />
      <div className='relative z-20 w-full max-w-3xl rounded-xl border bg-[var(--card)] p-2 md:p-4 shadow-2xl' style={{ borderColor: 'var(--border)' }}>
        <div className='flex items-center justify-between gap-3 mb-4'>
          <div>
            <h2 className='text-sm font-semibold' style={{ color: 'var(--foreground)' }}>XML Content</h2>
            <p className='text-[11px] text-[var(--text-muted)]'>Review or edit the current Atdl XML content.</p>
          </div>
          <button type='button' onClick={onClose} className='text-xs font-semibold p-1.5 rounded-lg border' style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
            <X className='h-4 w-4' />
          </button>
        </div>
        <textarea
          value={content}
          onChange={e => onChange(e.target.value)}
          className='w-full h-[60vh] min-h-[320px] p-4 rounded-xl text-xs font-mono bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] outline-none resize-none'
          spellCheck={false}
        />
        <div className='mt-2 flex flex-wrap items-center gap-3'>
          <button type='button' onClick={() => onParse(content)} disabled={!content.trim()} className='fx-btn-primary py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed'>
            <Play className='h-3.5 w-3.5' /> Parse &amp; Render
          </button>
        </div>
        {errors.length > 0 && (
          <div className='mt-3 p-3 rounded-lg border text-xs font-mono space-y-1' style={{ background: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}>
            {errors.map((e, idx) => <p key={idx}>{e}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function ATDLRendererPage() {
  const [inputMode, setInputMode] = useState('file');
  const [xmlInput, setXmlInput] = useState('');
  const [loadedFileName, setLoadedFileName] = useState('');
  const [parsed, setParsed] = useState(null);
  const [parseErrors, setParseErrors] = useState([]);
  const [activeStratIdx, setActiveStratIdx] = useState(0);
  const [values, setValues] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [fixPreview, setFixPreview] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => { setIsLoaded(true); }, []);

  const handleParse = useCallback((xml) => {
    const src = xml !== undefined ? xml : xmlInput;
    if (!src.trim()) { setParsed(null); setParseErrors([]); return; }
    const result = parseATDL(src);
    setParsed(result);
    setParseErrors(result.errors);
    setActiveStratIdx(0);
    setValues({});
    setValidationErrors({});
    setFixPreview('');
  }, [xmlInput]);

  const handleFileLoaded = (content, fileName) => {
    setXmlInput(content);
    setLoadedFileName(fileName);
    handleParse(content);
  };

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => handleFileLoaded(e.target.result, file.name);
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/xml': ['.xml', '.atdl'], 'application/xml': ['.xml', '.atdl'] },
    multiple: false,
  });

  const handleLoadDemo = () => {
    setXmlInput(DEMO_ATDL);
    setLoadedFileName('demo.xml');
    handleParse(DEMO_ATDL);
  };

  const [showXmlModal, setShowXmlModal] = useState(false);

  const handleClear = () => {
    setXmlInput('');
    setLoadedFileName('');
    setParsed(null);
    setParseErrors([]);
    setFixPreview('');
    setValues({});
    setValidationErrors({});
    setShowXmlModal(false);
  };

  const handleStrategySwitch = (idx) => {
    setActiveStratIdx(idx);
    setValues({});
    setValidationErrors({});
    setFixPreview('');
  };

  const activeStrategy = parsed?.strategies?.[activeStratIdx];

  const handleValueChange = (paramRef, val) => {
    setValues(prev => {
      const next = { ...prev, [paramRef]: val };
      if (activeStrategy) setFixPreview(buildFIX(activeStrategy, next));
      return next;
    });
    setValidationErrors(prev => { const n = { ...prev }; delete n[paramRef]; return n; });
  };

  const handleValidate = () => {
    if (!activeStrategy) return;
    const errs = {};
    for (const p of activeStrategy.parameters) {
      if (p.constValue) continue;
      const v = values[p.name];
      if (p.required && (v === undefined || v === '' || v === null)) { errs[p.name] = 'Required field'; continue; }
      if (v !== undefined && v !== '') {
        const num = parseFloat(v);
        if (p.minValue !== '' && p.minValue !== undefined && !isNaN(num) && num < parseFloat(p.minValue))
          errs[p.name] = 'Min: ' + p.minValue;
        if (p.maxValue !== '' && p.maxValue !== undefined && !isNaN(num) && num > parseFloat(p.maxValue))
          errs[p.name] = 'Max: ' + p.maxValue;
      }
    }
    setValidationErrors(errs);
    if (Object.keys(errs).length === 0) setFixPreview(buildFIX(activeStrategy, values));
  };

  const handleReset = () => { setValues({}); setValidationErrors({}); setFixPreview(''); };

  const handleCopy = () => {
    if (!fixPreview) return;
    navigator.clipboard.writeText(fixPreview.replace(/\u0001/g, '|'))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleDownload = () => {
    if (!fixPreview) return;
    const blob = new Blob([fixPreview.replace(/\u0001/g, '|')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (activeStrategy?.name || 'atdl') + '_params.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const isValid = parsed?.strategies?.length > 0 && parseErrors.length === 0;
  const vpCount = activeStrategy?.parameters?.filter(p => !p.constValue).length ?? 0;
  const filledCount = activeStrategy?.parameters?.filter(p => !p.constValue && values[p.name] !== undefined && values[p.name] !== '').length ?? 0;
  const errCount = Object.keys(validationErrors).length;
  const fixParts = fixPreview ? fixPreview.split('\u0001').filter(Boolean) : [];

  return (
    <div className='min-h-screen' style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <main className={`max-w-[1400px] mx-auto w-full px-2 sm:px-3 md:px-4 py-6 space-y-5 transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>

        {/* ── Page Header ── */}
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h1 className='text-xl font-bold tracking-tight flex items-center gap-2.5'>
              <div className='p-1.5 rounded-lg' style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}>
                <UserCog className='h-5 w-5' style={{ color: 'var(--primary)' }} />
              </div>
              FIXatdl Renderer
            </h1>
            <p className='text-xs mt-0.5' style={{ color: 'var(--text-muted)' }}>
              Parse FIXatdl 1.1 strategy XML · render interactive controls · generate FIX wire
            </p>
          </div>
        </div>

        {/* ── Input Card (File | Paste tabs — same as Latency page) ── */}
        {!isValid && (
          <div className='rounded-xl overflow-hidden' style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
            {/* Tab header */}
            <div className='px-5 py-3.5 flex items-center justify-between' style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
              <div className='fx-tab-group'>
                <button className={`fx-tab${inputMode === 'file' ? ' active' : ''}`} onClick={() => setInputMode('file')}>
                  <UploadCloud className='h-3.5 w-3.5' />
                  <span className='hidden sm:inline'>File / Drop</span>
                </button>
                <button className={`fx-tab${inputMode === 'paste' ? ' active' : ''}`} onClick={() => setInputMode('paste')}>
                  <FileText className='h-3.5 w-3.5' />
                  <span className='hidden sm:inline'>Paste XML</span>
                </button>
              </div>
              <button onClick={handleLoadDemo} className='fx-btn-primary py-1 px-3 text-[10px]'>
                <Sparkles className='h-3 w-3' /> Load Demo
              </button>
            </div>

            {/* Tab body */}
            <div className='p-6'>
              {inputMode === 'file' ? (
                <div
                  {...getRootProps()}
                  className='border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all'
                  style={{
                    borderColor: isDragActive ? 'var(--primary)' : 'var(--border)',
                    background: isDragActive ? 'var(--primary-faint)' : 'var(--background)',
                  }}
                >
                  <input {...getInputProps()} />
                  <UploadCloud
                    className='h-10 w-10 mx-auto mb-3'
                    style={{ color: isDragActive ? 'var(--primary)' : 'var(--text-muted)' }}
                  />
                  <p className='text-sm font-semibold' style={{ color: 'var(--foreground)' }}>
                    {isDragActive ? 'Drop to parse…' : 'Drag & drop ATDL strategy file'}
                  </p>
                  <p className='text-xs mt-1' style={{ color: 'var(--text-muted)' }}>
                    Supports .xml · .atdl · FIXatdl 1.1
                  </p>
                </div>
              ) : (
                <div className='space-y-3'>
                  <textarea
                    value={xmlInput}
                    onChange={e => setXmlInput(e.target.value)}
                    placeholder='Paste FIXatdl 1.1 XML here…&#10;&#10;<Strategies xmlns="http://www.fixprotocol.org/FIXatdl-1-1/Core">&#10;  <Strategy name="VWAP" ...>'
                    className='w-full h-64 p-4 rounded-xl resize-none text-xs font-mono outline-none'
                    style={{
                      background: 'var(--background)',
                      border: '1px solid var(--border)',
                      color: 'var(--foreground)',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                    spellCheck={false}
                  />
                  <button
                    onClick={() => handleParse()}
                    disabled={!xmlInput.trim()}
                    className='w-full fx-btn-primary justify-center py-2'
                  >
                    <Play className='h-3.5 w-3.5' /> Parse &amp; Render
                  </button>
                </div>
              )}

              {parseErrors.length > 0 && (
                <div className='mt-4 p-3 rounded-lg border text-xs font-mono space-y-1'
                  style={{ background: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}
                >
                  {parseErrors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Loaded file banner ── */}
        {isValid && (
          <div className='flex items-center gap-3 p-2 md:px-4 md:py-2.5 rounded-xl border'
            style={{ borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.06)' }}
          >
            <div className='flex h-2 w-2 shrink-0'>
              <span className='animate-ping absolute inline-flex h-2 w-2 rounded-full opacity-75' style={{ background: '#10b981' }} />
              <span className='relative inline-flex rounded-full h-2 w-2' style={{ background: '#10b981' }} />
            </div>
            <button
              type='button'
              onClick={() => setShowXmlModal(true)}
              className='text-xs font-mono font-semibold underline underline-offset-2 transition-colors hover:text-white'
              style={{ color: '#34d399' }}
            >
              {loadedFileName || 'XML'}
            </button>
            <span className='text-xs hidden md:inline' style={{ color: 'var(--text-muted)' }}>
              — {parsed.strategies.length} {parsed.strategies.length === 1 ? 'strategy' : 'strategies'} loaded
            </span>
            <div className='ml-auto flex items-center gap-2'>
              <button
                onClick={handleReset}
                className='text-[12px] font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors hover:bg-[var(--primary-faint)]'
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                <RotateCcw className='h-3 w-3' /> Reset
              </button>
              <button
                onClick={handleClear}
                className='text-[12px] font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors hover:bg-red-500/10'
                style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}
              >
                <Trash2 className='h-3 w-3' /> Clear All
              </button>
            </div>
          </div>
        )}

        <XmlContentModal
          isOpen={showXmlModal}
          onClose={() => setShowXmlModal(false)}
          content={xmlInput}
          onChange={setXmlInput}
          onParse={(content) => { handleParse(content); setShowXmlModal(false); }}
          errors={parseErrors}
        />

        {/* ── Main Renderer ── */}
        {isValid && activeStrategy && (
          <div className='space-y-4'>

            {/* Strategy + sub-strategy selector */}
            <div className='rounded-xl border overflow-hidden' style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              <div className='px-4 py-3 flex flex-wrap items-center gap-3' style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
                <Layers className='h-4 w-4 shrink-0 hidden md:inline' style={{ color: 'var(--primary)' }} />
                <span className='text-xs font-semibold' style={{ color: 'var(--text-muted)' }}>Strategy</span>
                <select
                  value={activeStratIdx}
                  onChange={e => handleStrategySwitch(Number(e.target.value))}
                  className='flex-1 min-w-[160px] max-w-xs px-3 py-1.5 rounded-lg border text-xs font-mono outline-none transition-all cursor-pointer'
                  style={{ background: 'var(--background)', borderColor: 'var(--primary-border)', color: 'var(--foreground)' }}
                >
                  {parsed.strategies.map((s, i) => (
                    <option key={i} value={i}>
                      {s.uiRep || s.name}
                    </option>
                  ))}
                </select>

                {/* Sub-panel quick-jump dropdown if multiple panels */}
                {activeStrategy.groups.length > 1 && (
                  <>
                    <span className='text-[10px]' style={{ color: 'var(--border)' }}>|</span>
                    <span className='text-xs font-semibold' style={{ color: 'var(--text-muted)' }}>Panel</span>
                    <select
                      className='min-w-[140px] px-3 py-1.5 rounded-lg border text-xs font-mono outline-none cursor-pointer transition-all'
                      style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                      onChange={e => {
                        const el = document.getElementById('atdl-panel-' + e.target.value);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      defaultValue=''
                    >
                      <option value=''>Jump to panel…</option>
                      {activeStrategy.groups.map((g, i) => (
                        <option key={i} value={i}>{g.label || 'Panel ' + (i + 1)}</option>
                      ))}
                    </select>
                  </>
                )}

                <div className='ml-auto flex items-center gap-2.5'>
                  <span className='text-[10px] font-mono' style={{ color: 'var(--text-muted)' }}>{filledCount}/{vpCount} filled</span>
                  <div className='w-20 h-1.5 rounded-full overflow-hidden' style={{ background: 'var(--border)' }}>
                    <div className='h-full rounded-full transition-all duration-500'
                      style={{
                        width: vpCount > 0 ? Math.round((filledCount / vpCount) * 100) + '%' : '0%',
                        background: filledCount === vpCount && vpCount > 0 ? '#10b981' : 'var(--primary)',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Strategy description */}
              {activeStrategy.description && (
                <div className='px-4 py-2.5 flex items-start gap-2 text-xs' style={{ color: 'var(--text-muted)' }}>
                  <Info className='h-3.5 w-3.5 shrink-0 mt-0.5' style={{ color: 'var(--primary)' }} />
                  {activeStrategy.description}
                </div>
              )}
            </div>

            {/* Two-column layout */}
            <div className='grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5'>

              {/* Left: Form panels */}
              <div className='space-y-4'>
                {activeStrategy.groups.map((group, i) => (
                  <div key={i} id={'atdl-panel-' + i}>
                    <PanelGroup group={group} values={values} onChange={handleValueChange} errors={validationErrors} />
                  </div>
                ))}

                {/* Action bar */}
                <div className='flex flex-wrap gap-2 pt-1'>
                  <button onClick={handleValidate} className='fx-btn-primary py-2 px-4'>
                    <CheckCircle2 className='h-3.5 w-3.5' /> Validate &amp; Preview FIX
                  </button>
                  <button
                    onClick={handleReset}
                    className='px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors hover:bg-[var(--primary-faint)]'
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    <RotateCcw className='h-3.5 w-3.5' /> Reset Fields
                  </button>
                  {fixParts.length > 0 && errCount === 0 && (
                    <span className='px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5'
                      style={{ borderColor: 'rgba(16,185,129,0.4)', color: '#34d399', background: 'rgba(16,185,129,0.08)' }}
                    >
                      <CheckCircle2 className='h-3.5 w-3.5' /> Valid — {fixParts.length} tag{fixParts.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {errCount > 0 && (
                    <span className='px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5'
                      style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#f87171', background: 'rgba(239,68,68,0.08)' }}
                    >
                      <AlertTriangle className='h-3.5 w-3.5' /> {errCount} error{errCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Right Sidebar */}
              <div className='space-y-4'>

                {/* Analytics */}
                <AnalyticsPanel strategy={activeStrategy} parsed={parsed} values={values} fixParts={fixParts} />

                {/* Parameter Map */}
                <div className='rounded-xl border overflow-hidden' style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                  <div className='px-4 py-3 border-b flex items-center gap-2' style={{ borderColor: 'var(--border)' }}>
                    <Hash className='h-3.5 w-3.5' style={{ color: 'var(--primary)' }} />
                    <span className='text-xs font-bold'>Parameter Map</span>
                    <span className='text-[10px] font-mono ml-auto' style={{ color: 'var(--text-muted)' }}>
                      {activeStrategy.parameters.length} params
                    </span>
                  </div>
                  <div className='overflow-y-auto' style={{ maxHeight: '220px' }}>
                    <table className='w-full text-[10px] font-mono'>
                      <thead>
                        <tr style={{ background: 'var(--background)', color: 'var(--text-muted)', position: 'sticky', top: 0 }}>
                          <th className='px-3 py-2 text-left font-semibold'>Name</th>
                          <th className='px-3 py-2 text-left font-semibold'>Tag</th>
                          <th className='px-3 py-2 text-left font-semibold'>Type</th>
                          <th className='px-3 py-2 text-left font-semibold'>Value</th>
                          <th className='px-3 py-2 text-left font-semibold'>R</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeStrategy.parameters.map((p, i) => {
                          const val = p.constValue || values[p.name] || '';
                          const shortType = p.type.replace('_t', '').replace('UTCTimestamp', 'Timestamp').replace('Percentage', 'Pct');
                          return (
                            <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                              <td className='px-3 py-1.5 font-semibold' style={{ color: 'var(--foreground)' }}>{p.name}</td>
                              <td className='px-3 py-1.5' style={{ color: 'var(--primary)' }}>{p.fixTag || '—'}</td>
                              <td className='px-3 py-1.5'>
                                <span className='px-1.5 py-0.5 rounded text-[9px] font-mono' style={{ background: 'var(--primary-faint)', color: 'var(--primary)', border: '1px solid var(--primary-border)' }}>
                                  {shortType}
                                </span>
                              </td>
                              <td className='px-3 py-1.5 max-w-[60px] truncate' style={{ color: val ? '#10b981' : 'var(--border)' }}>
                                {val || '—'}
                              </td>
                              <td className='px-3 py-1.5'>
                                {p.required ? <span style={{ color: '#f87171' }}>●</span> : <span style={{ color: 'var(--border)' }}>○</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* FIX Wire Preview */}
                <div className='rounded-xl border overflow-hidden' style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                  <div className='px-4 py-3 border-b flex items-center justify-between' style={{ borderColor: 'var(--border)' }}>
                    <div className='flex items-center gap-2'>
                      <Code2 className='h-3.5 w-3.5' style={{ color: 'var(--primary)' }} />
                      <span className='text-xs font-bold'>FIX Wire Preview</span>
                      {fixParts.length > 0 && (
                        <span className='text-[9px] font-mono px-1.5 py-0.5 rounded border'
                          style={{ borderColor: 'rgba(16,185,129,0.3)', color: '#10b981', background: 'rgba(16,185,129,0.08)' }}
                        >{fixParts.length} tags</span>
                      )}
                    </div>
                    <div className='flex items-center gap-1.5'>
                      {fixPreview && (
                        <>
                          <button onClick={handleCopy} title='Copy' className='p-1.5 rounded-lg border transition-colors hover:bg-[var(--primary-faint)]' style={{ borderColor: 'var(--border)' }}>
                            {copied ? <Check className='h-3 w-3 text-emerald-400' /> : <Copy className='h-3 w-3' style={{ color: 'var(--text-muted)' }} />}
                          </button>
                          <button onClick={handleDownload} title='Download' className='p-1.5 rounded-lg border transition-colors hover:bg-[var(--primary-faint)]' style={{ borderColor: 'var(--border)' }}>
                            <Download className='h-3 w-3' style={{ color: 'var(--text-muted)' }} />
                          </button>
                        </>
                      )}
                      <button onClick={() => setShowPreview(v => !v)} className='p-1.5 rounded-lg border transition-colors hover:bg-[var(--primary-faint)]' style={{ borderColor: 'var(--border)' }}>
                        {showPreview ? <EyeOff className='h-3 w-3' style={{ color: 'var(--text-muted)' }} /> : <Eye className='h-3 w-3' style={{ color: 'var(--text-muted)' }} />}
                      </button>
                    </div>
                  </div>

                  {showPreview && (
                    <div className='p-4'>
                      {fixParts.length > 0 ? (
                        <div className='space-y-0.5'>
                          {fixParts.map((part, i) => {
                            const ei = part.indexOf('=');
                            const tag = ei > -1 ? part.slice(0, ei) : part;
                            const val = ei > -1 ? part.slice(ei + 1) : '';
                            return (
                              <div key={i} className='flex items-baseline gap-2 text-[10px] font-mono py-1 px-1.5 rounded transition-colors hover:bg-[var(--primary-faint)]'>
                                <span className='shrink-0 w-10 text-right font-bold' style={{ color: 'var(--primary)' }}>{tag}</span>
                                <span style={{ color: 'var(--text-muted)' }}>=</span>
                                <span style={{ color: 'var(--foreground)' }}>{val}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className='text-[11px] text-center py-6' style={{ color: 'var(--text-muted)' }}>
                          Fill parameters then click<br />
                          <strong style={{ color: 'var(--foreground)' }}>Validate &amp; Preview FIX</strong>
                        </p>
                      )}
                    </div>
                  )}

                  {fixParts.length > 0 && (
                    <div className='px-4 pb-4 pt-0 border-t' style={{ borderColor: 'var(--border)' }}>
                      <p className='text-[9px] font-mono uppercase tracking-wider mb-1.5 pt-3' style={{ color: 'var(--text-muted)' }}>
                        Raw SOH string <span className='normal-case opacity-60'>(SOH → |)</span>
                      </p>
                      <p className='text-[9px] font-mono break-all leading-relaxed p-2 rounded border'
                        style={{ color: 'var(--foreground)', background: 'var(--background)', borderColor: 'var(--border)' }}
                      >
                        {fixPreview.replace(/\u0001/g, '|')}
                      </p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
