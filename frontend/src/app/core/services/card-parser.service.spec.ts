import { TestBed } from '@angular/core/testing';
import { CardParserService } from './card-parser.service';

describe('CardParserService', () => {
  let service: CardParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CardParserService);
  });

  it('should parse Maria Olivia card accurately including domain company fallback', () => {
    const rawCardText = `
      MARIA OLIVIA
      Manager
      +011 123 456 789
      maria.olivia@aurora.com
      www.aurora.com
    `;

    const parsed = service.parseCardText(rawCardText);

    expect(parsed.name).toBe('MARIA OLIVIA');
    expect(parsed.designation).toBe('Manager');
    expect(parsed.email).toBe('maria.olivia@aurora.com');
    expect(parsed.phone).toBe('+011 123 456 789');
    expect(parsed.website).toBe('www.aurora.com');
    expect(parsed.company).toBe('Aurora');
  });

  it('should parse Pushparaj Subramaniam card accurately without address leaking into company', () => {
    const rawCardText = `
      AriyAI
      Tech Private Limited
      PUSHPARAJ SUBRAMANIAM
      Chief Development Officer
      9/10-B, First Floor, Pariyar Nagar,
      Coimbatore - 641014
      +91 93444 21012
      pushparaj.s@ariyitech.com
      https://ariyitech.com/
    `;

    const parsed = service.parseCardText(rawCardText);

    expect(parsed.name).toBe('PUSHPARAJ SUBRAMANIAM');
    expect(parsed.designation).toBe('Chief Development Officer');
    expect(parsed.company).toBe('AriyAI Tech Private Limited');
    expect(parsed.email).toBe('pushparaj.s@ariyitech.com');
    expect(parsed.phone).toBe('+91 93444 21012');
    expect(parsed.website).toBe('https://ariyitech.com/');
    expect(parsed.address).toContain('Coimbatore');
  });

  it('should parse Business Development Head card (T.R. Manikandan / SRIDHARSHINI ENTERPRISE) accurately', () => {
    const rawCardText = `
      T.R. Manikandan
      Business Development Head
      SRIDHARSHINI ENTERPRISE
      +91 99449 23516
      sdemarketing@dkbelt.com
      www.dkbelt.com
      # 123/10E, Kasthuri Building, Dr. Nanjappa Road
      Coimbatore - 641018 Tamil Nadu. INDIA
    `;

    const parsed = service.parseCardText(rawCardText);

    expect(parsed.name).toBe('T.R. Manikandan');
    expect(parsed.designation).toBe('Business Development Head');
    expect(parsed.company).toBe('SRIDHARSHINI ENTERPRISE');
    expect(parsed.phone).toContain('99449 23516');
    expect(parsed.email).toBe('sdemarketing@dkbelt.com');
    expect(parsed.website).toBe('www.dkbelt.com');
  });

  it('should pattern match dynamic Head of and fuzzy designation OCR typos', () => {
    const parsed1 = service.parseCardText('John Doe\nHead of Operations\nAcme Corp\n+91 9876543210');
    expect(parsed1.designation).toBe('Head of Operations');

    const parsed2 = service.parseCardText('Jane Smith\nBusness Develpment Manager\nTech Solutions\n+91 9876543210');
    expect(parsed2.designation).toBe('Business Development Manager');
  });

  it('should clean trailing OCR noise from designation and correctly parse R. SUNDARRAJ / Managing Director / NAREN GROUP OF COMPANIES', () => {
    const rawCardText = `
      Lo LW
      R. SUNDARRAJ
      Managing Director carat Ju Tv 260 TO
      98422 16086
      +91 422 2967078 / 2967127
      +91 9965516076 / 98429 91141
      sundar1870@gmail.com
      NAREN GROUP OF COMPANIES
      9/10, Periar Nagar, Nehru Nagar East, Civil Aerodrome Post, Coimbatore - 641 014.
      www.narengroup.in
    `;

    const parsed = service.parseCardText(rawCardText);

    expect(parsed.name).toBe('R. SUNDARRAJ');
    expect(parsed.designation).toBe('Managing Director');
    expect(parsed.company).toBe('NAREN GROUP OF COMPANIES');
    expect(parsed.email).toBe('sundar1870@gmail.com');
    expect(parsed.website).toBe('www.narengroup.in');
  });

  it('should parse salutations and format initials cleanly without relying on email username', () => {
    const rawCardText = `
      Dr. Rajesh V. Sharma
      Chief Executive Officer
      AriyAI Solutions
      rajesh.s@ariyai.com
      +91 9876543210
    `;
    const parsed1 = service.parseCardText(rawCardText);
    expect(parsed1.name).toBe('Dr. Rajesh V. Sharma');
    expect(parsed1.designation).toBe('Chief Executive Officer');

    const rawCardText2 = `
      T R Manikandan
      Business Development Head
      Sridharshini Enterprise
      +91 99449 23516
    `;
    const parsed2 = service.parseCardText(rawCardText2);
    expect(parsed2.name).toBe('T.R. Manikandan');
  });

  it('should reject logo noise lines like "a. Yat le EEE CL" and correctly extract "R. SUNDARRAJ"', () => {
    const rawCardText = `
      a. Yat le EEE CL
      naren EMPOWERING QUALITY AND TRUST
      R. SUNDARRAJ
      Managing Director
      98422 16086
      +91 422 2967078 / 2967127
      +91 9965516076 / 98429 91141
      sundar1870@gmail.com
      NAREN GROUP OF COMPANIES
      9/10, Periar Nagar, Nehru Nagar East, Civil Aerodrome Post, Coimbatore - 641 014.
      www.narengroup.in
    `;

    const parsed = service.parseCardText(rawCardText);

    expect(parsed.name).toBe('R. SUNDARRAJ');
    expect(parsed.designation).toBe('Managing Director');
    expect(parsed.company).toBe('NAREN GROUP OF COMPANIES');
    expect(parsed.email).toBe('sundar1870@gmail.com');
  });

  it('should clean "R. SUNDARRA naren" to "R. SUNDARRAJ" and "US A CY Nord NAREN GROUP OF COMPANIES prey" to "NAREN GROUP OF COMPANIES"', () => {
    const rawCardText = `
      R. SUNDARRA naren
      Managing Director
      98422 16086
      +91 422 2967078 / 2967127
      +91 9965516076 / 98429 91141
      sundar1870@gmail.com
      US A CY Nord NAREN GROUP OF COMPANIES prey
      9/10, Periar Nagar, Coimbatore - 641 014.
      www.narengroup.in
    `;

    const parsed = service.parseCardText(rawCardText);

    expect(parsed.name).toBe('R. SUNDARRAJ');
    expect(parsed.designation).toBe('Managing Director');
    expect(parsed.company).toBe('NAREN GROUP OF COMPANIES');
    expect(parsed.email).toBe('sundar1870@gmail.com');
  });

  it('should auto-repair J symbol misreads (PUSHPARA] / R. SUNDARRA)) and join multi-line names', () => {
    const rawCardText1 = `
      AriyAI
      Tech Private Limited
      PUSHPARA]
      SUBRAMANIAM
      Chief Development Officer
      +91 93444 21012
      pushparaj.s@ariyitech.com
      https://ariyitech.com/
    `;
    const parsed1 = service.parseCardText(rawCardText1);
    expect(parsed1.name).toBe('PUSHPARAJ SUBRAMANIAM');
    expect(parsed1.designation).toBe('Chief Development Officer');

    const rawCardText2 = `
      R. SUNDARRA)
      Managing Director
      sundar1870@gmail.com
      NAREN GROUP OF COMPANIES
    `;
    const parsed2 = service.parseCardText(rawCardText2);
    expect(parsed2.name).toBe('R. SUNDARRAJ');
  });

  it('should completely strip icon symbols, [?] tags, single-letter OCR icon misreads, and field label prefixes from all fields', () => {
    const rawCardText = `
      (👤) e R. SUNDARRAJ
      (💼) e Managing Director
      (🏢) e NAREN GROUP OF COMPANIES
      📍 [?] o 9/10, Periar Nagar, Coimbatore - 641 014.
      📞 [PH] c +91 98422 16086
      ✉ [EMAIL] e sundar1870@gmail.com
      🌐 [WEB] w www.narengroup.in
    `;

    const parsed = service.parseCardText(rawCardText);

    expect(parsed.name).toBe('R. SUNDARRAJ');
    expect(parsed.designation).toBe('Managing Director');
    expect(parsed.company).toBe('NAREN GROUP OF COMPANIES');
    expect(parsed.address).toBe('9/10, Periar Nagar, Coimbatore - 641 014.');
    expect(parsed.phone).toBe('+91 98422 16086');
    expect(parsed.email).toBe('sundar1870@gmail.com');
    expect(parsed.website).toBe('www.narengroup.in');
  });

  it('should strip field label prefixes like Address:, Mob:, Email:, Web:, Name: without leaving prefixes in values', () => {
    const rawCardText = `
      Name: T.R. Manikandan
      Designation: Business Development Head
      Company: SRIDHARSHINI ENTERPRISE
      Mob: +91 99449 23516
      Email: sdemarketing@dkbelt.com
      Web: www.dkbelt.com
      Address: # 123/10E, Dr. Nanjappa Road, Coimbatore - 641018
    `;

    const parsed = service.parseCardText(rawCardText);

    expect(parsed.name).toBe('T.R. Manikandan');
    expect(parsed.designation).toBe('Business Development Head');
    expect(parsed.company).toBe('SRIDHARSHINI ENTERPRISE');
    expect(parsed.phone).toBe('+91 99449 23516');
    expect(parsed.email).toBe('sdemarketing@dkbelt.com');
    expect(parsed.website).toBe('www.dkbelt.com');
    expect(parsed.address).toBe('# 123/10E, Dr. Nanjappa Road, Coimbatore - 641018');
  });

  it('should strip inline SVG tags, path elements, and SVG icon attributes from raw text and extracted fields', () => {
    const rawCardText = `
      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10"/></svg> R. SUNDARRAJ
      <path fill="#000"/> Managing Director
      <g class="icon-building"> NAREN GROUP OF COMPANIES </g>
      <circle/> 9/10, Periar Nagar, Coimbatore - 641 014.
      bi-telephone +91 98422 16086
      fa-envelope sundar1870@gmail.com
      icon-web www.narengroup.in
    `;

    const parsed = service.parseCardText(rawCardText);

    expect(parsed.name).toBe('R. SUNDARRAJ');
    expect(parsed.designation).toBe('Managing Director');
    expect(parsed.company).toBe('NAREN GROUP OF COMPANIES');
    expect(parsed.address).toBe('9/10, Periar Nagar, Coimbatore - 641 014.');
    expect(parsed.phone).toBe('+91 98422 16086');
    expect(parsed.email).toBe('sundar1870@gmail.com');
    expect(parsed.website).toBe('www.narengroup.in');
  });

  it('should repair G4 :, =K 52 :, [0 :4919965516076, - 451, leading quotes, and country code 491 misreads', () => {
    const rawCardText1 = `
      R. SUNDARRAJ
      Managing Director
      98422 16086
      * +91 422 2967078 / 2967127
      [0 :4919965516076 / 98429 91141
      G4 :sundar1870@gmail.com
      NAREN GROUP OF COMPANIES
      9/10, Periar Nagar, Nehru Nagar East, Civil Aerodrome Post, Coimbatore - 641 014.
      www.narengroup.in
    `;

    const parsed1 = service.parseCardText(rawCardText1);

    expect(parsed1.name).toBe('R. SUNDARRAJ');
    expect(parsed1.designation).toBe('Managing Director');
    expect(parsed1.company).toBe('NAREN GROUP OF COMPANIES');
    expect(parsed1.phone).toContain('99655 16076');
    expect(parsed1.email).toBe('sundar1870@gmail.com');
    expect(parsed1.website).toBe('www.narengroup.in');

    const rawCardText2 = `
      " R.SUNDARRAJ
      " Managing Director
      98422 16086
      - 451 422 2967078 / 2067127
      [ 0 :4919965516076 / 9842991141
      =K 52 :sundar1870@gmail. com Co
      'NAREN GROUP OF COMPANIES
      0 9/10, Periar Nagar, Coimbatore - 641 014.
      0 www. narengroup. in
    `;

    const parsed2 = service.parseCardText(rawCardText2);

    expect(parsed2.name).toBe('R. SUNDARRAJ');
    expect(parsed2.designation).toBe('Managing Director');
    expect(parsed2.company).toBe('NAREN GROUP OF COMPANIES');
    expect(parsed2.phone).toContain('99655 16076');
    expect(parsed2.email).toBe('sundar1870@gmail.com');
    expect(parsed2.website).toBe('www.narengroup.in');
    expect(parsed2.address).toContain('Coimbatore');
  });

  it('should split same-line multi-column fields like "T.R. Manikandan +91 99449 23516" into separate line segments', () => {
    const rawCardText = `
      T.R. Manikandan +91 99449 23516
      Business Development Head
      SRIDHARSHINI ENTERPRISE sdemarketing@dkbelt.com
      www.dkbelt.com
    `;

    const parsed = service.parseCardText(rawCardText);

    expect(parsed.name).toBe('T.R. Manikandan');
    expect(parsed.phone).toBe('+91 99449 23516');
    expect(parsed.designation).toBe('Business Development Head');
    expect(parsed.company).toBe('SRIDHARSHINI ENTERPRISE');
    expect(parsed.email).toBe('sdemarketing@dkbelt.com');
  });

  it('should correctly select T.R. Manikandan as name when phone is on same line and raw text contains I P : phone labels', () => {
    const rawCardText = `
      T.R. Manikandan +91 99449 23516
      Business Development Head
      t (3 SRIDHARSHINI ENTERPRISE
      BE P : +91 4224392980 / +91 98430 23516
      I P :
      WE : sdemarketing@dkbelt.com
      BW: www.dkbelt.com
      I # 123/10E, Kasthuri Building, Dr. Nanjappa Road
      Coimbatore - 641018 Tamil Nadu. INDIA
    `;

    const parsed = service.parseCardText(rawCardText);

    expect(parsed.name).toBe('T.R. Manikandan');
    expect(parsed.designation).toBe('Business Development Head');
    expect(parsed.company).toBe('SRIDHARSHINI ENTERPRISE');
    expect(parsed.email).toBe('sdemarketing@dkbelt.com');
    expect(parsed.website).toBe('www.dkbelt.com');
    expect(parsed.phone).toContain('99449 23516');
  });

  it('should extract exactly 2 unique phone numbers without duplicates for Sivabalan B card', () => {
    const rawCardText = `
      homefirst
      We'll take you home
      Sivabalan B
      Relationship Manager
      +91 8903613984 / 9952293135
      sivabalan.b@homefirstindia.com
      4B, Dhanaas Arcata, Trichy Road, Singanallur, Coimbatore-641005
    `;

    const parsed = service.parseCardText(rawCardText);

    expect(parsed.name).toBe('Sivabalan B');
    expect(parsed.designation).toBe('Relationship Manager');
    expect(parsed.email).toBe('sivabalan.b@homefirstindia.com');
    expect(parsed.phone).toBe('+91 89036 13984, +91 99522 93135');
    expect(parsed.phone?.split(',').length).toBe(2);
  });
});
