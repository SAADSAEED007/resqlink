import type { SOSDraft } from "./report";

type Language = "en" | "ur" | "sd";
const copy = {
  en: { title: "Is anyone in immediate danger?", optional: "Quick safety check · Optional", helper: "This helps coordinators understand how urgently the report may need review.", yes: "Yes, immediate danger", no: "No known immediate danger", unsure: "I'm not sure", clear: "Clear answer", questions: { FLOOD: "Are people trapped or in immediate danger from rising water?", MEDICAL: "Is anyone unconscious, not breathing normally, or facing an immediate life threat?", FIRE: "Are people trapped, injured, or threatened by a spreading fire?", STRANDED: "Is anyone seriously injured or trapped in a vehicle?", SUPPLIES: "Is anyone stranded in a dangerous situation or unable to reach safety?", OTHER: "Is anyone currently facing an immediate threat to life or serious injury?" } },
  ur: { title: "کیا کسی کی جان کو فوری خطرہ ہے؟", optional: "فوری حفاظتی سوال · اختیاری", helper: "اس سے رابطہ کار کو رپورٹ کی فوری نوعیت سمجھنے میں مدد ملتی ہے۔", yes: "ہاں، فوری خطرہ ہے", no: "کسی فوری خطرے کا علم نہیں", unsure: "یقین نہیں", clear: "جواب ہٹائیں", questions: { FLOOD: "کیا لوگ پھنسے ہوئے ہیں یا بڑھتے پانی سے فوری خطرے میں ہیں؟", MEDICAL: "کیا کوئی بے ہوش ہے، معمول کے مطابق سانس نہیں لے رہا، یا اس کی جان کو فوری خطرہ ہے؟", FIRE: "کیا لوگ پھنسے ہوئے، زخمی یا پھیلتی آگ سے خطرے میں ہیں؟", STRANDED: "کیا کوئی شدید زخمی ہے یا گاڑی میں پھنسا ہوا ہے؟", SUPPLIES: "کیا کوئی خطرناک جگہ پھنسا ہوا ہے یا محفوظ مقام تک نہیں پہنچ سکتا؟", OTHER: "کیا کسی کی جان کو فوری خطرہ یا شدید چوٹ کا خدشہ ہے؟" } },
  sd: { title: "ڇا ڪنهن جي جان کي فوري خطرو آهي؟", optional: "تڪڙو حفاظتي سوال · اختياري", helper: "هي رابطاڪار کي رپورٽ جي تڪڙ سمجهڻ ۾ مدد ڪري ٿو۔", yes: "ها، فوري خطرو آهي", no: "ڪنهن فوري خطري جي ڄاڻ ناهي", unsure: "پڪ ناهي", clear: "جواب هٽايو", questions: { FLOOD: "ڇا ماڻهو ڦاٿل آهن يا وڌندڙ پاڻي کان فوري خطري ۾ آهن؟", MEDICAL: "ڇا ڪو بيهوش آهي، عام طرح ساهه نٿو کڻي، يا سندس جان کي فوري خطرو آهي؟", FIRE: "ڇا ماڻهو ڦاٿل، زخمي يا پکڙجندڙ باهه کان خطري ۾ آهن؟", STRANDED: "ڇا ڪو سخت زخمي آهي يا گاڏي ۾ ڦاٿل آهي؟", SUPPLIES: "ڇا ڪو خطرناڪ هنڌ ڦاٿل آهي يا محفوظ هنڌ تائين نٿو پهچي سگهي؟", OTHER: "ڇا ڪنهن جي جان کي فوري خطرو يا سخت زخمي ٿيڻ جو انديشو آهي؟" } },
};

export function QuickSafetyCheck({ draft, language, onChange }: { draft: SOSDraft; language: Language; onChange: (patch: Partial<SOSDraft>) => void }) {
  if (!draft.emergencyType) return null;
  const t = copy[language];
  const answer = draft.safetyEmergencyType === draft.emergencyType ? draft.safetyAnswer : "UNANSWERED";
  return <fieldset className="rqSafetyInline" key={draft.emergencyType}>
    <legend>{t.title}</legend><span className="rqSafetyOptional">{t.optional}</span>
    <p className="rqSafetyQuestion">{t.questions[draft.emergencyType]}</p>
    <div className="rqSafetyOptions">{([["YES", t.yes], ["NO", t.no], ["UNSURE", t.unsure]] as const).map(([value, label]) => <label key={value}>
      <input type="radio" name="safety-answer" value={value} checked={answer === value} onChange={() => onChange({ safetyAnswer: value, safetyEmergencyType: draft.emergencyType })} />
      <span>{label}</span>
    </label>)}</div>
    <div className="rqSafetyHelper"><small>{t.helper}</small>{answer !== "UNANSWERED" && <button type="button" onClick={() => onChange({ safetyAnswer: "UNANSWERED", safetyEmergencyType: draft.emergencyType })}>{t.clear}</button>}</div>
  </fieldset>;
}
