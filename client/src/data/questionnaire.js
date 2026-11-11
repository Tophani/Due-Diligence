// Questionnaire definition: Organizational Due Diligence Form (template v2.0, as designed).
// Copied verbatim from the script block of design/VendorWorkspace.dc.html.
// Item type codes: t short text · l long text · n number · d date · s select (country)
//                  c checkboxes · y Yes/No · r repeating table · f file upload

/** The 12 section names; section n is SECS[n - 1]. Section 12 is the derived checklist. */
export const SECS = ['General Organizational Information', 'Legal and Compliance', 'Financial Health', 'Procurement and Vendor Management', 'Organizational Capacity and Capability', 'Donor Agreements and Programme Implementation', 'Quality Assurance and Risk Management', 'Ethical Standards and Policies', 'Corporate Governance', 'Stakeholder Engagement, CSR and Sustainability', 'References and Past Performance', 'Documentation Checklist'];

/** Subsection names keyed by subsection ref (e.g. "2.4"). */
export const SUBS = {"1.0":"General Information","1.1":"Registration Details","1.2":"Authorized Representatives","2.1":"Legal Status of the Organization","2.2":"Constitutional Documents","2.3":"Compliance with Local Laws and Regulations","2.4":"Statutory Remittances and Permits","2.5":"Anti-Corruption Policies","2.6":"Fraud Prevention, Conflict of Interest and Related Parties","2.7":"Beneficial Ownership, Screening and Data Protection","2.8":"Litigation Status","3.1":"Financial Statements","3.2":"Solvency, Bank and Credit References","3.3":"Financial Records and Accounting","3.4":"Banking Details","3.5":"Bank Accounts and Reconciliations","3.6":"Financial Management Policies and Internal Controls","3.7":"Payroll and Staff Costs","3.8":"Cash and Staff Advances","3.9":"Income, Receivables and Liabilities","3.10":"Donor Fund Management","4.1":"Procurement Policies","4.2":"Vendor Records","4.3":"Contract Awards","5.1":"Company Structure","5.2":"Staff and Management Information","5.3":"Recruitment and Training","5.4":"Key Project Personnel","5.5":"Technical Expertise","5.6":"Strategy, Processes and Assets","5.7":"Equipment, Stock and Insurance","5.8":"Health, Safety, and Environmental (HSE) Policies","5.9":"Workplace Standards","6.1":"Donor/Partnership Agreements","6.2":"Programmes Executed","6.3":"Monitoring, Evaluation and Beneficiary Records","6.4":"Subcontractor and Sub-grantee Oversight","7.1":"Quality Management Systems","7.2":"Risk Management Plan","7.3":"Risk Reporting and Oversight","7.4":"Audit Follow-up and Assurance","7.5":"Security Protocols","7.6":"Information Technology and Records","8.1":"Ethical Conduct","8.2":"Other Ethics Policies and Reporting","8.3":"Safeguarding Policies","8.4":"Diversity and Inclusion","9.1":"Board of Directors","9.2":"Board and Management Committees","9.3":"Directors' Remuneration","9.4":"Board Evaluation, Training and Succession","9.5":"Shareholders and Annual General Meeting","10.1":"Stakeholder Engagement and Sustainability","11.1":"Client References","11.2":"Experience in Similar Projects"};

/** All 159 items, one per line: ref | title | help | type. */
export const RAW = `1.0.1|Official Organization Name|State the official registered name of your organization.|t
1.0.2|Acronym|State your organization's acronym (if any).|t
1.0.3|Organization Address|State your organization's address.|l
1.0.4|Organization Contact Information|Provide your organization's phone number, email address and website.|t
1.0.5|Organization Type|Select all that apply. If Other, please explain.|c
1.1.1|Business Registration Number|State your business registration number.|t
1.1.2|Incorporation Date|State your date of incorporation.|d
1.1.3|Country of Registration|State your country of registration.|s
1.2.1|Authorized Representatives' Contact Information|Provide the names, titles and email addresses of your authorized representatives.|r
1.2.2|Organizational Background, Nature of Business/Services Provided|Provide a brief description of the organization, including its geography, formation and operations.|l
1.2.3|Previous experience in international development projects|Do you have any previous experience in implementing International Development Projects?|y
1.2.4|Relationships with NGOs and donors|List any existing and/or previous relationships you have had with NGOs and donors.|l
2.1.1|Copy of the Certificate of Incorporation|Attach a copy of your Certificate of Incorporation.|f
2.1.2|Evidence of Tax Identification Number (TIN)|Attach evidence of your TIN.|f
2.1.3|Current Tax Clearance Certificate|Attach your current Tax Clearance Certificate.|f
2.2.1|Memorandum and Articles of Association (or Constitution)|Attach your Memorandum and Articles of Association or equivalent constitutional documents.|f
2.3.1|Corporate Affairs Commission (CAC) registration (for Nigeria)|Attach your CAC registration.|f
2.3.2|Compliance with Nigerian labour and tax laws|Describe the mechanisms in place for compliance with labour and tax obligations under Nigerian tax laws.|l
2.4.1|Tax remittances|Attach evidence of filing and remittance of all taxes during the review period, including PAYE.|f
2.4.2|Pension remittances|Attach evidence of monthly pension remittances for all staff and a current PenCom Compliance Certificate.|f
2.4.3|Other statutory certificates|Attach current compliance certificates from NSITF, ITF and other statutory bodies.|f
2.4.4|Business permits and licences|Attach business permits, operating licences and vehicle and equipment (tractor) registration.|f
2.4.5|Tax audits and disputes|Give details of any tax audits, assessments or disputes with tax authorities during the last five years.|l
2.5.1|Adherence to local and international anti-corruption laws (e.g. FCPA, UK Bribery Act)|Attach your organization’s anti-corruption policies and/or guidelines.|f
2.5.2|Code of Conduct and Anti-Bribery Policy|Attach your organization’s code of conduct and anti-bribery policies and/or guidelines.|f
2.6.1|Fraud Prevention and Detection Policy|Attach your organization's Fraud Prevention and Detection Policy.|f
2.6.2|Conflict of Interest Policy|Attach your organization's Conflict of Interest Policy.|f
2.6.3|Related Party Transactions Policy|Attach your organization's Related Party Transactions Policy.|f
2.6.4|Schedule of related party transactions|Attach a schedule of all related party transactions entered during the review period.|f
2.6.5|Insider Trading / Confidential information policy|Attach your Insider Trading Policy (or policy on the use of confidential information).|f
2.7.1|Beneficial ownership|Attach your register of Persons with Significant Control (PSC) as filed with the CAC.|f
2.7.2|Anti-money laundering and counter-terrorism financing|Attach your Anti-Money Laundering and Counter-Terrorism Financing Policy.|f
2.7.3|Sanctions and debarment screening|Attach your procedure for screening staff, vendors and partners against sanctions and debarment lists.|f
2.7.4|Data protection and privacy|Attach your Data Protection/Privacy Policy, showing how staff, farmer and beneficiary data is protected.|f
2.8.1|Litigation status|Do you have any pending, current, or past legal issues, proceedings or disputes within the last five years?|y
3.1.1|Audited financial statements|Has your organization been audited in the past 2 years?|y
3.1.2|Audited financial statements (past 3 years)|Attach your organization’s audited financial statements for the past 3 years.|f
3.2.1|Certificate/declaration of solvency|Attach a certificate or signed declaration of solvency for your organization.|f
3.2.2|Bank reference letter|Attach a recent reference letter from your bank confirming the account details provided.|f
3.2.3|Credit references|Attach credit references from your bank, lenders or major suppliers.|f
3.3.1|Schedule of inflows and outflows|Attach a schedule of all inflows into and outflows from your accounts during the review period.|f
3.3.2|General ledger|Attach the general ledger covering the review period.|f
3.3.3|Trial balance|Attach the trial balance(s) covering the review period.|f
3.3.4|Chart of accounts|Attach your organization's chart of accounts.|f
3.3.5|Approved annual budgets|Attach your approved annual budget for each year within the review period.|f
3.3.6|Schedule of expenditure|Attach a schedule of all expenditure incurred during the review period.|f
3.3.7|Supporting documents for expenditure|Attach (or make available) supporting documents for the expenditure listed above.|f
3.3.8|External audit management letters|Attach the management letters issued by your external auditors for the last two financial years.|f
3.4.1|Official bank account details for verification|Provide your organization’s official bank details: bank, account name and account number.|l
3.5.1|List of all bank accounts used by the organization|List every bank account used by your organization during the review period.|r
3.5.2|Bank statements|Attach statements for all the bank accounts listed above, covering the review period.|f
3.5.3|Bank reconciliation reports|Attach bank reconciliation reports for all the accounts listed above, covering the review period.|f
3.5.4|Bank confirmation|Will your organization authorize its banks to provide statements and confirmations directly to the auditors?|y
3.6.1|Financial policies, SOPs and internal control framework|Attach your financial policies, SOPs and internal control framework.|f
3.6.2|Delegation of authority framework|Attach your delegation of authority framework, including the approval matrix.|f
3.7.1|Payroll registers|Attach the monthly payroll registers for the review period, showing gross pay and deductions.|f
3.7.2|Staff contracts and salary scale|Attach your approved salary scale and make employment contracts available.|f
3.7.3|Timesheets / level of effort|Attach timesheets or level-of-effort records showing time charged to each donor-funded project.|f
3.8.1|Petty cash policy and cash counts|Attach your petty cash policy and records of cash counts during the review period.|f
3.8.2|Staff advances register|Attach the register of advances made to staff during the review period.|f
3.9.1|Income and revenue records|Attach a schedule of all income received during the review period.|f
3.9.2|Receivables and payables|Attach aged schedules of amounts owed to and by your organization at the end of the review period.|f
3.9.3|Loans, guarantees and commitments|List any loans, overdrafts, guarantees or other significant commitments of your organization.|l
3.10.1|Budget vs actual reports|Attach budget vs actual (variance) reports for each donor grant during the review period.|f
3.10.2|Cost allocation method|Attach your method for allocating shared costs (e.g. rent, staff, vehicles) across projects.|f
3.10.3|Exchange rate policy|Attach your policy on exchange rates used to record and report foreign-currency donor funds.|f
3.10.4|Travel, per diem, vehicle and fuel policies|Attach your travel, per diem, vehicle use and fuel management policies.|f
4.1.1|Procurement/supply chain policy and SOPs|Attach your procurement/supply chain policy and all related SOPs.|f
4.2.1|Vendor master file|Attach your electronic vendor master file (e.g. Excel).|f
4.3.1|Schedule of contracts awarded|Attach a schedule of all contracts awarded during the review period.|f
4.3.2|Supporting documents for contract awards|Attach (or make available) the supporting documents and approvals for contract awards.|f
5.1.1|Employees|How many employees does your organization employ?|n
5.1.2|Organizational chart or company profile|Attach your organizational chart or company profile.|f
5.1.3|Changes in management or financial staff|Have there been any changes in management or financial staff during the last 12 months?|y
5.1.4|Anticipated headcount|What do you anticipate your employee headcount to be 12 months from now?|n
5.1.5|Attrition rate (%)|What is the organization’s attrition rate?|n
5.1.6|Senior-management staff|How many senior-management staff does the organization employ?|n
5.1.7|Finance staff|How many finance staff does the organization employ?|n
5.2.1|Departmental/unit heads|Attach a list of departmental/unit heads with their contact information.|f
5.2.2|Employee list|Attach a list of all employees showing staff name, staff ID, address, email and telephone number.|f
5.2.3|Staff handbook|Attach your organization's Staff Handbook.|f
5.2.4|Performance management system|Attach details of your performance management system.|f
5.3.1|Recruitment policy and background checks|Attach your recruitment policy and evidence of reference and background checks.|f
5.3.2|Staff training records|Attach records of staff training during the review period.|f
5.4.1|Key project personnel|Provide a list of key personnel that will work with us on the project.|r
5.4.2|CVs of key personnel|Attach the CVs of the staff listed above.|f
5.5.1|Evidence of previous similar work|Attach evidence of previous similar work (e.g. case studies, project reports).|f
5.6.1|Current strategy document|Attach your organization's current strategy document.|f
5.6.2|Core and supporting processes|Attach a list of your core and supporting processes, including documented SOPs.|f
5.6.3|Key performance indicators|Attach the KPIs and performance ratings across all functions.|f
5.6.4|Asset register|Attach a schedule of all assets owned or managed by your organization.|f
5.7.1|Equipment logbooks|Attach logbooks for tractors and other equipment covering the review period.|f
5.7.2|Asset verification and disposals|Attach the most recent physical verification report of your assets.|f
5.7.3|Stock records|Attach stock records for spare parts, fuel and other consumables.|f
5.7.4|Insurance policies|Attach your current insurance policies, including cover for assets and equipment.|f
5.8.1|HSE policies and protocols|Attach a copy of your organization’s HSE Policy.|f
5.9.1|Labour policies|Attach a copy of your organization’s Labour and Employment Policy.|f
5.9.2|Compliance with international standards (e.g. ILO labour standards)|Explain the measures you have put in place to comply with international labour practices.|l
6.1.1|Partnership/grant agreements|Attach all partnership or grant agreements between your organization and its donors.|f
6.1.2|Proposals, budgets and workplans|Attach the proposal, budget and workplan relating to each agreement above.|f
6.1.3|Reports submitted to donors|Attach all reports submitted to donors during the review period.|f
6.2.1|Programs executed during the review period|List the programs executed, with a description, key milestones and results.|l
6.2.2|Workplans and methodology|Attach sample workplans and approach for major projects in each year of the review period.|f
6.2.3|Customer/beneficiary feedback reports|Attach customer or beneficiary feedback reports (if available).|f
6.3.1|Beneficiary records|Attach lists of farmers/beneficiaries served during the review period.|f
6.3.2|Monitoring and evaluation framework|Attach your results framework or logframe and indicator tracking tables.|f
6.3.3|Complaints and grievance log|Attach your grievance mechanism and the log of complaints received.|f
6.4.1|Subcontractors and sub-grantees|Attach a list of subcontractors and sub-grantees engaged during the review period.|f
7.1.1|ISO certifications or equivalent (if applicable)|Attach your organization’s ISO/NIS certificate or equivalent.|f
7.1.2|Procedures for quality assurance and monitoring|Briefly explain the quality management systems your organization has in place.|l
7.2.1|Measures to mitigate risks (financial, operational, environmental)|Attach your Financial Policy, Operations Manual and Environmental Policy.|f
7.2.2|Risk mitigation measures|Outline some of your organization’s risk mitigation measures.|l
7.2.3|Risk management policy|Attach your organization’s Risk Management Policy.|f
7.3.1|Risk assessment reports|Attach the risk assessment reports covering the review period.|f
7.3.2|Quarterly assurance reports to the Board|Attach quarterly reports to the Board from internal audit, risk and compliance.|f
7.3.3|Quarterly management reports to the Board|Attach the quarterly management reports made to the Board during the review period.|f
7.3.4|Crisis communication/management plan|Attach your crisis communication/management plan (if any).|f
7.4.1|Status of previous audit recommendations|Attach a tracker of recommendations from previous external audits and their status.|f
7.4.2|Donor audits, monitoring visits and spot-checks|Attach reports of donor audits, monitoring visits and spot-checks during the review period.|f
7.4.3|Internal audit|Attach your internal audit charter, plan and reports issued during the review period.|f
7.4.4|Fraud and incident register|Attach your register of fraud, theft, losses and other incidents during the review period.|f
7.5.1|Security plans for high-risk areas (if applicable)|If operating in conflict-prone or high-risk areas, attach your security protocols.|f
7.6.1|Accounting system|State the accounting software you use, and list the staff who have access to it.|l
7.6.2|IT and data security policy|Attach your IT and data security policy, including user access controls.|f
7.6.3|Backup and business continuity|Attach your data backup and disaster recovery or business continuity plan.|f
7.6.4|Records retention policy|Attach your records retention policy.|f
8.1.1|Policies on whistleblower protection|Attach your organization’s Whistleblower Protection Policy.|f
8.2.1|Bullying and harassment policy|Attach your organization's Bullying and Harassment Policy.|f
8.2.2|Reporting policy|Attach your policy for reporting misconduct, incidents and ethics concerns.|f
8.2.3|Code of conduct for the Board|Attach the Board code of conduct (if separate from the company code of conduct).|f
8.2.4|Violations of the code of conduct|Give details of any violations of the code of conduct during the review period.|l
8.3.1|Child Protection, Gender-Based Violence, and safeguarding mechanisms|Attach your policies on Gender-Based Violence, Child Protection and Safeguarding.|f
8.4.1|Commitment to gender equality and non-discrimination|Attach your Gender Diversity and Inclusion policy.|f
9.1.1|List of Directors|Attach a list of all Directors and their designations (e.g. Independent, Non-Executive).|f
9.1.2|Board appointments/re-elections|Attach a list of Board appointments and re-elections during the review period.|f
9.1.3|Directors' files|Attach each Director's file, including background checks from the appointment process.|f
9.1.4|Directors' declarations of interest|Attach each Director's annual declaration of financial interests/independence.|f
9.2.1|Board committees|Attach a list of Board committees, with chairpersons and members.|f
9.2.2|Board and committee charters|Attach the charters of the Board and each Board committee.|f
9.2.3|Management committees|Attach a list of management committees, with their charters and minutes.|f
9.2.4|Board and committee meeting records|Attach agendas, papers and minutes of Board and committee meetings.|f
9.3.1|Directors' remuneration policy|Attach your Directors' Remuneration Policy.|f
9.3.2|Clawback policy|Attach your organization's Clawback Policy.|f
9.3.3|Directors' remuneration schedule|Attach each Director's remuneration package and a breakdown of payments.|f
9.3.4|External remuneration consultants|Attach any correspondence from external remuneration consultants (if any).|f
9.4.1|Directors' evaluation policy|Attach your Directors' Evaluation Policy.|f
9.4.2|Board evaluation reports|Attach previous Board evaluation reports.|f
9.4.3|Succession planning policy|Attach your Succession Planning Policy.|f
9.4.4|Director induction and training|Attach details of induction and training programs held for Directors.|f
9.5.1|AGM procedures|Attach the procedures for the conduct of the Annual General Meeting (AGM).|f
9.5.2|Minutes of shareholders’ meetings|Attach the minutes of AGMs held during the review period.|f
9.5.3|Shareholders’ communications|Attach communications (e.g. letters) sent to shareholders.|f
10.1.1|Stakeholder engagement policy|Attach your Stakeholder Engagement Policy.|f
10.1.2|Corporate Social Responsibility (CSR)|Attach your CSR framework and reports made to stakeholders.|f
10.1.3|Sustainability strategy and policies|Attach the strategy, policies and procedures that guide sustainability.|f
10.1.4|Sustainability initiatives|Attach evidence of involvement in sustainability initiatives (if any).|f
11.1.1|References from past clients or donors|Provide at least three references from past clients or donors, with contact details.|r
11.1.2|Testimonials or certificates of satisfactory performance|Attach written testimonials or certificates of performance from past clients.|f
11.2.1|Experience in similar projects|List previous NGO projects, donor names, scope of work and budgets executed.|l`;

/** Parsed items: { ref, title, help, t, sec, sub } */
export const ITEMS = RAW.split('\n').map((l) => { const p = l.split('|'); const r = p[0].split('.'); return { ref: p[0], title: p[1], help: p[2], t: p[3], sec: +r[0], sub: r[0] + '.' + r[1] }; });

/** Items keyed by ref. */
export const BYREF = {}; ITEMS.forEach((i) => { BYREF[i.ref] = i; });

/** Conditional items: item ref -> controlling Yes/No item ref (shown only when that item = "Yes"). */
export const COND = { '1.2.4': '1.2.3', '3.1.2': '3.1.1' };

/** Yes/No items that ask for details when answered "Yes": item ref -> detail prompt. */
export const DETAIL = { '2.8.1': 'List and explain each matter, its current status and any financial exposure.', '5.1.3': 'Describe the changes and the roles affected.' };

/** Items that are not required ("If applicable"). */
export const OPTIONAL = { '1.0.2': 1, '6.2.3': 1, '7.1.1': 1, '7.3.4': 1, '7.5.1': 1, '8.2.3': 1, '9.3.4': 1, '10.1.4': 1 };

/** Column headings for repeating-table items. */
export const COLS = { '1.2.1': ['Name', 'Title', 'Email address'], '3.5.1': ['Bank', 'Account number', 'Currency'], '5.4.1': ['Name', 'Role on project', 'Years of experience'], '11.1.1': ['Organisation', 'Contact person', 'Email or phone'] };

/** Section intro text (others use DEFAULT_INTRO). */
export const INTRO = {
  1: 'Basic facts about your organisation. Use the details exactly as they appear on your registration documents.',
  2: 'Upload your legal, tax and statutory compliance documents. Where TracTrac already holds a document it is marked as provided, so you don’t need to upload it again.',
  3: 'Financial records should cover the review period, 1 Jan 2024 – 30 Jun 2026. Large ledgers can be split across several files.',
  12: 'This checklist fills itself from the documents you upload in Sections 1–11. Use it to confirm nothing is missing before you submit.'
};
export const DEFAULT_INTRO = 'Answer each item or upload the requested evidence. If an item does not apply, mark it Not applicable and say why.';

/** Section 12 checklist: [document name, ref of the requirement that satisfies it]. */
export const CHECK = [['Certificate of Incorporation', '2.1.1'], ['CAC Registration (Nigeria-specific)', '2.3.1'], ['Audited Financial Statements (last 2–3 years)', '3.1.2'], ['Bank Verification Documents', '3.2.2'], ['Certificate/Declaration of Solvency', '3.2.1'], ['Evidence of Tax Identification Number (TIN)', '2.1.2'], ['Tax Clearance Certificate', '2.1.3'], ['Contracts from Funding History', '6.1.1'], ['Credit References', '3.2.3'], ['Case Studies and Project Reports from Similar Work', '5.5.1'], ['Code of Conduct', '2.5.2'], ['Anti-Bribery Policy', '2.5.2'], ['Anti-Fraud and Corruption Policy', '2.6.1'], ['Child-Safeguarding and Gender-Based Violence Policies', '8.3.1'], ['Diversity and Inclusion Policy', '8.4.1'], ['Anti-terrorism and Money Laundering Policies', '2.7.2'], ['Health and Safety Policy', '5.8.1'], ['Labour Policy', '5.9.1'], ['ISO Certificate or Equivalent', '7.1.1'], ['Risk Management Policy', '7.2.3'], ['References from previous clients', '11.1.1'], ['Certificates of Performance/Testimonials', '11.1.2']];

/** Checkbox-group options (from itemVals() in the design). "Other" reveals an explanation field. */
export const CHOICES = { '1.0.5': ['Nonprofit', 'Private Firm', 'Other'] };
export const OTHER_OPTION = 'Other';

/** Select options for country items (type "s"), from the design's <select>. */
export const COUNTRY_OPTIONS = ['Nigeria', 'Ghana', 'Kenya', 'Other'];

/** Default columns for a repeating table with no COLS entry. */
export const DEFAULT_COLS = ['Name', 'Detail', 'Contact'];

export const CHECKLIST_SECTION = 12;
export const SECTION_COUNT = SECS.length;
