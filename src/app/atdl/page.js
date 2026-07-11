'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  UploadCloud, FileText, Play, RotateCcw, Copy, Check,
  ChevronRight, ChevronDown, Info, AlertTriangle,
  CheckCircle2, Sparkles, Download, Eye, EyeOff, Hash, Layers,
  Code2, UserCog, BarChart3, Trash2, Search, X,
} from 'lucide-react';

/* ─── ATDL Parser — FIXatdl 1.1 + 1.2 ─── */
function parseATDL(xmlString) {
  if (!xmlString.trim()) return { strategies: [], errors: [], version: '' };
  let doc;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xmlString, 'application/xml');
    const pe = doc.querySelector('parsererror');
    if (pe) return { strategies: [], errors: ['XML Parse Error: ' + pe.textContent.slice(0, 300)], version: '' };
  } catch (e) { return { strategies: [], errors: ['Parse failed: ' + e.message], version: '' }; }

  // Detect FIXatdl version from namespace
  const rootNS = doc.documentElement.getAttribute('xmlns') || '';
  const version = rootNS.includes('1-2') ? '1.2' : rootNS.includes('1-1') ? '1.1' : '1.x';

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
  const warnings = [];
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
      if (findAll(p, 'Activation').length) warnings.push(`Unsupported Parameter activation/condition for '${param.name || 'unknown'}'`);
      if (findAll(p, 'Condition').length) warnings.push(`Unsupported Parameter condition for '${param.name || 'unknown'}'`);
      if (findAll(p, 'Integration').length) warnings.push(`Unsupported Parameter integration for '${param.name || 'unknown'}'`);
      strat.parameters.push(param);
    }

    if (findAll(s, 'Integration').length) warnings.push(`Unsupported Strategy integration for '${strat.name}'`);
    if (findAll(s, 'Activation').length || findAll(s, 'Condition').length) {
      warnings.push(`Unsupported Strategy activation/conditional rendering for '${strat.name}'`);
    }
    if (findAll(s, 'SubStrategy').length) warnings.push(`Unsupported nested SubStrategy inside '${strat.name}'`);

    const le = findAll(s, 'StrategyLayout')[0];
    strat.groups = le
      ? parseLayoutGroups(le, strat.parameters, findAll, ga, warnings)
      : [{
          label: 'Parameters', orientation: 'vertical', subGroups: [],
          collapsible: true, startCollapsed: false,
          controls: strat.parameters.map(p => ({
            id: p.name, paramRef: p.name, label: p.name,
            type: inferControlType(p.type, p.enumPairs),
            tooltip: p.description, initValue: p.defaultValue, param: p,
          })),
        }];
    strategies.push(strat);
  }
  return { strategies, errors: [], warnings, version };
}

function parseLayoutGroups(layoutEl, parameters, findAll, ga, warnings) {
  const proc = (el, depth = 0) => {
    const label = ga(el, 'title', 'label', 'name') || (depth === 0 ? 'Settings' : '');
    const collapsible = ga(el, 'collapsible') !== 'false';
    const startCollapsed = ga(el, 'collapsed') === 'true';
    const controls = [];
    const subGroups = [];
    for (const c of Array.from(el.children)) {
      if (c.localName === 'Control') {
        const pr = ga(c, 'parameterRef');
        const param = parameters.find(p => p.name === pr);
        const et = ga(c, 'xsi:type', 'type');
        const initPolicy = ga(c, 'initPolicy') || 'UseInitValue';
        controls.push({
          id: ga(c, 'ID', 'id') || pr,
          paramRef: pr,
          label: ga(c, 'label', 'Label') || pr || '',
          type: et ? mapCT(et) : (param ? inferControlType(param.type, param.enumPairs) : 'text'),
          initValue: initPolicy !== 'UseParamDef'
            ? (ga(c, 'initValue', 'defaultVal') || (param?.defaultValue || ''))
            : (param?.defaultValue || ''),
          tooltip: ga(c, 'tooltip', 'description') || (param?.description || ''),
          param,
        });
      } else if (c.localName === 'StrategyPanel') {
        const n = proc(c, depth + 1);
        if (n) subGroups.push(n);
      }
    }
    return { label, orientation: ga(el, 'orientation') || 'vertical', controls, subGroups, collapsible, startCollapsed };
  };
  const groups = [];
  for (const c of Array.from(layoutEl.children)) {
    if (c.localName === 'StrategyPanel') groups.push(proc(c));
  }
  if (groups.length === 0) groups.push(proc(layoutEl));
  return groups;
}

function mapCT(t, paramName = '') {
  t = t.toLowerCase();
  if (t.includes('spinner'))     return 'spinner';
  if (t.includes('multiselect')) return 'multiselect';
  if (t.includes('hidden'))      return 'hidden';
  if (t.includes('monthyear'))   return 'monthyear';
  if (t.includes('localmktdate')) return 'date';
  if (t.includes('clock') || t.includes('time')) return 'time';
  if (t.includes('date'))        return 'date';
  if (t.includes('radiobutton') || t.includes('singleselectlist')) return 'radio';
  if (t.includes('checkbox'))    return 'checkbox';
  if (t.includes('dropdown') || t.includes('editablelist')) return 'select';
  if (t.includes('slider'))      return 'slider';
  return 'text';
}

function inferControlType(pt, ep, paramName = '') {
  if (ep && ep.length > 0) {
    if (/security|region|venue|type/i.test(paramName)) return 'select';
    return ep.length <= 4 ? 'radio' : 'select';
  }
  const t = (pt || '').toLowerCase();
  if (t.includes('bool'))        return 'checkbox';
  if (t.includes('utctimestamp') || (t.includes('time') && !t.includes('date'))) return 'time';
  if (t.includes('monthyear'))   return 'monthyear';
  if (t.includes('localmktdate') || t.includes('date')) return 'date';
  if (t.includes('multiplestringvalue') || t.includes('multiplecharvalue')) return 'multiselect';
  if (t.includes('float') || t.includes('price') || t.includes('qty') || t.includes('percent') || t.includes('int')) return 'spinner';
  return 'text';
}

function isNumericParameter(param) {
  const t = (param?.type || '').toLowerCase();
  const n = (param?.name || '').toLowerCase();
  return /int|qty|quantity|price|percent|float|double|decimal/.test(t) || /qty|quantity|amount|price|percent/.test(n);
}

function isIntegerParameter(param) {
  const t = (param?.type || '').toLowerCase();
  const n = (param?.name || '').toLowerCase();
  return /(^|\W)(int|qty|quantity)(\W|$)/.test(t) || /qty|quantity/.test(n);
}

function validateParameterValue(param, value) {
  if (!param) return '';
  const raw = String(value ?? '').trim();
  if (raw === '') return '';
  const minValue = param.minValue !== '' && param.minValue !== undefined ? parseFloat(param.minValue) : undefined;
  const maxValue = param.maxValue !== '' && param.maxValue !== undefined ? parseFloat(param.maxValue) : undefined;
  const numericField = minValue !== undefined || maxValue !== undefined || isNumericParameter(param);
  if (numericField) {
    if (!/^-?\d+(\.\d+)?$/.test(raw)) return 'Must be a number';
    const num = Number(raw);
    if (!Number.isFinite(num)) return 'Must be a number';
    const isInteger = isIntegerParameter(param);
    if (isInteger && !Number.isInteger(num)) return 'Must be an integer';
    if (minValue !== undefined && num < minValue) return 'Min: ' + param.minValue;
    if (maxValue !== undefined && num > maxValue) return 'Max: ' + param.maxValue;
    if (minValue === undefined && /qty|quantity/i.test(param.name) && num < 0) return 'Must be zero or positive';
  }
  return '';
}

function buildFIX(strategy, values) {
  if (!strategy) return '';
  const parts = [];
  for (const p of strategy.parameters) {
    if (p.constValue) { if (p.fixTag) parts.push(p.fixTag + '=' + p.constValue); continue; }
    const v = values[p.name];
    if (v === undefined || v === '' || v === null) continue;

    const mapToken = (tok) => {
      const t = String(tok);
      if (p.enumPairs && p.enumPairs.length > 0) {
        const f = p.enumPairs.find(e => e.enumID === t || e.wireValue === t || e.uiRep === t);
        return f ? (f.wireValue || t) : t;
      }
      return t;
    };

    let wv;
    if (p.enumPairs && p.enumPairs.length > 0) {
      if (Array.isArray(v)) {
        wv = v.map(mapToken).join(' ');
      } else if (typeof v === 'string' && /\s/.test(v)) {
        wv = v.split(/\s+/).map(mapToken).join(' ');
      } else {
        wv = mapToken(v);
      }
    } else {
      wv = String(v);
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
function ControlField({ control, param, value, onChange, errors, dirty }) {
  const hasError = errors?.[control.paramRef];
  const isDirty = dirty?.[control.paramRef];
  const baseInput = 'fx-input w-full text-xs';
  const inputStyle = {
    borderColor: hasError ? '#ef4444' : isDirty ? 'var(--primary-faint)' : undefined,
  };
  const label = control.label || control.paramRef || control.id;
  const ep = param?.enumPairs || [];

  const wrapStyle = {
    borderLeft: hasError ? '2px solid #ef4444' : isDirty ? '2px solid var(--primary)' : param?.required ? '2px solid var(--primary-border)' : '2px solid transparent',
    paddingLeft: '10px',
  };

  const renderInput = () => {
    switch (control.type) {
      case 'checkbox': {
        const on = value === 'Y' || value === true || value === 'true';
        return (
          <label className='flex items-center gap-3 cursor-pointer select-none'>
            <button
              type='button'
              onClick={() => onChange(on ? 'N' : 'Y')}
              className='relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0'
              style={{ background: on ? 'var(--primary)' : 'var(--border)' }}
            >
              <div
                className='absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow transition-all duration-200'
                style={{ left: on ? '23px' : '3px' }}
              />
            </button>
            <span className='text-xs font-mono font-semibold' style={{ color: on ? 'var(--foreground)' : 'var(--text-muted)' }}>
              {on ? 'ON' : 'OFF'}
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
          <div className='relative'>
            <select value={value || ''} onChange={x => onChange(x.target.value)}
              className={baseInput + ' pr-8 appearance-none cursor-pointer'}
              style={{ ...inputStyle, background: 'var(--background)', color: 'var(--foreground)' }}
            >
              <option value=''>— Select —</option>
              {ep.map(e => <option key={e.enumID} value={e.enumID}>{e.uiRep}</option>)}
            </select>
            <ChevronDown className='pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5' style={{ color: 'var(--text-muted)' }} />
          </div>
        );
      case 'slider': {
        const min = !isNaN(parseFloat(param?.minValue)) ? parseFloat(param.minValue) : 0;
        const max = !isNaN(parseFloat(param?.maxValue)) ? parseFloat(param.maxValue) : (param?.type?.toLowerCase().includes('percent') ? 1 : 100);
        const step = (max - min) <= 1 ? 0.01 : 1;
        const nv = value !== '' && value !== undefined ? parseFloat(value) : min;
        const pct = max > min ? Math.round(((nv - min) / (max - min)) * 100) : 0;
        const disp = (param?.type?.toLowerCase().includes('percent') ? (Math.round(nv * 100) + '%') : nv);
        return (
          <div className='space-y-2'>
            <input
              type='range' min={min} max={max} step={step} value={nv}
              onChange={x => onChange(x.target.value)}
              className='w-full h-2 rounded-full appearance-none cursor-pointer'
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
      case 'spinner': {
        const spinnerMin = param?.minValue !== '' && param?.minValue !== undefined ? param.minValue : undefined;
        const spinnerMax = param?.maxValue !== '' && param?.maxValue !== undefined ? param.maxValue : undefined;
        const isInteger = isIntegerParameter(param);
        const spinnerStep = isInteger ? '1' : (param?.type?.toLowerCase().includes('percent') ? '0.01' : 'any');
        return (
          <input type='number' value={value || ''} onChange={x => onChange(x.target.value)}
            min={spinnerMin} max={spinnerMax}
            step={spinnerStep} inputMode={isInteger ? 'numeric' : 'decimal'}
            placeholder={param?.defaultValue || 'Enter value…'} className={baseInput} style={inputStyle}
          />
        );
      }
      case 'multiselect':
        return (
          <div className='flex flex-wrap gap-2'>
            {ep.length > 0 ? ep.map(e => {
              const checked = (value || '').split(' ').includes(e.enumID);
              return (
                <label key={e.enumID}
                  className='flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border cursor-pointer select-none transition-all'
                  style={checked
                    ? { background: 'var(--primary-faint)', borderColor: 'var(--primary-border)', color: 'var(--foreground)' }
                    : { borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'transparent' }
                  }
                >
                  <input type='checkbox' className='sr-only' checked={checked} onChange={() => {
                    const cur = (value || '').split(' ').filter(Boolean);
                    const next = checked ? cur.filter(x => x !== e.enumID) : [...cur, e.enumID];
                    onChange(next.join(' '));
                  }} />
                  <div className='w-3 h-3 rounded border flex items-center justify-center shrink-0'
                    style={{ borderColor: checked ? 'var(--primary)' : 'var(--border)', background: checked ? 'var(--primary)' : 'transparent' }}
                  >
                    {checked && <Check className='h-2 w-2 text-white' />}
                  </div>
                  {e.uiRep}
                </label>
              );
            }) : <input type='text' value={value || ''} onChange={x => onChange(x.target.value)} placeholder='Space-separated values' className={baseInput} style={inputStyle} />}
          </div>
        );
      case 'monthyear': {
        const myCur = value || '';
        const myYear = myCur.length >= 4 ? myCur.slice(0, 4) : '';
        const myMonth = myCur.length >= 6 ? myCur.slice(4, 6) : '';
        return (
          <div className='flex gap-2'>
            <div className='relative flex-1'>
              <select value={myMonth} onChange={x => onChange((myYear || new Date().getFullYear().toString()) + x.target.value)}
                className={baseInput + ' pr-8 appearance-none cursor-pointer'}
                style={{ ...inputStyle, background: 'var(--background)', color: 'var(--foreground)' }}
              >
                <option value=''>Month</option>
                {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                  <option key={m} value={m}>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]}</option>
                ))}
              </select>
              <ChevronDown className='pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5' style={{ color: 'var(--text-muted)' }} />
            </div>
            <input type='number' value={myYear} min='2000' max='2099' placeholder='YYYY'
              onChange={x => onChange(x.target.value.slice(0,4) + myMonth)}
              className={baseInput + ' w-24'} style={inputStyle}
            />
          </div>
        );
      }
      case 'hidden':
        return (
          <span className='text-[10px] font-mono px-2 py-1 rounded border italic'
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'var(--background)' }}
          >(hidden{value ? ' — ' + value : ''})</span>
        );
      default:
        return <input type='text' value={value || ''} onChange={x => onChange(x.target.value)} placeholder={param?.defaultValue || 'Enter value…'} className={baseInput} style={inputStyle} />;
    }
  };

  return (
    <div className='space-y-1.5 transition-all' style={wrapStyle}>
      <div className='flex items-center gap-1.5 flex-wrap'>
        <label className='text-[11px] font-semibold' style={{ color: 'var(--text-muted)' }}>
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
      {(param?.defaultValue || param?.minValue || param?.maxValue || param?.constValue) && (
        <div className='text-[10px] text-[var(--text-muted)] space-y-0.5'>
          {param?.constValue && <div>Fixed: {param.constValue}</div>}
          {param?.defaultValue && <div>Default: {param.defaultValue}</div>}
          {(param?.minValue || param?.maxValue) && (
            <div>Range: {param?.minValue || '-'} to {param?.maxValue || '-'}</div>
          )}
        </div>
      )}
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
function PanelGroup({ group, values, onChange, errors, dirty, depth = 0 }) {
  const [collapsed, setCollapsed] = useState(!!group.startCollapsed);
  const canCollapse = group.collapsible !== false;
  const hasControls = group.controls.length > 0;
  const hasSubGroups = group.subGroups?.length > 0;
  const horizontal = group.orientation === 'horizontal';
  if (!hasControls && !hasSubGroups) return null;
  return (
    <div className='rounded-xl border overflow-hidden'
      style={{ borderColor: 'var(--border)', background: depth > 0 ? 'var(--background)' : 'var(--card)', marginTop: depth > 0 ? '12px' : '0' }}
    >
      {group.label && (
        <button
          onClick={() => canCollapse && setCollapsed(c => !c)}
          className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors${canCollapse ? ' hover:bg-[var(--primary-faint)] cursor-pointer' : ' cursor-default'}`}
          style={{ borderBottom: !collapsed ? '1px solid var(--border)' : 'none' }}
        >
          <div className='flex items-center gap-2'>
            {depth > 0 && <ChevronRight className='h-3 w-3' style={{ color: 'var(--primary)' }} />}
            <span className='text-xs font-bold' style={{ color: 'var(--foreground)' }}>{group.label}</span>
            <span className='text-[9px] font-mono' style={{ color: 'var(--text-muted)' }}>
              {group.controls.length} field{group.controls.length !== 1 ? 's' : ''}
              {hasSubGroups ? ` · ${group.subGroups.length} sub-panel${group.subGroups.length !== 1 ? 's' : ''}` : ''}
            </span>
          </div>
          <ChevronDown
            className='h-3.5 w-3.5 shrink-0 transition-transform duration-200'
            style={{ color: 'var(--text-muted)', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          />
        </button>
      )}
      {!collapsed && (
        <div className={`p-4 ${horizontal ? 'flex flex-wrap gap-4' : 'space-y-5'}`}>
          {group.controls.map((ctrl, i) => (
            <div key={ctrl.id || i} className={horizontal ? 'flex-1 min-w-[240px]' : ''}>
              <ControlField control={ctrl} param={ctrl.param}
                value={values[ctrl.paramRef] ?? ctrl.param?.defaultValue ?? ctrl.initValue ?? ''}
                onChange={val => onChange(ctrl.paramRef, val)} errors={errors} dirty={dirty}
              />
            </div>
          ))}
          {group.subGroups?.map((sg, i) => (
            <PanelGroup key={i} group={sg} values={values} onChange={onChange} errors={errors} dirty={dirty} depth={depth + 1} />
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
  const optional = params.filter(p => !p.required && !p.constValue).length;
  const withEnums = params.filter(p => p.enumPairs?.length > 0).length;
  const panelCount = strategy?.groups?.reduce((sum, g) => sum + 1 + (g.subGroups?.length || 0), 0) || 0;
  const fillPct = total > 0 ? Math.round((filled / total) * 100) : 0;
  const reqPct = required > 0 ? Math.round((requiredFilled / required) * 100) : 100;

  const strategyCount = parsed?.strategies?.length ?? 1;
  const totalParamsAllStrats = parsed?.strategies?.reduce((sum, s) => sum + s.parameters.length, 0) ?? params.length;
  const totalPanelsAllStrats = parsed?.strategies?.reduce((sum, s) => sum + s.groups.length, 0) ?? (strategy?.groups?.length ?? 0);
  const activeLabel = strategy?.uiRep || strategy?.name || 'Current Strategy';
  const statusReady = fillPct === 100 && reqPct === 100;

  // SVG ring
  const r = 28, circ = 2 * Math.PI * r;
  const dash = circ - (fillPct / 100) * circ;

  return (
    <div className='rounded-xl border overflow-hidden' style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
      <div className='p-4 space-y-4'>

        <div className='rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4'>
          <div className='flex items-start justify-between gap-3'>
            <div className='min-w-0'>
              <p className='text-xs font-semibold uppercase tracking-[0.12em]' style={{ color: 'var(--text-muted)' }}>Strategy</p>
              <div className='flex items-center gap-2'>
                {strategy?.description && (
                  <span className='group relative inline-flex items-center justify-center rounded-full overflow-visible text-[var(--text-muted)]'>
                    <Info className='h-3 w-3' />
                    <span className='pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-64 -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 text-[10px] text-[var(--text-muted)] shadow-lg group-hover:flex'>
                      <span className='text-[10px] leading-5'>{strategy.description}</span>
                      <span className='absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rotate-45 bg-[var(--card)] border border-[var(--border)] border-b-0 border-l-0 z-50' />
                    </span>
                  </span>
                )}
                <p className='text-sm font-bold' style={{ color: 'var(--foreground)' }}>{activeLabel}</p>
              </div>
            </div>
            <span className={`rounded-full px-1.5 py-0.75 text-[10px] font-semibold uppercase whitespace-nowrap ${statusReady ? 'border border-emerald-300 bg-emerald-50 text-emerald-700' : 'border border-slate-300 bg-slate-50 text-slate-800'}`}>
              {statusReady ? 'Ready' : 'Needs input'}
            </span>
          </div>
          <div className='mt-4 grid grid-cols-2 gap-2'>
            <div className='rounded-xl border px-3 py-2' style={{ borderColor: 'var(--border)' }}>
              <p className='text-[9px] uppercase font-semibold tracking-[0.18em]' style={{ color: 'var(--text-muted)' }}>Fields filled</p>
              <p className='text-sm font-bold' style={{ color: 'var(--foreground)' }}>{filled}/{total}</p>
            </div>
            <div className='rounded-xl border px-3 py-2' style={{ borderColor: 'var(--border)' }}>
              <p className='text-[9px] uppercase font-semibold tracking-[0.18em]' style={{ color: 'var(--text-muted)' }}>Req. complete</p>
              <p className='text-sm font-bold' style={{ color: 'var(--foreground)' }}>{requiredFilled}/{required}</p>
            </div>
            <div className='rounded-xl border px-3 py-2' style={{ borderColor: 'var(--border)' }}>
              <p className='text-[9px] uppercase font-semibold tracking-[0.18em]' style={{ color: 'var(--text-muted)' }}>Enum controls</p>
              <p className='text-sm font-bold' style={{ color: 'var(--foreground)' }}>{withEnums}</p>
            </div>
            <div className='rounded-xl border px-3 py-2' style={{ borderColor: 'var(--border)' }}>
              <p className='text-[9px] uppercase font-semibold tracking-[0.18em]' style={{ color: 'var(--text-muted)' }}>Panels</p>
              <p className='text-sm font-bold' style={{ color: 'var(--foreground)' }}>{panelCount}</p>
            </div>
          </div>
        </div>

        <div className='flex items-center gap-4'>
          <div className='relative shrink-0'>
            <svg width='72' height='72' viewBox='0 0 72 72'>
              <circle cx='36' cy='36' r={r} fill='none' stroke='var(--border)' strokeWidth='5' />
              <circle cx='36' cy='36' r={r} fill='none'
                stroke={fillPct === 100 ? '#10b981' : 'var(--primary)'}
                strokeWidth='5' strokeDasharray={circ} strokeDashoffset={dash}
                strokeLinecap='round' style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            <div className='absolute inset-0 flex flex-col items-center justify-center'>
              <span className='text-sm font-bold' style={{ color: fillPct === 100 ? '#10b981' : 'var(--foreground)' }}>{fillPct}%</span>
              <span className='text-[8px] font-mono' style={{ color: 'var(--text-muted)' }}>filled</span>
            </div>
          </div>
          <div className='flex-1 space-y-3'>
            <div>
              <div className='flex justify-between text-[10px] font-mono uppercase tracking-wider whitespace-nowrap' style={{ color: 'var(--text-muted)' }}>
                <span>Field Fill</span>
                <span>{filled}/{total}</span>
              </div>
              <div className='mt-2 h-1.5 rounded-full overflow-hidden' style={{ background: 'var(--border)' }}>
                <div className='h-full rounded-full transition-all duration-500' style={{ width: `${fillPct}%`, background: fillPct === 100 ? '#10b981' : 'var(--primary)' }} />
              </div>
            </div>
            <div>
              <div className='flex justify-between text-[10px] font-mono uppercase tracking-wider' style={{ color: 'var(--text-muted)' }}>
                <span>Required Complete</span>
                <span>{requiredFilled}/{required}</span>
              </div>
              <div className='mt-2 h-1.5 rounded-full overflow-hidden' style={{ background: 'var(--border)' }}>
                <div className='h-full rounded-full transition-all duration-500' style={{ width: `${reqPct}%`, background: reqPct === 100 ? '#10b981' : '#ef4444' }} />
              </div>
            </div>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-2'>
          {[
            { label: 'Optional', value: optional, color: 'var(--text-muted)' },
            { label: 'Constants', value: consts, color: 'var(--primary)' },
            { label: 'Strategies', value: strategyCount, color: 'var(--foreground)' },
            { label: 'Total Params', value: totalParamsAllStrats, color: 'var(--foreground)' },
          ].map(s => (
            <div key={s.label} className='rounded-lg border px-3 py-3' style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
              <p className='text-[10px] uppercase tracking-[0.18em]' style={{ color: 'var(--text-muted)' }}>{s.label}</p>
              <p className='text-lg font-semibold' style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className='rounded-xl border p-3' style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
          <p className='text-[10px] font-semibold uppercase tracking-[0.18em]' style={{ color: 'var(--text-muted)' }}>FIX Tag Summary</p>
          {fixParts.length > 0 ? (
            <p className='mt-2 text-[10px] font-mono break-all' style={{ color: 'var(--foreground)' }}>
              {fixParts.map(p => p.split('=')[0]).join(', ')}
            </p>
          ) : (
            <p className='mt-2 text-[10px] text-[var(--text-muted)]'>No FIX tags yet. Fill required fields to preview output.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Parameter Map with search ─── */
function ParameterMap({ parameters, values }) {
  const [search, setSearch] = useState('');
  const filtered = parameters.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.fixTag.includes(search) || p.type.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className='rounded-xl border overflow-hidden' style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
      <div className='px-4 py-3 border-b flex items-center gap-2' style={{ borderColor: 'var(--border)' }}>
        <Hash className='h-3.5 w-3.5' style={{ color: 'var(--primary)' }} />
        <span className='text-xs font-bold'>Parameter Map</span>
        <span className='text-[10px] font-mono ml-auto' style={{ color: 'var(--text-muted)' }}>{parameters.length} params</span>
      </div>
      {/* Search */}
      <div className='px-3 py-2 border-b' style={{ borderColor: 'var(--border)' }}>
        <div className='relative'>
          <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3' style={{ color: 'var(--text-muted)' }} />
          <input
            type='text'
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='Filter by name, tag, or type…'
            className='w-full pl-7 pr-3 py-1.5 text-[10px] font-mono rounded-lg border outline-none'
            style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className='absolute right-2 top-1/2 -translate-y-1/2'>
              <X className='h-3 w-3' style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>
      </div>
      <div className='overflow-y-auto' style={{ maxHeight: '220px' }}>
        <table className='w-full text-[10px] font-mono'>
          <thead>
            <tr style={{ background: 'var(--background)', color: 'var(--text-muted)', position: 'sticky', top: 0 }}>
              <th className='px-3 py-2 text-left font-semibold'>Name</th>
              <th className='px-3 py-2 text-left font-semibold'>Tag</th>
              <th className='px-3 py-2 text-left font-semibold'>Type</th>
              <th className='px-3 py-2 text-left font-semibold'>Value</th>
              <th className='px-3 py-2 text-left font-semibold'>Req</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className='px-3 py-4 text-center' style={{ color: 'var(--text-muted)' }}>No matches</td></tr>
            ) : filtered.map((p, i) => {
              const val = p.constValue || values[p.name] || '';
              const shortType = p.type.replace('_t', '').replace('UTCTimestamp', 'Timestamp').replace('Percentage', 'Pct');
              return (
                <tr key={i} className='hover:bg-[var(--primary-faint)] transition-colors' style={{ borderTop: '1px solid var(--border)' }}>
                  <td className='px-3 py-1.5 font-semibold' style={{ color: 'var(--foreground)' }}>{p.name}</td>
                  <td className='px-3 py-1.5' style={{ color: 'var(--primary)' }}>{p.fixTag || '—'}</td>
                  <td className='px-3 py-1.5'>
                    <span className='px-1.5 py-0.5 rounded text-[9px] font-mono'
                      style={{ background: 'var(--primary-faint)', color: 'var(--primary)', border: '1px solid var(--primary-border)' }}
                    >{shortType}</span>
                  </td>
                  <td className='px-3 py-1.5 max-w-[60px] truncate' style={{ color: val ? '#10b981' : 'var(--border)' }} title={val || undefined}>
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
  );
}

/* ─── XML Content Modal ─── */
function XmlContentModal({ isOpen, onClose, content, onChange, onParse, errors }) {
  if (!isOpen) return null;
  const lineCount = content ? content.split('\n').length : 0;
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <div className='absolute inset-0 bg-black/80' style={{ zIndex: 10 }} onClick={onClose} />
      <div className='relative z-20 w-full max-w-3xl rounded-xl border bg-[var(--card)] p-3 md:p-4 shadow-2xl' style={{ borderColor: 'var(--border)' }}>
        <div className='flex items-center justify-between gap-3 mb-4'>
          <div>
            <h2 className='text-sm font-semibold' style={{ color: 'var(--foreground)' }}>XML Content</h2>
            <p className='text-[11px] text-[var(--text-muted)]'>{lineCount} lines · Review or edit the ATDL XML</p>
          </div>
          <button type='button' onClick={onClose} className='fx-btn-secondary p-1.5'>
            <X className='h-4 w-4' />
          </button>
        </div>
        <textarea
          value={content}
          onChange={e => onChange(e.target.value)}
          className='w-full h-[60vh] min-h-[320px] p-4 rounded-xl text-[11px] font-mono bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] outline-none resize-none'
          style={{ letterSpacing: '-0.01em' }}
          spellCheck={false}
        />
        <div className='mt-2 flex flex-wrap items-center gap-3'>
          <button type='button' onClick={() => onParse(content)} disabled={!content.trim()} className='fx-btn-primary py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed'>
            <Play className='h-3.5 w-3.5' /> Parse & Render
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
  const [renderWarnings, setRenderWarnings] = useState([]);
  const [activeStratIdx, setActiveStratIdx] = useState(0);
  const [values, setValues] = useState({});
  const [dirty, setDirty] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [fixPreview, setFixPreview] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showXmlModal, setShowXmlModal] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => { setIsLoaded(true); }, []);

  const handleParse = useCallback((xml) => {
    const src = xml !== undefined ? xml : xmlInput;
    if (!src.trim()) { setParsed(null); setParseErrors([]); setRenderWarnings([]); return; }
    const result = parseATDL(src);
    setParsed(result);
    setParseErrors(result.errors);
    setRenderWarnings(result.warnings || []);
    setActiveStratIdx(0);
    const initialValues = {};
    const first = result.strategies[0];
    if (first) {
      first.parameters.forEach(p => {
        if (!p.constValue && p.defaultValue !== '') initialValues[p.name] = p.defaultValue;
      });
    }
    setValues(initialValues);
    setDirty({});
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
    setLoadedFileName('demo.atdl');
    handleParse(DEMO_ATDL);
  };

  const handleClear = () => {
    setXmlInput('');
    setLoadedFileName('');
    setParsed(null);
    setParseErrors([]);
    setFixPreview('');
    setValues({});
    setDirty({});
    setValidationErrors({});
    setShowXmlModal(false);
  };

  const handleStrategySwitch = (idx) => {
    setActiveStratIdx(idx);
    const strat = parsed?.strategies?.[idx];
    const initialValues = {};
    strat?.parameters.forEach(p => {
      if (!p.constValue && p.defaultValue !== '') initialValues[p.name] = p.defaultValue;
    });
    setValues(initialValues);
    setDirty({});
    setValidationErrors({});
    setFixPreview('');
  };

  const activeStrategy = parsed?.strategies?.[activeStratIdx];

  const handleValueChange = (paramRef, val) => {
    const nextValues = { ...values, [paramRef]: val };
    const nextErrors = { ...validationErrors };
    const param = activeStrategy?.parameters.find(p => p.name === paramRef);
    if (param) {
      const fieldError = validateParameterValue(param, val);
      if (fieldError) nextErrors[paramRef] = fieldError;
      else delete nextErrors[paramRef];
    }
    setValues(nextValues);
    setDirty(prev => ({ ...prev, [paramRef]: true }));
    setValidationErrors(nextErrors);
    if (activeStrategy) {
      if (Object.keys(nextErrors).length === 0) setFixPreview(buildFIX(activeStrategy, nextValues));
      else setFixPreview('');
    }
  };

  const handleValidate = () => {
    if (!activeStrategy) return;
    const errs = {};
    for (const p of activeStrategy.parameters) {
      if (p.constValue) continue;
      const v = values[p.name];
      if (p.required && (v === undefined || v === '' || v === null)) { errs[p.name] = 'Required field'; continue; }
      const fieldError = validateParameterValue(p, v);
      if (fieldError) { errs[p.name] = fieldError; continue; }
    }
    setValidationErrors(errs);
    if (Object.keys(errs).length === 0) setFixPreview(buildFIX(activeStrategy, values));
  };

  const handleReset = () => { setValues({}); setDirty({}); setValidationErrors({}); setFixPreview(''); };

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
  const atdlVersion = parsed?.version || '';

  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <main className={`space-y-8 max-w-screen-2xl mx-auto w-full px-2 sm:px-3 md:px-4 py-6 transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>

        {/* ── Page Header (matches latency page pattern) ── */}
        <div className={`fx-page-header flex flex-col md:flex-row md:items-start justify-between gap-4 ${!isValid ? 'max-w-2xl mx-auto' : ''}`}>
          <div className={`space-y-1.5 ${!isValid ? 'text-center md:text-left w-full' : ''}`}>
            <h1 className='text-2xl font-bold tracking-tight flex items-center justify-center md:justify-start gap-2.5' style={{ color: 'var(--foreground)' }}>
              <div className='h-9 w-9 rounded-xl flex items-center justify-center shrink-0'
                style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
              >
                <UserCog className='h-5 w-5' style={{ color: 'var(--primary)' }} />
              </div>
              <span>FIXatdl Renderer</span>
            </h1>
            <p className='text-sm' style={{ color: 'var(--text-muted)' }}>
              Parse FIXatdl 1.1 &amp; 1.2 strategy XML, render interactive controls, and generate FIX wire output
            </p>
          </div>
          {isValid && (
            <div className='flex items-center gap-2 shrink-0'>
              <button onClick={handleReset} className='fx-btn-secondary py-2 px-3 text-xs'>
                <RotateCcw className='h-3.5 w-3.5' /> Reset
              </button>
              <button onClick={handleClear} className='fx-btn-secondary py-2 px-3 text-xs' style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>
                <Trash2 className='h-3.5 w-3.5' /> Clear
              </button>
            </div>
          )}
        </div>

        {/* ── Input Card ── */}
        {!isValid && (
          <div className='max-w-2xl mx-auto space-y-4'>
            <div className='rounded-xl overflow-hidden' style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
              {/* Tab header */}
              <div className='px-5 py-3.5 flex items-center justify-between'
                style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
              >
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
                      className='h-10 w-10 mx-auto mb-3 transition-colors'
                      style={{ color: isDragActive ? 'var(--primary)' : 'var(--text-muted)' }}
                    />
                    <p className='text-sm font-semibold' style={{ color: 'var(--foreground)' }}>
                      {isDragActive ? 'Drop to parse…' : 'Drag & drop ATDL strategy file'}
                    </p>
                    <p className='text-xs mt-1' style={{ color: 'var(--text-muted)' }}>
                      Supports .xml · .atdl · FIXatdl 1.1 &amp; 1.2
                    </p>
                  </div>
                ) : (
                  <div className='space-y-3'>
                    <textarea
                      value={xmlInput}
                      onChange={e => setXmlInput(e.target.value)}
                      placeholder={'Paste FIXatdl 1.1 or 1.2 XML here…\n\n<Strategies xmlns="http://www.fixprotocol.org/FIXatdl-1-1/Core">\n  <Strategy name="VWAP" ...>'}
                      className='w-full h-64 p-4 rounded-xl resize-none text-xs font-mono outline-none'
                      style={{
                        background: 'var(--background)',
                        border: '1px solid var(--border)',
                        color: 'var(--foreground)',
                        letterSpacing: '-0.01em',
                      }}
                      onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                      onBlur={e => e.target.style.borderColor = 'var(--border)'}
                      spellCheck={false}
                    />
                    <button
                      onClick={() => handleParse()}
                      disabled={!xmlInput.trim()}
                      className='w-full fx-btn-primary justify-center py-2 disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      <Play className='h-3.5 w-3.5' /> Parse &amp; Render
                    </button>
                  </div>
                )}

                {parseErrors.length > 0 && (
                  <div className='mt-4 border-l-4 border-red-500 pl-3 pr-3 py-2 rounded-r-lg text-xs font-mono space-y-1'
                    style={{ background: 'rgba(239,68,68,0.07)', color: '#f87171' }}
                  >
                    {parseErrors.map((e, i) => <p key={i}>{e}</p>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Loaded file banner ── */}
        {isValid && (
          <div className='flex items-center gap-3 p-2 md:px-4 md:py-2.5 rounded-xl border'
            style={{ borderColor: 'var(--primary-faint)', background: 'var(--primary-faint)' }}
          >
            <span className='relative flex h-2 w-2 shrink-0'>
              <span className='animate-ping absolute inline-flex h-full w-full rounded-full opacity-75' style={{ background: 'var(--primary)' }} />
              <span className='relative inline-flex rounded-full h-2 w-2' style={{ background: 'var(--primary)' }} />
            </span>
            <button
              type='button'
              onClick={() => setShowXmlModal(true)}
              className='text-xs font-mono font-semibold underline underline-offset-2 transition-colors hover:opacity-70'
              style={{ color: 'var(--primary)' }}
            >
              {loadedFileName || 'XML'}
            </button>
            <span className='text-xs hidden md:inline' style={{ color: 'var(--text-muted)' }}>
              — {parsed.strategies.length} {parsed.strategies.length === 1 ? 'strategy' : 'strategies'}
            </span>
            {atdlVersion && (
              <span className='badge-success hidden md:inline text-[9px]'>FIXatdl {atdlVersion}</span>
            )}
          </div>
        )}

        {isValid && renderWarnings.length > 0 && (
          <div className='rounded-xl border-l-4 p-4 text-xs' style={{ borderColor: 'var(--primary)', background: 'rgba(59,130,246,0.08)', color: 'var(--foreground)' }}>
            <div className='font-semibold mb-2'>Render warnings</div>
            <ul className='list-disc list-inside space-y-1'>
              {renderWarnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
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

            {/* Strategy selector card */}
            <div className='rounded-xl border overflow-hidden' style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              <div className='px-4 py-3 flex flex-wrap items-center gap-3'
                style={{ borderBottom: '1px solid var(--border)', background: 'var(--background)' }}
              >
                <Layers className='h-4 w-4 shrink-0 hidden md:inline' style={{ color: 'var(--primary)' }} />

                <span className='text-xs font-semibold' style={{ color: 'var(--text-muted)' }}>Strategy</span>
                <select
                  value={activeStratIdx}
                  onChange={e => handleStrategySwitch(Number(e.target.value))}
                  className='w-full sm:flex-1 min-w-[160px] sm:max-w-xs px-3 py-2 rounded-lg border text-xs font-mono outline-none transition-all cursor-pointer'
                  style={{ background: 'var(--background)', borderColor: 'var(--primary-border)', color: 'var(--foreground)' }}
                  aria-label='Select strategy'
                  title='Select strategy'
                >
                  {parsed.strategies.map((s, i) => (
                    <option key={i} value={i}>{s.uiRep || s.name}</option>
                  ))}
                </select>
                <div className='relative w-full sm:w-auto'>
                  <select
                    className='w-full pl-3 pr-10 py-2 rounded-lg border text-xs font-mono outline-none cursor-pointer transition-all appearance-none'
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    onChange={e => {
                      const el = document.getElementById('atdl-panel-' + e.target.value);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    defaultValue=''
                    aria-label='Jump to panel'
                    title='Jump to panel'
                  >
                    <option value=''>Jump to panel…</option>
                    {activeStrategy.groups.map((g, i) => (
                      <option key={i} value={i}>{g.label || 'Panel ' + (i + 1)}</option>
                    ))}
                  </select>
                  <ChevronDown className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3' style={{ color: 'var(--text-muted)' }} />
                </div>

                {/* Right: validation status + fill bar */}
                <div className='ml-auto flex items-center gap-2.5'>
                  {fixParts.length > 0 && errCount === 0 && (
                    <span className='hidden sm:flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-lg border'
                      style={{ borderColor: 'rgba(16,185,129,0.4)', color: '#34d399', background: 'rgba(16,185,129,0.08)' }}
                    >
                      <CheckCircle2 className='h-3 w-3' /> Valid · {fixParts.length} tags
                    </span>
                  )}
                  {errCount > 0 && (
                    <span className='hidden sm:flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-lg border'
                      style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#f87171', background: 'rgba(239,68,68,0.08)' }}
                    >
                      <AlertTriangle className='h-3 w-3' /> {errCount} error{errCount > 1 ? 's' : ''}
                    </span>
                  )}
                  <span className='text-[10px] font-mono' style={{ color: 'var(--text-muted)' }}>{filledCount}/{vpCount}</span>
                  <div className='w-16 h-1.5 rounded-full overflow-hidden' style={{ background: 'var(--border)' }}>
                    <div className='h-full rounded-full transition-all duration-500'
                      style={{
                        width: vpCount > 0 ? Math.round((filledCount / vpCount) * 100) + '%' : '0%',
                        background: filledCount === vpCount && vpCount > 0 ? '#10b981' : 'var(--primary)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Two-column layout */}
            <div className='grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5'>

              {/* Left: Form panels */}
              <div className='space-y-4'>
                {activeStrategy.groups.map((group, i) => (
                  <div key={i} id={'atdl-panel-' + i}>
                    <PanelGroup group={group} values={values} onChange={handleValueChange} errors={validationErrors} dirty={dirty} />
                  </div>
                ))}

                {/* Action bar */}
                <div className='flex flex-wrap gap-2 pt-1'>
                  <button onClick={handleValidate} className='fx-btn-primary py-2 px-4'>
                    <CheckCircle2 className='h-3.5 w-3.5' /> Validate &amp; Preview FIX
                  </button>
                  <button onClick={handleReset} className='fx-btn-secondary py-2 px-3 text-xs'>
                    <RotateCcw className='h-3.5 w-3.5' /> Reset Fields
                  </button>
                  {/* Mobile-only status */}
                  {fixParts.length > 0 && errCount === 0 && (
                    <span className='sm:hidden px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5'
                      style={{ borderColor: 'rgba(16,185,129,0.4)', color: '#34d399', background: 'rgba(16,185,129,0.08)' }}
                    >
                      <CheckCircle2 className='h-3.5 w-3.5' /> Valid
                    </span>
                  )}
                  {errCount > 0 && (
                    <span className='sm:hidden px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5'
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
                <ParameterMap parameters={activeStrategy.parameters} values={values} />

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
