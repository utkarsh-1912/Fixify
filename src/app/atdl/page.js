'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  UploadCloud, FileText, Play, RotateCcw, Copy, Check,
  ChevronRight, ChevronDown, Info, AlertTriangle,
  CheckCircle2, Sparkles, Download, Eye, EyeOff, Hash, Layers,
  Code2, UserCog, BarChart3, Trash2, Search, X, Plus, FileCode2,
} from 'lucide-react';

/* ─── ATDL Parser — FIXatdl 1.1 + 1.2 ─── */
function parseEditElement(el) {
  if (!el) return null;
  const ga = (node, ...names) => {
    for (const n of names) { const v = node.getAttribute(n); if (v !== null) return v; }
    return '';
  };

  const logicOp = ga(el, 'logicOperator');
  const childEdits = Array.from(el.children).filter(c => c.localName === 'Edit');

  return {
    field: ga(el, 'field'),
    operator: ga(el, 'operator'),
    value: ga(el, 'value'),
    field2: ga(el, 'field2'),
    logicOperator: logicOp || (childEdits.length > 0 ? 'AND' : ''),
    edits: childEdits.map(parseEditElement).filter(Boolean),
  };
}

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
  const rootNS = doc.documentElement ? (doc.documentElement.getAttribute('xmlns') || '') : '';
  const version = rootNS.includes('1-2') ? '1.2' : rootNS.includes('1-1') ? '1.1' : '1.x';
  const strategyIdentifierTag = doc.documentElement ? (doc.documentElement.getAttribute('strategyIdentifierTag') || '7620') : '7620';

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
    let regionsVal = ga(s, 'regions', 'Regions');
    if (!regionsVal) {
      const regionsEl = findAll(s, 'Regions')[0];
      if (regionsEl) {
        regionsVal = findAll(regionsEl, 'Region')
          .filter(r => (r.getAttribute('inclusion') || 'Include') !== 'Exclude')
          .map(r => r.getAttribute('name'))
          .filter(Boolean)
          .join(' ');
      }
    }

    let securityTypesVal = ga(s, 'securityTypes', 'SecurityTypes');
    if (!securityTypesVal) {
      const secTypesEl = findAll(s, 'SecurityTypes')[0];
      if (secTypesEl) {
        securityTypesVal = findAll(secTypesEl, 'SecurityType')
          .filter(st => (st.getAttribute('inclusion') || 'Include') !== 'Exclude')
          .map(st => st.getAttribute('name'))
          .filter(Boolean)
          .join(' ');
      }
    }

    const strat = {
      name: ga(s, 'name', 'Name'),
      version: ga(s, 'version', 'Version'),
      providerID: ga(s, 'providerID', 'ProviderID'),
      uiRep: ga(s, 'uiRep', 'UIRep') || ga(s, 'name', 'Name'),
      regions: regionsVal,
      securityTypes: securityTypesVal,
      description: '',
      parameters: [],
      groups: [],
      validationRules: [],
      subStrategies: [],
    };
    const descEl = findAll(s, 'Description')[0];
    if (descEl) strat.description = descEl.textContent.trim();

    // Parse parameters
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
        trueWireValue: ga(p, 'trueWireValue'),
        falseWireValue: ga(p, 'falseWireValue'),
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

    // Parse sub-strategies
    for (const sub of findAll(s, 'SubStrategy')) {
      const subStrat = {
        name: ga(sub, 'name', 'Name'),
        uiRep: ga(sub, 'uiRep', 'UIRep') || ga(sub, 'name', 'Name'),
        description: '',
      };
      const subDesc = findAll(sub, 'Description')[0];
      if (subDesc) subStrat.description = subDesc.textContent.trim();
      strat.subStrategies.push(subStrat);
    }

    // Parse StrategyEdits (validation rules)
    for (const se of findAll(s, 'StrategyEdit')) {
      const editEl = findAll(se, 'Edit')[0];
      if (editEl) {
        strat.validationRules.push({
          errorMessage: ga(se, 'errorMessage') || 'Validation failed',
          edit: parseEditElement(editEl),
        });
      }
    }

    // Capture Integration / flow notes for feature coverage
    if (findAll(s, 'Integration').length) warnings.push(`Integration specifications defined inside strategy '${strat.name}'`);
    if (findAll(s, 'Activation').length || findAll(s, 'Condition').length) {
      warnings.push(`Dynamic activations/conditions defined inside strategy '${strat.name}'`);
    }

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
            stateRules: [],
            listItems: [],
          })),
        }];
    strategies.push(strat);
  }
  return { strategies, errors: [], warnings, version, strategyIdentifierTag };
}

function parseLayoutGroups(layoutEl, parameters = [], findAll, ga, warnings) {
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

        // Parse list items
        const listItems = [];
        for (const child of Array.from(c.children)) {
          if (child.localName === 'ListItem') {
            listItems.push({
              enumID: ga(child, 'enumID'),
              uiRep: ga(child, 'uiRep') || ga(child, 'enumID'),
            });
          }
        }

        // Parse StateRule workflow rules
        const stateRules = [];
        for (const child of Array.from(c.children)) {
          if (child.localName === 'StateRule') {
            const editEl = findAll(child, 'Edit')[0];
            stateRules.push({
              enabled: ga(child, 'enabled') === 'true' ? true : ga(child, 'enabled') === 'false' ? false : undefined,
              visible: ga(child, 'visible') === 'true' ? true : ga(child, 'visible') === 'false' ? false : undefined,
              value: ga(child, 'value'),
              edit: editEl ? parseEditElement(editEl) : null,
            });
          }
        }

        controls.push({
          id: ga(c, 'ID', 'id') || pr,
          paramRef: pr,
          label: ga(c, 'label', 'Label') || pr || '',
          type: et ? mapCT(et) : (param ? inferControlType(param.type, param.enumPairs) : 'text'),
          initValue: initPolicy !== 'UseParamDef'
            ? (ga(c, 'initValue', 'defaultVal') || (param?.defaultValue || ''))
            : (param?.defaultValue || ''),
          tooltip: ga(c, 'tooltip', 'description') || (param?.description || ''),
          checkedValue: ga(c, 'checkedValue'),
          uncheckedValue: ga(c, 'uncheckedValue'),
          param,
          listItems,
          stateRules,
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

function evaluateEdit(edit, values, isStateRule = false) {
  if (!edit) return true;
  const { field, operator, value, field2, logicOperator, edits } = edit;

  if (logicOperator) {
    const childEdits = edits || [];
    if (logicOperator === 'AND') {
      return childEdits.every(e => evaluateEdit(e, values, isStateRule));
    }
    if (logicOperator === 'OR') {
      return childEdits.some(e => evaluateEdit(e, values, isStateRule));
    }
    if (logicOperator === 'NOT') {
      return !evaluateEdit(childEdits[0], values, isStateRule);
    }
  }

  if (!field) return true;
  const val1 = values[field];
  const val2 = field2 ? values[field2] : value;

  const exists = val1 !== undefined && val1 !== '' && val1 !== null;
  if (operator === 'EX') return exists;
  if (operator === 'NX') return !exists;

  if (!exists) {
    // For state rules, if a field doesn't exist, comparisons fail (return false)
    // For validation rules, if optional field doesn't exist, we return true to pass validation
    return !isStateRule;
  }

  // Also check if field2 exists if field2 is specified
  if (field2) {
    const val2Exists = values[field2] !== undefined && values[field2] !== '' && values[field2] !== null;
    if (!val2Exists) {
      return !isStateRule;
    }
  }

  const v1 = parseFloat(val1);
  const v2 = parseFloat(val2);
  const isNumericComp = !isNaN(v1) && !isNaN(v2);

  switch (operator) {
    case 'EQ': return isNumericComp ? v1 === v2 : String(val1) === String(val2);
    case 'NE': return isNumericComp ? v1 !== v2 : String(val1) !== String(val2);
    case 'LT': return isNumericComp ? v1 < v2 : String(val1) < String(val2);
    case 'GT': return isNumericComp ? v1 > v2 : String(val1) > String(val2);
    case 'LE': return isNumericComp ? v1 <= v2 : String(val1) <= String(val2);
    case 'GE': return isNumericComp ? v1 >= v2 : String(val1) >= String(val2);
    default: return true;
  }
}

function evaluateControlState(control, values) {
  let enabled = true;
  let visible = true;
  let overriddenValue = undefined;

  if (control.stateRules && control.stateRules.length > 0) {
    for (const rule of control.stateRules) {
      const match = evaluateEdit(rule.edit, values, true);
      if (match) {
        if (rule.enabled !== undefined) enabled = rule.enabled;
        if (rule.visible !== undefined) visible = rule.visible;
        if (rule.value !== undefined) overriddenValue = rule.value;
      }
    }
  }

  return { enabled, visible, overriddenValue };
}

function getEffectiveValues(strategy, rawValues) {
  if (!strategy) return rawValues;
  const effective = { ...rawValues };
  
  let changed = true;
  let iterations = 0;
  
  const walk = (g, currentValues) => {
    if (g.controls) {
      g.controls.forEach(c => {
        if (!c.paramRef) return;
        const { enabled, visible, overriddenValue } = evaluateControlState(c, currentValues);
        
        // If overridden, set to overridden value
        if (overriddenValue !== undefined) {
          const resolvedOverridden = getEnumID(c.param, overriddenValue);
          if (currentValues[c.paramRef] !== resolvedOverridden) {
            currentValues[c.paramRef] = resolvedOverridden;
            changed = true;
          }
        }
      });
    }
    if (g.subGroups) {
      g.subGroups.forEach(sg => walk(sg, currentValues));
    }
  };

  while (changed && iterations < 5) {
    changed = false;
    iterations++;
    if (strategy.groups) {
      strategy.groups.forEach(g => walk(g, effective));
    }
  }
  
  return effective;
}

function getActiveParameters(strategy, values) {
  const activeSet = new Set();
  const walk = (g) => {
    if (g.controls) {
      g.controls.forEach(c => {
        if (c.paramRef) {
          const { visible, enabled } = evaluateControlState(c, values);
          if (visible && enabled) {
            activeSet.add(c.paramRef);
          }
        }
      });
    }
    if (g.subGroups) {
      g.subGroups.forEach(walk);
    }
  };
  if (strategy?.groups) {
    strategy.groups.forEach(walk);
  } else {
    if (strategy?.parameters) {
      strategy.parameters.forEach(p => activeSet.add(p.name));
    }
  }
  return activeSet;
}

function getEnumID(param, val) {
  if (!param || !param.enumPairs || param.enumPairs.length === 0) return val;
  const t = String(val);
  let f = param.enumPairs.find(e =>
    (e.enumID && e.enumID === t) ||
    (e.wireValue && e.wireValue === t) ||
    (e.uiRep && e.uiRep === t)
  );
  if (!f) {
    const tLower = t.toLowerCase();
    f = param.enumPairs.find(e =>
      (e.enumID && e.enumID.toLowerCase() === tLower) ||
      (e.wireValue && e.wireValue.toLowerCase() === tLower) ||
      (e.uiRep && e.uiRep.toLowerCase() === tLower)
    );
  }
  return f ? f.enumID : val;
}

function getInitialValues(strategy) {
  const initialValues = {};
  if (strategy?.parameters) {
    strategy.parameters.forEach(p => {
      if (!p.constValue && p.defaultValue !== '') {
        initialValues[p.name] = getEnumID(p, p.defaultValue);
      }
    });
  }

  const walk = (g) => {
    if (g.controls) {
      g.controls.forEach(c => {
        if (c.paramRef) {
          const val = c.initValue !== undefined && c.initValue !== '' ? c.initValue : undefined;
          if (val !== undefined) {
            initialValues[c.paramRef] = getEnumID(c.param, val);
          }
        }
      });
    }
    if (g.subGroups) {
      g.subGroups.forEach(walk);
    }
  };

  if (strategy?.groups) {
    strategy.groups.forEach(walk);
  }
  return initialValues;
}

function validateParameterValue(param, value) {
  if (!param) return '';
  const raw = String(value ?? '').trim();
  if (raw === '') return '';

  let valToValidate = raw;
  if (param.enumPairs && param.enumPairs.length > 0) {
    const f = param.enumPairs.find(e => e.enumID === raw || e.wireValue === raw || e.uiRep === raw);
    if (f) valToValidate = f.wireValue;
  }

  const minValue = param.minValue !== '' && param.minValue !== undefined ? parseFloat(param.minValue) : undefined;
  const maxValue = param.maxValue !== '' && param.maxValue !== undefined ? parseFloat(param.maxValue) : undefined;
  const numericField = minValue !== undefined || maxValue !== undefined || isNumericParameter(param);
  if (numericField) {
    if (!/^-?\d+(\.\d+)?$/.test(valToValidate)) return 'Must be a number';
    const num = Number(valToValidate);
    if (!Number.isFinite(num)) return 'Must be a number';
    const isInteger = isIntegerParameter(param);
    if (isInteger && !Number.isInteger(num)) return 'Must be an integer';
    if (minValue !== undefined && num < minValue) return 'Min: ' + param.minValue;
    if (maxValue !== undefined && num > maxValue) return 'Max: ' + param.maxValue;
    if (minValue === undefined && /qty|quantity/i.test(param.name) && num < 0) return 'Must be zero or positive';
  }
  return '';
}

function buildFIX(strategy, values = {}, delimiter = '\u0001', selectedSubStrategy = '') {
  if (!strategy) return '';
  const parts = [];

  // Filter parameter visibility & enablement
  const visibleParams = new Set();
  const walk = (g) => {
    if (g.controls) {
      g.controls.forEach(c => {
        if (c.paramRef) {
          const { visible, enabled } = evaluateControlState(c, values);
          if (visible && enabled) {
            visibleParams.add(c.paramRef);
          }
        }
      });
    }
    if (g.subGroups) {
      g.subGroups.forEach(walk);
    }
  };

  if (strategy.groups) {
    strategy.groups.forEach(walk);
  } else {
    if (strategy.parameters) {
      strategy.parameters.forEach(p => visibleParams.add(p.name));
    }
  }

  for (const p of strategy.parameters || []) {
    if (p.constValue) { if (p.fixTag) parts.push(p.fixTag + '=' + p.constValue); continue; }
    if (!visibleParams.has(p.name)) continue;

    const v = values[p.name];
    if (v === undefined || v === '' || v === null) continue;

    const mapToken = (tok) => {
      const t = String(tok);
      if (p.enumPairs && p.enumPairs.length > 0) {
        let f = p.enumPairs.find(e =>
          (e.enumID && e.enumID === t) ||
          (e.wireValue && e.wireValue === t) ||
          (e.uiRep && e.uiRep === t)
        );
        if (!f) {
          const tLower = t.toLowerCase();
          f = p.enumPairs.find(e =>
            (e.enumID && e.enumID.toLowerCase() === tLower) ||
            (e.wireValue && e.wireValue.toLowerCase() === tLower) ||
            (e.uiRep && e.uiRep.toLowerCase() === tLower)
          );
        }
        return f ? (f.wireValue !== undefined && f.wireValue !== null ? f.wireValue : t) : t;
      }

      if (p.type && p.type.toLowerCase().includes('bool')) {
        const isTrue = tok === true || t === 'true' || t === 'Y' || t === '1' || t === 'yes' || t === 'on';
        return isTrue ? (p.trueWireValue || 'Y') : (p.falseWireValue || 'N');
      }

      return t;
    };

    let wv;
    const isMultiValue = p.type && (p.type.toLowerCase().includes('multiple') || p.type.toLowerCase().includes('multi'));
    if (p.enumPairs && p.enumPairs.length > 0) {
      if (Array.isArray(v)) {
        wv = v.map(mapToken).join(' ');
      } else if (isMultiValue && typeof v === 'string' && /\s/.test(v)) {
        wv = v.split(/\s+/).map(mapToken).join(' ');
      } else {
        wv = mapToken(v);
      }
    } else {
      wv = mapToken(v);
    }

    if (p.fixTag) parts.push(p.fixTag + '=' + wv);
  }

  if (selectedSubStrategy && !parts.some(p => p.startsWith('847='))) {
    parts.push('847=' + selectedSubStrategy);
  }

  return parts.join(delimiter);
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
function ControlField({ control, param, value, onChange, errors, dirty, disabled }) {
  const [localVal, setLocalVal] = useState(value || '');

  useEffect(() => {
    setLocalVal(value || '');
  }, [value]);

  const hasError = errors?.[control.paramRef];
  const isDirty = dirty?.[control.paramRef];
  const baseInput = 'fx-input w-full text-xs';
  const inputStyle = {
    borderColor: hasError ? '#ef4444' : isDirty ? 'var(--primary-faint)' : undefined,
    opacity: disabled ? 0.5 : undefined,
    pointerEvents: disabled ? 'none' : undefined,
  };
  const label = control.label || control.paramRef || control.id;

  // Resolve options from Control's ListItems or Param's EnumPairs
  const ep = (control.listItems && control.listItems.length > 0
    ? control.listItems.map(li => {
        const match = param?.enumPairs?.find(ep => ep.enumID === li.enumID);
        return {
          enumID: li.enumID || '',
          uiRep: li.uiRep || match?.uiRep || li.enumID || '',
          wireValue: match?.wireValue || li.enumID || '',
        };
      })
    : (param?.enumPairs || []).map(ep => ({
        enumID: ep.enumID || '',
        uiRep: ep.uiRep || ep.enumID || '',
        wireValue: ep.wireValue || ep.enumID || '',
      }))
  ).filter(e => e.enumID);

  const wrapStyle = {
    borderLeft: hasError ? '2px solid #ef4444' : isDirty ? '2px solid var(--primary)' : param?.required ? '2px solid var(--primary-border)' : '2px solid transparent',
    paddingLeft: '10px',
    opacity: disabled ? 0.6 : undefined,
  };

  const renderInput = () => {
    switch (control.type) {
      case 'checkbox': {
        const checkedVal = control.checkedValue || param?.trueWireValue || 'Y';
        const uncheckedVal = control.uncheckedValue || param?.falseWireValue || 'N';
        const on = value === checkedVal || value === 'Y' || value === true || value === 'true';
        return (
          <label className={`flex items-center gap-3 cursor-pointer select-none${disabled ? ' opacity-50 pointer-events-none' : ''}`}>
            <button
              type='button'
              disabled={disabled}
              onClick={() => onChange(on ? uncheckedVal : checkedVal)}
              className='relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 border border-[var(--border)]'
              style={{ background: on ? 'var(--primary)' : 'var(--background)' }}
            >
              <div
                className='absolute top-[2px] w-[18px] h-[18px] rounded-full shadow transition-all duration-200'
                style={{
                  left: on ? '22px' : '2px',
                  background: on ? 'var(--background)' : 'var(--text-muted)'
                }}
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
                disabled={disabled}
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
            <select value={value || ''} onChange={x => onChange(x.target.value)} disabled={disabled}
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
              type='range' min={min} max={max} step={step} value={nv} disabled={disabled}
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
        return (
          <input 
            type='time' 
            value={localVal} 
            onChange={x => setLocalVal(x.target.value)} 
            onBlur={() => { if (localVal !== value) onChange(localVal); }}
            onKeyDown={e => { if (e.key === 'Enter') { if (localVal !== value) onChange(localVal); } }}
            disabled={disabled} 
            className={baseInput} 
            style={inputStyle} 
          />
        );
      case 'date':
        return (
          <input 
            type='date' 
            value={localVal} 
            onChange={x => setLocalVal(x.target.value)} 
            onBlur={() => { if (localVal !== value) onChange(localVal); }}
            onKeyDown={e => { if (e.key === 'Enter') { if (localVal !== value) onChange(localVal); } }}
            disabled={disabled} 
            className={baseInput} 
            style={inputStyle} 
          />
        );
      case 'spinner': {
        const spinnerMin = param?.minValue !== '' && param?.minValue !== undefined ? param.minValue : undefined;
        const spinnerMax = param?.maxValue !== '' && param?.maxValue !== undefined ? param.maxValue : undefined;
        const isInteger = isIntegerParameter(param);
        const spinnerStep = isInteger ? '1' : (param?.type?.toLowerCase().includes('percent') ? '0.01' : 'any');
        return (
          <input 
            type='number' 
            value={localVal} 
            onChange={x => setLocalVal(x.target.value)} 
            onBlur={() => { if (localVal !== value) onChange(localVal); }}
            onKeyDown={e => { if (e.key === 'Enter') { if (localVal !== value) onChange(localVal); } }}
            disabled={disabled}
            min={spinnerMin} 
            max={spinnerMax}
            step={spinnerStep} 
            inputMode={isInteger ? 'numeric' : 'decimal'}
            placeholder={param?.defaultValue || 'Enter value…'} 
            className={baseInput} 
            style={inputStyle}
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
                  className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border cursor-pointer select-none transition-all${disabled ? ' opacity-50 pointer-events-none' : ''}`}
                  style={checked
                    ? { background: 'var(--primary-faint)', borderColor: 'var(--primary-border)', color: 'var(--foreground)' }
                    : { borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'transparent' }
                  }
                >
                  <input type='checkbox' className='sr-only' checked={checked} disabled={disabled} onChange={() => {
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
            }) : (
              <input 
                type='text' 
                value={localVal} 
                onChange={x => setLocalVal(x.target.value)} 
                onBlur={() => { if (localVal !== value) onChange(localVal); }}
                onKeyDown={e => { if (e.key === 'Enter') { if (localVal !== value) onChange(localVal); } }}
                disabled={disabled} 
                placeholder='Space-separated values' 
                className={baseInput} 
                style={inputStyle} 
              />
            )}
          </div>
        );
      case 'monthyear': {
        const myCur = value || '';
        const myYear = myCur.length >= 4 ? myCur.slice(0, 4) : '';
        const myMonth = myCur.length >= 6 ? myCur.slice(4, 6) : '';
        return (
          <div className='flex gap-2'>
            <div className='relative flex-1'>
              <select value={myMonth} onChange={x => onChange((myYear || new Date().getFullYear().toString()) + x.target.value)} disabled={disabled}
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
            <input type='number' value={myYear} min='2000' max='2099' placeholder='YYYY' disabled={disabled}
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
        return (
          <input 
            type='text' 
            value={localVal} 
            onChange={x => setLocalVal(x.target.value)} 
            onBlur={() => { if (localVal !== value) onChange(localVal); }}
            onKeyDown={e => { if (e.key === 'Enter') { if (localVal !== value) onChange(localVal); } }}
            disabled={disabled} 
            placeholder={param?.defaultValue || 'Enter value…'} 
            className={baseInput} 
            style={inputStyle} 
          />
        );
    }
  };

  const tooltipText = [
    control.tooltip || param?.description || '',
    param?.defaultValue !== undefined && param?.defaultValue !== null && param?.defaultValue !== '' ? `Default: ${param.defaultValue}` : '',
    param?.minValue !== undefined && param?.minValue !== null && param?.minValue !== '' ? `Min: ${param.minValue}` : '',
    param?.maxValue !== undefined && param?.maxValue !== null && param?.maxValue !== '' ? `Max: ${param.maxValue}` : '',
    param?.constValue !== undefined && param?.constValue !== null && param?.constValue !== '' ? `Fixed: ${param.constValue}` : '',
  ].filter(Boolean).join(' | ');

  const isNumeric = isNumericParameter(param);
  const badges = [];
  if (isNumeric) {
    if (param?.defaultValue !== undefined && param?.defaultValue !== null && param.defaultValue !== '') {
      badges.push({ label: 'Def: ' + param.defaultValue, value: param.defaultValue });
    }
    if (param?.minValue !== undefined && param?.minValue !== null && param.minValue !== '') {
      badges.push({ label: 'Min: ' + param.minValue, value: param.minValue });
    }
    if (param?.maxValue !== undefined && param?.maxValue !== null && param.maxValue !== '') {
      badges.push({ label: 'Max: ' + param.maxValue, value: param.maxValue });
    }
  }

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
        {tooltipText && (
          <span
            className='group relative cursor-help inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-mono font-bold tracking-wider rounded border transition-colors hover:bg-[var(--primary-faint)]'
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card)',
              color: 'var(--text-muted)'
            }}
          >
            <Info className='h-2.5 w-2.5 shrink-0' style={{ color: 'var(--primary)' }} />
            {param?.constValue ? `FIXED: ${param.constValue}` : param?.defaultValue ? `DF: ${param.defaultValue}` : 'INFO'}

            {/* Custom Tooltip Popover Notch */}
            <div
              className='absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col gap-1 p-2.5 rounded-lg border shadow-xl pointer-events-none min-w-[200px] max-w-[280px] z-50 text-[10px] font-sans font-normal normal-case tracking-normal'
              style={{
                borderColor: 'var(--border)',
                background: 'var(--background)',
                color: 'var(--foreground)'
              }}
            >
              {(control.tooltip || param?.description) && (
                <div className='font-semibold border-b pb-1 mb-1 leading-snug' style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                  {control.tooltip || param?.description}
                </div>
              )}
              {param?.defaultValue !== undefined && param?.defaultValue !== null && param?.defaultValue !== '' && (
                <div className='flex justify-between gap-4 py-0.5'>
                  <span style={{ color: 'var(--text-muted)' }}>Default:</span>
                  <span className='font-mono font-bold' style={{ color: 'var(--primary)' }}>{param.defaultValue}</span>
                </div>
              )}
              {param?.minValue !== undefined && param?.minValue !== null && param?.minValue !== '' && (
                <div className='flex justify-between gap-4 py-0.5'>
                  <span style={{ color: 'var(--text-muted)' }}>Min Value:</span>
                  <span className='font-mono font-bold'>{param.minValue}</span>
                </div>
              )}
              {param?.maxValue !== undefined && param?.maxValue !== null && param?.maxValue !== '' && (
                <div className='flex justify-between gap-4 py-0.5'>
                  <span style={{ color: 'var(--text-muted)' }}>Max Value:</span>
                  <span className='font-mono font-bold'>{param.maxValue}</span>
                </div>
              )}
              {param?.constValue !== undefined && param?.constValue !== null && param?.constValue !== '' && (
                <div className='flex justify-between gap-4 py-0.5'>
                  <span style={{ color: 'var(--text-muted)' }}>Const Value:</span>
                  <span className='font-mono font-bold' style={{ color: 'var(--primary)' }}>{param.constValue}</span>
                </div>
              )}
              {/* Little arrow at the bottom pointing to the notch */}
              <div
                className='absolute top-full left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45 border-r border-b'
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--background)',
                  marginTop: '-3px'
                }}
              />
            </div>
          </span>
        )}
      </div>
      {renderInput()}
      {badges.length > 0 && (
        <div className='flex flex-wrap gap-1 mt-1'>
          {badges.map((badge, bIdx) => (
            <button
              key={bIdx}
              type='button'
              disabled={disabled}
              onClick={() => {
                onChange(badge.value);
                setLocalVal(badge.value);
              }}
              className='text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-855/50 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer'
            >
              {badge.label}
            </button>
          ))}
        </div>
      )}
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

  // Pre-evaluate visibility of all controls
  const visibleControls = group.controls;

  const hasVisibleControls = visibleControls.length > 0;
  const hasSubGroups = group.subGroups?.length > 0;
  const horizontal = group.orientation === 'horizontal';

  if (!hasVisibleControls && !hasSubGroups) return null;

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
              {visibleControls.length} field{visibleControls.length !== 1 ? 's' : ''}
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
          {visibleControls.map((ctrl, i) => {
            const { enabled, visible, overriddenValue } = evaluateControlState(ctrl, values);
            const displayVal = overriddenValue !== undefined ? overriddenValue : (values[ctrl.paramRef] ?? ctrl.param?.defaultValue ?? ctrl.initValue ?? '');
            return (
              <div key={ctrl.id || i} className={horizontal ? 'flex-1 min-w-[240px]' : ''}>
                <ControlField control={ctrl} param={ctrl.param}
                  value={displayVal}
                  onChange={val => onChange(ctrl.paramRef, val)} errors={errors} dirty={dirty}
                  disabled={!enabled || !visible}
                />
              </div>
            );
          })}
          {group.subGroups?.map((sg, i) => (
            <PanelGroup key={i} group={sg} values={values} onChange={onChange} errors={errors} dirty={dirty} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Parameter Map Table ─── */
function ParameterMapTable({ parameters, values, search, setSearch }) {
  const filtered = parameters.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.fixTag.includes(search) || p.type.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className='space-y-2'>
      <div className='relative'>
        <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5' style={{ color: 'var(--text-muted)' }} />
        <input
          type='text'
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder='Filter by name, tag, or type…'
          className='w-full pl-7 pr-7 py-1 text-[10px] font-mono rounded border outline-none'
          style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        />
        {search && (
          <button onClick={() => setSearch('')} className='absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer bg-transparent border-none outline-none'>
            <X className='h-3.5 w-3.5' style={{ color: 'var(--text-muted)' }} />
          </button>
        )}
      </div>
      <div className='overflow-y-auto' style={{ maxHeight: '250px' }}>
        <table className='w-full text-[9px] font-mono'>
          <thead>
            <tr style={{ background: 'var(--background)', color: 'var(--text-muted)', position: 'sticky', top: 0 }}>
              <th className='px-2 py-1 text-left font-semibold'>Name</th>
              <th className='px-2 py-1 text-left font-semibold'>Tag</th>
              <th className='px-2 py-1 text-left font-semibold'>Type</th>
              <th className='px-2 py-1 text-left font-semibold'>Value</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={4} className='px-2 py-3 text-center' style={{ color: 'var(--text-muted)' }}>No matches</td></tr>
            ) : filtered.map((p, i) => {
              const val = p.constValue || values[p.name] || '';
              const shortType = p.type.replace('_t', '').replace('UTCTimestamp', 'Time').replace('Percentage', 'Pct');
              return (
                <tr key={i} className='hover:bg-[var(--primary-faint)] transition-colors' style={{ borderTop: '1px solid var(--border)' }}>
                  <td className='px-2 py-1 font-semibold truncate max-w-[90px]' style={{ color: 'var(--foreground)' }} title={p.name}>{p.name}</td>
                  <td className='px-2 py-1' style={{ color: 'var(--primary)' }}>{p.fixTag || '—'}</td>
                  <td className='px-2 py-1 text-[8px] text-[var(--text-muted)]'>{shortType}</td>
                  <td className='px-2 py-1 max-w-[70px] truncate' style={{ color: val ? '#34d399' : 'var(--border)' }} title={val}>
                    {val || '—'}
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
function XmlContentModal({ isOpen, onClose, content, onChange, onParse, errors, parsed }) {
  if (!isOpen) return null;
  const [activeTab, setActiveTab] = React.useState('editor');
  const lineCount = content ? content.split('\n').length : 0;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <div className='absolute inset-0 bg-black/80' style={{ zIndex: 10 }} onClick={onClose} />
      <div className='relative z-20 w-full max-w-4xl rounded-xl border bg-[var(--card)] p-3 md:p-4 shadow-2xl space-y-4' style={{ borderColor: 'var(--border)' }}>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <h2 className='text-sm font-semibold' style={{ color: 'var(--foreground)' }}>XML Document Explorer</h2>
            <p className='text-[11px] text-[var(--text-muted)]'>{lineCount} lines · Review source code or structural outline</p>
          </div>
          <div className='flex items-center gap-2'>
            <div className='flex border border-[var(--border)] rounded overflow-hidden shrink-0'>
              <button
                type='button'
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1 flex items-center gap-1.5 text-[10px] font-bold border-none cursor-pointer outline-none transition-colors ${activeTab === 'editor' ? 'bg-[var(--primary)] text-[var(--background)]' : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--primary-faint)]'}`}
              >
                <Code2 className='h-3 w-3' /> XML Code
              </button>
              <button
                type='button'
                onClick={() => setActiveTab('outline')}
                className={`px-3 py-1 flex items-center gap-1.5 text-[10px] font-bold border-none cursor-pointer outline-none transition-colors ${activeTab === 'outline' ? 'bg-[var(--primary)] text-[var(--background)]' : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--primary-faint)]'}`}
              >
                <Layers className='h-3 w-3' /> File Outline
              </button>
            </div>
            <button type='button' onClick={onClose} className='p-1 border border-[var(--border)] bg-transparent rounded cursor-pointer'>
              <X className='h-4 w-4' />
            </button>
          </div>
        </div>

        {activeTab === 'editor' && (
          <>
            <textarea
              value={content}
              onChange={e => onChange(e.target.value)}
              className='w-full h-[55vh] min-h-[300px] p-3 rounded-xl text-[10px] font-mono bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] outline-none resize-none'
              style={{ letterSpacing: '-0.01em' }}
              spellCheck={false}
            />
            <div className='flex flex-wrap items-center gap-3'>
              <button type='button' onClick={() => onParse(content)} disabled={!content.trim()} className='fx-btn-primary py-1.5 px-3.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'>
                <Play className='h-3.5 w-3.5' /> Parse &amp; Render Changes
              </button>
            </div>
          </>
        )}

        {activeTab === 'outline' && (
          <div className='w-full h-[60vh] min-h-[320px] overflow-y-auto space-y-4 pr-1'>
            {parsed && parsed.strategies && parsed.strategies.length > 0 ? (
              parsed.strategies.map((strat, sIdx) => (
                <div key={sIdx} className='border border-[var(--border)] rounded-xl p-3 bg-[var(--background)] space-y-2'>
                  <div className='flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-2'>
                    <div>
                      <h3 className='text-xs font-bold text-[var(--foreground)]'>{strat.uiRep || strat.name}</h3>
                      {strat.description && (
                        <p className='text-[10px] text-[var(--text-muted)] mt-0.5'>{strat.description}</p>
                      )}
                    </div>
                    <div className='flex items-center gap-1.5'>
                      {strat.regions && (
                        <span className='px-1.5 py-0.5 rounded text-[8px] font-mono border border-emerald-500/20 text-emerald-400 bg-emerald-500/5'>
                          Reg: {strat.regions}
                        </span>
                      )}
                      {strat.securityTypes && (
                        <span className='px-1.5 py-0.5 rounded text-[8px] font-mono border border-sky-500/20 text-sky-400 bg-sky-500/5'>
                          Sec: {strat.securityTypes}
                        </span>
                      )}
                    </div>
                  </div>

                  {strat.subStrategies && strat.subStrategies.length > 0 && (
                    <div className='space-y-1 pl-1'>
                      <span className='text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]'>Sub-Strategies:</span>
                      <div className='flex flex-wrap gap-1.5'>
                        {strat.subStrategies.map(sub => (
                          <div key={sub.name} className='px-2 py-0.5 rounded border border-[var(--border)] text-[9px] font-mono bg-[var(--card)]' title={sub.description}>
                            <span className='font-bold text-[var(--foreground)]'>{sub.uiRep || sub.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className='space-y-1.5 pt-1.5'>
                    <span className='text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]'>Parameters Spec ({strat.parameters.length}):</span>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                      {strat.parameters.map((param, pIdx) => {
                        const hasEnums = param.enumPairs && param.enumPairs.length > 0;
                        return (
                          <div key={pIdx} className='p-2 rounded border border-[var(--border)] bg-[var(--card)] text-[10px] font-mono space-y-1'>
                            <div className='flex items-center justify-between gap-1.5'>
                              <span className='font-bold text-[var(--foreground)] truncate max-w-[150px]' title={param.name}>{param.name}</span>
                              <span className='text-[9px] text-[var(--primary)] font-bold'>Tag {param.fixTag || '—'}</span>
                            </div>
                            <div className='text-[9px] text-[var(--text-muted)] flex flex-wrap gap-x-2 gap-y-0.5'>
                              <span>Type: {param.type.replace('_t', '')}</span>
                              {param.defaultValue && <span>Default: {param.defaultValue}</span>}
                              {param.required && <span className='text-red-400 font-bold'>Required</span>}
                            </div>
                            {param.description && (
                              <p className='text-[9px] text-[var(--text-muted)] italic line-clamp-2 mt-0.5'>{param.description}</p>
                            )}
                            {hasEnums && (
                              <div className='pt-1 border-t border-[var(--border)] mt-1 space-y-0.5 text-[8px] text-[var(--text-muted)] max-h-16 overflow-y-auto'>
                                {param.enumPairs.map((e, eIdx) => (
                                  <div key={eIdx} className='flex justify-between gap-1'>
                                    <span className='text-[var(--foreground)]'>{e.uiRep || e.enumID}</span>
                                    <span>wire: {e.wireValue}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className='text-xs text-center py-8 text-[var(--text-muted)]'>No parsed schema metadata outline available.</p>
            )}
          </div>
        )}

        {errors.length > 0 && (
          <div className='p-3 rounded-lg border text-xs font-mono space-y-1' style={{ background: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}>
            {errors.map((e, idx) => <p key={idx}>{e}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── ATDL Validation Rules Telemetry & Tree Inspector ─── */
function evaluateEditTelemetry(edit, values) {
  if (!edit) return { passed: true, details: 'Empty edit' };
  const { field, operator, value, field2, logicOperator, edits } = edit;

  if (logicOperator) {
    const childEdits = edits || [];
    const childrenTelemetry = childEdits.map(e => evaluateEditTelemetry(e, values));
    
    let passed = true;
    if (logicOperator === 'AND') {
      passed = childrenTelemetry.every(c => c.passed);
    } else if (logicOperator === 'OR') {
      passed = childrenTelemetry.some(c => c.passed);
    } else if (logicOperator === 'NOT') {
      passed = childrenTelemetry[0] ? !childrenTelemetry[0].passed : true;
    }

    return {
      logicOperator,
      passed,
      edits: childrenTelemetry
    };
  }

  if (!field) return { passed: true, details: 'No field specified' };
  const val1 = values[field];
  const val2 = field2 ? values[field2] : value;

  const exists = val1 !== undefined && val1 !== '' && val1 !== null;
  if (operator === 'EX') {
    return { field, operator, val1, passed: exists };
  }
  if (operator === 'NX') {
    return { field, operator, val1, passed: !exists };
  }

  if (!exists) {
    return { field, operator, val1, passed: true, isSkipped: true };
  }

  const v1 = parseFloat(val1);
  const v2 = parseFloat(val2);
  const isNumericComp = !isNaN(v1) && !isNaN(v2);

  let passed = true;
  switch (operator) {
    case 'EQ': passed = isNumericComp ? v1 === v2 : String(val1) === String(val2); break;
    case 'NE': passed = isNumericComp ? v1 !== v2 : String(val1) !== String(val2); break;
    case 'LT': passed = isNumericComp ? v1 < v2 : String(val1) < String(val2); break;
    case 'GT': passed = isNumericComp ? v1 > v2 : String(val1) > String(val2); break;
    case 'LE': passed = isNumericComp ? v1 <= v2 : String(val1) <= String(val2); break;
    case 'GE': passed = isNumericComp ? v1 >= v2 : String(val1) >= String(val2); break;
    default: passed = true;
  }

  return {
    field,
    operator,
    val1,
    val2,
    passed
  };
}

function ValidationTreeInspector({ rules, values }) {
  const [expandedRules, setExpandedRules] = useState({});

  const toggleRule = (idx) => {
    setExpandedRules(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const renderTelemetryNode = (node, depth = 0) => {
    if (!node) return null;

    if (node.logicOperator) {
      return (
        <div key={depth} className='ml-3 mt-1 font-mono text-[10px]'>
          <div className='flex items-center gap-1.5'>
            <span 
              className='px-1 rounded text-[9px] font-bold'
              style={{
                background: node.passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: node.passed ? '#10b981' : '#f87171'
              }}
            >
              {node.logicOperator}
            </span>
            <span className='text-zinc-500'>({node.passed ? 'PASSED' : 'FAILED'})</span>
          </div>
          <div className='border-l border-zinc-800 ml-1.5 pl-2.5 mt-0.5 space-y-1' style={{ borderColor: 'var(--border)' }}>
            {node.edits.map((child, i) => renderTelemetryNode(child, depth + '-' + i))}
          </div>
        </div>
      );
    }

    const { field, operator, val1, val2, passed, isSkipped } = node;
    let label = '';
    if (operator === 'EX') label = `EX (${field} is present)`;
    else if (operator === 'NX') label = `NX (${field} is empty)`;
    else {
      const displayVal1 = val1 !== undefined && val1 !== '' ? `'${val1}'` : 'N/A';
      const displayVal2 = val2 !== undefined && val2 !== '' ? `'${val2}'` : 'empty';
      label = `${field} (${displayVal1}) ${operator} ${displayVal2}`;
    }

    return (
      <div key={field + '-' + operator} className='ml-3 mt-1 font-mono text-[9px] flex items-center gap-1.5'>
        <span style={{ color: passed ? '#10b981' : '#f87171' }}>
          {passed ? '✔' : '✘'}
        </span>
        <span style={{ color: passed ? 'var(--foreground)' : '#f87171' }}>{label}</span>
        {isSkipped && <span className='text-zinc-500 text-[8px]'>(skipped)</span>}
      </div>
    );
  };

  if (!rules || rules.length === 0) {
    return <p className='text-[10px] text-center py-6 text-zinc-500 italic'>No validation rules defined.</p>;
  }

  return (
    <div className='space-y-2.5 max-h-[300px] overflow-y-auto pr-1'>
      {rules.map((rule, idx) => {
        const telemetry = evaluateEditTelemetry(rule.edit, values);
        const isExpanded = !!expandedRules[idx];
        return (
          <div 
            key={idx} 
            className='p-2 rounded-lg border text-xs transition-all'
            style={{ 
              borderColor: telemetry.passed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              background: telemetry.passed ? 'rgba(16, 185, 129, 0.02)' : 'rgba(239, 68, 68, 0.02)'
            }}
          >
            <div 
              className='flex items-start justify-between gap-2 cursor-pointer'
              onClick={() => toggleRule(idx)}
            >
              <div className='flex items-start gap-1.5'>
                <span className='mt-0.5' style={{ color: telemetry.passed ? '#10b981' : '#f87171' }}>
                  {telemetry.passed ? <CheckCircle2 className='h-3.5 w-3.5 shrink-0' /> : <AlertTriangle className='h-3.5 w-3.5 shrink-0' />}
                </span>
                <span className='font-medium leading-tight' style={{ color: 'var(--foreground)' }}>
                  {rule.errorMessage}
                </span>
              </div>
              <ChevronDown 
                className={`h-3.5 w-3.5 text-zinc-500 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
              />
            </div>

            {isExpanded && (
              <div className='mt-2 pt-2 border-t border-zinc-800/40'>
                <p className='text-[8px] font-mono text-zinc-500 uppercase tracking-wider mb-1'>Logical Condition Evaluation:</p>
                {renderTelemetryNode(telemetry)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TagAnalyticsView({ analytics }) {
  const { mapped, inactive, unrecognized } = analytics;
  return (
    <div className='space-y-4 text-xs'>
      {/* Category 1: Mapped Tags */}
      <div className='space-y-1.5'>
        <p className='text-[9px] font-mono uppercase tracking-wider font-bold text-emerald-400'>
          Mapped Tags ({mapped.length})
        </p>
        {mapped.length > 0 ? (
          <div className='grid grid-cols-2 gap-1.5'>
            {mapped.map(item => (
              <div key={item.tag} className='p-1.5 rounded border border-emerald-500/10 bg-emerald-500/5 font-mono text-[10px] flex items-center justify-between'>
                <span className='font-bold text-emerald-400'>{item.tag}</span>
                <span className='text-zinc-450 truncate max-w-[80px]' style={{ color: 'var(--text-muted)' }} title={item.param}>{item.param}</span>
                <span className='text-zinc-500'>={item.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className='text-[10px] text-zinc-500 italic'>No mapped tags in message</p>
        )}
      </div>

      {/* Category 2: Inactive / Hidden Tags */}
      <div className='space-y-1.5'>
        <p className='text-[9px] font-mono uppercase tracking-wider font-bold text-amber-400'>
          Inactive / Hidden Tags ({inactive.length})
        </p>
        {inactive.length > 0 ? (
          <div className='grid grid-cols-2 gap-1.5'>
            {inactive.map(item => (
              <div key={item.tag} className='p-1.5 rounded border border-amber-500/10 bg-amber-500/5 font-mono text-[10px] flex items-center justify-between' title='Parameter control is currently hidden or disabled due to StateRules'>
                <span className='font-bold text-amber-400'>{item.tag}</span>
                <span className='text-zinc-455 truncate max-w-[80px]' style={{ color: 'var(--text-muted)' }}>{item.param}</span>
                <span className='text-zinc-500'>={item.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className='text-[10px] text-zinc-500 italic'>No inactive tags detected</p>
        )}
      </div>

      {/* Category 3: Unrecognized Tags */}
      <div className='space-y-1.5'>
        <p className='text-[9px] font-mono uppercase tracking-wider font-bold text-red-400'>
          Unrecognized Tags ({unrecognized.length})
        </p>
        {unrecognized.length > 0 ? (
          <div className='grid grid-cols-2 gap-1.5'>
            {unrecognized.map(item => (
              <div key={item.tag} className='p-1.5 rounded border border-red-500/10 bg-red-500/5 font-mono text-[10px] flex items-center justify-between' title='This tag does not map to any parameter defined in the ATDL schema'>
                <span className='font-bold text-red-400'>{item.tag}</span>
                <span className='text-zinc-500'>={item.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className='text-[10px] text-zinc-500 italic'>No unrecognized tags</p>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function ATDLRendererPage() {
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState('');

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

  // Enterprise additions
  const [fixDelimiter, setFixDelimiter] = useState('\\u0001');
  const [selectedSubStrategy, setSelectedSubStrategy] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [selectedSecurityType, setSelectedSecurityType] = useState('All');
  const [rawFixInput, setRawFixInput] = useState('');
  const [activeSidebarTab, setActiveSidebarTab] = useState('preview');
  const [activeTelemetryTab, setActiveTelemetryTab] = useState('validation');
  const [paramMapSearch, setParamMapSearch] = useState('');

  useEffect(() => { setIsLoaded(true); }, []);

  const getDelimiterChar = (delim) => {
    if (delim === '\\u0001') return '\u0001';
    if (delim === '|') return '|';
    if (delim === '^A') return '\u0001';
    return '\u0001';
  };

  const loadTabToWorkspace = useCallback((tab) => {
    if (!tab) return;
    setXmlInput(tab.xmlInput || '');
    setLoadedFileName(tab.loadedFileName || '');
    setParsed(tab.parsed || null);
    setParseErrors(tab.parseErrors || []);
    setRenderWarnings(tab.renderWarnings || []);
    setActiveStratIdx(tab.activeStratIdx || 0);
    setValues(tab.values || {});
    setDirty(tab.dirty || {});
    setValidationErrors(tab.validationErrors || {});
    setFixPreview(tab.fixPreview || '');
    setSelectedSubStrategy(tab.selectedSubStrategy || '');
    setSelectedRegion(tab.selectedRegion || 'All');
    setSelectedSecurityType(tab.selectedSecurityType || 'All');
    setRawFixInput(tab.rawFixInput || '');
  }, []);

  const handleTabSwitch = (targetTabId) => {
    if (targetTabId === activeTabId) return;

    // Save current active workspace state to the current tab
    if (activeTabId) {
      setTabs(prev => prev.map(t => {
        if (t.id === activeTabId) {
          return {
            ...t,
            xmlInput,
            loadedFileName,
            parsed,
            parseErrors,
            renderWarnings,
            activeStratIdx,
            values,
            dirty,
            validationErrors,
            fixPreview,
            selectedSubStrategy,
            selectedRegion,
            selectedSecurityType,
            rawFixInput
          };
        }
        return t;
      }));
    }

    const targetTab = tabs.find(t => t.id === targetTabId);
    if (targetTab) {
      loadTabToWorkspace(targetTab);
      setActiveTabId(targetTabId);
    }
  };

  const createNewTab = (name, xmlContent) => {
    const newTabId = `tab-${Date.now()}`;
    const newTab = {
      id: newTabId,
      name: name,
      xmlInput: xmlContent,
      loadedFileName: name,
      parsed: null,
      parseErrors: [],
      renderWarnings: [],
      activeStratIdx: 0,
      values: {},
      dirty: {},
      validationErrors: {},
      fixPreview: '',
      selectedSubStrategy: '',
      selectedRegion: 'All',
      selectedSecurityType: 'All',
      rawFixInput: ''
    };

    if (activeTabId) {
      setTabs(prev => prev.map(t => {
        if (t.id === activeTabId) {
          return {
            ...t,
            xmlInput,
            loadedFileName,
            parsed,
            parseErrors,
            renderWarnings,
            activeStratIdx,
            values,
            dirty,
            validationErrors,
            fixPreview,
            selectedSubStrategy,
            selectedRegion,
            selectedSecurityType,
            rawFixInput
          };
        }
        return t;
      }));
    }

    setTabs(prev => [...prev, newTab]);
    loadTabToWorkspace(newTab);
    setActiveTabId(newTabId);

    // Run parsing for the new tab
    const result = parseATDL(xmlContent);
    setParsed(result);
    setParseErrors(result.errors);
    setRenderWarnings(result.warnings || []);
    setSelectedRegion('All');
    setSelectedSecurityType('All');
    setActiveStratIdx(0);
  };

  const handleTabClose = (tabIdToClose, e) => {
    if (e) e.stopPropagation();
    const remainingTabs = tabs.filter(t => t.id !== tabIdToClose);
    setTabs(remainingTabs);

    if (activeTabId === tabIdToClose) {
      if (remainingTabs.length > 0) {
        const firstTab = remainingTabs[0];
        loadTabToWorkspace(firstTab);
        setActiveTabId(firstTab.id);
      } else {
        handleClear();
        setActiveTabId('');
      }
    }
  };

  const handleParse = useCallback((xml) => {
    const src = xml !== undefined ? xml : xmlInput;
    if (!src.trim()) { setParsed(null); setParseErrors([]); setRenderWarnings([]); return; }
    const result = parseATDL(src);
    setParsed(result);
    setParseErrors(result.errors);
    setRenderWarnings(result.warnings || []);
    setSelectedRegion('All');
    setSelectedSecurityType('All');
    setActiveStratIdx(0);

    if (activeTabId) {
      setTabs(prev => prev.map(t => {
        if (t.id === activeTabId) {
          return { ...t, xmlInput: src };
        }
        return t;
      }));
    }
  }, [xmlInput, activeTabId]);

  const handleFileLoaded = (content, fileName) => {
    createNewTab(fileName, content);
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
    createNewTab('demo.atdl', DEMO_ATDL);
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
    setSelectedSubStrategy('');
    setSelectedRegion('All');
    setSelectedSecurityType('All');
    setRawFixInput('');
    setShowXmlModal(false);
    setTabs([]);
    setActiveTabId('');
  };

  // Collect unique regions and security types
  const uniqueRegions = useMemo(() => {
    if (!parsed?.strategies) return [];
    const set = new Set();
    parsed.strategies.forEach(s => {
      if (s.regions) {
        s.regions.split(/\s+/).forEach(r => { if (r.trim()) set.add(r.trim()); });
      }
    });
    return Array.from(set).sort();
  }, [parsed]);

  const uniqueSecurityTypes = useMemo(() => {
    if (!parsed?.strategies) return [];
    const set = new Set();
    parsed.strategies.forEach(s => {
      if (s.securityTypes) {
        s.securityTypes.split(/\s+/).forEach(st => { if (st.trim()) set.add(st.trim()); });
      }
    });
    return Array.from(set).sort();
  }, [parsed]);

  const filteredStrategies = useMemo(() => {
    if (!parsed?.strategies) return [];
    return parsed.strategies.filter(s => {
      const regionMatch = selectedRegion === 'All' ||
        (s.regions && s.regions.split(/\s+/).some(r => r.trim() === selectedRegion));
      const secTypeMatch = selectedSecurityType === 'All' ||
        (s.securityTypes && s.securityTypes.split(/\s+/).some(st => st.trim() === selectedSecurityType));
      return regionMatch && secTypeMatch;
    });
  }, [parsed, selectedRegion, selectedSecurityType]);

  const activeStrategy = filteredStrategies[activeStratIdx];

  const effectiveValues = useMemo(() => {
    return getEffectiveValues(activeStrategy, values);
  }, [activeStrategy, values]);

  // Auto-init strategy values when filters or strategies change
  useEffect(() => {
    setActiveStratIdx(0);
    const first = filteredStrategies[0];
    if (first) {
      setValues(getInitialValues(first));
    } else {
      setValues({});
    }
    setSelectedSubStrategy('');
    setDirty({});
    setValidationErrors({});
    setFixPreview('');
  }, [selectedRegion, selectedSecurityType, filteredStrategies]);

  const handleStrategySwitch = (idx) => {
    setActiveStratIdx(idx);
    const strat = filteredStrategies[idx];
    if (strat) {
      setValues(getInitialValues(strat));
    }
    setSelectedSubStrategy('');
    setDirty({});
    setValidationErrors({});
    setFixPreview('');
  };

  const handleValueChange = (paramRef, val) => {
    const nextValues = { ...values, [paramRef]: val };
    const nextErrors = { ...validationErrors };
    const param = activeStrategy?.parameters.find(p => p.name === paramRef);
    if (param) {
      const fieldError = validateParameterValue(param, val);
      if (fieldError) nextErrors[paramRef] = fieldError;
      else delete nextErrors[paramRef];
    }
    Object.keys(nextErrors).forEach(k => {
      if (k.startsWith('_strategy_edit_')) delete nextErrors[k];
    });

    setValues(nextValues);
    setDirty(prev => ({ ...prev, [paramRef]: true }));
    setValidationErrors(nextErrors);

    if (activeStrategy) {
      const delimChar = getDelimiterChar(fixDelimiter);
      const nextEffective = getEffectiveValues(activeStrategy, nextValues);
      setFixPreview(buildFIX(activeStrategy, nextEffective, delimChar, selectedSubStrategy));
    }
  };

  // Sync Delimiter and Sub-Strategy changes to FIX output preview
  useEffect(() => {
    if (activeStrategy) {
      const delimChar = getDelimiterChar(fixDelimiter);
      setFixPreview(buildFIX(activeStrategy, effectiveValues, delimChar, selectedSubStrategy));
    }
  }, [selectedSubStrategy, fixDelimiter, effectiveValues, activeStrategy]);

  const handleValidate = () => {
    if (!activeStrategy) return;
    const errs = {};
    const activeParams = getActiveParameters(activeStrategy, effectiveValues);
    for (const p of activeStrategy.parameters) {
      if (p.constValue) continue;
      if (!activeParams.has(p.name)) continue;
      const v = effectiveValues[p.name];
      if (p.required && (v === undefined || v === '' || v === null)) { errs[p.name] = 'Required field'; continue; }
      const fieldError = validateParameterValue(p, v);
      if (fieldError) { errs[p.name] = fieldError; continue; }
    }

    // Evaluate StrategyEdit validation rules
    if (activeStrategy.validationRules && activeStrategy.validationRules.length > 0) {
      activeStrategy.validationRules.forEach((rule, idx) => {
        const passed = evaluateEdit(rule.edit, effectiveValues);
        if (!passed) {
          errs[`_strategy_edit_${idx}`] = rule.errorMessage || 'Validation rule failed';
        }
      });
    }

    setValidationErrors(errs);
    if (Object.keys(errs).length === 0) {
      const delimChar = getDelimiterChar(fixDelimiter);
      setFixPreview(buildFIX(activeStrategy, effectiveValues, delimChar, selectedSubStrategy));
    } else {
      setFixPreview('');
    }
  };

  // Parse raw FIX message to pre-fill form
  const handleParseRawFix = () => {
    if (!activeStrategy || !rawFixInput.trim()) return;
    const msg = rawFixInput.trim();
    const tokens = msg.split(/[\u0001|^\s]+/);
    const newValues = { ...values };

    tokens.forEach(tok => {
      const idx = tok.indexOf('=');
      if (idx === -1) return;
      const tag = tok.slice(0, idx).trim();
      const val = tok.slice(idx + 1).trim();

      const param = activeStrategy.parameters.find(p => p.fixTag === tag);
      if (param) {
        if (param.enumPairs && param.enumPairs.length > 0) {
          const match = param.enumPairs.find(e =>
            (e.wireValue && e.wireValue === val) ||
            (e.enumID && e.enumID === val)
          );
          newValues[param.name] = match ? match.enumID : val;
        } else if (param.type && param.type.toLowerCase().includes('bool')) {
          const isTrue = val === 'Y' || val === '1' || val === 'true' || val === param.trueWireValue;
          newValues[param.name] = isTrue;
        } else {
          newValues[param.name] = val;
        }
      } else if (tag === '847') {
        setSelectedSubStrategy(val);
      }
    });

    setValues(newValues);
    setDirty(prev => {
      const next = { ...prev };
      Object.keys(newValues).forEach(k => { next[k] = true; });
      return next;
    });

    const newEffective = getEffectiveValues(activeStrategy, newValues);
    const activeParams = getActiveParameters(activeStrategy, newEffective);
    const errs = {};
    for (const p of activeStrategy.parameters) {
      if (p.constValue) continue;
      if (!activeParams.has(p.name)) continue;
      const v = newEffective[p.name];
      if (p.required && (v === undefined || v === '' || v === null)) { errs[p.name] = 'Required field'; continue; }
      const fieldError = validateParameterValue(p, v);
      if (fieldError) { errs[p.name] = fieldError; continue; }
    }
    setValidationErrors(errs);
    const delimChar = getDelimiterChar(fixDelimiter);
    setFixPreview(buildFIX(activeStrategy, newEffective, delimChar, selectedSubStrategy));
  };

  const handleReset = () => {
    if (activeStrategy) {
      setValues(getInitialValues(activeStrategy));
    } else {
      setValues({});
    }
    setDirty({});
    setValidationErrors({});
    setSelectedSubStrategy('');
    setFixPreview('');
  };

  const handleCopy = () => {
    if (!fixPreview) return;
    const cleanMsg = fixDelimiter === '\\u0001' ? fixPreview.replace(/\u0001/g, '|') : fixPreview;
    navigator.clipboard.writeText(cleanMsg)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleDownload = () => {
    if (!fixPreview) return;
    const cleanMsg = fixDelimiter === '\\u0001' ? fixPreview.replace(/\u0001/g, '|') : fixPreview;
    const blob = new Blob([cleanMsg], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (activeStrategy?.name || 'atdl') + '_params.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTagAnalytics = () => {
    const mapped = [];
    const inactive = [];
    const unrecognized = [];

    if (!activeStrategy) return { mapped, inactive, unrecognized };

    // Get list of tags parsed from raw FIX input or currently generated fields
    const parsedTags = {};
    if (rawFixInput.trim()) {
      const delim = getDelimiterChar(fixDelimiter);
      const cleanInput = rawFixInput.indexOf('8=') > -1 ? rawFixInput.substring(rawFixInput.indexOf('8=')) : rawFixInput;
      const normalized = delim !== '\x01' ? cleanInput.split(delim).join('\x01') : cleanInput;
      const pairs = normalized.split('\x01').filter(Boolean);
      pairs.forEach(p => {
        const eq = p.indexOf('=');
        if (eq > -1) {
          parsedTags[p.slice(0, eq).trim()] = p.slice(eq + 1);
        }
      });
    }

    // Also include currently generated tags from values
    const generatedTags = {};
    if (fixPreview) {
      const delim = getDelimiterChar(fixDelimiter);
      const pairs = fixPreview.split(delim).filter(Boolean);
      pairs.forEach(p => {
        const eq = p.indexOf('=');
        if (eq > -1) {
          generatedTags[p.slice(0, eq).trim()] = p.slice(eq + 1);
        }
      });
    }

    const allSourceTags = { ...parsedTags, ...generatedTags };

    // Go through each parameter in strategy schema
    const paramTags = new Set();
    activeStrategy.parameters.forEach(p => {
      if (!p.fixTag) return;
      paramTags.add(p.fixTag);

      // Check if control is hidden/disabled
      const control = activeStrategy.groups
        .flatMap(g => g.controls || [])
        .find(c => c.paramRef === p.name);

      let isControlActive = true;
      if (control) {
        const controlState = evaluateControlState(control, effectiveValues);
        isControlActive = controlState.visible !== false && controlState.enabled !== false;
      }

      if (allSourceTags[p.fixTag] !== undefined) {
        if (isControlActive) {
          mapped.push({ tag: p.fixTag, param: p.name, value: allSourceTags[p.fixTag] });
        } else {
          inactive.push({ tag: p.fixTag, param: p.name, value: allSourceTags[p.fixTag] });
        }
      }
    });

    // Any tag in rawFixInput/fixPreview that doesn't correspond to any parameter is unrecognized
    Object.keys(allSourceTags).forEach(tag => {
      if (['8', '9', '10', '35', '34', '49', '56', '52'].includes(tag)) return;
      if (!paramTags.has(tag)) {
        unrecognized.push({ tag, value: allSourceTags[tag] });
      }
    });

    return { mapped, inactive, unrecognized };
  };

  const isValid = activeTabId && parsed?.strategies?.length > 0 && parseErrors.length === 0;
  const vpCount = activeStrategy?.parameters?.filter(p => !p.constValue).length ?? 0;
  const filledCount = activeStrategy?.parameters?.filter(p => !p.constValue && values[p.name] !== undefined && values[p.name] !== '').length ?? 0;
  const errCount = Object.keys(validationErrors).length;
  const fixParts = fixPreview ? fixPreview.split(getDelimiterChar(fixDelimiter)).filter(Boolean) : [];
  const atdlVersion = parsed?.version || '';

  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <main className={`space-y-4 max-w-screen-2xl mx-auto w-full px-2 sm:px-3 md:px-4 py-4 transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>

        {/* ── Page Header ── */}
        <div className={`fx-page-header flex flex-col md:flex-row md:items-start justify-between gap-3 ${!isValid ? 'max-w-2xl mx-auto' : ''}`}>
          <div className={`space-y-1 ${!isValid ? 'text-center md:text-left w-full' : ''}`}>
            <h1 className='text-xl font-bold tracking-tight flex items-center justify-center md:justify-start gap-2' style={{ color: 'var(--foreground)' }}>
              <div className='h-8 w-8 rounded-lg flex items-center justify-center shrink-0'
                style={{ background: 'var(--primary-faint)', border: '1px solid var(--primary-border)' }}
              >
                <UserCog className='h-4 w-4' style={{ color: 'var(--primary)' }} />
              </div>
              <span>FIXatdl Renderer</span>
            </h1>
            <p className='text-xs' style={{ color: 'var(--text-muted)' }}>
              Parse strategy XML templates, evaluate validation rules, and generate FIX wire parameters
            </p>
          </div>
          {isValid && (
            <div className='flex items-center gap-1.5 shrink-0'>
              <button onClick={handleReset} className='fx-btn-secondary py-1 px-2.5 text-[10px] cursor-pointer'>
                <RotateCcw className='h-3 w-3' /> Reset
              </button>
              <button onClick={handleClear} className='fx-btn-secondary py-1 px-2.5 text-[10px] cursor-pointer' style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>
                <Trash2 className='h-3 w-3' /> Clear
              </button>
            </div>
          )}
        </div>

        {/* Workspace Tab Bar */}
        {tabs.length > 0 && (
          <div className='flex flex-wrap items-center gap-1.5 border-b pb-2' style={{ borderColor: 'var(--border)' }}>
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  onClick={() => handleTabSwitch(tab.id)}
                  className='flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium cursor-pointer transition-all border'
                  style={{
                    background: isActive ? 'var(--primary-faint)' : 'var(--card)',
                    borderColor: isActive ? 'var(--primary)' : 'var(--border)',
                    color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                    boxShadow: isActive ? '0 0 12px rgba(139, 92, 246, 0.08)' : 'none'
                  }}
                >
                  <FileCode2 className='h-3.5 w-3.5' />
                  <span>{tab.name}</span>
                  <button
                    type='button'
                    onClick={(e) => handleTabClose(tab.id, e)}
                    className='hover:bg-zinc-800 rounded p-0.5 text-zinc-400 hover:text-zinc-200 transition-colors bg-transparent border-none'
                  >
                    <X className='h-2.5 w-2.5' />
                  </button>
                </div>
              );
            })}
            <button
              onClick={() => {
                if (activeTabId) {
                  // Save current tab's active workspace state
                  setTabs(prev => prev.map(t => {
                    if (t.id === activeTabId) {
                      return {
                        ...t,
                        xmlInput,
                        loadedFileName,
                        parsed,
                        parseErrors,
                        renderWarnings,
                        activeStratIdx,
                        values,
                        dirty,
                        validationErrors,
                        fixPreview,
                        selectedSubStrategy,
                        selectedRegion,
                        selectedSecurityType,
                        rawFixInput
                      };
                    }
                    return t;
                  }));
                }
                // Enter new strategy/tab upload mode
                setParsed(null);
                setLoadedFileName('');
                setActiveTabId('');
              }}
              className='p-1.5 rounded-lg text-xs flex items-center gap-1.5 border cursor-pointer hover:bg-zinc-800 transition-colors'
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              title='Open another strategy'
            >
              <Plus className='h-3.5 w-3.5' />
            </button>
          </div>
        )}

        {/* ── Input Card ── */}
        {!isValid && (
          <div className='max-w-2xl mx-auto space-y-4'>
            <div className='rounded-xl overflow-hidden' style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
              {/* Tab header */}
              <div className='px-4 py-2.5 flex items-center justify-between border-b'
                style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
              >
                <div className='fx-tab-group'>
                  <button className={`fx-tab${inputMode === 'file' ? ' active' : ''}`} onClick={() => setInputMode('file')}>
                    <UploadCloud className='h-3.5 w-3.5' />
                    <span className='hidden sm:inline'>File</span>
                  </button>
                  <button className={`fx-tab${inputMode === 'paste' ? ' active' : ''}`} onClick={() => setInputMode('paste')}>
                    <FileText className='h-3.5 w-3.5' />
                    <span className='hidden sm:inline'>Paste</span>
                  </button>
                </div>
                <button onClick={handleLoadDemo} className='fx-btn-primary py-1 px-2.5 text-[10px] cursor-pointer'>
                  <Sparkles className='h-3 w-3' /> Load Demo
                </button>
              </div>

              {/* Tab body */}
              <div className='p-4'>
                {inputMode === 'file' ? (
                  <div
                    {...getRootProps()}
                    className='border border-dashed rounded-xl p-8 text-center cursor-pointer transition-all'
                    style={{
                      borderColor: isDragActive ? 'var(--primary)' : 'var(--border)',
                      background: isDragActive ? 'var(--primary-faint)' : 'var(--background)',
                    }}
                  >
                    <input {...getInputProps()} />
                    <UploadCloud
                      className='h-8 w-8 mx-auto mb-2 transition-colors'
                      style={{ color: isDragActive ? 'var(--primary)' : 'var(--text-muted)' }}
                    />
                    <p className='text-xs font-semibold' style={{ color: 'var(--foreground)' }}>
                      {isDragActive ? 'Drop to parse…' : 'Drag & drop ATDL strategy file'}
                    </p>
                    <p className='text-[10px] mt-0.5' style={{ color: 'var(--text-muted)' }}>
                      Supports .xml · .atdl · FIXatdl 1.1 &amp; 1.2
                    </p>
                  </div>
                ) : (
                  <div className='space-y-3.5'>
                    <textarea
                      value={xmlInput}
                      onChange={e => setXmlInput(e.target.value)}
                      placeholder={'Paste FIXatdl 1.1 or 1.2 XML here…\n\n<Strategies xmlns="http://www.fixprotocol.org/FIXatdl-1-1/Core">\n  <Strategy name="VWAP" ...>'}
                      className='w-full h-64 p-3 rounded-xl resize-none text-[10px] font-mono bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] outline-none'
                      style={{ letterSpacing: '-0.01em' }}
                      spellCheck={false}
                    />
                    <button
                      onClick={() => handleParse()}
                      disabled={!xmlInput.trim()}
                      className='w-full fx-btn-primary justify-center py-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
                    >
                      <Play className='h-3.5 w-3.5' /> Parse &amp; Render
                    </button>
                  </div>
                )}

                {parseErrors.length > 0 && (
                  <div className='mt-3 border-l-4 border-red-500 pl-3 pr-3 py-1.5 rounded-r-lg text-[10px] font-mono space-y-1'
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
          <div className='flex items-center gap-2 p-2 rounded-lg border'
            style={{ borderColor: 'var(--primary-faint)', background: 'var(--primary-faint)' }}
          >
            <span className='relative flex h-1.5 w-1.5 shrink-0'>
              <span className='animate-ping absolute inline-flex h-full w-full rounded-full opacity-75' style={{ background: 'var(--primary)' }} />
              <span className='relative inline-flex rounded-full h-1.5 w-1.5' style={{ background: 'var(--primary)' }} />
            </span>
            <button
              type='button'
              onClick={() => setShowXmlModal(true)}
              className='text-xs font-mono font-semibold underline underline-offset-2 transition-colors hover:opacity-70 cursor-pointer bg-transparent border-none'
              style={{ color: 'var(--primary)' }}
            >
              {loadedFileName || 'XML'}
            </button>
            <span className='text-[10px]' style={{ color: 'var(--text-muted)' }}>
              — {filteredStrategies.length} strategy{filteredStrategies.length !== 1 ? 'ies' : ''}
            </span>
            {atdlVersion && (
              <span className='badge-success text-[9px]'>FIXatdl {atdlVersion}</span>
            )}
          </div>
        )}

        <XmlContentModal
          isOpen={showXmlModal}
          onClose={() => setShowXmlModal(false)}
          content={xmlInput}
          onChange={setXmlInput}
          onParse={(content) => { handleParse(content); setShowXmlModal(false); }}
          errors={parseErrors}
          parsed={parsed}
        />

        {/* ── Main Renderer ── */}
        {isValid && activeStrategy && (
          <div className='space-y-4'>

            {/* Strategy selector card */}
            <div className='rounded-xl border bg-[var(--card)] border-[var(--border)] overflow-hidden'>
              <div className='px-3.5 py-2.5 flex flex-wrap items-center gap-2.5 bg-[var(--background)] border-b border-[var(--border)]'>
                <Layers className='h-3.5 w-3.5 shrink-0' style={{ color: 'var(--primary)' }} />

                {/* Region Filter */}
                {uniqueRegions.length > 0 && (
                  <select
                    value={selectedRegion}
                    onChange={e => setSelectedRegion(e.target.value)}
                    className='px-2 py-1 text-[11px] font-mono outline-none border rounded bg-[var(--background)] border-[var(--border)] text-[var(--foreground)] cursor-pointer'
                    aria-label='Region'
                  >
                    <option value='All'>All Regions</option>
                    {uniqueRegions.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                )}

                {/* Security Type Filter */}
                {uniqueSecurityTypes.length > 0 && (
                  <select
                    value={selectedSecurityType}
                    onChange={e => setSelectedSecurityType(e.target.value)}
                    className='px-2 py-1 text-[11px] font-mono outline-none border rounded bg-[var(--background)] border-[var(--border)] text-[var(--foreground)] cursor-pointer'
                    aria-label='Security Type'
                  >
                    <option value='All'>All Types</option>
                    {uniqueSecurityTypes.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                )}

                {/* Strategy Selector */}
                <select
                  value={activeStratIdx}
                  onChange={e => handleStrategySwitch(Number(e.target.value))}
                  className='px-2 py-1 text-[11px] font-semibold border rounded bg-[var(--background)] border-[var(--primary-border)] text-[var(--foreground)] outline-none cursor-pointer'
                  aria-label='Select strategy'
                >
                  {filteredStrategies.map((s, i) => (
                    <option key={i} value={i}>{s.uiRep || s.name}</option>
                  ))}
                </select>

                {/* Sub-Strategy Selector */}
                {activeStrategy.subStrategies && activeStrategy.subStrategies.length > 0 && (
                  <select
                    value={selectedSubStrategy}
                    onChange={e => setSelectedSubStrategy(e.target.value)}
                    className='px-2 py-1 text-[11px] font-mono border rounded bg-[var(--background)] border-[var(--border)] text-[var(--foreground)] outline-none cursor-pointer'
                    aria-label='Sub-Strategy'
                  >
                    <option value=''>Sub-Strategy: None</option>
                    {activeStrategy.subStrategies.map(sub => (
                      <option key={sub.name} value={sub.name}>{sub.uiRep}</option>
                    ))}
                  </select>
                )}

                {/* Jump to panel */}
                <div className='relative'>
                  <select
                    className='pl-2 pr-7 py-1 text-[11px] border rounded bg-[var(--background)] border-[var(--border)] text-[var(--foreground)] outline-none cursor-pointer appearance-none'
                    onChange={e => {
                      const el = document.getElementById('atdl-panel-' + e.target.value);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    defaultValue=''
                    aria-label='Jump to panel'
                  >
                    <option value=''>Jump to panel…</option>
                    {activeStrategy.groups.map((g, i) => (
                      <option key={i} value={i}>{g.label || 'Panel ' + (i + 1)}</option>
                    ))}
                  </select>
                  <ChevronDown className='pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3' style={{ color: 'var(--text-muted)' }} />
                </div>

                {/* Right: Validation feedback indicators */}
                <div className='ml-auto flex items-center gap-2.5'>
                  {fixParts.length > 0 && errCount === 0 && (
                    <span className='hidden sm:flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded border border-emerald-500/20 text-emerald-400 bg-emerald-500/5'
                    >
                      <CheckCircle2 className='h-2.5 w-2.5' /> Valid · {fixParts.length} tags
                    </span>
                  )}
                  {errCount > 0 && (
                    <span className='hidden sm:flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded border border-red-500/20 text-red-400 bg-red-500/5'
                    >
                      <AlertTriangle className='h-2.5 w-2.5' /> {errCount} error{errCount > 1 ? 's' : ''}
                    </span>
                  )}
                  <span className='text-[10px] font-mono' style={{ color: 'var(--text-muted)' }}>{filledCount}/{vpCount}</span>
                  <div className='w-14 h-1 rounded-full overflow-hidden' style={{ background: 'var(--border)' }}>
                    <div className='h-full rounded-full transition-all duration-500'
                      style={{
                        width: vpCount > 0 ? Math.round((filledCount / vpCount) * 100) + '%' : '0%',
                        background: filledCount === vpCount && vpCount > 0 ? '#10b981' : 'var(--primary)',
                      }}
                    />
                  </div>
                </div>
              </div>

              {activeStrategy.description && (
                <div className='px-3.5 py-1.5 text-[10px] bg-[var(--card)] border-t border-[var(--border)] flex items-start gap-1.5' style={{ color: 'var(--text-muted)' }}>
                  <Info className='h-3.5 w-3.5 text-[var(--primary)] shrink-0 mt-0.5' />
                  <div>
                    <span>{activeStrategy.description}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Two-column layout */}
            <div className='grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4'>

              {/* Left: Form panels */}
              <div className='space-y-4'>

                {/* Validation failures summary */}
                {Object.keys(validationErrors).filter(k => k.startsWith('_strategy_edit_')).length > 0 && (
                  <div className='p-3 rounded-lg border space-y-1.5'
                    style={{ background: 'rgba(239,68,68,0.04)', borderColor: 'rgba(239,68,68,0.15)' }}
                  >
                    <div className='flex items-center gap-1.5 text-xs font-bold text-red-400'>
                      <AlertTriangle className='h-3.5 w-3.5 shrink-0' />
                      <span>Strategy Rules validation failures</span>
                    </div>
                    <ul className='list-disc list-inside text-[10px] space-y-0.5 text-red-400 font-mono pl-0.5'>
                      {Object.entries(validationErrors)
                        .filter(([k]) => k.startsWith('_strategy_edit_'))
                        .map(([k, msg]) => <li key={k}>{msg}</li>)}
                    </ul>
                  </div>
                )}

                {activeStrategy.groups.map((group, i) => (
                  <div key={i} id={'atdl-panel-' + i}>
                    <PanelGroup group={group} values={effectiveValues} onChange={handleValueChange} errors={validationErrors} dirty={dirty} />
                  </div>
                ))}

                {/* Form Action Buttons */}
                <div className='flex flex-wrap gap-2 pt-1'>
                  <button onClick={handleValidate} className='fx-btn-primary py-1.5 px-3.5 text-xs cursor-pointer'>
                    <CheckCircle2 className='h-3.5 w-3.5' /> Validate &amp; Preview FIX
                  </button>
                  <button onClick={handleReset} className='fx-btn-secondary py-1.5 px-3 text-xs cursor-pointer'>
                    <RotateCcw className='h-3.5 w-3.5' /> Reset Fields
                  </button>
                  {/* Mobile-only status */}
                  {fixParts.length > 0 && errCount === 0 && (
                    <span className='sm:hidden px-2.5 py-1.5 rounded border text-[10px] font-semibold flex items-center gap-1 border-emerald-500/20 text-emerald-400 bg-emerald-500/5'
                    >
                      <CheckCircle2 className='h-3 w-3' /> Valid
                    </span>
                  )}
                  {errCount > 0 && (
                    <span className='sm:hidden px-2.5 py-1.5 rounded border text-[10px] font-semibold flex items-center gap-1 border-red-500/20 text-red-400 bg-red-500/5'
                    >
                      <AlertTriangle className='h-3 w-3' /> {errCount} error{errCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Right Sidebar */}
              <div className='space-y-4'>

                {/* Card 1: FIX to Form Synchronizer */}
                <div className='rounded-xl border overflow-hidden bg-[var(--card)] border-[var(--border)]'>
                  <div className='px-3.5 py-2 flex items-center gap-2 border-b border-[var(--border)] bg-[var(--background)]'>
                    <Sparkles className='h-3.5 w-3.5' style={{ color: 'var(--primary)' }} />
                    <span className='text-[11px] font-bold'>FIX to Form Sync</span>
                  </div>
                  <div className='p-3 space-y-2'>
                    <p className='text-[10px]' style={{ color: 'var(--text-muted)' }}>
                      Paste a raw FIX message to populate form fields. Supports SOH, Pipe, or caret delimiters.
                    </p>
                    <textarea
                      value={rawFixInput}
                      onChange={e => setRawFixInput(e.target.value)}
                      placeholder='e.g. 59=6|7620=Y|7610=0.35'
                      className='w-full h-14 p-2 rounded text-[10px] font-mono outline-none bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] resize-none'
                    />
                    <button
                      type='button'
                      onClick={handleParseRawFix}
                      disabled={!rawFixInput.trim()}
                      className='w-full fx-btn-primary justify-center py-1.5 text-[10px] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
                    >
                      Sync Message to Form
                    </button>
                  </div>
                </div>

                {/* Card 2: Combined FIX Workstation Output (Tabs: Preview vs. Tag Map) */}
                <div className='rounded-xl border overflow-hidden bg-[var(--card)] border-[var(--border)]'>
                  <div className='px-3.5 py-2 flex items-center justify-between border-b border-[var(--border)] bg-[var(--background)]'>
                    {/* Left: Tab selection */}
                    <div className='flex border border-[var(--border)] rounded overflow-hidden shrink-0'>
                      <button
                        type='button'
                        onClick={() => setActiveSidebarTab('preview')}
                        className={`px-3 py-1 flex items-center gap-1.5 text-[10px] font-bold border-none cursor-pointer outline-none transition-colors ${activeSidebarTab === 'preview' ? 'bg-[var(--primary)] text-[var(--background)]' : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--primary-faint)]'}`}
                      >
                        <Code2 className='h-3 w-3' /> Wire
                      </button>
                      <button
                        type='button'
                        onClick={() => setActiveSidebarTab('map')}
                        className={`px-3 py-1 flex items-center gap-1.5 text-[10px] font-bold border-none cursor-pointer outline-none transition-colors ${activeSidebarTab === 'map' ? 'bg-[var(--primary)] text-[var(--background)]' : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--primary-faint)]'}`}
                      >
                        <Hash className='h-3 w-3' /> Map
                      </button>
                    </div>

                    {/* Right: Actions and settings */}
                    <div className='flex items-center gap-1.5'>
                      {activeSidebarTab === 'preview' && (
                        <div className='flex rounded border border-[var(--border)] overflow-hidden shrink-0 mr-1'>
                          {['\\u0001', '|'].map(delim => (
                            <button
                              key={delim}
                              type='button'
                              onClick={() => setFixDelimiter(delim)}
                              className={`px-1.5 py-0.5 text-[9px] font-mono border-none outline-none cursor-pointer transition-colors ${fixDelimiter === delim ? 'bg-[var(--primary)] text-[var(--background)]' : 'bg-[var(--background)] hover:bg-[var(--primary-faint)]'}`}
                            >
                              {delim === '\\u0001' ? 'SOH' : delim}
                            </button>
                          ))}
                        </div>
                      )}
                      {fixPreview && activeSidebarTab === 'preview' && (
                        <>
                          <button onClick={handleCopy} title='Copy Message' className='p-1 border border-[var(--border)] bg-transparent rounded hover:bg-[var(--primary-faint)] cursor-pointer'>
                            {copied ? <Check className='h-3 w-3 text-emerald-400' /> : <Copy className='h-3 w-3 text-[var(--text-muted)]' />}
                          </button>
                          <button onClick={handleDownload} title='Download Parameters' className='p-1 border border-[var(--border)] bg-transparent rounded hover:bg-[var(--primary-faint)] cursor-pointer'>
                            <Download className='h-3 w-3 text-[var(--text-muted)]' />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tab Body */}
                  <div className='p-3'>
                    {activeSidebarTab === 'preview' ? (
                      <div className='space-y-2.5'>
                        {/* Warnings block (moved inside output tab for dynamic debugger access) */}
                        {renderWarnings.length > 0 && (
                          <div className='p-2 rounded bg-amber-500/5 border border-amber-500/10 text-[9px] text-amber-400 font-mono max-h-[100px] overflow-y-auto'>
                            <span className='font-bold block uppercase tracking-wider mb-1'>Specification warnings:</span>
                            {renderWarnings.map((w, idx) => (
                              <div key={idx} className='flex items-start gap-1'>
                                <span>•</span>
                                <span>{w}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {fixParts.length > 0 ? (
                          <div className='space-y-0.5 max-h-[250px] overflow-y-auto'>
                            {fixParts.map((part, i) => {
                              const ei = part.indexOf('=');
                              const tag = ei > -1 ? part.slice(0, ei) : part;
                              const val = ei > -1 ? part.slice(ei + 1) : '';
                              return (
                                <div key={i} className='flex items-baseline gap-2 text-[10px] font-mono py-1 px-1.5 rounded transition-colors hover:bg-[var(--primary-faint)]'>
                                  <span className='shrink-0 w-10 text-right font-bold' style={{ color: 'var(--primary)' }}>{tag}</span>
                                  <span style={{ color: 'var(--text-muted)' }}>=</span>
                                  <span className='break-all' style={{ color: 'var(--foreground)' }}>{val}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className='text-[10px] text-center py-6' style={{ color: 'var(--text-muted)' }}>
                            Fill strategy parameters then click<br />
                            <strong style={{ color: 'var(--foreground)' }}>Validate &amp; Preview FIX</strong>
                          </p>
                        )}

                        {fixParts.length > 0 && (
                          <div className='pt-2.5 border-t border-[var(--border)]'>
                            <p className='text-[9px] font-mono uppercase tracking-wider mb-1' style={{ color: 'var(--text-muted)' }}>
                              Raw Wire Output ({fixDelimiter === '\\u0001' ? 'SOH → |' : fixDelimiter})
                            </p>
                            <p className='text-[9px] font-mono break-all leading-normal p-2 rounded border bg-[var(--background)] border-[var(--border)] text-[var(--foreground)]'
                            >
                              {fixDelimiter === '\\u0001' ? fixPreview.replace(/\u0001/g, '|') : fixPreview}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <ParameterMapTable
                        parameters={activeStrategy.parameters}
                        values={effectiveValues}
                        search={paramMapSearch}
                        setSearch={setParamMapSearch}
                      />
                    )}
                  </div>
                </div>

                {/* Card 3: Advanced Developer Telemetry (Validation Rule Debugger & Tag Coverage Analytics) */}
                <div className='rounded-xl border overflow-hidden bg-[var(--card)] border-[var(--border)]'>
                  <div className='px-3.5 py-2 flex items-center justify-between border-b border-[var(--border)] bg-[var(--background)]'>
                    {/* Left: Tab selection */}
                    <div className='flex border border-[var(--border)] rounded overflow-hidden shrink-0'>
                      <button
                        type='button'
                        onClick={() => setActiveTelemetryTab('validation')}
                        className={`px-3 py-1 flex items-center gap-1.5 text-[10px] font-bold border-none cursor-pointer outline-none transition-colors ${activeTelemetryTab === 'validation' ? 'bg-[var(--primary)] text-[var(--background)]' : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--primary-faint)]'}`}
                      >
                        <UserCog className='h-3 w-3' /> Rule Debugger
                      </button>
                      <button
                        type='button'
                        onClick={() => setActiveTelemetryTab('coverage')}
                        className={`px-3 py-1 flex items-center gap-1.5 text-[10px] font-bold border-none cursor-pointer outline-none transition-colors ${activeTelemetryTab === 'coverage' ? 'bg-[var(--primary)] text-[var(--background)]' : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--primary-faint)]'}`}
                      >
                        <BarChart3 className='h-3 w-3' /> Tag Analytics
                      </button>
                    </div>
                  </div>

                  {/* Tab Body */}
                  <div className='p-3 max-h-[350px] overflow-y-auto'>
                    {activeTelemetryTab === 'validation' ? (
                      <ValidationTreeInspector
                        rules={activeStrategy.validationRules}
                        values={effectiveValues}
                      />
                    ) : (
                      <TagAnalyticsView
                        analytics={getTagAnalytics()}
                      />
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
