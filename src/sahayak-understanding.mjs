const TOPICS = [
  ['eligibility', /\b(eligibility|eligible|eligibility percentage|eligibility score|criteria satisfied|application assessment|अनुपात्रता|पात्रता|पात्र|योग्यता)\b/i],
  ['document_verification', /\b(document|documents|file|files|evidence|दस्तावेज़?|फाइल|फ़ाइल|साक्ष्य)\b.{0,50}\b(verification|verify|verified|issue|problem|status|expiry|expire|सत्यापन|सत्यापित|समस्या|समस्याएँ|गायब|लापता)\b|\b(verification|verify|verified|सत्यापन|सत्यापित)\b.{0,50}\b(document|documents|file|files|दस्तावेज़?|फाइल|फ़ाइल|साक्ष्य)\b/i],
  ['compliance', /\b(compliance|compliant|rule evaluation|rule evaluations|failed? rules?|passed? rules?|regulatory rule|अनुपालन|विनियम|नियम)\b/i],
  ['verification', /\b(source verifications?|verification results?|verification status|verify|verified|source checks?|स्रोत सत्यापन|सत्यापन स्थिति)\b/i],
  ['findings', /\b(findings?|issues?|problems?|flags?|needs attention|निष्कर्ष|समस्या|समस्याएँ|मुद्दे|ध्यान देने योग्य)\b/i],
  ['rectifications', /\b(rectifications?|responses?|corrective action|सुधार|जवाब|प्रतिक्रिया)\b/i],
  ['inspections', /\b(inspections?|recommendations?|निरीक्षण)\b/i],
  ['infrastructure', /\b(infrastructure|facilities|facility|building|laborator(?:y|ies)|lab|भवन|बुनियादी ढांचा|सुविधाएँ?)\b/i],
  ['faculty', /\b(faculty|faculties|teachers?|staff|student.?teacher ratio|faculty.?student ratio|छात्र.?शिक्षक अनुपात|शिक्षक|संकाय)\b/i],
  ['programmes', /\b(programmes?|courses?|intake|कोर्स|पाठ्यक्रम|कार्यक्रम|इनटेक)\b/i],
  ['documents', /\b(documents?|files?|evidence|दस्तावेज़?|फाइल|फ़ाइल|साक्ष्य)\b/i],
  ['applications', /\b(applications?|work queue|आवेदन|कार्य कतार)\b/i],
  ['approval', /\b(approval|approved|approvals|sanction|मंज़ूरी|अनुमोदन|स्वीकृति)\b/i],
  ['audit', /\b(audit|history|activity history|audit trail|इतिहास|ऑडिट)\b/i],
  ['institution', /\b(institutions?|colleges?|universities|university|institute|संस्था|संस्थान|कॉलेज|विश्वविद्यालय)\b/i],
];

const STATUS_PATTERNS = [
  ['FAILED', /\b(failed?|failure|not passed|गैर.?अनुपालक|विफल|असफल)\b/i],
  ['PASS', /(?<!not )\b(passed?|pass|compliant|उत्तीर्ण|अनुपालक)\b/i],
  ['PENDING', /\b(pending|awaiting|not yet|लंबित|प्रतीक्षारत)\b/i],
  ['MISSING', /\b(missing|absent|not received|not submitted|गायब|लापता|अनुपलब्ध)\b/i],
  ['OVERDUE', /\b(overdue|late|past due|समय.?सीमा पार)\b/i],
  ['RESOLVED', /\b(resolved|closed|निस्तारित|हल हो गया)\b/i],
  ['OPEN', /\b(open|unresolved|अधूरे|खुले)\b/i],
];

const OPERATIONS = [
  ['compare', /\b(compare|comparison|versus|vs\.?|difference between|तुलना|बनाम)\b/i],
  ['next_steps', /\b(what should i do next|what next|next step|next steps|what do i do now|अगला कदम|अब क्या करूँ|आगे क्या)\b/i],
  ['page_explanation', /\b(explain this page|what is this page|what does this page|describe this page|explain the current page|इस पेज के बारे में|यह पेज क्या)\b/i],
  ['count', /\b(how many|count|number of|कितने|कितनी|कुल संख्या)\b/i],
  ['summarize', /\b(summary|summari[sz]e|overview|tell me about|सारांश|संक्षेप)\b/i],
  ['explain', /\b(why|explain|what does|meaning|क्यों|समझाइए|बताइए)\b/i],
  ['navigate', /\b(where|how do i|how can i|how to|open the|which page|navigate|कहाँ|कैसे खोल|किस पेज)\b/i],
  ['history', /\b(history|historical|previous|earlier|audit trail|इतिहास|पहले के)\b/i],
  ['changes', /\b(what changed|changes since|changed since|updates since|क्या बदला|बदलाव)\b/i],
  ['search', /\b(search|find|look up|locate|खोज|ढूँढ|ढूंढ)\b/i],
  ['list', /\b(list|show|display|which ones|कौन से|कौन-कौन)\b/i],
  ['retrieve', /\b(get|retrieve|give me|देखें|दिखाएँ|जानकारी)\b/i],
];

const HINDI_TOPICS = [
  ['eligibility', /पात्रता|पात्र|योग्यता/u],
  ['document_verification', /दस्तावेज़?\s*(का|की|के)?\s*(सत्यापन|सत्यापित|जाँच|जांच)/u],
  ['compliance', /अनुपालन|विनियम|नियम/u], ['verification', /स्रोत सत्यापन|सत्यापन|सत्यापित/u],
  ['findings', /निष्कर्ष|समस्याएँ|समस्या|मुद्दे|ध्यान देने योग्य/u],
  ['rectifications', /सुधार|जवाब|प्रतिक्रिया/u], ['inspections', /निरीक्षण/u],
  ['infrastructure', /बुनियादी ढांचा|सुविधाएँ?|भवन|प्रयोगशाला/u], ['faculty', /संकाय|शिक्षक|छात्र.?शिक्षक अनुपात/u],
  ['programmes', /पाठ्यक्रम|कार्यक्रम|कोर्स|इनटेक/u], ['documents', /दस्तावेज़?|फ़ाइल|फाइल|साक्ष्य/u],
  ['applications', /आवेदन|कार्य कतार/u], ['approval', /मंज़ूरी|अनुमोदन|स्वीकृति/u],
  ['audit', /ऑडिट|इतिहास/u], ['institution', /संस्था|संस्थान|कॉलेज|विश्वविद्यालय/u],
];
const HINDI_STATUSES = [
  ['FAILED', /विफल|असफल|गैर.?अनुपालक/u], ['PASS', /उत्तीर्ण|अनुपालक/u],
  ['PENDING', /लंबित|प्रतीक्षारत/u], ['MISSING', /गायब|लापता|अनुपलब्ध/u],
  ['OVERDUE', /समय.?सीमा पार/u], ['RESOLVED', /निस्तारित|हल हो गया/u], ['OPEN', /खुले|अधूरे/u],
];
const HINDI_OPERATIONS = [
  ['next_steps', /अगला कदम|अब क्या करूँ|आगे क्या/u], ['page_explanation', /इस पेज के बारे में|यह पेज क्या/u],
  ['compare', /तुलना|बनाम/u], ['count', /कितने|कितनी|कुल संख्या/u], ['summarize', /सारांश|संक्षेप/u],
  ['explain', /क्यों|समझाइए|बताइए/u], ['navigate', /कहाँ|कैसे खोल|किस पेज/u],
  ['history', /इतिहास|पिछले/u], ['changes', /क्या बदला|बदलाव/u], ['search', /खोज|ढूँढ|ढूंढ/u],
  ['list', /कौन से|कौन-कौन|दिखाएँ|दिखाइए/u], ['retrieve', /जानकारी|देखें/u],
];

const STATES = [
  ['Andhra Pradesh', /\bandhra\s+pradesh\b|आंध्र प्रदेश/i], ['Arunachal Pradesh', /\barunachal\s+pradesh\b|अरुणाचल प्रदेश/i],
  ['Assam', /\bassam\b|असम/i], ['Bihar', /\bbihar\b|बिहार/i], ['Chhattisgarh', /\bchhattisgarh\b|छत्तीसगढ़/i],
  ['Goa', /\bgoa\b|गोवा/i], ['Gujarat', /\bgujarat\b|गुजरात/i], ['Haryana', /\bharyana\b|हरियाणा/i],
  ['Himachal Pradesh', /\bhimachal\s+pradesh\b|हिमाचल प्रदेश/i], ['Jharkhand', /\bjharkhand\b|झारखंड/i],
  ['Karnataka', /\bkarnataka\b|कर्नाटक/i], ['Kerala', /\bkerala\b|केरल/i], ['Madhya Pradesh', /\bmadhya\s+pradesh\b|मध्य प्रदेश/i],
  ['Maharashtra', /\bmaharashtra\b|महाराष्ट्र/i], ['Manipur', /\bmanipur\b|मणिपुर/i], ['Meghalaya', /\bmeghalaya\b|मेघालय/i],
  ['Mizoram', /\bmizoram\b|मिजोरम/i], ['Nagaland', /\bnagaland\b|नागालैंड/i], ['Odisha', /\bodisha\b|\borissa\b|ओडिशा/i],
  ['Punjab', /\bpunjab\b|पंजाब/i], ['Rajasthan', /\brajasthan\b|राजस्थान/i], ['Sikkim', /\bsikkim\b|सिक्किम/i],
  ['Tamil Nadu', /\btamil\s+nadu\b|तमिलनाडु/i], ['Telangana', /\btelangana\b|तेलंगाना/i], ['Tripura', /\btripura\b|त्रिपुरा/i],
  ['Uttar Pradesh', /\buttar\s+pradesh\b|उत्तर प्रदेश/i], ['Uttarakhand', /\buttarakhand\b|उत्तराखंड/i],
  ['West Bengal', /\bwest\s+bengal\b|पश्चिम बंगाल/i], ['Delhi', /\bdelhi\b|दिल्ली/i], ['Jammu and Kashmir', /\bjammu\s+(and|&)\s+kashmir\b|जम्मू और कश्मीर/i],
];

export function interpretSahayakRequest(input) {
  const message = String(input || '').normalize('NFKC').slice(0, 2000);
  const topics = [...TOPICS.filter(([, pattern]) => pattern.test(message)).map(([topic]) => topic), ...HINDI_TOPICS.filter(([, pattern]) => pattern.test(message)).map(([topic]) => topic)];
  if (topics.includes('faculty') && /\b(faculty.?student|student.?faculty|student.?teacher|teacher.?student)\s+ratio\b|छात्र.?शिक्षक अनुपात/u.test(message) && !topics.includes('compliance')) topics.push('compliance');
  const statuses = [...STATUS_PATTERNS.filter(([, pattern]) => pattern.test(message)).map(([status]) => status), ...HINDI_STATUSES.filter(([, pattern]) => pattern.test(message)).map(([status]) => status)];
  const operations = [...OPERATIONS.filter(([, pattern]) => pattern.test(message)).map(([operation]) => operation), ...HINDI_OPERATIONS.filter(([, pattern]) => pattern.test(message)).map(([operation]) => operation)];
  const cleanStatuses = [...new Set(statuses)];
  if (/\b(did not pass|not passed|did not meet)\b/i.test(message)) {
    const passIndex = cleanStatuses.indexOf('PASS');
    if (passIndex >= 0) cleanStatuses.splice(passIndex, 1);
    if (!cleanStatuses.includes('FAILED')) cleanStatuses.push('FAILED');
  }
  const yearMatches = [...message.matchAll(/\b(20\d{2})[-/](\d{2})\b/g)].map((match) => `${match[1]}-${match[2]}`);
  const state = STATES.find(([, pattern]) => pattern.test(message))?.[0] || '';
  const timeframe = /\b(latest|most recent|current|currently|आज|वर्तमान|नवीनतम)\b/i.test(message) ? 'current'
    : /\b(historical|history|previous|earlier|past|इतिहास|पिछले)\b/i.test(message) ? 'historical' : '';
  return {
    language: /[\u0900-\u097f]/u.test(message) ? 'hi' : 'en',
    operations: [...new Set(operations)],
    topics: [...new Set(topics)],
    filters: { statuses: cleanStatuses, academicYears: [...new Set(yearMatches)], state, timeframe },
  };
}

export function standardizeSahayakReason(reason) {
  const aliases = {
    NOT_IN_DATASET: 'NOT_FOUND',
    UNSUPPORTED_REQUEST: 'UNSUPPORTED_OPERATION',
    UNSUPPORTED: 'UNSUPPORTED_OPERATION',
    AMBIGUOUS: 'AMBIGUOUS_REQUEST',
    FORBIDDEN: 'ACCESS_RESTRICTED',
    PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
    AI_PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  };
  const value = String(reason || '').trim().toUpperCase();
  if (!value) return '';
  const normalized = aliases[value] || value;
  const allowed = new Set([
    'NOT_FOUND', 'NO_ASSOCIATED_RECORD', 'EVIDENCE_NOT_AVAILABLE', 'PROCESSING_PENDING',
    'INSUFFICIENT_DATA', 'ACCESS_RESTRICTED', 'PROVIDER_UNAVAILABLE', 'SERVICE_UNAVAILABLE',
    'AMBIGUOUS_REQUEST', 'INVALID_IDENTIFIER', 'UNSUPPORTED_OPERATION',
  ]);
  return allowed.has(normalized) ? normalized : 'SERVICE_UNAVAILABLE';
}

