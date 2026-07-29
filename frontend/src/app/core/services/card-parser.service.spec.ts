import { TestBed } from '@angular/core/testing';
import { CardParserService } from './card-parser.service';

describe('CardParserService', () => {
  let service: CardParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CardParserService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should parse email, phone, designation, company, and name correctly', () => {
    const rawCardText = `
      Rajesh Kumar
      Managing Director
      Apex Tech Solutions Pvt Ltd
      Phone: +91 9876543210
      Email: rajesh.kumar@apextech.com
      Web: www.apextech.com
      Plot 42, Industrial Area, Mumbai
    `;

    const parsed = service.parseCardText(rawCardText);

    expect(parsed.email).toBe('rajesh.kumar@apextech.com');
    expect(parsed.phone).toContain('9876543210');
    expect(parsed.designation).toBe('Managing Director');
    expect(parsed.company).toBe('Apex Tech Solutions Pvt Ltd');
    expect(parsed.name).toBe('Rajesh Kumar');
    expect(parsed.website).toBe('www.apextech.com');
  });

  it('should handle cards without emails or websites gracefully', () => {
    const rawCardText = `
      Dr. Anita Sharma
      Senior Manager
      Global Exports Inc
      Tel: 022-28374650
    `;

    const parsed = service.parseCardText(rawCardText);

    expect(parsed.name).toBe('Dr. Anita Sharma');
    expect(parsed.designation).toBe('Senior Manager');
    expect(parsed.company).toBe('Global Exports Inc');
    expect(parsed.email).toBeUndefined();
  });
});
