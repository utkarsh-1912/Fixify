// src/lib/dialect.js

/**
 * Parses a standard QuickFIX XML dictionary file.
 * Returns the version string and an array of field objects with tags, names, types, and values/enums.
 */
export function parseQuickFixXml(xmlText) {
  if (typeof window === 'undefined') return null;
  
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "application/xml");
  const parserError = xmlDoc.getElementsByTagName("parsererror");
  if (parserError.length > 0) {
    throw new Error("Invalid XML dictionary file: " + parserError[0].textContent);
  }
  
  const fixEl = xmlDoc.getElementsByTagName("fix")[0];
  if (!fixEl) {
    throw new Error("Missing root <fix> element in dictionary XML.");
  }
  
  const major = fixEl.getAttribute("major") || "4";
  const minor = fixEl.getAttribute("minor") || "4";
  const servicepack = fixEl.getAttribute("servicepack") || "";
  const spSuffix = servicepack ? `SP${servicepack}` : "";
  const version = `FIX.${major}.${minor}${spSuffix}-custom`;
  
  const fieldsParent = xmlDoc.getElementsByTagName("fields")[0];
  if (!fieldsParent) {
    throw new Error("Missing <fields> parent element in dictionary XML.");
  }
  
  const fieldNodes = fieldsParent.getElementsByTagName("field");
  const fields = [];
  
  for (let i = 0; i < fieldNodes.length; i++) {
    const fNode = fieldNodes[i];
    
    // QuickFIX XML defines <field number="1" name="Account" type="STRING">
    // values are nested as <value enum="1" description="NOT_HELD" />
    const tag = parseInt(fNode.getAttribute("number"), 10);
    const name = fNode.getAttribute("name");
    const type = fNode.getAttribute("type") || "STRING";
    
    if (isNaN(tag)) continue;
    
    const values = [];
    const valNodes = fNode.getElementsByTagName("value");
    for (let j = 0; j < valNodes.length; j++) {
      const vNode = valNodes[j];
      const enumVal = vNode.getAttribute("enum");
      const description = vNode.getAttribute("description");
      if (enumVal !== null && description !== null) {
        values.push({
          enum: enumVal,
          description
        });
      }
    }
    
    fields.push({
      tag,
      name,
      type,
      ...(values.length > 0 ? { values } : {})
    });
  }
  
  return {
    version,
    fields
  };
}

// In-memory cache for fast lookups
let customDialectCache = null;

export function clearCustomDialectCache() {
  customDialectCache = null;
}

/**
 * Loads custom dialect from localStorage.
 */
export function getCustomDialect() {
  if (typeof window === 'undefined') return null;
  if (customDialectCache) return customDialectCache;
  
  try {
    const raw = localStorage.getItem('fixify-custom-dialect');
    if (raw) {
      customDialectCache = JSON.parse(raw);
      return customDialectCache;
    }
  } catch (e) {
    console.error("Failed to parse custom dialect from localStorage", e);
  }
  return null;
}
