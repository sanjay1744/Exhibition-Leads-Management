import { Injectable } from '@angular/core';
import { PREDEFINED_DESIGNATIONS } from './card-parser.service';

export interface ParsedVoiceLeadData {
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
  designation?: string;
  interestLevel?: 'Hot' | 'Warm' | 'Cold';
  remarks?: string;
}

@Injectable({ providedIn: 'root' })
export class VoiceParserService {
  private wordDigitMap: { [key: string]: string } = {
    zero: '0', oh: '0',
    one: '1', two: '2',
    three: '3', four: '4', five: '5',
    six: '6', seven: '7', eight: '8',
    nine: '9'
  };

  /**
   * Parse a spoken voice transcript string into structured Lead Form fields.
   */
  parseVoiceTranscript(transcript: string): ParsedVoiceLeadData {
    if (!transcript || !transcript.trim()) {
      return {};
    }

    const result: ParsedVoiceLeadData = {};
    const text = transcript.trim();

    // 1. Extract Phone Number
    const phone = this.extractPhone(text);
    if (phone) result.phone = phone;

    // 2. Extract Email Address
    const email = this.extractEmail(text);
    if (email) result.email = email;

    // 3. Extract Full Name
    const name = this.extractName(text);
    if (name) result.name = name;

    // 4. Extract Company Name
    const company = this.extractCompany(text, result.name);
    if (company) result.company = company;

    // 5. Extract Designation
    const designation = this.extractDesignation(text);
    if (designation) result.designation = designation;

    // 6. Extract Interest Level
    const interest = this.extractInterestLevel(text);
    if (interest) result.interestLevel = interest;

    return result;
  }

  private extractName(text: string): string | undefined {
    if (!text) return undefined;

    // 1. Strip leading greetings
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^(?:hi|hello|hey|good\s+(?:morning|afternoon|evening))\s+/gi, '');
    cleaned = cleaned.replace(/^(?:hi|hello|hey|good\s+(?:morning|afternoon|evening))\s+/gi, '');

    // 2. High-precision intro patterns: "this is Augustine", "my name is Augustine", "I am Augustine"
    const patterns = [
      /(?:my name is|name is|this is|speaking with|visitor name is|met with)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
      /(?:i am|i'm|im)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
      /([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(?:here|from|working|representing)/i,
    ];

    for (const pat of patterns) {
      const match = cleaned.match(pat);
      if (match && match[1]) {
        let candidate = match[1].trim();

        // Strip trailing stop words like "from", "at", "with", "and", "here"
        candidate = candidate.replace(/\s+(?:from|with|at|here|the|and|in|company|pvt|ltd)$/i, '').trim();

        const lower = candidate.toLowerCase();
        if (!['here', 'from', 'with', 'this', 'that', 'there', 'user', 'client', 'visitor', 'lead', 'hello', 'hi', 'hey', 'good'].includes(lower)) {
          return this.capitalizeWords(candidate);
        }
      }
    }

    return undefined;
  }

  private extractCompany(text: string, extractedName?: string): string | undefined {
    if (!text) return undefined;

    // Match "from <Company Name>" e.g. "from applied automation systems private limited"
    const pattern = /(?:from|working at|company is|representing|company|org|organization|firm|with)\s+([A-Za-z0-9&.\s]{3,45}?)(?=\s+and\s+this|\s+and\s+my|\s*,|\s*phone|\s*mobile|\s*email|\s*contact|\s*designation|\s*$)/i;
    
    const match = text.match(pattern);
    if (match && match[1]) {
      let comp = match[1].trim();

      // Clean up trailing conjunctions or stop words if appended by mistake
      comp = comp.replace(/\s+(?:and\s+this|and\s+my|and|my|phone|contact|mobile)$/i, '').trim();

      if (extractedName && comp.toLowerCase().includes(extractedName.toLowerCase())) {
        comp = comp.replace(new RegExp(extractedName, 'gi'), '').trim();
      }

      if (comp.length > 2 && !['this', 'that', 'here', 'there', 'my', 'the', 'a', 'an'].includes(comp.toLowerCase())) {
        return this.capitalizeWords(comp);
      }
    }

    return undefined;
  }

  private extractDesignation(text: string): string | undefined {
    if (!text) return undefined;
    const lowerText = text.toLowerCase();

    // Check predefined designations list first
    for (const desig of PREDEFINED_DESIGNATIONS) {
      if (lowerText.includes(desig.toLowerCase())) {
        return desig;
      }
    }

    // Common short designations
    const shortDesigs = ['CEO', 'CTO', 'COO', 'CFO', 'VP', 'MD', 'GM', 'PM'];
    for (const sd of shortDesigs) {
      const regex = new RegExp(`\\b${sd}\\b`, 'i');
      if (regex.test(text)) {
        return sd;
      }
    }

    // Natural speech patterns: "working as CEO", "designation is Manager"
    const match = text.match(/(?:designation is|working as|role is|position is|i am a|i am an)\s+([a-z\s]{3,20})/i);
    if (match && match[1]) {
      return this.capitalizeWords(match[1].trim());
    }

    return undefined;
  }

  private extractPhone(text: string): string | undefined {
    if (!text) return undefined;

    // 1. Look explicitly after keywords: "contact number", "mobile number", "phone number", "my number is", "contact", "call"
    const keywordMatch = text.match(/(?:contact\s*number|mobile\s*number|phone\s*number|my\s*number|contact|mobile|phone|call)\D*([\d\s.-]{7,16})/i);
    if (keywordMatch && keywordMatch[1]) {
      const digits = keywordMatch[1].replace(/\D/g, '');
      if (digits.length >= 7 && digits.length <= 13) {
        return digits.length >= 10 ? digits.slice(-10) : digits;
      }
    }

    // 2. Process word numbers e.g. "nine eight seven six five four three two one zero" or "double nine"
    let processed = text.toLowerCase().replace(/double\s+([a-z0-9]+)/gi, (m, p1) => {
      const d = this.wordDigitMap[p1] || p1;
      return d + d;
    });

    for (const [w, d] of Object.entries(this.wordDigitMap)) {
      processed = processed.replace(new RegExp(`\\b${w}\\b`, 'gi'), d);
    }

    // 3. Search for any sequence of 9 to 13 digits (even if separated by spaces like 35195 8023 or 98765 43210)
    const digitSequences = processed.match(/(?:\+?91[\s.-]?)?(?:\d[\s.-]?){8,14}/g);
    if (digitSequences) {
      for (const seq of digitSequences) {
        const cleanDigits = seq.replace(/\D/g, '');
        if (cleanDigits.length >= 8 && cleanDigits.length <= 13) {
          return cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;
        }
      }
    }

    // 4. Fallback: all digits in text if 8-13 total digits exist
    const allDigits = processed.replace(/\D/g, '');
    if (allDigits.length >= 8 && allDigits.length <= 13) {
      return allDigits.length >= 10 ? allDigits.slice(-10) : allDigits;
    }

    return undefined;
  }

  private extractEmail(text: string): string | undefined {
    if (!text) return undefined;

    // Standard email regex
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      return emailMatch[0].toLowerCase();
    }

    // Spoken email format: "sanjay at techcorp dot com"
    const spokenEmailMatch = text.match(/([a-zA-Z0-9._]+)\s+at\s+([a-zA-Z0-9.-]+)\s+dot\s+(com|in|org|net|co|io)/i);
    if (spokenEmailMatch) {
      const prefix = spokenEmailMatch[1].trim();
      const domain = spokenEmailMatch[2].trim();
      const tld = spokenEmailMatch[3].trim();
      return `${prefix}@${domain}.${tld}`.toLowerCase();
    }

    return undefined;
  }

  private extractInterestLevel(text: string): 'Hot' | 'Warm' | 'Cold' | undefined {
    if (!text) return undefined;
    const lower = text.toLowerCase();

    if (lower.includes('hot') || lower.includes('urgent') || lower.includes('high budget') || lower.includes('immediately') || lower.includes('ready to buy')) {
      return 'Hot';
    }
    if (lower.includes('cold') || lower.includes('not interested') || lower.includes('no requirement')) {
      return 'Cold';
    }
    if (lower.includes('warm') || lower.includes('interested') || lower.includes('send proposal') || lower.includes('quotation')) {
      return 'Warm';
    }
    return undefined;
  }

  private capitalizeWords(str: string): string {
    return str
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
}
