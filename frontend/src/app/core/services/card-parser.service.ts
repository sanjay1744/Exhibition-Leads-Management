import { Injectable } from '@angular/core';

export interface FieldCandidateDiagnostic {
  field: 'name' | 'designation' | 'company' | 'phone' | 'email' | 'website' | 'address';
  selectedValue?: string;
  evaluatedLines: { line: string; status: 'selected' | 'rejected' | 'candidate'; score?: number; reason: string }[];
}

export interface MergeFieldScore {
  field: string;
  pass1Val?: string;
  pass1Score: number;
  pass2Val?: string;
  pass2Score: number;
  winner: 'pass1' | 'pass2' | 'equal' | 'none';
  finalVal?: string;
}

export interface OcrDebugTelemetry {
  timestamp: string;
  pass1WarpedUrl?: string;
  pass2BinarizedUrl?: string;
  pass1RawText?: string;
  pass2RawText?: string;
  pass1LineMetadata?: OcrLineMetadata[];
  pass2LineMetadata?: OcrLineMetadata[];
  pass1Extracted?: ExtractedCardData;
  pass2Extracted?: ExtractedCardData;
  fieldDiagnostics?: FieldCandidateDiagnostic[];
  mergeScores?: MergeFieldScore[];
  finalMerged?: ExtractedCardData;
  apiResponse?: any;
}

export interface ExtractedCardData {
  name?: string;
  designation?: string;
  company?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  rawText?: string;
  confidence?: number;
  photoDataUrl?: string;
}

export interface OcrLineMetadata {
  text: string;
  fontSize: number; // Line bounding box height in pixels
}

export const PREDEFINED_DESIGNATIONS = [
  'Business Development Head',
  'Business Development Manager',
  'Business Development Executive',
  'Chief Executive Officer',
  'Chief Technology Officer',
  'Chief Operating Officer',
  'Chief Financial Officer',
  'Chief Development Officer',
  'Chief Marketing Officer',
  'Managing Director',
  'Executive Director',
  'Technical Director',
  'Director',
  'President',
  'Vice President',
  'General Manager',
  'Senior Manager',
  'Project Manager',
  'Product Manager',
  'Sales Manager',
  'Purchase Manager',
  'Marketing Manager',
  'Operations Manager',
  'Regional Manager',
  'Account Manager',
  'Relationship Manager',
  'Manager',
  'Head of Sales',
  'Head of Marketing',
  'Head of Operations',
  'Head of Business Development',
  'Head of Engineering',
  'Head of Purchase',
  'Lead Engineer',
  'Senior Engineer',
  'Software Engineer',
  'Engineer',
  'Sales Executive',
  'Marketing Executive',
  'Purchase Officer',
  'Consultant',
  'Advisor',
  'Architect',
  'Specialist',
  'Founder',
  'Co-Founder',
  'Proprietor',
  'Owner',
  'Partner',
  'Executive'
];

@Injectable({
  providedIn: 'root'
})
export class CardParserService {

  readonly PREDEFINED_DESIGNATIONS = PREDEFINED_DESIGNATIONS;

  private readonly DESIGNATIONS = PREDEFINED_DESIGNATIONS.map(d => d.toUpperCase());

  private readonly COMPANY_SUFFIXES = [
    'GROUP OF COMPANIES', 'GROUP', 'COMPANIES',
    'TECH PRIVATE LIMITED', 'TECH PVT LTD', 'PRIVATE LIMITED', 'PVT LTD',
    'LIMITED', 'LTD', 'INCORPORATED', 'INC', 'CORPORATION', 'CORP',
    'LLP', 'PLC', 'GMBH', 'ENTERPRISES', 'ENTERPRISE', 'SOLUTIONS',
    'TECHNOLOGIES', 'INFOTECH', 'INDUSTRIES', 'SERVICES', 'SOFTWARE',
    'SYSTEMS', 'LOGISTICS', 'GLOBAL', 'EXPORTS', 'IMPORTS', 'TRADERS',
    'INTERNATIONAL', 'AGENCY', 'STUDIO', 'WORKS', 'VENTURES', 'FINANCE',
    'HOUSING', 'CAPITAL', 'CREDIT', 'HOLDINGS', 'DEVELOPERS', 'BUILDERS'
  ];

  /**
   * Computes Levenshtein distance between two strings for offline OCR typo repair
   */
  private levenshteinDistance(a: string, b: string): number {
    const s1 = a.toUpperCase();
    const s2 = b.toUpperCase();
    const matrix: number[][] = [];

    for (let i = 0; i <= s2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    return matrix[s2.length][s1.length];
  }

  // Strict word-boundary regex for address keywords to prevent false positives (e.g. "ST" matching "TRUST" or "homefirst")
  private readonly ADDRESS_KEYWORD_REGEX = /\b(?:ROAD|RD|STREET|ST|AVE|AVENUE|BLVD|FLOOR|FLR|BUILDING|BLDG|PLOT|SECTOR|ESTATE|MIDC|PIN|ZIP|PINCODE|CITY|STATE|INDIA|POST|NAGAR|EAST|WEST|NORTH|SOUTH|COMPLEX|TOWER|CIVIL AERODROME|AERODROME|POSTAL|LAYOUT|BYPASS|CROSS|MAIN|BLOCK|DOOR|NO|SF|OPP|OPPOSITE|NEAR|BEHIND|NEXT TO|CORNER|ARCATA|ARCADE|PLAZA|CENTER|CENTRE|SQUARE|PARK|ENCLAVE|APARTMENT|APTS|VILLA|HOUSING|MANOR|HEIGHTS|GARDENS|COLONY|CHAMBERS)\b/i;

  private readonly ADDRESS_CITIES_REGEX = /\b(?:MUMBAI|DELHI|BANGALORE|CHENNAI|HYDERABAD|COIMBATORE|PUNE|AHMEDABAD|KOLKATA|TIRUPUR|SALEM|TRICHY|TIRUCHIRAPPALLI|MADURAI|SINGANALLUR|PEELAMEDU|GANDHIPURAM|AERODROME|ERODE|VELLORE|THUTHOOKUDI|NAGERCOIL|KANCHEEPURAM|THIRUVALLUR|KARUR|DINDIGUL|THANJAVUR|NOIDA|GURGAON|GURUGRAM|GHAZIABAD|FARIDABAD|SURAT|JAIPUR|LUCKNOW|NAGPUR|INDORE|THANE|BHOPAL|VISAKHAPATNAM|VADODARA|GHATKOPAR|ANDHERI|WHITEFIELD|ELECTRONIC CITY|KORAMANGALA|HSR|JAYANAGAR|INDIRANAGAR)\b/i;

  private readonly STOP_WORDS = ['THE', 'AND', 'FOR', 'WITH', 'THIS', 'THAT', 'FROM', 'RE', 'A', 'AN', 'OF', 'IN', 'ON', 'AT', 'TO'];

  /**
   * Sanitizes extracted text fields by removing unwanted OCR special characters, braces, and trailing symbols.
   */
  private cleanField(val?: string, type?: 'name' | 'company' | 'designation'): string | undefined {
    if (!val) return undefined;
    let s = val.trim();

    if (type === 'name') {
      // Auto-repair common OCR symbol misreads of 'J' at the end of names e.g. "PUSHPARA]" -> "PUSHPARAJ", "SUNDARRA)" -> "SUNDARRAJ"
      s = s.replace(/([A-Z]{2,})(?:RA|PA|MA|BA|GA|KA)[\]\)\}\>\|/\\]+/gi, '$1RAJ');
      s = s.replace(/([A-Z]{3,})[\]\)\}\>]+/gi, '$1J');
      s = s.replace(/RA[\]\)\}\>]/gi, 'RAJ');
      s = s.replace(/RAI\s+Ree$/i, 'RAJ');
      s = s.replace(/RAI$/i, 'RAJ');
      s = s.replace(/\b(SUNDAR|PUSHPA|SELVA|DHARMA|NAGA|YUVA|KAMA|NATA|JAYA|MUTHU|BALA|RAM)RAI?\b/i, (m, g1) => g1.toUpperCase() + 'RAJ');
      s = s.replace(/[^a-zA-Z\s.'-]/g, ' ');
      // Standardize single/double initial dots e.g. "T R Manikandan" -> "T.R. Manikandan", "R SUNDARRAJ" -> "R. SUNDARRAJ"
      s = s.replace(/^([A-Z])\s+([A-Z])\s+([A-Z][a-z]+)/, '$1.$2. $3');
      s = s.replace(/^([A-Z])\s+([A-Z][a-z]+)/, '$1. $2');
      s = s.replace(/^([A-Z])\s+([A-Z]+)$/, '$1. $2');
      s = s.replace(/^([A-Z])\.\s*([A-Z])\s+([A-Z][a-z]+)/, '$1.$2. $3');
    } else if (type === 'designation') {
      // Allow letters, digits, spaces, ampersands, slashes, hyphens (e.g. "Sales / Marketing Director")
      s = s.replace(/[^a-zA-Z0-9\s&/-]/g, ' ');
    } else if (type === 'company') {
      // Allow letters, digits, spaces, dots, ampersands, hyphens, apostrophes (strip /, }, {, ], [, ~, |, #, etc.)
      s = s.replace(/[^a-zA-Z0-9\s.&'-]/g, ' ');
    }

    // Collapse multiple spaces & trim leading/trailing noise symbols
    s = s.replace(/\s+/g, ' ').trim();
    s = s.replace(/^[-_.~=*\s|:/\\{}()\[\]]+|[-_.~=*\s|:/\\{}()\[\]]+$/g, '').trim();

    return s.length >= 2 ? s : undefined;
  }

  /**
   * Parses raw OCR string into structured contact fields with high precision heuristics
   */
  parseCardText(rawText: string, lineMetadata: OcrLineMetadata[] = []): ExtractedCardData {
    if (!rawText || !rawText.trim()) {
      return {};
    }

    const cleanedText = this.sanitizeOcrText(rawText);

    const lines: string[] = [];
    for (const rawLine of cleanedText.split('\n')) {
      // Split line segments separated by 3 or more spaces or tabs e.g. "T.R. Manikandan          +91 99449 23516"
      const segments = rawLine.split(/\s{3,}|\t+/).map(s => s.trim()).filter(s => s.length > 0);
      for (const seg of segments) {
        if (!/^[-_.~=*\s|:]+$/.test(seg)) {
          lines.push(seg);
        }
      }
    }

    const email = this.extractEmail(cleanedText);
    const website = this.extractWebsite(cleanedText);
    const phone = this.extractPhone(cleanedText);

    let designation = this.extractDesignation(lines);
    designation = this.cleanField(designation, 'designation');

    // Extract Name first before Company so company extractor doesn't claim person's name
    let name = this.extractName(lines, { email, phone, website, designation });
    name = this.cleanField(name, 'name');

    // Pass line metadata & extracted name to company extractor
    let company = this.extractCompany(lines, email, website, lineMetadata, { designation, name });
    company = this.cleanField(company, 'company');

    // Strip company brand words or website domain stem if prepended/appended to person's name e.g. "R. SUNDARRAJ naren" -> "R. SUNDARRAJ"
    if (name && (company || website || email)) {
      const brandKeywords: string[] = [];
      if (company) {
        const compWords = company.split(/\s+/).filter(w => w.length >= 3 && !this.COMPANY_SUFFIXES.includes(w.toUpperCase()));
        brandKeywords.push(...compWords);
      }
      if (website) {
        const webMatch = website.match(/(?:www\.|@)([a-zA-Z0-9-]+)\./);
        if (webMatch && webMatch[1]) brandKeywords.push(webMatch[1]);
      }
      for (const brand of brandKeywords) {
        if (brand.length >= 3) {
          const reg = new RegExp(`\\s+\\b${brand}\\b|\\b${brand}\\b\\s+`, 'gi');
          name = name.replace(reg, ' ').trim();
        }
      }
      name = this.cleanField(name, 'name');
    }

    const address = this.extractAddress(lines, { email, phone, website, designation, company, name });

    return {
      name,
      designation,
      company,
      phone,
      email,
      website,
      address,
      rawText: cleanedText
    };
  }

  scoreField(str?: string, type?: string): number {
    if (!str || !str.trim()) return -100;
    const val = str.trim();
    let score = 10;

    const words = val.split(/\s+/).filter(w => w.length > 0);
    const singleChars = words.filter(w => w.length === 1 && !/^[AI]$/i.test(w)).length;
    if (words.length >= 2 && singleChars / words.length > 0.25) score -= 50;

    if (type === 'name') {
      if (/\d/.test(val) || /\+91/.test(val)) score -= 100;
      if (words.some(w => /^[A-Z]\.?$/i.test(w))) score += 35;
      if (words.every(w => /^[A-Z][a-z.]*$/i.test(w))) score += 20;
      if (/\b(?:director|manager|officer|directo|fn|bs|hts|aka|saaf|saanfor|my)\b/i.test(val)) score -= 50;
    } else if (type === 'company') {
      if (this.COMPANY_SUFFIXES.some(s => val.toUpperCase().includes(s))) score += 40;
      if (/\b(?:fn|bs|hts|my|tr)\b/i.test(val)) score -= 30;
    } else if (type === 'phone') {
      if (/^\+91\s[6-9]\d{4}\s\d{5}/.test(val)) score += 30;
      if (/^\+91\s422\s\d{6,7}/.test(val)) score += 30;
    }

    return score;
  }

  getDiagnosticBreakdown(rawText: string, lineMetadata: OcrLineMetadata[] = []): FieldCandidateDiagnostic[] {
    const cleaned = this.sanitizeOcrText(rawText);
    const lines: string[] = [];
    for (const rawLine of cleaned.split('\n')) {
      const segments = rawLine.split(/\s{3,}|\t+/).map(s => s.trim()).filter(s => s.length > 0);
      for (const seg of segments) {
        lines.push(seg);
      }
    }
    const parsed = this.parseCardText(rawText, lineMetadata);

    const diagnostics: FieldCandidateDiagnostic[] = [];
    const fields: ('name' | 'designation' | 'company' | 'phone' | 'email' | 'website' | 'address')[] = 
      ['email', 'phone', 'website', 'designation', 'name', 'company', 'address'];

    for (const field of fields) {
      const selectedValue = (parsed as any)[field];
      const evaluatedLines = lines.map(line => {
        const isMatch = selectedValue && line.toLowerCase().includes(selectedValue.toLowerCase());
        return {
          line,
          status: isMatch ? ('selected' as const) : ('candidate' as const),
          score: this.scoreField(line, field),
          reason: isMatch ? `Matched extracted ${field}` : `Evaluated as line candidate for ${field}`
        };
      });

      diagnostics.push({
        field,
        selectedValue,
        evaluatedLines
      });
    }

    return diagnostics;
  }

  /**
   * Merges primary and secondary multi-pass OCR parsed data using quality heuristic scoring
   */
  mergeCardData(primary: ExtractedCardData, secondary: ExtractedCardData): ExtractedCardData {
    const scoreField = (str?: string, type?: string): number => {
      if (!str || !str.trim()) return -100;
      const val = str.trim();
      let score = 10;

      // Penalize strings with high proportion of single-character words or random noise
      const words = val.split(/\s+/).filter(w => w.length > 0);
      const singleChars = words.filter(w => w.length === 1 && !/^[AI]$/i.test(w)).length;
      if (words.length >= 2 && singleChars / words.length > 0.25) score -= 50;

      if (type === 'name') {
        // High score for capitalized initials e.g. "R. SUNDARRAJ"
        if (words.some(w => /^[A-Z]\.?$/i.test(w))) score += 35;
        // High score for standard Title Case / ALL CAPS person names
        if (words.every(w => /^[A-Z][a-z.]*$/i.test(w))) score += 20;
        // Heavy penalty if string contains designation words or noise like "Directo", "Manager", "FN", "hts", "aka"
        if (/\b(?:director|manager|officer|directo|fn|bs|hts|aka|saaf|saanfor|my)\b/i.test(val)) score -= 50;
      } else if (type === 'company') {
        // High score for explicit company suffixes
        if (this.COMPANY_SUFFIXES.some(s => val.toUpperCase().includes(s))) score += 40;
        // Penalty for trailing noise symbols like "FN bs"
        if (/\b(?:fn|bs|hts|my|tr)\b/i.test(val)) score -= 30;
      } else if (type === 'phone') {
        if (/^\+91\s[6-9]\d{4}\s\d{5}/.test(val)) score += 30;
        if (/^\+91\s422\s\d{6,7}/.test(val)) score += 30;
      }

      return score;
    };

    const pickBest = (field1?: string, field2?: string, type?: string): string | undefined => {
      if (!field1 && !field2) return undefined;
      const f1 = field1?.trim();
      const f2 = field2?.trim();
      if (!f1) return f2;
      if (!f2) return f1;

      const s1 = scoreField(f1, type);
      // Pass 1 Primary Rule: If Pass 1 has a valid score (>= 0), keep Pass 1 without letting Pass 2 override it
      if (s1 >= 0) {
        return f1;
      }

      // Pass 2 Secondary Fallback Rule: Only if Pass 1 score was invalid/noisy (< 0), check if Pass 2 is better
      const s2 = scoreField(f2, type);
      return s2 > s1 ? f2 : f1;
    };

    return {
      name: this.cleanField(pickBest(primary.name, secondary.name, 'name'), 'name'),
      designation: this.cleanField(pickBest(primary.designation, secondary.designation, 'designation'), 'designation'),
      company: this.cleanField(pickBest(primary.company, secondary.company, 'company'), 'company'),
      phone: pickBest(primary.phone, secondary.phone, 'phone'),
      email: pickBest(primary.email, secondary.email, 'email'),
      website: pickBest(primary.website, secondary.website, 'website'),
      address: pickBest(primary.address, secondary.address, 'address'),
      rawText: primary.rawText || secondary.rawText
    };
  }

  private sanitizeOcrText(text: string): string {
    return text
      // Replace explicit location icons & symbols BEFORE stripping non-ASCII characters
      .replace(/[📍🏢🏠📌🗺️🧭🌍🌐⌂⌖🎯©®●•§€£ø]/g, ' [ADD] ')
      // Tag line-leading address prefixes e.g. "Address:", "Add:", "Office:", "Location:"
      .replace(/^[^\w\s\n]*\b(add|address|loc|location|off|office|factory|site|regd|head office|corporate office)\b[\s.:-]*/gmi, ' [ADD] ')
      // Replace phone icons
      .replace(/[☎📱📞]/g, ' [PH] ')
      // Tag line-leading phone prefixes e.g. "Tel:", "Mob:", "Ph:", "Phone:", "Cell:"
      .replace(/^[^\w\s\n]*\b(tel|mob|mobile|phone|ph|cell)\b[\s.:-]*/gmi, ' [PH] ')
      // Replace email icons
      .replace(/[✉📧]/g, ' [EMAIL] ')
      // Replace website icons
      .replace(/[🌐💻🔗]/g, ' [WEB] ')
      // Fix email OCR spaces e.g. "pushparaj . s @ ariyAitech .com" -> "pushparaj.s@ariyAitech.com"
      .replace(/([a-zA-Z0-9._%+-]+)\s*@\s*([a-zA-Z0-9.-]+)\s*\.\s*([a-zA-Z]{2,})/g, '$1@$2.$3')
      // Remove trailing noise symbols like "| :" or "~"
      .replace(/[|:~]+\s*$/gm, '')
      // Keep normal printable ASCII
      .replace(/[^\x00-\x7F]/g, ' ');
  }

  private extractEmail(text: string): string | undefined {
    const normalized = text
      .replace(/([a-zA-Z0-9._%+-]+)\s*@\s*([a-zA-Z0-9.-]+)\s*\.\s*([a-zA-Z]{2,})/gi, '$1@$2.$3')
      .replace(/([a-zA-Z0-9._%+-]+)\s*\[\s*at\s*\]\s*([a-zA-Z0-9.-]+)\s*\.\s*([a-zA-Z]{2,})/gi, '$1@$2.$3');

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
    const matches = normalized.match(emailRegex);
    if (matches && matches.length > 0) {
      let emailStr = matches[0].toLowerCase().trim();
      emailStr = emailStr.replace(/^[^\w]+|[.,;:]+$/g, '');
      emailStr = emailStr.replace(/([a-z0-9]+)1b(\d*@)/gi, '$118$2');
      emailStr = emailStr.replace(/([a-z0-9]+)l8(\d*@)/gi, '$118$2');
      emailStr = emailStr.replace(/@gma[i1l]{1,2}\.(?:com|co|in|1n)$/i, '@gmail.com');
      emailStr = emailStr.replace(/@yaho[o0]{1,2}\.(?:com|co|in)$/i, '@yahoo.com');
      return emailStr;
    }
    return undefined;
  }

  private extractWebsite(text: string): string | undefined {
    const webRegex = /(https?:\/\/)?(www\.)[a-zA-Z0-9.-]+\.(com|in|co|net|org|io|ai|biz|tech|me)\b(\/[^\s]*)?/i;
    const domainRegex = /\b(https?:\/\/)?[a-zA-Z0-9.-]+\.(com|in|co\.in|co|net|org|io|ai|biz|tech|me)\b(\/[^\s]*)?/i;

    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes('@')) continue;

      const match = trimmed.match(webRegex) || trimmed.match(domainRegex);
      if (match) {
        let url = match[0].toLowerCase().replace(/^[^\w\s]*|[:.,;:]+$/g, '');
        if (!url.startsWith('http') && !url.startsWith('www.')) {
          url = 'https://' + url;
        }
        return url;
      }
    }
    return undefined;
  }

  private extractPhone(text: string): string | undefined {
    const phones: string[] = [];

    // Match all international or 10-digit mobile numbers
    const mobileRegex = /(?:\+?91[\s.-]?)?[6-9]\d{4}[\s.-]?\d{5}|\b[6-9]\d{9}\b/g;
    let match: RegExpExecArray | null;
    while ((match = mobileRegex.exec(text)) !== null) {
      const digits = match[0].replace(/\D/g, '');
      let formatted = '';
      if (digits.length === 10) {
        formatted = '+91 ' + digits.slice(0, 5) + ' ' + digits.slice(5);
      } else if (digits.length === 12 && digits.startsWith('91')) {
        formatted = '+91 ' + digits.slice(2, 7) + ' ' + digits.slice(7);
      } else {
        formatted = match[0].trim();
      }
      if (!phones.includes(formatted)) {
        phones.push(formatted);
      }
    }

    // Match landline numbers e.g. 0422 2967078, 2967127, +91 422 2967078
    const landlineRegex = /(?:\+?91[\s.-]?)?(?:0?\d{3,4}[\s.-]?)?[2-5]\d{6,7}/g;
    while ((match = landlineRegex.exec(text)) !== null) {
      const digits = match[0].replace(/\D/g, '');
      if (digits.length >= 7 && digits.length <= 12) {
        let formatted = match[0].trim();
        if (digits.length === 10 && digits.startsWith('0422')) {
          formatted = '+91 422 ' + digits.slice(4);
        }
        if (!phones.includes(formatted)) {
          phones.push(formatted);
        }
      }
    }

    if (phones.length > 0) {
      return phones.slice(0, 3).join(', ');
    }

    return undefined;
  }

  private extractDesignation(lines: string[]): string | undefined {
    const predefinedUpper = PREDEFINED_DESIGNATIONS.map(d => ({
      raw: d,
      upper: d.toUpperCase()
    }));

    const singleWordRoles = [
      'DIRECTOR', 'MANAGER', 'PRESIDENT', 'FOUNDER', 'CO-FOUNDER',
      'PROPRIETOR', 'OWNER', 'PARTNER', 'ENGINEER', 'CONSULTANT',
      'ADVISOR', 'ARCHITECT', 'SPECIALIST', 'EXECUTIVE', 'REPRESENTATIVE',
      'HEAD', 'CHIEF', 'OFFICER', 'LEAD'
    ];

    const shortAcronyms = ['CEO', 'CTO', 'COO', 'CFO', 'CDO', 'CMO', 'CIO', 'MD', 'VP', 'GM'];

    // Dynamic pattern for <Department> <Role> (e.g. "Business Development Head", "Sales Manager")
    const deptRoleRegex = /\b(?:BUSINESS\s+DEVELOPMENT|SALES|MARKETING|OPERATIONS|PURCHASE|PROCUREMENT|ENGINEERING|TECHNOLOGY|PROJECT|PRODUCT|FINANCE|ACCOUNTS|HR|IT|TECHNICAL|REGIONAL|QUALITY|QA|R&D)\s+(?:HEAD|MANAGER|DIRECTOR|LEAD|EXECUTIVE|OFFICER|VP|CHIEF|ADVISOR|CONSULTANT|SPECIALIST)\b/i;

    // Dynamic pattern for "Head of <Department>" or "Head - <Department>"
    const headOfDeptRegex = /\bHEAD\s+(?:OF\s+|-|:)?\s*(?:SALES|MARKETING|OPERATIONS|BUSINESS\s+DEVELOPMENT|ENGINEERING|PURCHASE|PROCUREMENT|FINANCE|IT|HR|STRATEGY|TECHNOLOGY|QUALITY|R&D)\b/i;

    // Pass 1: Multi-word & Predefined designation pattern matching
    for (const line of lines) {
      const cleaned = line.replace(/^[|:~_\-\s]+|[|:~_\-\s]+$/g, '').trim();
      const upper = cleaned.toUpperCase();
      if (!cleaned || cleaned.length > 60) continue;

      // Skip lines that match company suffixes unless they clearly contain a designation like "Director"
      if (this.COMPANY_SUFFIXES.some(s => upper.includes(s)) && !upper.includes('DIRECTOR') && !upper.includes('MANAGER')) {
        continue;
      }

      // Check against predefined designations
      for (const item of predefinedUpper) {
        const regex = new RegExp(`\\b${item.upper.replace(/\s+/g, '\\s+')}\\b`, 'i');
        if (regex.test(upper)) {
          return item.raw;
        }
      }

      // Check dynamic <Department> <Role> pattern (e.g. "Business Development Head")
      const deptMatch = cleaned.match(deptRoleRegex);
      if (deptMatch) {
        return deptMatch[0];
      }

      // Check dynamic "Head of <Department>" pattern
      const headMatch = cleaned.match(headOfDeptRegex);
      if (headMatch) {
        return headMatch[0];
      }
    }

    // Pass 2: Fuzzy Managing / Relationship / Marketing Director & OCR typo patterns
    for (const line of lines) {
      const cleaned = line.replace(/^[|:~_\-\s]+|[|:~_\-\s]+$/g, '').trim();
      const upper = cleaned.toUpperCase();
      if (!cleaned || cleaned.length > 50) continue;

      if (/\bMANAG\w*\s+DIRECT\w*\b/i.test(upper) || /\bMARKET\w*\s+DIRECT\w*\b/i.test(upper)) {
        if (/\bMARKET/i.test(upper)) return 'Marketing Director';
        return 'Managing Director';
      }

      if (/\bRELAT\w*\s+MANAG\w*\b/i.test(upper) || /\bRETAF\w*\s+MANAG\w*\b/i.test(upper) || /\bREIAL\w*\s+MANAG\w*\b/i.test(upper)) {
        return 'Relationship Manager';
      }

      if (/\bBUSI\w*\s+DEVEL\w*\s+(?:HEAD|MANAG\w*|EXEC\w*)\b/i.test(upper)) {
        if (upper.includes('HEAD')) return 'Business Development Head';
        if (upper.includes('EXEC')) return 'Business Development Executive';
        return 'Business Development Manager';
      }
    }

    // Pass 3: Single-word roles & Acronyms
    for (const line of lines) {
      const cleaned = line.replace(/^[|:~_\-\s]+|[|:~_\-\s]+$/g, '').trim();
      const upper = cleaned.toUpperCase();
      if (!cleaned || cleaned.length > 50) continue;

      for (const role of [...singleWordRoles, ...shortAcronyms]) {
        const regex = new RegExp(`\\b${role}\\b`, 'i');
        if (regex.test(upper)) {
          if (this.COMPANY_SUFFIXES.some(s => upper.includes(s)) && !upper.includes('DIRECTOR') && !upper.includes('MANAGER')) {
            continue;
          }
          return role.charAt(0) + role.slice(1).toLowerCase();
        }
      }
    }

    // Pass 4: Fuzzy Levenshtein Distance repair against PREDEFINED_DESIGNATIONS
    for (const line of lines) {
      const cleaned = line.replace(/^[|:~_\-\s]+|[|:~_\-\s]+$/g, '').trim();
      if (!cleaned || cleaned.length > 45) continue;
      const upper = cleaned.toUpperCase();

      for (const item of predefinedUpper) {
        if (Math.abs(upper.length - item.upper.length) <= 3) {
          const dist = this.levenshteinDistance(upper, item.upper);
          if (dist >= 1 && dist <= 3) {
            return item.raw;
          }
        }
      }
    }

    return undefined;
  }

  private extractCompany(
    lines: string[],
    email?: string,
    website?: string,
    lineMetadata: OcrLineMetadata[] = [],
    alreadyExtracted: { name?: string; designation?: string } = {}
  ): string | undefined {
    // 1. Explicit Suffix Match or Fuzzy Typo Match (High Confidence)
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const upper = line.toUpperCase();

      if (this.ADDRESS_KEYWORD_REGEX.test(upper) && !upper.includes('PVT LTD') && !upper.includes('PRIVATE LIMITED') && !upper.includes('GROUP')) {
        continue;
      }

      // Clean leading logo noise (e.g., "A Yom NAREN GROUP...", "Logo NAREN...", "Scan for Location...")
      line = line.replace(/^(?:[A-Za-z]{1,3}\s+(?:Yom|Logo|Icon|Scan|Tag)\s+)+/i, '').trim();

      // Perform typo auto-repair on line words
      const words = line.split(/\s+/);
      const repairedWords = words.map(w => {
        const cleanW = w.replace(/[^a-zA-Z]/g, '');
        if (cleanW.length >= 5) {
          for (const targetKw of ['LIMITED', 'PRIVATE', 'TECHNOLOGIES', 'SOLUTIONS', 'SERVICES', 'ENTERPRISES', 'INDUSTRIES', 'COMPANIES']) {
            if (Math.abs(cleanW.length - targetKw.length) <= 2) {
              const dist = this.levenshteinDistance(cleanW, targetKw);
              if (dist >= 1 && dist <= 2) {
                return w.toUpperCase() === w ? targetKw : targetKw.charAt(0) + targetKw.slice(1).toLowerCase();
              }
            }
          }
        }
        return w;
      });

      line = repairedWords.join(' ');
      const repairedUpper = line.toUpperCase();

      for (const suffix of this.COMPANY_SUFFIXES) {
        if (repairedUpper.includes(suffix)) {
          let cleaned = line.replace(/["'“”|:~]/g, '').trim();

          // Isolate company brand + suffix, trimming off any leading noise words (e.g. "US A CY Nord") and trailing words (e.g. "prey")
          const suffixIdx = cleaned.toUpperCase().indexOf(suffix);
          if (suffixIdx >= 0) {
            const endIdx = suffixIdx + suffix.length;
            cleaned = cleaned.substring(0, endIdx).trim();

            const prefixPart = cleaned.substring(0, suffixIdx).trim();
            if (prefixPart) {
              const prefixWords = prefixPart.split(/\s+/);
              const noiseWords = ['US', 'A', 'CY', 'NORD', 'ICON', 'SCAN', 'LOGO', 'TAG', 'TEL', 'MOB', 'PH', 'FAX', 'PREY', 'HTTP', 'WWW', 'LO', 'LW', 'ADD', 'OFFICE', 'SITE', 'LOCATION'];
              let validStart = prefixWords.length - 1;
              while (validStart > 0 && !noiseWords.includes(prefixWords[validStart - 1].toUpperCase()) && prefixWords[validStart - 1].length > 1) {
                validStart--;
              }
              const cleanPrefixWords = prefixWords.slice(validStart).filter(w => !noiseWords.includes(w.toUpperCase()));
              cleaned = (cleanPrefixWords.join(' ') + ' ' + suffix).trim();
            }
          }

          // Strip leading phone digits, numbers, or noise symbols before company name (e.g. "01 923516 63 SRIDHARSHINI ENTERPRISES")
          cleaned = cleaned.replace(/^(?:\+?\d[\d\s.-]{2,15}|\d{2,10}\s+)+/g, '').trim();
          cleaned = cleaned.replace(/^[\d\s._\-|/:\\]+/, '').trim();

          // Strip leading designation text if prepended to company line
          const desKeywords = [
            'BUSINESS DEVELOPMENT HEAD', 'BUSINESS DEVELOPMENT MANAGER', 'BUSINESS DEVELOPMENT EXECUTIVE',
            'CHIEF EXECUTIVE OFFICER', 'MANAGING DIRECTOR', 'EXECUTIVE DIRECTOR', 'TECHNICAL DIRECTOR',
            'SALES MANAGER', 'PURCHASE MANAGER', 'MARKETING MANAGER', 'OPERATIONS MANAGER', 'PROJECT MANAGER',
            'PRODUCT MANAGER', 'REGIONAL MANAGER', 'ACCOUNT MANAGER', 'RELATIONSHIP MANAGER', 'GENERAL MANAGER',
            'SENIOR MANAGER', 'HEAD OF SALES', 'HEAD OF MARKETING', 'HEAD OF OPERATIONS', 'HEAD OF BUSINESS DEVELOPMENT',
            'HEAD OF ENGINEERING', 'HEAD OF PURCHASE', 'SALES EXECUTIVE', 'MARKETING EXECUTIVE', 'PURCHASE OFFICER',
            'LEAD ENGINEER', 'SENIOR ENGINEER', 'SOFTWARE ENGINEER', 'DIRECTOR', 'MANAGER', 'PRESIDENT', 'FOUNDER',
            'PROPRIETOR', 'OWNER', 'PARTNER', 'ENGINEER', 'CONSULTANT', 'ADVISOR', 'ARCHITECT', 'SPECIALIST',
            'EXECUTIVE', 'HEAD', 'CHIEF', 'OFFICER', 'LEAD', 'VP', 'GM', 'MD', 'CEO', 'CTO', 'COO', 'CFO', 'CDO'
          ];

          if (alreadyExtracted.designation) {
            const desUpper = alreadyExtracted.designation.toUpperCase();
            const idx = cleaned.toUpperCase().indexOf(desUpper);
            if (idx === 0) {
              cleaned = cleaned.substring(desUpper.length).trim();
            }
          }

          for (const desKw of desKeywords) {
            const idx = cleaned.toUpperCase().indexOf(desKw);
            if (idx === 0) {
              cleaned = cleaned.substring(desKw.length).trim();
            }
          }

          // Strip single/double leading noise letters (e.g., "J ", "A ") right before brand name
          cleaned = cleaned.replace(/^[A-Za-z]{1,2}\s+/, '').trim();

          // Clean address tail if present on same line
          for (const addrKw of ['COIMBATORE', 'MUMBAI', 'DELHI', 'BANGALORE', 'CHENNAI', 'HYDERABAD', 'PUNE', 'PIN', 'ZIP']) {
            const idx = cleaned.toUpperCase().indexOf(addrKw);
            if (idx > 0) {
              cleaned = cleaned.substring(0, idx).trim();
            }
          }
          // Clean trailing logo noise words like "TR" or "TM" from right side of logo
          cleaned = cleaned.replace(/\s+(?:TR|TM|R|C|A|AN|THE|EMPOWERING|TRUST|LOCATION)$/i, '').trim();
          cleaned = cleaned.replace(/[-–—|:\s]+$/, '').trim();

          // Multi-Line Link: Check if line[i-1] contains the Brand Name
          if (i > 0) {
            const prevLine = lines[i - 1].trim();
            const prevUpper = prevLine.toUpperCase();
            const isPrevDesig = desKeywords.some(k => prevUpper.includes(k)) || 
              (alreadyExtracted.designation && prevUpper.includes(alreadyExtracted.designation.toUpperCase())) ||
              (alreadyExtracted.name && prevUpper.includes(alreadyExtracted.name.toUpperCase()));
            const hasDigits = /\d/.test(prevLine);

            if (
              prevLine.length >= 2 && prevLine.length <= 25 &&
              !isPrevDesig &&
              !hasDigits &&
              !this.ADDRESS_KEYWORD_REGEX.test(prevUpper) &&
              !prevUpper.includes('@') && !prevUpper.includes('WWW')
            ) {
              if (!cleaned.toUpperCase().startsWith(prevUpper)) {
                cleaned = prevLine + ' ' + cleaned;
              }
            }
          }

          if (cleaned.length >= 3) {
            return cleaned;
          }
        }
      }
    }

    // 2. Domain-based brand name line matching (e.g. email "sivabalan.b@homefirstindia.com" or web "www.homefirst.com")
    const domainSource = website || email;
    let domainStem = '';
    if (domainSource) {
      const domainMatch = domainSource.match(/(?:www\.|@)([a-zA-Z0-9-]+)\./);
      if (domainMatch && domainMatch[1]) {
        domainStem = domainMatch[1].toLowerCase().replace(/(?:india|tech|pvt|ltd|group|inc)$/i, '');
      }
    }

    if (domainStem && domainStem.length >= 4) {
      for (const line of lines) {
        const lineClean = line.replace(/[^a-zA-Z0-9\s]/g, '').trim();
        const lineUpper = lineClean.toUpperCase();
        if (lineClean.length >= 3 && lineClean.length <= 35 && !lineClean.includes('@') && !lineClean.includes('www.')) {
          if (lineUpper.replace(/\s+/g, '').toLowerCase().includes(domainStem)) {
            return lineClean;
          }
        }
      }
    }

    // 3. Standalone company brand name match
    for (const line of lines) {
      const upper = line.toUpperCase();
      if (/^[a-zA-Z0-9\s.&'-]+$/.test(line) && line.length >= 3 && line.length <= 30) {
        if (['ARIYAI', 'AURORA', 'TECH', 'SOLUTIONS', 'GLOBAL', 'HOMEFIRST', 'NAREN'].some(brand => upper.includes(brand))) {
          return line.trim();
        }
      }
    }

    // 4. Font Size Heuristic Fallback
    if (lineMetadata && lineMetadata.length > 0) {
      const fontCompany = this.extractCompanyByFontSize(lineMetadata, { email, website, ...alreadyExtracted });
      if (fontCompany) {
        return fontCompany;
      }
    }

    // 5. Fallback: Domain stem from Email or Website
    if (domainSource) {
      const domainMatch = domainSource.match(/(?:www\.|@)([a-zA-Z0-9-]+)\./);
      if (domainMatch && domainMatch[1]) {
        const rawStem = domainMatch[1];
        if (!['gmail', 'yahoo', 'hotmail', 'outlook', 'icloud', 'rediffmail'].includes(rawStem.toLowerCase())) {
          return rawStem.charAt(0).toUpperCase() + rawStem.slice(1);
        }
      }
    }

    return undefined;
  }

  /**
   * Identifies company name by analyzing OCR bounding box font heights.
   * Business card company logos & brand titles are almost always the largest/boldest text on the card.
   */
  private extractCompanyByFontSize(
    lineMetadata: OcrLineMetadata[],
    context: { email?: string; website?: string; name?: string; designation?: string }
  ): string | undefined {
    const phoneDigitRegex = /(?:\+?91[\s.-]?)?[6-9]\d{4}[\s.-]?\d{5}|\b\d{8,12}\b|\[PH\]|☎|📱|📞|tel|mob|phone|fax/i;
    const commonNoiseWords = ['HOW', 'THE', 'AND', 'FOR', 'WITH', 'FROM', 'YOUR', 'OUR', 'WE', 'YOU', 'THIS', 'THAT', 'NOTE', 'TAG', 'LOGO', 'SCAN', 'CARD'];
    const candidates: { line: string; score: number }[] = [];

    for (const meta of lineMetadata) {
      let line = meta.text.trim();
      const upper = line.toUpperCase();

      if (line.length < 3 || line.length > 45) continue;

      const words = line.split(/\s+/).filter(w => w.length > 0);
      const singleCharWords = words.filter(w => w.length === 1).length;

      // Filter out non-company lines and noisy OCR garbage (e.g. "rr i i i i i oh RR aon 9", "----", "How")
      if (
        commonNoiseWords.includes(upper) ||
        (words.length >= 3 && singleCharWords / words.length > 0.35) ||
        (line.match(/(.)\1{3,}/g) !== null) ||
        line.includes('@') ||
        line.includes('www.') ||
        line.includes('http') ||
        phoneDigitRegex.test(line) ||
        this.ADDRESS_KEYWORD_REGEX.test(upper) ||
        this.ADDRESS_CITIES_REGEX.test(upper) ||
        (context.designation && upper.includes(context.designation.toUpperCase())) ||
        (context.name && upper.includes(context.name.toUpperCase())) ||
        upper.includes('EMPOWERING QUALITY') || upper.includes('QUALITY FIRST') || upper.includes('SCAN FOR')
      ) {
        continue;
      }

      // Base score is line bounding box font height in pixels
      let score = meta.fontSize || 0;

      // Bonus for matching company suffixes (e.g. GROUP, LIMITED, PVT LTD)
      if (this.COMPANY_SUFFIXES.some(s => upper.includes(s))) {
        score += 35;
      }

      // Bonus for domain stem match
      const domainSource = context.website || context.email;
      if (domainSource) {
        const domainMatch = domainSource.match(/(?:www\.|@)([a-zA-Z0-9-]+)\./);
        if (domainMatch && domainMatch[1]) {
          const stem = domainMatch[1].toLowerCase().replace(/(?:india|tech|pvt|ltd|group|inc)$/i, '');
          if (stem.length >= 4 && upper.replace(/\s+/g, '').toLowerCase().includes(stem)) {
            score += 45;
          }
        }
      }

      if (score > 15) {
        candidates.push({ line, score });
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      return candidates[0].line;
    }

    return undefined;
  }

  private extractName(
    lines: string[],
    alreadyExtracted: { email?: string; phone?: string; website?: string; designation?: string; company?: string }
  ): string | undefined {
    const namePrefixes = ['MR.', 'MR', 'MS.', 'MS', 'MRS.', 'MRS', 'DR.', 'DR', 'ER.', 'ER', 'PROF.', 'SHRI', 'SMT.'];
    const candidates: { text: string; score: number }[] = [];

    const designationKeywords = [
      'DIRECTOR', 'MANAGER', 'OFFICER', 'PRESIDENT', 'FOUNDER', 'PROPRIETOR',
      'OWNER', 'PARTNER', 'ENGINEER', 'CONSULTANT', 'EXECUTIVE', 'HEAD',
      'CEO', 'CTO', 'COO', 'CFO', 'CDO', 'MD', 'VP', 'GM'
    ];

    const logoNoiseRegex = /\b(?:EEE|CL|YAT|LE|CARAT|SCAN|LOCATION|EMPOWERING|QUALITY|TRUST|LOGO|ICON|TAG|TV|JU|LW|LO|AKA|FN|BS|HTS|SAAF)\b/i;

    let emailUserStem = '';
    if (alreadyExtracted.email) {
      const userPart = alreadyExtracted.email.split('@')[0].replace(/\d+/g, '').replace(/[._-]+/g, ' ').trim();
      if (userPart.length >= 3) {
        emailUserStem = userPart.toLowerCase();
      }
    }

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // Clean leading/trailing non-name symbols
      line = line.replace(/^[|:~_\-\s()\[\]{}]+|[|:~_\-\s()\[\]{}]+$/g, '').trim();

      // Auto-repair common OCR symbol misreads of 'J' at the end of names e.g. "PUSHPARA]" -> "PUSHPARAJ", "SUNDARRA)" -> "SUNDARRAJ"
      line = line.replace(/([A-Z]{2,})(?:RA|PA|MA|BA|GA|KA)[\]\)\}\>\|/\\]+/gi, '$1RAJ');
      line = line.replace(/([A-Z]{3,})[\]\)\}\>]+/gi, '$1J');
      line = line.replace(/RA[\]\)\}\>]/gi, 'RAJ');

      // Strip trailing phone numbers/prefixes appended to person names on the same line e.g. "T.R. Manikandan +91 99449 23516" -> "T.R. Manikandan"
      line = line.replace(/\s*(?:\+?91[\s.-]?)?[6-9]\d{4}[\s.-]?\d{5}.*$/i, '').trim();
      line = line.replace(/\s*(?:\+?\d{1,3}[\s.-]?)?(?:\d{3,5}[\s.-]?){2,4}.*$/i, '').trim();
      line = line.replace(/\s*(?:ph|phone|mob|mobile|cell|tel|call)[\s.:-]*\d.*$/i, '').trim();

      // Multi-Line Name Combination check: if line[i] and line[i+1] are consecutive uppercase name words
      if (i + 1 < lines.length) {
        let nextLine = lines[i + 1].trim().replace(/([A-Z]{2,})(?:RA|PA|MA|BA|GA|KA)[\]\)\}\>\|/\\]+/gi, '$1RAJ').replace(/([A-Z]{3,})[\]\)\}\>]+/gi, '$1J');
        const isNextNameWord = /^[a-zA-Z\s.'-]+$/.test(nextLine) && nextLine.length >= 2 && nextLine.length <= 30 && !designationKeywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(nextLine.toUpperCase())) && !this.COMPANY_SUFFIXES.some(k => nextLine.toUpperCase().includes(k)) && !/\d/.test(nextLine);
        const isCurrNameWord = /^[a-zA-Z\s.'-]+$/.test(line) && line.length >= 2 && line.length <= 30;

        if (isCurrNameWord && isNextNameWord) {
          const combinedName = line + ' ' + nextLine;
          let combinedScore = 30;
          if (emailUserStem && combinedName.toLowerCase().includes(emailUserStem)) {
            combinedScore += 100;
          }
          if (alreadyExtracted.designation) {
            const desUpper = alreadyExtracted.designation.toUpperCase();
            if (i + 2 < lines.length && lines[i + 2].toUpperCase().includes(desUpper)) {
              combinedScore += 80;
            }
          }
          candidates.push({ text: combinedName, score: combinedScore });
        }
      }

      // Strip leading logo noise artifacts prepended to name e.g. "a. Yat le EEE CL R. SUNDARRAJ" -> "R. SUNDARRAJ"
      line = line.replace(/^(?:[a-z]\.?(?:\s+[a-z]{1,4}|\s+Yat|\s+le|\s+EEE|\s+CL|\s+Lo|\s+LW|\s+Tv|\s+Ju|\s+Scan|\s+Carat)+\s+)+/i, '').trim();
      line = line.replace(/^(?:[a-z]\s+Yat\s+le\s+EEE\s+CL|[a-z]\.?\s+Yat|[a-z]\.?\s+le|EEE\s+CL|Lo\s+LW)\s*/i, '').trim();

      const upper = line.toUpperCase();
      if (line.length < 3) continue;

      // 1. Skip if line contains explicit logo noise words (e.g. "a. Yat le EEE CL")
      if (logoNoiseRegex.test(upper)) {
        continue;
      }

      // 2. Skip if line is equal to email, website, phone, or designation
      if (
        (alreadyExtracted.email && line.toLowerCase().includes(alreadyExtracted.email.toLowerCase())) ||
        (alreadyExtracted.website && line.toLowerCase().includes(alreadyExtracted.website.toLowerCase())) ||
        (alreadyExtracted.phone && alreadyExtracted.phone.includes(line)) ||
        (alreadyExtracted.designation && upper === alreadyExtracted.designation.toUpperCase())
      ) {
        continue;
      }

      // 3. Skip if line contains numbers, email, web URL
      if (/\d/.test(line) || line.includes('@') || line.includes('www.') || line.includes('.com') || line.includes('http')) {
        continue;
      }

      // 4. Skip if line contains address keywords
      if (this.ADDRESS_KEYWORD_REGEX.test(upper)) {
        continue;
      }

      // 5. Skip if line contains designation keywords as standalone words
      const containsDesignation = designationKeywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(upper));
      if (containsDesignation) {
        continue;
      }

      // 6. Skip if line is a company suffix or brand
      const isCompanySuffix = this.COMPANY_SUFFIXES.some(k => upper.includes(k));
      if (isCompanySuffix) {
        continue;
      }

      // 7. Validate words & filter out random garbled OCR noise
      const words = line.split(/\s+/).filter(w => w.length > 0);
      const firstWordUpper = words[0].toUpperCase();

      // Reject lines with lowercase single letters (e.g. "a Yat") or excessive short noise
      const shortNoisyWordCount = words.filter(w => w.length <= 2 && !/^[AEIOU]$/i.test(w) && !/^[A-Z]\.?$/.test(w)).length;
      if (words.length >= 3 && shortNoisyWordCount >= Math.ceil(words.length / 2)) {
        continue;
      }

      const validNameWords = words.filter(w => w.length >= 1 && !this.STOP_WORDS.includes(w.toUpperCase()));
      if (validNameWords.length === 0) continue;

      let score = 10;
      if (namePrefixes.includes(firstWordUpper) && words.length >= 2) {
        score += 40;
      }

      if (words.length >= 1 && words.length <= 5 && /^[a-zA-Z\s.'-]+$/.test(line) && line.length >= 3 && line.length <= 40) {
        if (i <= 2) score += 15; // Top 3 lines get priority
        if (line === upper || words.every(w => /^[A-Z]/.test(w))) score += 15;
        if (words.some(w => this.STOP_WORDS.includes(w.toUpperCase()))) score -= 20;

        // ONLY uppercase single-letter initials like "R." or "T.R." get +35 bonus (not lowercase "a.")
        if (words.some(w => /^[A-Z]\.?$/.test(w))) score += 35;

        // Huge bonus (+100) if line contains email username stem e.g. email "sundar1870@gmail.com" matches "R. SUNDARRAJ"
        if (emailUserStem && upper.toLowerCase().includes(emailUserStem)) {
          score += 100;
        }

        // High bonus (+70) if adjacent line (up to 2 lines above or below) matches Designation
        if (alreadyExtracted.designation) {
          const desUpper = alreadyExtracted.designation.toUpperCase();
          for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) {
            if (j !== i && lines[j].toUpperCase().includes(desUpper)) {
              score += 70;
              break;
            }
          }
        }

        if (score > 0) {
          candidates.push({ text: line, score });
        }
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      if (candidates[0].score >= 30) {
        return candidates[0].text;
      }
    }

    // Email username cross-match fallback if candidate score was low or no candidates passed
    if (emailUserStem) {
      for (const line of lines) {
        const clean = line.replace(/^[|:~_\-\s]+|[|:~_\-\s]+$/g, '').trim();
        const upper = clean.toUpperCase();
        if (clean.length >= 3 && clean.length <= 40 && upper.toLowerCase().includes(emailUserStem)) {
          if (!logoNoiseRegex.test(upper) && !/\d/.test(clean) && !clean.includes('@')) {
            return clean;
          }
        }
      }

      // Last-resort capitalized email username e.g. "sundar1870@gmail.com" -> "Sundar"
      const capitalized = emailUserStem.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      return capitalized;
    }

    return candidates.length > 0 ? candidates[0].text : undefined;
  }

  private extractAddress(
    lines: string[],
    alreadyExtracted: { email?: string; phone?: string; website?: string; designation?: string; company?: string; name?: string }
  ): string | undefined {
    const scoredLines: { line: string; score: number; index: number }[] = [];

    // Phone digits regex to filter out all mobile/landline digit lines
    const phoneDigitRegex = /(?:\+?91[\s.-]?)?\d{3,5}[\s.-]?\d{5,7}|\b\d{7,12}\b|\[PH\]|☎|📱|📞|tel|mob|phone|fax/i;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // Check if line contains [ADD] tag (from location icon or prefix)
      const hasAddTag = line.includes('[ADD]');

      // Clean [ADD] tag from beginning of line for final output
      const cleanLine = line.replace(/\[ADD\]/gi, '').trim();
      const cleanUpper = cleanLine.toUpperCase();

      if (!cleanLine) continue;

      // 1. Exclude lines containing emails, websites, or phone numbers
      if (
        cleanLine.includes('@') ||
        cleanLine.includes('www.') ||
        cleanLine.includes('http') ||
        phoneDigitRegex.test(cleanLine) ||
        (alreadyExtracted.phone && alreadyExtracted.phone.includes(cleanLine)) ||
        (alreadyExtracted.name && cleanLine === alreadyExtracted.name) ||
        (alreadyExtracted.designation && cleanLine === alreadyExtracted.designation) ||
        (alreadyExtracted.company && cleanLine.includes(alreadyExtracted.company))
      ) {
        continue;
      }

      // Exclude tagline slogans
      if (cleanUpper.includes('EMPOWERING QUALITY') || cleanUpper.includes('QUALITY FIRST') || cleanUpper.includes('SCAN FOR')) {
        continue;
      }

      let score = 0;

      // 100 points for explicit [ADD] location icon or prefix!
      if (hasAddTag) {
        score += 100;
      }

      // Indian / International 6-digit or 5-digit Pincode / Zipcode match e.g. "641 014", "641005"
      if (/\b\d{3}\s?\d{3}\b|\b\d{5,6}\b/.test(cleanLine)) {
        score += 50;
      }

      // Address word boundary keywords match e.g. Road, Street, Nagar, Post, Aerodrome, Building, Arcata
      if (this.ADDRESS_KEYWORD_REGEX.test(cleanUpper)) {
        score += 25;
      }

      // Known city names match e.g. Coimbatore, Singanallur, Trichy, Mumbai, Chennai
      if (this.ADDRESS_CITIES_REGEX.test(cleanUpper)) {
        score += 25;
      }

      // Door / Plot / Unit number patterns at start e.g. "9/10, Periar Nagar", "4B, Dhanaas Arcata"
      if (/^(?:\d+[\/\-]\d+|\d+[A-Za-z]?\b|NO\.?\s*\d+|PLOT\s*NO)/i.test(cleanLine)) {
        score += 20;
      }

      if (score >= 10) {
        scoredLines.push({ line: cleanLine, score, index: i });
      }
    }

    if (scoredLines.length === 0) {
      return undefined;
    }

    // Sort address lines by score & line index to preserve address block sequence
    scoredLines.sort((a, b) => a.index - b.index);

    // Combine contiguous address lines into a clean full address string
    const resultAddress = scoredLines.map(s => s.line).join(', ');
    return resultAddress.replace(/\s*,\s*,/g, ',').replace(/^,\s*|\s*,\s*$/g, '');
  }
}
